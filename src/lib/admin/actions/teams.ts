"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { bumpAndRefresh, callEngine } from "@/lib/live/engine";
import { generateAccessCode, hashAccessCode } from "@/lib/security/crypto";
import { deleteImage, storeImage, UploadError } from "@/lib/storage";
import { invalid, type ActionResult } from "../result";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a colour like #1F6FEB.");

const teamSchema = z.object({
  auctionId: z.uuid(),
  teamId: z.string().optional(),
  version: z.coerce.number().int().optional(),
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  shortName: z.string().trim().toUpperCase().min(2, "Use 2 to 6 characters.").max(6, "Use 2 to 6 characters.").regex(/^[A-Z0-9]+$/, "Use letters and numbers only."),
  primaryColor: hex,
  secondaryColor: hex,
  ownerDisplayName: z.string().trim().max(80).default(""),
  purseTotal: z.coerce.number({ error: "Enter a whole number." }).int("Enter a whole number.").min(0, "Use zero or more.").max(1_000_000_000),
  maxSessions: z.coerce.number().int().min(1, "At least 1.").max(10, "At most 10."),
  reason: z.string().trim().max(300).default(""),
  removeLogo: z.string().optional(),
});

function revalidate(auctionId: string) {
  revalidatePath(`/admin/auctions/${auctionId}`, "layout");
}

