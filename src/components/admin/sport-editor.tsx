"use client";

import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerAvatar, RoleChip } from "@/components/auction/identity";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, Textarea } from "@/components/ui/field";
import { deletePresetAction, duplicatePresetAction, savePresetAction, saveSportAction } from "@/lib/admin/actions/sports";
import { formatStat } from "@/lib/format";
import type { AuctionDefaults, SportConfig, SportRole, StatField } from "@/lib/sports/config";
import { AdminSection } from "./admin-shell";
import { fromDraft, SlabEditor, toDraft, type SlabDraft } from "./slab-editor";
import { useAdminAction } from "./use-admin-action";

type Preset = { id: string; name: string; description: string; isExample: boolean };
type Usage = { roles: Record<string, number>; categories: Record<string, number> };

const keyOf = (label: string) =>
  label.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(\d)/, "r_$1").slice(0, 40) || "role";

function move<T>(arr: T[], i: number, d: -1 | 1): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

export function SportEditor({ sport, presets, usage }: { sport: { id: string; key: string; name: string; version: number; config: SportConfig }; presets: Preset[]; usage: Usage }) {
  const router = useRouter();
  const [name, setName] = useState(sport.name);
  const [roles, setRoles] = useState<(SportRole & { isNew?: boolean })[]>(sport.config.roles);
  const [categories, setCategories] = useState(sport.config.categories.join(", "));
  const [tags, setTags] = useState(sport.config.tags.join(", "));
  const [stats, setStats] = useState<(StatField & { isNew?: boolean })[]>(sport.config.statFields);
  const [d, setD] = useState<AuctionDefaults>(sport.config.defaults);
  const [slabs, setSlabs] = useState<SlabDraft[]>(toDraft(sport.config.defaults.slabs));
  const [presetName, setPresetName] = useState("");
  const [presetDesc, setPresetDesc] = useState("");
  const [delPreset, setDelPreset] = useState<Preset | null>(null);
  const save = useAdminAction(saveSportAction);
  const savePreset = useAdminAction(savePresetAction);
  const dup = useAdminAction(duplicatePresetAction);
  const del = useAdminAction(deletePresetAction);

  const list = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);
  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(/[^\d]/g, "")));
  const config = (): SportConfig => {
    const cats = list(categories).map((c) => c.toUpperCase());
    return {
      roles: roles.map((r) => ({ key: r.key, label: r.label, subRoles: r.subRoles, hidden: r.hidden })),
      categories: cats,
      tags: list(tags),
      statFields: stats.map((s) => ({ key: s.key, label: s.label, kind: s.kind, showOnCard: s.showOnCard })),
      defaults: { ...d, slabs: fromDraft(slabs) ?? d.slabs, categoryBasePrices: Object.fromEntries(Object.entries(d.categoryBasePrices).filter(([k]) => cats.includes(k))) },
    };
  };
  const errs = save.result && !save.result.ok ? Object.entries(save.result.fieldErrors ?? {}).map(([n, m]) => ({ name: n, message: `${n}: ${m}` })) : [];
  const previewRole = roles.find((r) => !r.hidden) ?? roles[0];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 pb-28 sm:px-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {save.result?.ok ? <FormStatus kind="success">{save.result.message}</FormStatus> : null}
        {save.result && !save.result.ok ? errs.length ? <FormErrorSummary title={save.result.error} errors={errs} /> : <FormStatus kind="error">{save.result.error}</FormStatus> : null}

        <AdminSection title="Name">
          <Field name="sport-name" label="Sport name">
            <Input id="f-sport-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          </Field>
        </AdminSection>

        <AdminSection title="Roles" description="Lists, filters, squad rules and player forms all follow these roles. Hide a role to stop using it without touching existing players.">
          <ul className="flex flex-col gap-3">
            {roles.map((r, i) => {
              const used = usage.roles[r.key] ?? 0;
              return (
                <li key={`${r.key}-${i}`} className={`rounded-[var(--radius-sm)] border p-3 ${r.hidden ? "border-dashed border-line" : "border-line-strong"}`}>
                  <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                    <Field name={`role-${i}`} label="Label">
                      <Input id={`f-role-${i}`} value={r.label} maxLength={40} onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, label: e.target.value, key: x.isNew ? keyOf(e.target.value) : x.key } : x)))} />
                    </Field>
                    <Field name={`rolekey-${i}`} label="Key" hint={r.isNew ? "Set from the label." : "Fixed once saved."}>
                      <Input id={`f-rolekey-${i}`} value={r.key} readOnly className="num text-muted" aria-describedby={`f-rolekey-${i}-hint`} />
                    </Field>
                  </div>
                  <Field name={`sub-${i}`} label="Sub-roles" optional hint="Separate with commas." className="mt-3">
                    <Input id={`f-sub-${i}`} value={r.subRoles.join(", ")} onChange={(e) => setRoles(roles.map((x, j) => (j === i ? { ...x, subRoles: e.target.value.split(",").map((s) => s.trimStart()).filter((s, k, all) => s || k === all.length - 1) } : x)))} onBlur={() => setRoles(roles.map((x, j) => (j === i ? { ...x, subRoles: x.subRoles.map((s) => s.trim()).filter(Boolean) } : x)))} aria-describedby={`f-sub-${i}-hint`} />
                  </Field>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted">{used ? `Used by ${used} players` : "Not used yet"}</span>
                    <div className="ml-auto flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setRoles(move(roles, i, -1))} disabled={i === 0} aria-label={`Move ${r.label} up`} icon={<ArrowUp className="size-4" aria-hidden="true" />}><span className="sr-only">Up</span></Button>
                      <Button size="sm" variant="ghost" onClick={() => setRoles(move(roles, i, 1))} disabled={i === roles.length - 1} aria-label={`Move ${r.label} down`} icon={<ArrowDown className="size-4" aria-hidden="true" />}><span className="sr-only">Down</span></Button>
                      <Button size="sm" onClick={() => setRoles(roles.map((x, j) => (j === i ? { ...x, hidden: !x.hidden } : x)))} aria-pressed={r.hidden} icon={r.hidden ? <Eye className="size-4" aria-hidden="true" /> : <EyeOff className="size-4" aria-hidden="true" />}>
                        {r.hidden ? "Show" : "Hide"}
                      </Button>
                      <Button size="sm" variant="danger" disabled={used > 0 || roles.length === 1} title={used ? "Move these players to another role first." : undefined} onClick={() => setRoles(roles.filter((_, j) => j !== i))} icon={<Trash2 className="size-4" aria-hidden="true" />}>
                        Delete
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-3">
            <Button size="sm" onClick={() => setRoles([...roles, { key: `role_${roles.length + 1}`, label: "", subRoles: [], hidden: false, isNew: true }])} icon={<Plus className="size-4" aria-hidden="true" />}>Add role</Button>
          </div>
        </AdminSection>

        <AdminSection title="Categories and tags">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="cats" label="Categories" optional hint={`Separate with commas, for example A, B, C, D. In use: ${Object.entries(usage.categories).map(([k, n]) => `${k} (${n})`).join(", ") || "none"}.`}>
              <Input id="f-cats" value={categories} onChange={(e) => setCategories(e.target.value)} aria-describedby="f-cats-hint" />
            </Field>
            <Field name="tags" label="Tags" optional hint="Separate with commas.">
              <Input id="f-tags" value={tags} onChange={(e) => setTags(e.target.value)} aria-describedby="f-tags-hint" />
            </Field>
          </div>
        </AdminSection>

        <AdminSection title="Stat fields" description="Shown on player cards and asked for on the registration form.">
          <ul className="flex flex-col gap-2">
            {stats.map((s, i) => (
              <li key={`${s.key}-${i}`} className="grid items-end gap-2 rounded-[var(--radius-sm)] border border-line p-2 sm:grid-cols-[1fr_9rem_8rem_auto]">
                <Field name={`stat-${i}`} label="Label">
                  <Input id={`f-stat-${i}`} value={s.label} maxLength={40} onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, label: e.target.value, key: x.isNew ? keyOf(e.target.value) : x.key } : x)))} />
                </Field>
                <Field name={`statkind-${i}`} label="Kind">
                  <SelectWrap>
                    <Select id={`f-statkind-${i}`} value={s.kind} onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, kind: e.target.value as "integer" | "decimal" } : x)))}>
                      <option value="integer">Whole number</option>
                      <option value="decimal">Decimal</option>
                    </Select>
                  </SelectWrap>
                </Field>
                <Checkbox id={`f-statcard-${i}`} name={`statcard-${i}`} checked={s.showOnCard} onChange={(e) => setStats(stats.map((x, j) => (j === i ? { ...x, showOnCard: e.target.checked } : x)))} label="On card" />
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setStats(move(stats, i, -1))} disabled={i === 0} aria-label={`Move ${s.label} up`} icon={<ArrowUp className="size-4" aria-hidden="true" />}><span className="sr-only">Up</span></Button>
                  <Button size="sm" variant="ghost" onClick={() => setStats(stats.filter((_, j) => j !== i))} aria-label={`Delete ${s.label}`} icon={<Trash2 className="size-4" aria-hidden="true" />}><span className="sr-only">Delete</span></Button>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-muted">Deleting a stat hides it everywhere; values already saved on players are kept.</p>
          <div className="mt-3">
            <Button size="sm" onClick={() => setStats([...stats, { key: `stat_${stats.length + 1}`, label: "", kind: "integer", showOnCard: true, isNew: true }])} icon={<Plus className="size-4" aria-hidden="true" />}>Add stat</Button>
          </div>
        </AdminSection>

        <AdminSection title="Defaults for new auctions" description="These prefill the rules of every new auction of this sport. Auctions already created keep their own rules.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="d-unit" label="Points label"><Input id="f-d-unit" value={d.pointsUnitLabel} onChange={(e) => setD({ ...d, pointsUnitLabel: e.target.value })} maxLength={24} /></Field>
            <Field name="d-purse" label="Purse per team"><Input id="f-d-purse" inputMode="numeric" className="num" value={String(d.purse)} onChange={(e) => setD({ ...d, purse: num(e.target.value) })} /></Field>
            <Field name="d-base" label="Default base price"><Input id="f-d-base" inputMode="numeric" className="num" value={String(d.defaultBasePrice)} onChange={(e) => setD({ ...d, defaultBasePrice: num(e.target.value) })} /></Field>
            <Field name="d-min" label="Squad minimum"><Input id="f-d-min" inputMode="numeric" className="num" value={String(d.squadMin)} onChange={(e) => setD({ ...d, squadMin: num(e.target.value) })} /></Field>
            <Field name="d-max" label="Squad maximum"><Input id="f-d-max" inputMode="numeric" className="num" value={String(d.squadMax)} onChange={(e) => setD({ ...d, squadMax: num(e.target.value) })} /></Field>
            <Field name="d-ov" label="Overseas maximum"><Input id="f-d-ov" inputMode="numeric" className="num" value={String(d.maxOverseas)} onChange={(e) => setD({ ...d, maxOverseas: num(e.target.value) })} /></Field>
          </div>
          {list(categories).length ? (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {list(categories).map((c) => c.toUpperCase()).map((c) => (
                <Field key={c} name={`d-cat-${c}`} label={`Category ${c} base`}>
                  <Input id={`f-d-cat-${c}`} inputMode="numeric" className="num" value={String(d.categoryBasePrices[c] ?? "")} onChange={(e) => setD({ ...d, categoryBasePrices: { ...d.categoryBasePrices, [c]: num(e.target.value) } })} />
                </Field>
              ))}
            </div>
          ) : null}
          <div className="mt-4 overflow-x-auto scrollbar-thin">
            <table className="w-full min-w-[24rem] text-sm">
              <caption className="mb-1 text-left font-semibold">Required roles</caption>
              <thead><tr className="text-left text-muted"><th scope="col">Role</th><th scope="col">At least</th><th scope="col">At most</th></tr></thead>
              <tbody>
                {roles.filter((r) => !r.isNew).map((r) => (
                  <tr key={r.key}>
                    <th scope="row" className="py-1 pr-2 text-left font-semibold">{r.label}</th>
                    <td className="py-1 pr-2"><Input aria-label={`${r.label} minimum`} inputMode="numeric" className="num" value={d.roleMinimums[r.key]?.toString() ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); const m = { ...d.roleMinimums }; if (v === "") delete m[r.key]; else m[r.key] = Number(v); setD({ ...d, roleMinimums: m }); }} /></td>
                    <td className="py-1"><Input aria-label={`${r.label} maximum`} inputMode="numeric" className="num" value={d.roleMaximums[r.key]?.toString() ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); const m = { ...d.roleMaximums }; if (v === "") delete m[r.key]; else m[r.key] = Number(v); setD({ ...d, roleMaximums: m }); }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5">
            <p className="mb-2 font-semibold">Bid slabs</p>
            <SlabEditor rows={slabs} onChange={setSlabs} unit={d.pointsUnitLabel} />
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Checkbox id="f-d-timer" name="d-timer" checked={d.bidTimerSeconds !== null} onChange={(e) => setD({ ...d, bidTimerSeconds: e.target.checked ? 30 : null, timerExtensionSeconds: e.target.checked ? (d.timerExtensionSeconds ?? 10) : null })} label="Bid timer on" />
            {d.bidTimerSeconds !== null ? (
              <div className="grid grid-cols-2 gap-3">
                <Field name="d-timer-s" label="Seconds"><Input id="f-d-timer-s" inputMode="numeric" className="num" value={String(d.bidTimerSeconds)} onChange={(e) => setD({ ...d, bidTimerSeconds: num(e.target.value) })} /></Field>
                <Field name="d-ext" label="Extension"><Input id="f-d-ext" inputMode="numeric" className="num" value={String(d.timerExtensionSeconds ?? "")} onChange={(e) => setD({ ...d, timerExtensionSeconds: e.target.value === "" ? null : num(e.target.value) })} /></Field>
              </div>
            ) : null}
            <Checkbox id="f-d-reserve" name="d-reserve" checked={d.reserveRuleEnabled} onChange={(e) => setD({ ...d, reserveRuleEnabled: e.target.checked })} label="Purse reserve rule" />
            <Checkbox id="f-d-rtm" name="d-rtm" checked={d.rtmEnabled} onChange={(e) => setD({ ...d, rtmEnabled: e.target.checked })} label="Match cards (RTM or FBM)" />
            {d.rtmEnabled ? (
              <div className="grid grid-cols-2 gap-3">
                <Field name="d-rtm-label" label="Card">
                  <SelectWrap><Select id="f-d-rtm-label" value={d.rtmLabel} onChange={(e) => setD({ ...d, rtmLabel: e.target.value as "RTM" | "FBM" })}><option value="RTM">RTM</option><option value="FBM">FBM</option></Select></SelectWrap>
                </Field>
                <Field name="d-rtm-n" label="Cards per team"><Input id="f-d-rtm-n" inputMode="numeric" className="num" value={String(d.rtmCardsPerTeam)} onChange={(e) => setD({ ...d, rtmCardsPerTeam: num(e.target.value) })} /></Field>
              </div>
            ) : null}
            <Checkbox id="f-d-ret" name="d-ret" checked={d.retentionsEnabled} onChange={(e) => setD({ ...d, retentionsEnabled: e.target.checked, maxRetentions: e.target.checked ? Math.max(d.maxRetentions, 1) : d.maxRetentions })} label="Retentions" />
          </div>
        </AdminSection>

        <AdminSection title="Presets" description="Named sets of default rules, offered when creating an auction.">
          <ul className="flex flex-col gap-2">
            {presets.length === 0 ? <li className="text-sm text-muted">No presets yet.</li> : null}
            {presets.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start gap-2 rounded-[var(--radius-sm)] border border-line p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name} {p.isExample ? <Badge tone="accent">Example, review every value</Badge> : null}</p>
                  {p.description ? <p className="text-sm text-muted">{p.description}</p> : null}
                </div>
                <Button size="sm" onClick={() => dup.run({ presetId: p.id }, () => router.refresh())} icon={<Copy className="size-4" aria-hidden="true" />}>Duplicate</Button>
                <Button size="sm" variant="ghost" onClick={() => setDelPreset(p)} icon={<Trash2 className="size-4" aria-hidden="true" />}>Delete</Button>
              </li>
            ))}
          </ul>
          <form className="mt-4 grid gap-3 rounded-[var(--radius-sm)] border border-dashed border-line-strong p-3" onSubmit={(e) => { e.preventDefault(); savePreset.run({ sportId: sport.id, name: presetName, description: presetDesc, config: config().defaults }, (r) => { if (r.ok) { setPresetName(""); setPresetDesc(""); router.refresh(); } }); }}>
            <p className="font-semibold">Save the defaults above as a new preset</p>
            {savePreset.result ? <FormStatus kind={savePreset.result.ok ? "success" : "error"}>{savePreset.result.ok ? savePreset.result.message : savePreset.result.error}</FormStatus> : null}
            <Field name="p-name" label="Preset name" error={savePreset.fieldErrors.name}><Input id="f-p-name" value={presetName} onChange={(e) => setPresetName(e.target.value)} maxLength={80} /></Field>
            <Field name="p-desc" label="Description" optional><Textarea id="f-p-desc" rows={2} value={presetDesc} onChange={(e) => setPresetDesc(e.target.value)} maxLength={400} /></Field>
            <div><Button type="submit" loading={savePreset.pending} disabled={presetName.trim().length < 2}>Save preset</Button></div>
          </form>
        </AdminSection>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start" aria-label="Preview">
        <AdminSection title="Preview">
          <p className="mb-3 text-sm text-muted">A player card and the role filter with these settings.</p>
          {previewRole ? (
            <div className="rounded-[var(--radius-md)] border border-line bg-surface-2 p-3">
              <div className="flex items-center gap-3">
                <PlayerAvatar name="Sample Player" photoPath={null} size={52} className="rounded-[var(--radius-sm)]" />
                <div>
                  <p className="font-semibold">Sample Player</p>
                  <RoleChip size="sm" label={previewRole.label || "Role"} index={roles.indexOf(previewRole)} subRole={previewRole.subRoles[0]} />
                </div>
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-1.5">
                {stats.filter((s) => s.showOnCard).map((s, i) => (
                  <div key={s.key} className="rounded-[var(--radius-xs)] bg-surface px-1.5 py-1">
                    <dt className="truncate text-[0.7rem] text-muted">{s.label || "Stat"}</dt>
                    <dd className="num text-sm font-bold">{formatStat(s.kind === "decimal" ? 70.5 + i : 12 + i * 7)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {roles.filter((r) => !r.hidden).map((r, i) => <RoleChip key={r.key} size="sm" label={r.label || "Role"} index={i} />)}
          </div>
        </AdminSection>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg lg:left-64">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="primary" loading={save.pending} icon={<Save className="size-4" aria-hidden="true" />} onClick={() => save.run({ sportId: sport.id, version: sport.version, name, config: config() }, (r) => r.ok && router.refresh())}>
            Save sport
          </Button>
          <span className="text-sm text-muted">Existing auctions keep their own rules.</span>
        </div>
      </div>

      <ConfirmDialog open={delPreset !== null} onClose={() => setDelPreset(null)} title={`Delete the preset "${delPreset?.name ?? ""}"?`} consequences={["Auctions already created from it are not affected."]} confirmLabel="Delete preset" danger busy={del.pending} onConfirm={() => delPreset && del.run({ presetId: delPreset.id }, () => { setDelPreset(null); router.refresh(); })} />
    </div>
  );
}
