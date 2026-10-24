"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { insertAuction } from "@/lib/domain/auctions";
import { createDemoAuction } from "@/lib/domain/demo";
import { bumpAndRefresh, callEngine, getFloor } from "@/lib/live/engine";
import { validateSlabs } from "@/lib/rules/slabs";
import { auctionDefaultsSchema, sportConfigSchema } from "@/lib/sports/config";
import { invalid, type ActionResult } from "../result";

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(80, "Use at most 80 characters.")
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes.");

const createSchema = z.object({
  sportId: z.uuid("Choose a sport."),
  presetId: z.string().trim(),
  name: z.string().trim().min(3, "Use at least 3 characters.").max(120, "Use at most 120 characters."),
  slug: slugSchema,
  startsAt: z.string().trim().optional(),
  isPublic: z.boolean(),
  rehearsal: z.boolean(),
});

export async function createAuctionAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string }>> {
  const admin = await requireAdmin();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;
  const sql = db();
  const taken = await sql`select 1 from app.auctions where slug = ${d.slug}`;
  if (taken.length) return { ok: false, error: "That link is already used by another auction.", fieldErrors: { slug: "This link is taken. Choose another." } };
  const sport = (await sql<{ id: string; key: string; config: unknown }[]>`select id, key, config from app.sports where id = ${d.sportId}`)[0];
  if (!sport) return { ok: false, error: "Sport not found.", fieldErrors: { sportId: "Choose a sport." } };
  const config = sportConfigSchema.parse(sport.config);
  let defaults = config.defaults;
  if (d.presetId && d.presetId !== "defaults") {
    const preset = (await sql<{ config: unknown }[]>`select config from app.sport_presets where id = ${d.presetId} and sport_id = ${sport.id}`)[0];
    if (!preset) return { ok: false, error: "Preset not found.", fieldErrors: { presetId: "Choose a preset." } };
    defaults = auctionDefaultsSchema.parse(preset.config);
  }
  let startsAt: Date | null = null;
  if (d.startsAt) {
    startsAt = new Date(d.startsAt);
    if (Number.isNaN(startsAt.getTime())) return { ok: false, error: "Check the start date.", fieldErrors: { startsAt: "Enter a valid date and time." } };
  }

  const id = await sql.begin(async (tx) => {
    const newId = d.rehearsal
      ? await createDemoAuction(tx as never, { sportKey: sport.key, name: d.name, slug: d.slug, defaults })
      : await insertAuction(tx as never, { sportId: sport.id, name: d.name, slug: d.slug, startsAt, isPublic: d.isPublic, rehearsal: false, defaults });
    if (d.rehearsal && startsAt) await tx`update app.auctions set starts_at = ${startsAt} where id = ${newId}`;
    await tx`select app._audit(${newId}, 'admin', ${admin.actorId}, 'auction.create', 'auction', ${newId}, null,
      ${tx.json({ name: d.name, slug: d.slug, rehearsal: d.rehearsal, preset: d.presetId })}, null)`;
    return newId;
  });
  redirect(`/admin/auctions/${id}`);
}

const transitions: Record<string, string[]> = {
  draft: ["scheduled", "live"],
  scheduled: ["draft", "live"],
  live: ["paused", "completed"],
  paused: ["live", "completed"],
  completed: ["live", "archived"],
  archived: ["completed"],
};

const statusSchema = z.object({
  auctionId: z.uuid(),
  to: z.enum(["draft", "scheduled", "live", "paused", "completed", "archived"]),
  reason: z.string().trim().max(300).optional(),
});