export async function saveTeamAction(formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string"));
  const parsed = teamSchema.safeParse(raw);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const sql = db();
  const auction = (await sql<{ status: string; rtmEnabled: boolean; cards: number }[]>`
    select status, rtm_enabled as "rtmEnabled", rtm_cards_per_team as cards from app.auctions where id = ${v.auctionId} and deleted_at is null`)[0];
  if (!auction) return { ok: false, error: "Auction not found." };
  if (auction.status === "completed" || auction.status === "archived") return { ok: false, error: "This auction is finished. Teams can no longer be changed." };

  const dup = await sql`select 1 from app.teams where auction_id = ${v.auctionId} and lower(short_name) = lower(${v.shortName}) and deleted_at is null and id::text <> ${v.teamId ?? ""}`;
  if (dup.length) return { ok: false, error: "Another team uses that short name.", fieldErrors: { shortName: "Already used by another team." } };

  let logoPath: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    try {
      logoPath = await storeImage(logo, "logo");
    } catch (e) {
      return { ok: false, error: e instanceof UploadError ? e.message : "The logo could not be saved.", fieldErrors: { logo: e instanceof UploadError ? e.message : "Upload failed." } };
    }
  }

  if (!v.teamId) {
    await sql.begin(async (tx) => {
      const rows = await tx<{ id: string }[]>`
        insert into app.teams(auction_id, name, short_name, primary_color, secondary_color, owner_display_name, purse_total, rtm_cards_left, max_sessions, logo_path)
        values (${v.auctionId}, ${v.name}, ${v.shortName}, ${v.primaryColor.toUpperCase()}, ${v.secondaryColor.toUpperCase()}, ${v.ownerDisplayName},
          ${v.purseTotal}, ${auction.rtmEnabled ? auction.cards : 0}, ${v.maxSessions}, ${logoPath ?? null})
        returning id`;
      const teamId = rows[0]!.id;
      await tx`select app._audit(${v.auctionId}, 'admin', ${admin.actorId}, 'team.create', 'team', ${teamId}, null,
        ${tx.json({ name: v.name, purse_total: v.purseTotal })}, null)`;
    });
    await bumpAndRefresh(v.auctionId);
    revalidate(v.auctionId);
    return { ok: true, message: `${v.name} added.` };
  }

  const team = (await sql<{ id: string; version: number; purseTotal: number; logoPath: string | null; name: string }[]>`
    select id, version::int as version, purse_total as "purseTotal", logo_path as "logoPath", name from app.teams
    where id = ${v.teamId} and auction_id = ${v.auctionId} and deleted_at is null`)[0];
  if (!team) return { ok: false, error: "Team not found." };
  if (v.version !== undefined && team.version !== v.version) {
    if (logoPath) await deleteImage(logoPath);
    return { ok: false, code: "STALE", error: "This team was changed elsewhere. Reload to see it." };
  }

  let version = team.version;
  if (v.purseTotal !== team.purseTotal) {
    const res = await callEngine("adjust_purse", [v.auctionId, team.id, v.purseTotal, version, admin.actorId, v.reason]);
    if (!res.ok) {
      if (logoPath) await deleteImage(logoPath);
      const fieldErrors: Record<string, string> =
        res.code === "REASON_REQUIRED" ? { reason: "Enter a reason for changing the purse." } : res.code === "PURSE_BELOW_SPENT" ? { purseTotal: res.message } : {};
      return { ok: false, code: res.code, error: res.message, fieldErrors };
    }
    version += 1;
  }
  const newLogo = logoPath ?? (v.removeLogo === "1" ? null : team.logoPath);
  const updated = await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      update app.teams set name = ${v.name}, short_name = ${v.shortName}, primary_color = ${v.primaryColor.toUpperCase()},
        secondary_color = ${v.secondaryColor.toUpperCase()}, owner_display_name = ${v.ownerDisplayName}, max_sessions = ${v.maxSessions},
        logo_path = ${newLogo}, version = version + 1
      where id = ${team.id} and version = ${version} returning id`;
    if (!rows[0]) return false;
    await tx`select app._audit(${v.auctionId}, 'admin', ${admin.actorId}, 'team.update', 'team', ${team.id},
      ${tx.json({ name: team.name, logo_path: team.logoPath })}, ${tx.json({ name: v.name, logo_path: newLogo, max_sessions: v.maxSessions })}, ${v.reason || null})`;
    return true;
  });
  if (!updated) return { ok: false, code: "STALE", error: "This team was changed elsewhere. Reload to see it." };
  if (newLogo !== team.logoPath) await deleteImage(team.logoPath);
  await bumpAndRefresh(v.auctionId);
  revalidate(v.auctionId);
  return { ok: true, message: `${v.name} saved.` };
}

export async function deleteTeamAction(input: { auctionId: string; teamId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const team = (await sql<{ name: string; squad: number; bids: number; spent: number; logoPath: string | null }[]>`
    select t.name, t.purse_spent as spent, t.logo_path as "logoPath",
      (select count(*)::int from app.auction_players ap where ap.sold_to_team_id = t.id) as squad,
      (select count(*)::int from app.bids b where b.team_id = t.id and not b.voided) as bids
    from app.teams t where t.id = ${input.teamId} and t.auction_id = ${input.auctionId} and t.deleted_at is null`)[0];
  if (!team) return { ok: false, error: "Team not found." };
  if (team.squad > 0 || team.spent > 0) return { ok: false, error: `${team.name} has players. Return them to the pool with a results correction before deleting the team.` };
  if (team.bids > 0) return { ok: false, error: `${team.name} has bids on record. Deleting it would break the bid history. Revoke its code instead.` };
  await sql.begin(async (tx) => {
    await tx`update app.teams set deleted_at = now() where id = ${input.teamId}`;
    await tx`update app.team_access_codes set active = false, revoked_at = now() where team_id = ${input.teamId} and active`;
    await tx`update app.team_sessions set revoked_at = now() where team_id = ${input.teamId} and revoked_at is null`;
    await tx`update app.auction_players set previous_team_id = null where previous_team_id = ${input.teamId}`;
    await tx`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'team.delete', 'team', ${input.teamId}, ${tx.json({ name: team.name })}, null, null)`;
  });
  await deleteImage(team.logoPath);
  await bumpAndRefresh(input.auctionId);
  revalidate(input.auctionId);
  return { ok: true, message: `${team.name} deleted.` };
}

/** Issues a new code. The previous code and all its sessions stop working at once. Returns the code once. */
export async function generateCodeAction(input: { auctionId: string; teamId: string }): Promise<ActionResult<{ code: string }>> {
  const admin = await requireAdmin();
  const sql = db();
  const team = (await sql<{ id: string }[]>`select id from app.teams where id = ${input.teamId} and auction_id = ${input.auctionId} and deleted_at is null`)[0];
  if (!team) return { ok: false, error: "Team not found." };
  const code = generateAccessCode();
  await sql.begin(async (tx) => {
    const ended = await tx`update app.team_sessions set revoked_at = now() where team_id = ${team.id} and revoked_at is null returning id`;
    await tx`update app.team_access_codes set active = false, revoked_at = now() where team_id = ${team.id} and active`;
    await tx`insert into app.team_access_codes(team_id, code_hash, code_hint) values (${team.id}, ${hashAccessCode(code)}, ${code.slice(-2)})`;
    await tx`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'team.code_issued', 'team', ${team.id}, null,
      ${tx.json({ sessions_ended: ended.length })}, null)`;
  });
  revalidate(input.auctionId);
  return { ok: true, message: "New code issued. Copy it now: it will not be shown again.", data: { code } };
}

export async function revokeCodeAction(input: { auctionId: string; teamId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  await sql.begin(async (tx) => {
    const ended = await tx`update app.team_sessions s set revoked_at = now() from app.teams t
      where t.id = s.team_id and t.id = ${input.teamId} and t.auction_id = ${input.auctionId} and s.revoked_at is null returning s.id`;
    await tx`update app.team_access_codes c set active = false, revoked_at = now() from app.teams t
      where t.id = c.team_id and t.id = ${input.teamId} and t.auction_id = ${input.auctionId} and c.active`;
    await tx`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'team.code_revoked', 'team', ${input.teamId}, null,
      ${tx.json({ sessions_ended: ended.length })}, null)`;
  });
  revalidate(input.auctionId);
  return { ok: true, message: "Code revoked. Every device using it was signed out." };
}

export async function endSessionAction(input: { auctionId: string; sessionId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const rows = await sql<{ teamId: string }[]>`
    update app.team_sessions s set revoked_at = now() from app.teams t
    where s.id = ${input.sessionId} and t.id = s.team_id and t.auction_id = ${input.auctionId} and s.revoked_at is null
    returning s.team_id as "teamId"`;
  if (!rows[0]) return { ok: false, error: "That session has already ended." };
  await sql`select app._audit(${input.auctionId}, 'admin', ${admin.actorId}, 'team.session_ended', 'team_session', ${input.sessionId}, null, null, null)`;
  revalidate(input.auctionId);
  return { ok: true, message: "Session ended." };
}
