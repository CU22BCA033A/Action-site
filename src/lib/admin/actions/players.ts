"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { parseCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { basePriceFor } from "@/lib/domain/auctions";
import { bumpAndRefresh, callEngine, runAndBroadcast } from "@/lib/live/engine";
import { sportConfigSchema, type SportConfig } from "@/lib/sports/config";
import { deleteImage, storeImage, UploadError } from "@/lib/storage";
import { isUnder18, playerInputSchema, sportProblems, validateCsvRows, type CsvRowResult } from "../player-input";
import { invalid, type ActionResult } from "../result";

async function auctionContext(auctionId: string) {
  const rows = await db()<{ id: string; status: string; sportId: string; config: unknown; categoryPrices: Record<string, number>; defaultBase: number }[]>`
    select a.id, a.status, a.sport_id as "sportId", s.config, a.category_base_prices as "categoryPrices", a.default_base_price as "defaultBase"
    from app.auctions a join app.sports s on s.id = a.sport_id where a.id = ${auctionId} and a.deleted_at is null`;
  const a = rows[0];
  if (!a) return null;
  return { ...a, config: sportConfigSchema.parse(a.config) as SportConfig };
}

const revalidate = (auctionId: string) => revalidatePath(`/admin/auctions/${auctionId}`, "layout");

const formSchema = z.object({
  auctionId: z.uuid(),
  auctionPlayerId: z.string().optional(),
  version: z.coerce.number().int().optional(),
  basePrice: z.string().trim().optional(),
  setName: z.string().trim().min(1, "Enter a set name.").max(40),
  setOrder: z.coerce.number().int("Use a whole number.").min(0).max(999),
  removePhoto: z.string().optional(),
  player: z.string(),
});

