"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { runAndBroadcast } from "@/lib/live/engine";
import { auctionDefaultsSchema, sportConfigSchema } from "@/lib/sports/config";
import { invalid, type ActionResult } from "../result";

const settingsSchema = z
  .object({
    auctionId: z.uuid(),
    expectedVersion: z.number().int().min(0),
    reason: z.string().trim().max(300).default(""),
    confirmConflicts: z.boolean().default(false),
    name: z.string().trim().min(3, "Use at least 3 characters.").max(120),
    slug: z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and single dashes."),
    startsAt: z.string().trim().default(""),
    isPublic: z.boolean(),
    registrationOpen: z.boolean(),
    rules: auctionDefaultsSchema,
  })
  .superRefine((v, ctx) => {
    if (v.rules.timerExtensionSeconds !== null && v.rules.bidTimerSeconds === null) {
      ctx.addIssue({ code: "custom", path: ["rules", "timerExtensionSeconds"], message: "Turn the bid timer on to use an extension." });
    }
  });

export type SettingsInput = z.input<typeof settingsSchema>;

export async function updateSettingsAction(input: SettingsInput): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const sql = db();

  // Role keys must exist in the sport's configuration.
  const sport = (await sql<{ config: unknown }[]>`select s.config from app.auctions a join app.sports s on s.id = a.sport_id where a.id = ${v.auctionId}`)[0];
  if (!sport) return { ok: false, error: "Auction not found." };
  const roleKeys = new Set(sportConfigSchema.parse(sport.config).roles.map((r) => r.key));
  for (const key of [...Object.keys(v.rules.roleMinimums), ...Object.keys(v.rules.roleMaximums)]) {
    if (!roleKeys.has(key)) return { ok: false, error: `The role "${key}" is not part of this sport.` };
  }
  const slugTaken = await sql`select 1 from app.auctions where slug = ${v.slug} and id <> ${v.auctionId}`;
  if (slugTaken.length) return { ok: false, error: "That link is used by another auction.", fieldErrors: { slug: "This link is taken." } };
  let startsAt: string | null = null;
  if (v.startsAt) {
    const d = new Date(v.startsAt);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Check the start date.", fieldErrors: { startsAt: "Enter a valid date and time." } };
    startsAt = d.toISOString();
  }

  const r = v.rules;
  const settings = {
    name: v.name,
    slug: v.slug,
    starts_at: startsAt ?? "",
    points_unit_label: r.pointsUnitLabel,
    public: v.isPublic,
    registration_open: v.registrationOpen,
    purse_per_team: r.purse,
    squad_min: r.squadMin,
    squad_max: r.squadMax,
    max_overseas: r.maxOverseas,
    role_minimums: r.roleMinimums,
    role_maximums: r.roleMaximums,
    default_base_price: r.defaultBasePrice,
    category_base_prices: r.categoryBasePrices,
    reserve_rule_enabled: r.reserveRuleEnabled,
    bid_timer_seconds: r.bidTimerSeconds ?? "",
    timer_extension_seconds: r.timerExtensionSeconds ?? "",
    rtm_enabled: r.rtmEnabled,
    rtm_label: r.rtmLabel,
    rtm_allow_final_raise: r.rtmAllowFinalRaise,
    rtm_cards_per_team: r.rtmCardsPerTeam,
    retentions_enabled: r.retentionsEnabled,
    max_retentions: r.maxRetentions,
  };
  const res = await runAndBroadcast(v.auctionId, "update_auction_settings", [
    v.auctionId,
    v.expectedVersion,
    settings,
    r.slabs,
    admin.actorId,
    v.reason,
    v.confirmConflicts,
  ]);
  revalidatePath(`/admin/auctions/${v.auctionId}`, "layout");
  if (res.ok) return { ok: true, message: res.message };
  if (res.code === "CONFLICTS") return { ok: false, code: "CONFLICTS", error: res.message, conflicts: res.conflicts ?? [] };
  if (res.code === "REASON_REQUIRED") return { ok: false, code: res.code, error: res.message, fieldErrors: { reason: "Enter a reason." } };
  if (res.code === "INVALID_SLABS") return { ok: false, code: res.code, error: res.message, fieldErrors: { slabs: res.message } };
  return { ok: false, code: res.code, error: res.message };
}

/**
 * Reverts the most recent audited settings change by applying its "before"
 * values through the same checks as a normal save.
 */
export async function undoLastSettingsAction(input: { auctionId: string; expectedVersion: number; reason: string; confirmConflicts?: boolean }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(input.auctionId);
  if (!id.success) return { ok: false, error: "Auction not found." };
  const last = (await db()<{ id: number; before: Record<string, unknown> | null }[]>`
    select id, before from app.audit_log where auction_id = ${id.data} and action = 'auction.settings' order by id desc limit 1`)[0];
  if (!last?.before) return { ok: false, error: "There is no earlier settings change to undo." };
  const b = last.before;
  const pick = (k: string) => (b[k] === null || b[k] === undefined ? "" : b[k]);
  const settings: Record<string, unknown> = {};
  for (const k of [
    "name", "points_unit_label", "public", "registration_open", "purse_per_team", "squad_min", "squad_max", "max_overseas",
    "role_minimums", "role_maximums", "default_base_price", "category_base_prices", "reserve_rule_enabled", "bid_timer_seconds",
    "timer_extension_seconds", "rtm_enabled", "rtm_label", "rtm_allow_final_raise", "rtm_cards_per_team", "retentions_enabled", "max_retentions",
  ]) settings[k] = pick(k);
  settings.starts_at = pick("starts_at");
  const res = await runAndBroadcast(id.data, "update_auction_settings", [
    id.data,
    input.expectedVersion,
    settings,
    (b.slabs as unknown[]) ?? null,
    admin.actorId,
    `Undo: ${input.reason || "revert last settings change"}`.slice(0, 300),
    input.confirmConflicts ?? false,
  ]);
  revalidatePath(`/admin/auctions/${id.data}`, "layout");
  if (res.ok) return { ok: true, message: "The last settings change was undone." };
  if (res.code === "CONFLICTS") return { ok: false, code: "CONFLICTS", error: res.message, conflicts: res.conflicts ?? [] };
  return { ok: false, code: res.code, error: res.message };
}
