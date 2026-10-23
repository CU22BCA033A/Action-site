"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { auctionDefaultsSchema, sportConfigSchema } from "@/lib/sports/config";
import { invalid, type ActionResult } from "../result";

const saveSchema = z.object({ sportId: z.uuid(), version: z.number().int(), name: z.string().trim().min(2).max(60), config: z.unknown() });

/**
 * Saves a sport's roles, categories, tags, stat fields and default rules.
 * Existing auctions keep the rules they were created with. Removing a role
 * or category that players or open auctions still use is refused.
 */
export async function saveSportAction(input: z.input<typeof saveSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const cfg = sportConfigSchema.safeParse(parsed.data.config);
  if (!cfg.success) return invalid(cfg.error);
  const { sportId, version, name } = parsed.data;
  const config = cfg.data;
  const sql = db();
  const current = (await sql<{ config: unknown; version: number }[]>`select config, version::int as version from app.sports where id = ${sportId}`)[0];
  if (!current) return { ok: false, error: "Sport not found." };
  if (current.version !== version) return { ok: false, code: "STALE", error: "This sport was changed elsewhere. Reload to see it." };
  const before = sportConfigSchema.parse(current.config);

  const removedRoles = before.roles.map((r) => r.key).filter((k) => !config.roles.some((r) => r.key === k));
  for (const key of removedRoles) {
    const label = before.roles.find((r) => r.key === key)?.label ?? key;
    const players = (await sql<{ n: number }[]>`select count(*)::int as n from app.players where sport_id = ${sportId} and role_key = ${key} and deleted_at is null`)[0]!.n;
    if (players > 0) return { ok: false, code: "IN_USE", error: `${label} is used by ${players} players. Move them to another role first, or hide the role instead of deleting it.` };
    const regs = (await sql<{ n: number }[]>`select count(*)::int as n from app.player_registrations r join app.auctions a on a.id = r.auction_id where a.sport_id = ${sportId} and r.role_key = ${key} and r.status = 'pending'`)[0]!.n;
    if (regs > 0) return { ok: false, code: "IN_USE", error: `${label} has ${regs} pending registrations. Review them first.` };
    const rules = (await sql<{ n: number }[]>`select count(*)::int as n from app.auctions where sport_id = ${sportId} and deleted_at is null
      and status not in ('completed','archived') and (role_minimums ? ${key} or role_maximums ? ${key})`)[0]!.n;
    if (rules > 0) return { ok: false, code: "IN_USE", error: `${label} is a required role in ${rules} open auctions. Remove it from their rules first.` };
  }
  const removedCats = before.categories.filter((c) => !config.categories.includes(c));
  for (const c of removedCats) {
    const n = (await sql<{ n: number }[]>`select count(*)::int as n from app.players where sport_id = ${sportId} and category = ${c} and deleted_at is null`)[0]!.n;
    if (n > 0) return { ok: false, code: "IN_USE", error: `Category ${c} is used by ${n} players. Change their category first.` };
  }
  for (const r of before.roles) {
    const now = config.roles.find((x) => x.key === r.key);
    if (!now) continue;
    for (const sub of r.subRoles.filter((s) => !now.subRoles.includes(s))) {
      const n = (await sql<{ n: number }[]>`select count(*)::int as n from app.players where sport_id = ${sportId} and role_key = ${r.key} and sub_role = ${sub} and deleted_at is null`)[0]!.n;
      if (n > 0) return { ok: false, code: "IN_USE", error: `The sub-role ${sub} is used by ${n} players. Change them first.` };
    }
  }

  const ok = await sql.begin(async (tx) => {
    const rows = await tx`update app.sports set name = ${name}, config = ${tx.json(config)}, version = version + 1 where id = ${sportId} and version = ${version} returning id`;
    if (!rows[0]) return false;
    await tx`select app._audit(null, 'admin', ${admin.actorId}, 'sport.update', 'sport', ${sportId}, ${tx.json(before)}, ${tx.json(config)}, null)`;
    return true;
  });
  if (!ok) return { ok: false, code: "STALE", error: "This sport was changed elsewhere. Reload to see it." };
  revalidatePath("/admin/sports", "layout");
  revalidatePath("/sports");
  return { ok: true, message: "Sport saved. New auctions use these settings; existing auctions are unchanged." };
}

const presetSchema = z.object({
  sportId: z.uuid(),
  name: z.string().trim().min(2, "Use at least 2 characters.").max(80),
  description: z.string().trim().max(400).default(""),
  config: auctionDefaultsSchema,
});

export async function savePresetAction(input: z.input<typeof presetSchema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = presetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const sql = db();
  const taken = await sql`select 1 from app.sport_presets where sport_id = ${v.sportId} and lower(name) = lower(${v.name})`;
  if (taken.length) return { ok: false, error: "A preset with that name exists.", fieldErrors: { name: "Choose another name." } };
  await sql`insert into app.sport_presets(sport_id, name, description, is_example, config) values (${v.sportId}, ${v.name}, ${v.description}, false, ${sql.json(v.config)})`;
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'sport.preset_saved', 'sport', ${v.sportId}, null, ${sql.json({ name: v.name })}, null)`;
  revalidatePath("/admin/sports", "layout");
  return { ok: true, message: `Preset "${v.name}" saved.` };
}

export async function duplicatePresetAction(input: { presetId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const p = (await sql<{ sportId: string; name: string; description: string; config: unknown }[]>`
    select sport_id as "sportId", name, description, config from app.sport_presets where id = ${input.presetId}`)[0];
  if (!p) return { ok: false, error: "Preset not found." };
  let name = `${p.name} copy`;
  for (let i = 2; (await sql`select 1 from app.sport_presets where sport_id = ${p.sportId} and name = ${name}`).length; i++) name = `${p.name} copy ${i}`;
  await sql`insert into app.sport_presets(sport_id, name, description, is_example, config) values (${p.sportId}, ${name.slice(0, 80)}, ${p.description}, false, ${sql.json(p.config as never)})`;
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'sport.preset_duplicated', 'sport', ${p.sportId}, null, ${sql.json({ name })}, null)`;
  revalidatePath("/admin/sports", "layout");
  return { ok: true, message: `Saved as "${name}".` };
}

export async function deletePresetAction(input: { presetId: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const sql = db();
  const rows = await sql<{ sportId: string; name: string }[]>`delete from app.sport_presets where id = ${input.presetId} returning sport_id as "sportId", name`;
  if (!rows[0]) return { ok: false, error: "Preset not found." };
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'sport.preset_deleted', 'sport', ${rows[0].sportId}, ${sql.json({ name: rows[0].name })}, null, null)`;
  revalidatePath("/admin/sports", "layout");
  return { ok: true, message: "Preset deleted." };
}
