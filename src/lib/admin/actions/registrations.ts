"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { basePriceFor } from "@/lib/domain/auctions";
import { bumpAndRefresh } from "@/lib/live/engine";
import { sportConfigSchema } from "@/lib/sports/config";
import { deleteImage } from "@/lib/storage";
import { isUnder18, playerInputSchema, sportProblems } from "../player-input";
import { invalid, type ActionResult } from "../result";

const approveSchema = z.object({
  auctionId: z.uuid(),
  registrationId: z.uuid(),
  version: z.number().int(),
  player: playerInputSchema,
  setName: z.string().trim().min(1).max(40),
  setOrder: z.number().int().min(0).max(999),
  basePrice: z.number().int().min(0).nullable(),
});

export async function approveRegistrationAction(input: z.input<typeof approveSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = approveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const sql = db();
  const ctx = (await sql<{ sportId: string; config: unknown; categoryPrices: Record<string, number>; defaultBase: number; status: string }[]>`
    select a.sport_id as "sportId", s.config, a.category_base_prices as "categoryPrices", a.default_base_price as "defaultBase", a.status
    from app.auctions a join app.sports s on s.id = a.sport_id where a.id = ${v.auctionId}`)[0];
  if (!ctx) return { ok: false, error: "Auction not found." };
  const problems = sportProblems(sportConfigSchema.parse(ctx.config), v.player);
  if (Object.keys(problems).length) return { ok: false, error: "Fix the highlighted fields.", fieldErrors: problems };
  if (isUnder18(v.player.dateOfBirth) && !v.player.guardianConsent) {
    return { ok: false, error: "This player is under 18 and has no guardian consent. Reject the registration or record consent first.", fieldErrors: { guardianConsent: "Required for players under 18." } };
  }
  const price = v.basePrice ?? basePriceFor(v.player.category, ctx.categoryPrices, ctx.defaultBase);
  const result = await sql.begin(async (tx) => {
    const reg = (await tx<{ photoPath: string | null; status: string; version: number }[]>`
      select photo_path as "photoPath", status, version::int as version from app.player_registrations
      where id = ${v.registrationId} and auction_id = ${v.auctionId} for update`)[0];
    if (!reg) return "missing" as const;
    if (reg.version !== v.version) return "stale" as const;
    if (reg.status !== "pending") return "done" as const;
    const p = v.player;
    const pl = await tx<{ id: string }[]>`
      insert into app.players(sport_id, full_name, role_key, sub_role, category, tags, nationality_group, stats, bio_short, photo_path,
        date_of_birth, guardian_consent, guardian_consent_at, source_registration_id)
      values (${ctx.sportId}, ${p.fullName}, ${p.roleKey}, ${p.subRole}, ${p.category}, ${p.tags}, ${p.nationalityGroup}, ${tx.json(p.stats)},
        ${p.bioShort}, ${reg.photoPath}, ${p.dateOfBirth}, ${p.guardianConsent}, ${p.guardianConsent ? new Date() : null}, ${v.registrationId})
      returning id`;
    await tx`insert into app.auction_players(auction_id, player_id, base_price, set_name, set_order, queue_position)
      values (${v.auctionId}, ${pl[0]!.id}, ${price}, ${v.setName}, ${v.setOrder},
        (select coalesce(max(queue_position), 0) + 1 from app.auction_players where auction_id = ${v.auctionId}))`;
    await tx`update app.player_registrations set status = 'approved', player_id = ${pl[0]!.id}, reviewed_at = now(), version = version + 1,
      full_name = ${p.fullName}, role_key = ${p.roleKey}, sub_role = ${p.subRole} where id = ${v.registrationId}`;
    await tx`select app._audit(${v.auctionId}, 'admin', ${admin.actorId}, 'registration.approve', 'player_registration', ${v.registrationId}, null,
      ${tx.json({ player_id: pl[0]!.id, base_price: price })}, null)`;
    return "ok" as const;
  });
  if (result === "missing") return { ok: false, error: "Registration not found." };
  if (result === "stale") return { ok: false, code: "STALE", error: "This registration was changed elsewhere. Reload to see it." };
  if (result === "done") return { ok: false, error: "This registration was already reviewed." };
  await bumpAndRefresh(v.auctionId);
  revalidatePath(`/admin/auctions/${v.auctionId}`, "layout");
  return { ok: true, message: `${v.player.fullName} is now in the player pool.` };
}

export async function rejectRegistrationAction(input: { auctionId: string; registrationId: string; reason: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const rows = await sql`update app.player_registrations set status = 'rejected', rejection_reason = ${input.reason.slice(0, 300) || null}, reviewed_at = now(), version = version + 1
    where id = ${input.registrationId} and auction_id = ${input.auctionId} and status = 'pending' returning id`;
  if (!rows[0]) return { ok: false, error: "This registration was already reviewed." };
  await sql`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'registration.reject', 'player_registration', ${input.registrationId}, null, null, ${input.reason || null})`;
  revalidatePath(`/admin/auctions/${input.auctionId}`, "layout");
  return { ok: true, message: "Registration rejected." };
}

/** Removes the registration and its photo, unless the photo now belongs to an approved player. */
export async function deleteRegistrationAction(input: { auctionId: string; registrationId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const reg = (await sql<{ status: string; photoPath: string | null; name: string }[]>`
    delete from app.player_registrations where id = ${input.registrationId} and auction_id = ${input.auctionId}
    returning status, photo_path as "photoPath", full_name as name`)[0];
  if (!reg) return { ok: false, error: "Registration not found." };
  if (reg.status !== "approved") await deleteImage(reg.photoPath);
  await sql`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'registration.delete', 'player_registration', ${input.registrationId}, null, null, null)`;
  revalidatePath(`/admin/auctions/${input.auctionId}`, "layout");
  return { ok: true, message: "Registration deleted." };
}

export async function setRegistrationOpenAction(input: { auctionId: string; open: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  await sql`update app.auctions set registration_open = ${input.open}, settings_version = settings_version + 1 where id = ${input.auctionId} and deleted_at is null`;
  await sql`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'registration.toggle', 'auction', ${input.auctionId}, null, ${sql.json({ open: input.open })}, null)`;
  revalidatePath(`/admin/auctions/${input.auctionId}`, "layout");
  return { ok: true, message: input.open ? "Registration is open." : "Registration is closed." };
}