export async function savePlayerAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = formSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const f = parsed.data;
  let playerJson: unknown;
  try {
    playerJson = JSON.parse(f.player);
  } catch {
    return { ok: false, error: "The form could not be read. Reload and try again." };
  }
  const p = playerInputSchema.safeParse(playerJson);
  if (!p.success) return invalid(p.error);
  const ctx = await auctionContext(f.auctionId);
  if (!ctx) return { ok: false, error: "Auction not found." };
  const problems = sportProblems(ctx.config, p.data);
  if (Object.keys(problems).length) return { ok: false, error: "Fix the highlighted fields.", fieldErrors: problems };
  if (isUnder18(p.data.dateOfBirth) && !p.data.guardianConsent) {
    return { ok: false, error: "This player is under 18. Confirm guardian consent before saving.", fieldErrors: { guardianConsent: "Required for players under 18." } };
  }
  const basePrice = f.basePrice ? Number(f.basePrice) : basePriceFor(p.data.category, ctx.categoryPrices, ctx.defaultBase);
  if (!Number.isInteger(basePrice) || basePrice < 0) return { ok: false, error: "Check the base price.", fieldErrors: { basePrice: "Use a whole number of zero or more." } };

  let photoPath: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    try {
      photoPath = await storeImage(photo, "player");
    } catch (e) {
      const msg = e instanceof UploadError ? e.message : "The photo could not be saved.";
      return { ok: false, error: msg, fieldErrors: { photo: msg } };
    }
  }

  const sql = db();
  const v = p.data;
  if (!f.auctionPlayerId) {
    await sql.begin(async (tx) => {
      const pl = await tx<{ id: string }[]>`
        insert into app.players(sport_id, full_name, role_key, sub_role, category, tags, nationality_group, stats, bio_short, photo_path,
          date_of_birth, guardian_consent, guardian_consent_at)
        values (${ctx.sportId}, ${v.fullName}, ${v.roleKey}, ${v.subRole}, ${v.category}, ${v.tags}, ${v.nationalityGroup}, ${tx.json(v.stats)},
          ${v.bioShort}, ${photoPath ?? null}, ${v.dateOfBirth}, ${v.guardianConsent}, ${v.guardianConsent ? new Date() : null})
        returning id`;
      const ap = await tx<{ id: string }[]>`
        insert into app.auction_players(auction_id, player_id, base_price, set_name, set_order, queue_position)
        values (${f.auctionId}, ${pl[0]!.id}, ${basePrice}, ${f.setName}, ${f.setOrder},
          (select coalesce(max(queue_position), 0) + 1 from app.auction_players where auction_id = ${f.auctionId}))
        returning id`;
      await tx`select app._audit(${f.auctionId}, 'admin', ${admin.actorId}, 'player.create', 'auction_player', ${ap[0]!.id}, null,
        ${tx.json({ name: v.fullName, base_price: basePrice })}, null)`;
    });
    await bumpAndRefresh(f.auctionId);
    revalidate(f.auctionId);
    return { ok: true, message: `${v.fullName} added.` };
  }

  const current = (await sql<{ playerId: string; status: string; version: number; photoPath: string | null; basePrice: number; name: string }[]>`
    select p.id as "playerId", ap.status, p.version::int as version, p.photo_path as "photoPath", ap.base_price as "basePrice", p.full_name as name
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.id = ${f.auctionPlayerId} and ap.auction_id = ${f.auctionId}`)[0];
  if (!current) return { ok: false, error: "Player not found." };
  if (f.version !== undefined && f.version !== current.version) {
    if (photoPath) await deleteImage(photoPath);
    return { ok: false, code: "STALE", error: "This player was changed elsewhere. Reload to see it." };
  }
  if (current.status === "on_floor" && basePrice !== current.basePrice) {
    if (photoPath) await deleteImage(photoPath);
    return { ok: false, error: "This player is on the floor. Change the base price after they leave the floor.", fieldErrors: { basePrice: "Locked while on the floor." } };
  }
  const newPhoto = photoPath ?? (f.removePhoto === "1" ? null : current.photoPath);
  const ok = await sql.begin(async (tx) => {
    const rows = await tx`
      update app.players set full_name = ${v.fullName}, role_key = ${v.roleKey}, sub_role = ${v.subRole}, category = ${v.category}, tags = ${v.tags},
        nationality_group = ${v.nationalityGroup}, stats = ${tx.json(v.stats)}, bio_short = ${v.bioShort}, photo_path = ${newPhoto},
        date_of_birth = ${v.dateOfBirth}, guardian_consent = ${v.guardianConsent},
        guardian_consent_at = case when ${v.guardianConsent ?? false} then coalesce(guardian_consent_at, now()) else null end,
        version = version + 1
      where id = ${current.playerId} and version = ${current.version} returning id`;
    if (!rows[0]) return false;
    if (current.status === "pool" || current.status === "unsold") {
      await tx`update app.auction_players set base_price = ${basePrice}, set_name = ${f.setName}, set_order = ${f.setOrder}, version = version + 1 where id = ${f.auctionPlayerId!}`;
    } else {
      await tx`update app.auction_players set set_name = ${f.setName}, set_order = ${f.setOrder}, version = version + 1 where id = ${f.auctionPlayerId!}`;
    }
    await tx`select app._audit(${f.auctionId}, 'admin', ${admin.actorId}, 'player.update', 'auction_player', ${f.auctionPlayerId!},
      ${tx.json({ name: current.name, base_price: current.basePrice })}, ${tx.json({ name: v.fullName, base_price: basePrice })}, null)`;
    return true;
  });
  if (!ok) return { ok: false, code: "STALE", error: "This player was changed elsewhere. Reload to see it." };
  if (newPhoto !== current.photoPath) await deleteImage(current.photoPath);
  await bumpAndRefresh(f.auctionId);
  revalidate(f.auctionId);
  return { ok: true, message: `${v.fullName} saved.` };
}