export async function setAuctionStatusAction(input: z.input<typeof statusSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = statusSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { auctionId, to, reason } = parsed.data;
  const sql = db();
  const a = (await sql<{ status: string; rehearsal: boolean }[]>`select status, rehearsal from app.auctions where id = ${auctionId} and deleted_at is null`)[0];
  if (!a) return { ok: false, error: "Auction not found." };
  if (!transitions[a.status]?.includes(to)) return { ok: false, error: `An auction cannot go from ${a.status} to ${to}.` };

  if (to === "live" && (a.status === "draft" || a.status === "scheduled")) {
    const counts = (await sql<{ teams: number; players: number }[]>`
      select (select count(*)::int from app.teams where auction_id = ${auctionId} and deleted_at is null) as teams,
             (select count(*)::int from app.auction_players where auction_id = ${auctionId}) as players`)[0]!;
    if (counts.teams < 2) return { ok: false, error: "Add at least two teams before going live." };
    if (counts.players < 1) return { ok: false, error: "Add at least one player before going live." };
    const slabs = await sql<{ from: number; to: number | null; increment: number }[]>`
      select from_points as "from", to_points as "to", increment_points as increment from app.bid_slabs where auction_id = ${auctionId}`;
    const problem = validateSlabs(slabs);
    if (problem) return { ok: false, error: `Fix the bid slabs first: ${problem.message}` };
  }
  if (a.status === "completed" && to === "live" && !reason) return { ok: false, error: "Give a reason for reopening a completed auction.", fieldErrors: { reason: "Enter a reason." } };

  const floor = await getFloor(auctionId);
  if (to === "paused" && floor?.phase === "live") {
    await callEngine("pause_floor", [auctionId, floor.version, admin.actorId]);
  }
  if (to === "completed" && floor && floor.currentAuctionPlayerId && ["idle", "live", "paused", "rtm_pending"].includes(floor.phase)) {
    // The player still on the floor goes back to the pool without a result.
    const back = await callEngine("return_to_pool", [auctionId, floor.currentAuctionPlayerId, floor.version, admin.actorId]);
    if (!back.ok) return { ok: false, error: back.message };
  }

  await sql.begin(async (tx) => {
    await tx`update app.auctions set status = ${to}, completed_at = case when ${to} = 'completed' then now() else completed_at end
      where id = ${auctionId}`;
    await tx`select app._audit(${auctionId}, 'admin', ${admin.actorId}, 'auction.status', 'auction', ${auctionId},
      ${tx.json({ status: a.status })}, ${tx.json({ status: to })}, ${reason ?? null})`;
  });
  await bumpAndRefresh(auctionId);
  revalidatePath(`/admin/auctions/${auctionId}`);
  return { ok: true, message: `Auction is now ${to}.` };
}

export async function deleteAuctionAction(input: { auctionId: string; confirmName: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(input.auctionId);
  if (!id.success) return { ok: false, error: "Auction not found." };
  const sql = db();
  const a = (await sql<{ name: string; status: string }[]>`select name, status from app.auctions where id = ${id.data} and deleted_at is null`)[0];
  if (!a) return { ok: false, error: "Auction not found." };
  if (input.confirmName.trim() !== a.name) return { ok: false, error: "Type the auction name exactly to confirm.", fieldErrors: { confirmName: "The name does not match." } };
  await sql.begin(async (tx) => {
    await tx`select app._lock_floor(${id.data})`;
    await tx`update app.auction_players set status = 'pool', version = version + 1 where auction_id = ${id.data} and status = 'on_floor'`;
    await tx`select app._clear_floor(${id.data})`;
    await tx`update app.auctions set deleted_at = now(), public = false, registration_open = false,
      status = case when status in ('live','paused') then 'completed' else status end where id = ${id.data}`;
    await tx`update app.team_access_codes c set active = false, revoked_at = now() from app.teams t where t.id = c.team_id and t.auction_id = ${id.data} and c.active`;
    await tx`update app.team_sessions s set revoked_at = now() from app.teams t where t.id = s.team_id and t.auction_id = ${id.data} and s.revoked_at is null`;
    await tx`select app._audit(${id.data}, 'admin', ${admin.actorId}, 'auction.delete', 'auction', ${id.data}, ${tx.json({ name: a.name })}, null, null)`;
  });
  redirect("/admin");
}