/** Sets a player's photo from a separate upload (used by bulk photo matching). */
export async function setPlayerPhotoAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const auctionId = String(formData.get("auctionId") ?? "");
  const auctionPlayerId = String(formData.get("auctionPlayerId") ?? "");
  const photo = formData.get("photo");
  if (!(photo instanceof File)) return { ok: false, error: "No photo." };
  const sql = db();
  const row = (await sql<{ playerId: string; photoPath: string | null }[]>`
    select p.id as "playerId", p.photo_path as "photoPath" from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.id = ${auctionPlayerId} and ap.auction_id = ${auctionId}`)[0];
  if (!row) return { ok: false, error: "Player not found." };
  let key: string;
  try {
    key = await storeImage(photo, "player");
  } catch (e) {
    return { ok: false, error: e instanceof UploadError ? e.message : "Upload failed." };
  }
  await sql`update app.players set photo_path = ${key}, version = version + 1 where id = ${row.playerId}`;
  await sql`select app._audit(${auctionId}, 'admin', ${admin.actorId}, 'player.photo', 'auction_player', ${auctionPlayerId}, null, null, null)`;
  await deleteImage(row.photoPath);
  revalidate(auctionId);
  return { ok: true };
}

const bulkSchema = z.object({
  auctionId: z.uuid(),
  ids: z.array(z.uuid()).min(1, "Select at least one player.").max(1000),
  action: z.enum(["set", "basePrice", "delete"]),
  setName: z.string().trim().max(40).optional(),
  setOrder: z.number().int().min(0).max(999).optional(),
  basePrice: z.number().int().min(0).optional(),
});

/** Bulk changes apply only to players still in the pool or unsold. */
export async function bulkPlayersAction(input: z.input<typeof bulkSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const b = parsed.data;
  const sql = db();
  if (b.action === "delete") {
    // Delete works on any player: sold players refund their team, a player on the floor is taken off it.
    const photos = await sql<{ photoPath: string | null }[]>`
      select p.photo_path as "photoPath" from app.auction_players ap join app.players p on p.id = ap.player_id
      where ap.auction_id = ${b.auctionId} and ap.id = any(${b.ids}::uuid[])`;
    const res = await runAndBroadcast(b.auctionId, "admin_delete_players", [b.auctionId, b.ids, admin.actorId]);
    if (!res.ok) return { ok: false, error: res.message };
    for (const ph of photos) await deleteImage(ph.photoPath);
    revalidate(b.auctionId);
    return { ok: true, message: res.message };
  }
  const eligible = await sql<{ id: string; playerId: string; photoPath: string | null; bids: number }[]>`
    select ap.id, ap.player_id as "playerId", p.photo_path as "photoPath",
      (select count(*)::int from app.bids x where x.auction_player_id = ap.id) as bids
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = ${b.auctionId} and ap.id = any(${b.ids}::uuid[]) and ap.status in ('pool','unsold')`;
  const skipped = b.ids.length - eligible.length;
  if (eligible.length === 0) return { ok: false, error: "None of the selected players can be changed. Only players in the pool or unsold can." };
  const ids = eligible.map((e) => e.id);
  let message = "";
  if (b.action === "set") {
    if (!b.setName) return { ok: false, error: "Enter a set name.", fieldErrors: { setName: "Enter a set name." } };
    await sql`update app.auction_players set set_name = ${b.setName}, set_order = ${b.setOrder ?? 1}, version = version + 1 where id = any(${ids}::uuid[])`;
    message = `${ids.length} players moved to ${b.setName}.`;
  } else if (b.action === "basePrice") {
    if (b.basePrice === undefined) return { ok: false, error: "Enter a base price.", fieldErrors: { basePrice: "Enter a base price." } };
    await sql`update app.auction_players set base_price = ${b.basePrice}, version = version + 1 where id = any(${ids}::uuid[])`;
    message = `Base price set for ${ids.length} players.`;
  }
  await sql`select app._audit(${b.auctionId}, 'admin', ${admin.actorId}, ${`player.bulk_${b.action}`}, 'auction', ${b.auctionId}, null,
    ${sql.json({ count: ids.length, set_name: b.setName ?? null, base_price: b.basePrice ?? null })}, null)`;
  await bumpAndRefresh(b.auctionId);
  revalidate(b.auctionId);
  return { ok: true, message: skipped ? `${message} ${skipped} sold, retained or on-floor players were skipped.` : message };
}

export type ImportReport = { valid: number; invalid: number; rows: Pick<CsvRowResult, "line" | "ok" | "errors">[]; headerErrors: string[]; imported?: number; created?: { id: string; name: string; lotNo: number }[] };

/** Validates the CSV and, when commit is true, imports every valid row in one transaction. */
export async function importPlayersCsvAction(input: { auctionId: string; csv: string; commit: boolean }): Promise<ActionResult<ImportReport>> {
  const admin = await requireAdmin();
  if (input.csv.length > 2_000_000) return { ok: false, error: "That file is too large. Split it into files of up to 1,000 players." };
  const ctx = await auctionContext(input.auctionId);
  if (!ctx) return { ok: false, error: "Auction not found." };
  const { results, headerErrors } = validateCsvRows(parseCsv(input.csv), ctx.config);
  const report: ImportReport = {
    valid: results.filter((r) => r.ok).length,
    invalid: results.filter((r) => !r.ok).length,
    rows: results.map(({ line, ok, errors }) => ({ line, ok, errors })),
    headerErrors,
  };
  if (!input.commit || headerErrors.length || report.valid === 0) return { ok: true, data: report };

  const sql = db();
  const created = await sql.begin(async (tx) => {
    const out: { id: string; name: string; lotNo: number }[] = [];
    let pos = (await tx<{ m: number }[]>`select coalesce(max(queue_position), 0)::int as m from app.auction_players where auction_id = ${input.auctionId}`)[0]!.m;
    for (const r of results) {
      if (!r.ok || !r.value) continue;
      const v = r.value;
      const pl = await tx<{ id: string }[]>`
        insert into app.players(sport_id, full_name, role_key, sub_role, category, tags, nationality_group, stats, bio_short,
          date_of_birth, guardian_consent, guardian_consent_at)
        values (${ctx.sportId}, ${v.fullName}, ${v.roleKey}, ${v.subRole}, ${v.category}, ${v.tags}, ${v.nationalityGroup}, ${tx.json(v.stats)},
          ${v.bioShort}, ${v.dateOfBirth}, ${v.guardianConsent}, ${v.guardianConsent ? new Date() : null})
        returning id`;
      const ap = await tx<{ id: string; lotNo: number }[]>`
        insert into app.auction_players(auction_id, player_id, base_price, set_name, set_order, queue_position)
        values (${input.auctionId}, ${pl[0]!.id}, ${v.basePrice ?? basePriceFor(v.category, ctx.categoryPrices, ctx.defaultBase)}, ${v.setName}, ${v.setOrder}, ${++pos})
        returning id, lot_no as "lotNo"`;
      out.push({ id: ap[0]!.id, name: v.fullName, lotNo: ap[0]!.lotNo });
    }
    await tx`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'player.import', 'auction', ${input.auctionId}, null,
      ${tx.json({ imported: out.length, skipped: report.invalid })}, null)`;
    return out;
  });
  await bumpAndRefresh(input.auctionId);
  revalidate(input.auctionId);
  return { ok: true, message: `${created.length} players imported.`, data: { ...report, imported: created.length, created } };
}

export async function retainPlayerAction(input: { auctionId: string; auctionPlayerId: string; teamId: string; price: number }): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!Number.isInteger(input.price) || input.price < 0) return { ok: false, error: "Enter a whole-number price.", fieldErrors: { price: "Use zero or more." } };
  const res = await callEngine("retain_player", [input.auctionId, input.auctionPlayerId, input.teamId, input.price, admin.actorId]);
  if (res.ok) {
    await bumpAndRefresh(input.auctionId);
    revalidate(input.auctionId);
  }
  return res.ok ? { ok: true, message: res.message } : { ok: false, code: res.code, error: res.message };
}
