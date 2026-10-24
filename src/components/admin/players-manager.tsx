"use client";

import { Camera, FileUp, Lock, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PlayerAvatar, RoleChip } from "@/components/auction/identity";
import { Badge, statusTone } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, Textarea, describedBy } from "@/components/ui/field";
import { bulkPlayersAction, importPlayersCsvAction, retainPlayerAction, savePlayerAction, setPlayerPhotoAction, type ImportReport } from "@/lib/admin/actions/players";
import { isUnder18 } from "@/lib/admin/player-input";
import type { AdminPlayer, AdminTeam } from "@/lib/admin/queries";
import { formatPoints } from "@/lib/format";
import type { SportConfig } from "@/lib/sports/config";
import { slugify } from "./new-auction-form";
import { useAdminAction } from "./use-admin-action";

type Ctx = {
  auctionId: string;
  status: string;
  unit: string;
  config: SportConfig;
  categoryPrices: Record<string, number>;
  defaultBasePrice: number;
  retentionsEnabled: boolean;
  teams: Pick<AdminTeam, "id" | "name" | "shortName">[];
};

export function PlayersManager({ players, ctx }: { players: AdminPlayer[]; ctx: Ctx }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [set, setSet] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<AdminPlayer | "new" | null>(null);
  const [dialog, setDialog] = useState<"import" | "photos" | "bulkSet" | "bulkPrice" | "bulkDelete" | null>(null);
  const [retaining, setRetaining] = useState<AdminPlayer | null>(null);
  const preLive = ctx.status === "draft" || ctx.status === "scheduled";
  const roles = ctx.config.roles;
  const sets = useMemo(() => [...new Set(players.map((p) => p.setName))], [players]);
  const teamName = (id: string | null) => ctx.teams.find((t) => t.id === id)?.name ?? "";

  const filtered = players.filter((p) => {
    const term = q.trim().toLowerCase();
    if (term && !p.fullName.toLowerCase().includes(term) && String(p.lotNo) !== term.replace(/^#/, "")) return false;
    if (role && p.roleKey !== role) return false;
    if (status && p.status !== status) return false;
    if (set && p.setName !== set) return false;
    return true;
  });
  const groups = roles
    .map((r, index) => ({ role: r, index, items: filtered.filter((p) => p.roleKey === r.key) }))
    .filter((g) => g.items.length > 0);
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {players.length} players. Lists group by the sport&apos;s roles. Set and base price changes apply to players in the pool or unsold; delete works on any player.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setDialog("photos")} icon={<Camera className="size-4" aria-hidden="true" />}>
            Upload photos
          </Button>
          <Button onClick={() => setDialog("import")} icon={<FileUp className="size-4" aria-hidden="true" />}>
            Import CSV
          </Button>
          <Button variant="primary" onClick={() => setEditing("new")} icon={<Plus className="size-4" aria-hidden="true" />}>
            Add player
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="relative">
          <label htmlFor="p-search" className="sr-only">Search by name or lot number</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <Input id="p-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" placeholder="Name or lot number" />
        </div>
        <SelectWrap>
          <label htmlFor="p-role" className="sr-only">Role</label>
          <Select id="p-role" value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">All roles</option>
            {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </Select>
        </SelectWrap>
        <SelectWrap>
          <label htmlFor="p-status" className="sr-only">Status</label>
          <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            {["pool", "on_floor", "sold", "unsold", "retained"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </Select>
        </SelectWrap>
        <SelectWrap>
          <label htmlFor="p-set" className="sr-only">Set</label>
          <Select id="p-set" value={set} onChange={(e) => setSet(e.target.value)}>
            <option value="">All sets</option>
            {sets.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>
        </SelectWrap>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">Showing {filtered.length} of {players.length}</p>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-md)] border border-line bg-surface p-5 text-muted">{players.length ? "No players match these filters." : "No players yet. Add them one by one, import a CSV, or open registration."}</p>
      ) : (
        groups.map((g) => (
          <section key={g.role.key} className="mt-6" aria-labelledby={`role-${g.role.key}`}>
            <h2 id={`role-${g.role.key}`} className="flex items-center gap-2 text-lg">
              <RoleChip label={g.role.label} index={g.index} />
              <span className="num text-sm text-muted">({g.items.length})</span>
            </h2>
            <ul className="mt-2 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
              {g.items.map((p) => {
                const editable = p.status === "pool" || p.status === "unsold";
                return (
                  <li key={p.auctionPlayerId} className="grid grid-cols-[auto_auto_1fr] items-center gap-3 p-3 md:grid-cols-[auto_auto_minmax(0,1fr)_8rem_7rem_9rem_auto]">
                    <input
                      type="checkbox"
                      aria-label={`Select ${p.fullName}`}
                      checked={selected.has(p.auctionPlayerId)}
                      onChange={() => toggle(p.auctionPlayerId)}
                      className="size-5 accent-[var(--accent)]"
                    />
                    <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={44} className="rounded-[var(--radius-sm)]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        <span className="num mr-2 text-xs text-info">#{String(p.lotNo).padStart(3, "0")}</span>
                        {p.fullName}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {[p.subRole, p.category ? `Cat ${p.category}` : null, p.nationalityGroup === "overseas" ? "Overseas" : null, p.dateOfBirth && isUnder18(p.dateOfBirth) ? (p.guardianConsent ? "Under 18, consent recorded" : "Under 18, consent missing") : null].filter(Boolean).join(" / ") || "No details"}
                      </p>
                    </div>
                    <p className="col-span-3 text-sm md:col-span-1">
                      <span className="text-muted md:sr-only">Set: </span>
                      {p.setName}
                    </p>
                    <p className="num text-sm">
                      <span className="text-muted">Base </span>
                      {formatPoints(p.basePrice)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <Badge tone={statusTone(p.status)}>{p.status.replace("_", " ")}</Badge>
                      {p.soldPrice !== null ? <span className="num text-xs text-muted">{formatPoints(p.soldPrice)} {teamName(p.soldToTeamId)}</span> : null}
                    </div>
                    <div className="col-span-3 flex flex-wrap justify-end gap-1 md:col-span-1">
                      {ctx.retentionsEnabled && preLive && p.status === "pool" ? (
                        <Button size="sm" variant="ghost" onClick={() => setRetaining(p)} icon={<Lock className="size-4" aria-hidden="true" />}>
                          Retain
                        </Button>
                      ) : null}
                      <Button size="sm" onClick={() => setEditing(p)} icon={<Pencil className="size-4" aria-hidden="true" />} aria-label={`Edit ${p.fullName}`}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setSelected(new Set([p.auctionPlayerId])); setDialog("bulkDelete"); }} icon={<Trash2 className="size-4" aria-hidden="true" />} aria-label={`Delete ${p.fullName}`}>
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}

      {selected.size > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
            <span className="num font-semibold" aria-live="polite">{selected.size} selected</span>
            <Button size="sm" onClick={() => setDialog("bulkSet")}>Move to set</Button>
            <Button size="sm" onClick={() => setDialog("bulkPrice")}>Set base price</Button>
            <Button size="sm" variant="danger" onClick={() => setDialog("bulkDelete")} icon={<Trash2 className="size-4" aria-hidden="true" />}>Delete</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>
          </div>
        </div>
      ) : null}

      {editing ? <PlayerDialog player={editing === "new" ? null : editing} ctx={ctx} sets={sets} onClose={() => setEditing(null)} /> : null}
      {dialog === "import" ? <ImportDialog ctx={ctx} onClose={() => { setDialog(null); router.refresh(); }} /> : null}
      {dialog === "photos" ? <PhotosDialog ctx={ctx} players={players} onClose={() => { setDialog(null); router.refresh(); }} /> : null}
      {dialog === "bulkSet" || dialog === "bulkPrice" || dialog === "bulkDelete" ? (
        <BulkDialog kind={dialog} ids={[...selected]} ctx={ctx} sets={sets} onClose={(done) => { setDialog(null); if (done) { setSelected(new Set()); router.refresh(); } }} />
      ) : null}
      {retaining ? <RetainDialog player={retaining} ctx={ctx} onClose={() => { setRetaining(null); router.refresh(); }} /> : null}
    </div>
  );
}

function PlayerDialog({ player, ctx, sets, onClose }: { player: AdminPlayer | null; ctx: Ctx; sets: string[]; onClose: () => void }) {
  const router = useRouter();
  const save = useAdminAction(savePlayerAction);
  const cfg = ctx.config;
  const firstRole = cfg.roles.find((r) => !r.hidden) ?? cfg.roles[0]!;
  const [roleKey, setRoleKey] = useState(player?.roleKey ?? firstRole.key);
  const [subRole, setSubRole] = useState(player?.subRole ?? "");
  const [category, setCategory] = useState(player?.category ?? "");
  const [tags, setTags] = useState<string[]>(player?.tags ?? []);
  const [nat, setNat] = useState<"domestic" | "overseas">(player?.nationalityGroup ?? "domestic");
  const [stats, setStats] = useState<Record<string, string>>(Object.fromEntries(Object.entries(player?.stats ?? {}).map(([k, v]) => [k, String(v)])));
  const [bio, setBio] = useState(player?.bioShort ?? "");
  const [dob, setDob] = useState(player?.dateOfBirth ?? "");
  const [consent, setConsent] = useState(Boolean(player?.guardianConsent));
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const role = cfg.roles.find((r) => r.key === roleKey);
  const fe = save.fieldErrors;
  const under18 = isUnder18(dob || null);
  const editable = !player || player.status === "pool" || player.status === "unsold";
  const defaultPrice = category && ctx.categoryPrices[category] !== undefined ? ctx.categoryPrices[category]! : ctx.defaultBasePrice;

  return (
    <Dialog open onClose={onClose} title={player ? `Edit ${player.fullName}` : "Add player"} size="lg">
      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const statsNum: Record<string, number> = {};
          for (const [k, v] of Object.entries(stats)) if (v.trim() !== "") statsNum[k] = Number(v);
          fd.set("auctionId", ctx.auctionId);
          if (player) {
            fd.set("auctionPlayerId", player.auctionPlayerId);
            fd.set("version", String(player.version));
          }
          fd.set("removePhoto", removePhoto ? "1" : "");
          fd.set(
            "player",
            JSON.stringify({
              fullName: fd.get("fullName"),
              roleKey,
              subRole: subRole || undefined,
              category: category || undefined,
              tags,
              nationalityGroup: nat,
              stats: statsNum,
              bioShort: bio,
              dateOfBirth: dob || undefined,
              guardianConsent: under18 ? consent : dob ? null : null,
            }),
          );
          save.run(fd as never, (r) => {
            if (r.ok) {
              onClose();
              router.refresh();
            }
          });
        }}
      >
        {save.result && !save.result.ok ? (
          Object.keys(fe).length ? <FormErrorSummary title={save.result.error} errors={Object.entries(fe).map(([name, message]) => ({ name, message: `${name}: ${message}` }))} /> : <FormStatus kind="error">{save.result.error}</FormStatus>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="New photo preview, cropped square" width={112} height={112} className="size-28 rounded-[var(--radius-md)] border border-line object-cover" />
            ) : (
              <PlayerAvatar name={player?.fullName ?? "New player"} photoPath={removePhoto ? null : player?.photoPath} size={112} className="rounded-[var(--radius-md)] border border-line" />
            )}
            <label htmlFor="f-photo" className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold hover:border-text">
              <Upload className="size-4" aria-hidden="true" /> Photo
            </label>
            <input
              id="f-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
                setRemovePhoto(false);
              }}
            />
            {player?.photoPath && !preview ? (
              <Button size="sm" variant="quiet" onClick={() => setRemovePhoto((v) => !v)} aria-pressed={removePhoto}>
                {removePhoto ? "Keep photo" : "Remove photo"}
              </Button>
            ) : null}
            {fe.photo ? <p className="text-sm text-danger">{fe.photo}</p> : null}
          </div>
          <div className="flex flex-col gap-4">
            <Field name="fullName" label="Full name" error={fe.fullName}>
              <Input id="f-fullName" name="fullName" defaultValue={player?.fullName} maxLength={80} required aria-invalid={fe.fullName ? true : undefined} aria-describedby={describedBy("fullName", false, Boolean(fe.fullName))} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="roleKey" label="Role" error={fe.roleKey}>
                <SelectWrap>
                  <Select id="f-roleKey" value={roleKey} onChange={(e) => { setRoleKey(e.target.value); setSubRole(""); }}>
                    {cfg.roles.filter((r) => !r.hidden || r.key === roleKey).map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </Select>
                </SelectWrap>
              </Field>
              {role?.subRoles.length ? (
                <Field name="subRole" label="Sub-role" optional error={fe.subRole}>
                  <SelectWrap>
                    <Select id="f-subRole" value={subRole} onChange={(e) => setSubRole(e.target.value)}>
                      <option value="">None</option>
                      {role.subRoles.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </SelectWrap>
                </Field>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {cfg.categories.length ? (
            <Field name="category" label="Category" optional error={fe.category}>
              <SelectWrap>
                <Select id="f-category" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">None</option>
                  {cfg.categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </SelectWrap>
            </Field>
          ) : null}
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Nationality</legend>
            <div className="flex gap-4">
              {(["domestic", "overseas"] as const).map((n) => (
                <label key={n} className="flex min-h-11 cursor-pointer items-center gap-2">
                  <input type="radio" name="nat" checked={nat === n} onChange={() => setNat(n)} className="size-5 accent-[var(--accent)]" />
                  {n === "domestic" ? "Domestic" : "Overseas"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {cfg.tags.length ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Tags</legend>
            <div className="flex flex-wrap gap-3">
              {cfg.tags.map((tg) => (
                <label key={tg} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={tags.includes(tg)} onChange={(e) => setTags((t) => (e.target.checked ? [...t, tg] : t.filter((x) => x !== tg)))} className="size-5 accent-[var(--accent)]" />
                  {tg}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {cfg.statFields.length ? (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold">Stats <span className="font-normal text-faint">Optional</span></legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {cfg.statFields.map((s) => (
                <Field key={s.key} name={`stats.${s.key}`} label={s.label} error={fe[`stats.${s.key}`]}>
                  <Input id={`f-stats.${s.key}`} inputMode={s.kind === "decimal" ? "decimal" : "numeric"} className="num" value={stats[s.key] ?? ""} onChange={(e) => setStats((x) => ({ ...x, [s.key]: e.target.value.replace(s.kind === "decimal" ? /[^\d.]/g : /[^\d]/g, "") }))} />
                </Field>
              ))}
            </div>
          </fieldset>
        ) : null}
        <Field name="bioShort" label="Short bio" optional hint={`${bio.length} of 160 characters`} error={fe.bioShort}>
          <Textarea id="f-bioShort" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} aria-describedby={describedBy("bioShort", true, Boolean(fe.bioShort))} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="dateOfBirth" label="Date of birth" optional hint="Only the age group is shown publicly." error={fe.dateOfBirth}>
            <Input id="f-dateOfBirth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} aria-describedby={describedBy("dateOfBirth", true, Boolean(fe.dateOfBirth))} />
          </Field>
          {under18 ? (
            <div className="self-end">
              <Checkbox id="f-guardianConsent" name="guardianConsent" checked={consent} onChange={(e) => setConsent(e.target.checked)} error={fe.guardianConsent} label="A parent or guardian has agreed to this player's profile being published" />
            </div>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="setName" label="Set" error={fe.setName}>
            <Input id="f-setName" name="setName" list="set-names" defaultValue={player?.setName ?? sets[0] ?? "Main"} maxLength={40} />
            <datalist id="set-names">{sets.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field name="setOrder" label="Set order" hint="Lower sets come first." error={fe.setOrder}>
            <Input id="f-setOrder" name="setOrder" type="number" min={0} max={999} defaultValue={player?.setOrder ?? 1} className="num" aria-describedby={describedBy("setOrder", true, false)} />
          </Field>
          <Field name="basePrice" label={`Base price (${ctx.unit})`} hint={editable ? `Empty uses ${formatPoints(defaultPrice)}.` : "Locked after the sale."} error={fe.basePrice}>
            <Input id="f-basePrice" name="basePrice" inputMode="numeric" className="num" defaultValue={player ? String(player.basePrice) : ""} disabled={!editable} aria-describedby={describedBy("basePrice", true, Boolean(fe.basePrice))} />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>Cancel</Button>
          <Button type="submit" variant="primary" loading={save.pending} loadingLabel="Saving">{player ? "Save player" : "Add player"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

function ImportDialog({ ctx, onClose }: { ctx: Ctx; onClose: () => void }) {
  const run = useAdminAction(importPlayersCsvAction);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const report: ImportReport | undefined = run.result?.ok ? run.result.data : undefined;
  const imported = report?.imported !== undefined;

  return (
    <Dialog open onClose={onClose} title="Import players from CSV" size="lg">
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
        <li>
          Download the{" "}
          <a className="link font-semibold text-accent-text" href={`/admin/auctions/${ctx.auctionId}/players/template`}>CSV template</a>{" "}
          for this sport. It has the role keys, categories and stat columns already set.
        </li>
        <li>Fill one player per row. Role can be the key or the label. Separate tags with a semicolon.</li>
        <li>Check the file, fix any rows listed, then import the valid rows.</li>
        <li>Add photos afterwards with Upload photos, matched by lot number or name.</li>
      </ol>
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor="csv-file" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-4 font-semibold hover:border-text">
          <FileUp className="size-4" aria-hidden="true" /> Choose CSV file
        </label>
        <input
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setFileName(f.name);
            setCsv(await f.text());
            run.reset();
          }}
        />
        <span className="text-sm text-muted">{fileName || "No file chosen"}</span>
      </div>
      {run.result && !run.result.ok ? <FormStatus kind="error">{run.result.error}</FormStatus> : null}
      {report ? (
        <div className="flex flex-col gap-3">
          {report.headerErrors.length ? (
            <FormStatus kind="error">
              <ul className="list-disc pl-5">{report.headerErrors.map((h) => <li key={h}>{h}</li>)}</ul>
            </FormStatus>
          ) : imported ? (
            <FormStatus kind="success">{report.imported === 1 ? "1 player imported." : `${report.imported} players imported.`} {report.invalid ? `${report.invalid} ${report.invalid === 1 ? "row" : "rows"} with problems skipped.` : ""}</FormStatus>
          ) : (
            <FormStatus kind={report.invalid ? "info" : "success"}>
              {report.valid === 1 ? "1 row is ready." : `${report.valid} rows are ready.`} {report.invalid === 0 ? "No problems found." : report.invalid === 1 ? "1 row has problems." : `${report.invalid} rows have problems.`}
            </FormStatus>
          )}
          {report.rows.some((r) => !r.ok) ? (
            <div className="max-h-64 overflow-y-auto rounded-[var(--radius-sm)] border border-line scrollbar-thin">
              <table className="w-full text-sm">
                <caption className="sr-only">Rows with problems</caption>
                <thead className="sticky top-0 bg-surface-2">
                  <tr><th scope="col" className="p-2 text-left">Line</th><th scope="col" className="p-2 text-left">Problems</th></tr>
                </thead>
                <tbody>
                  {report.rows.filter((r) => !r.ok).map((r) => (
                    <tr key={r.line} className="border-t border-line align-top">
                      <td className="num p-2">{r.line}</td>
                      <td className="p-2 text-danger">{r.errors.join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose}>{imported ? "Close" : "Cancel"}</Button>
        {!imported ? (
          <>
            <Button disabled={!csv} loading={run.pending && !report} onClick={() => csv && run.run({ auctionId: ctx.auctionId, csv, commit: false })}>Check file</Button>
            <Button variant="primary" disabled={!csv || !report || report.valid === 0 || report.headerErrors.length > 0} loading={run.pending && Boolean(report)} onClick={() => csv && run.run({ auctionId: ctx.auctionId, csv, commit: true })}>
              Import {report?.valid ?? 0} valid {report?.valid === 1 ? "row" : "rows"}
            </Button>
          </>
        ) : null}
      </div>
    </Dialog>
  );
}

function matchPhoto(name: string, players: AdminPlayer[]) {
  const stem = name.replace(/\.[^.]+$/, "");
  const lot = stem.match(/^(?:lot[-_ ]?)?#?0*(\d{1,5})$/i);
  if (lot) return players.find((p) => p.lotNo === Number(lot[1]));
  const slug = slugify(stem);
  return players.find((p) => slugify(p.fullName) === slug);
}

function PhotosDialog({ ctx, players, onClose }: { ctx: Ctx; players: AdminPlayer[]; onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<string, "waiting" | "done" | string>>({});
  const [running, setRunning] = useState(false);
  const matches = files.map((f) => ({ file: f, player: matchPhoto(f.name, players) }));
  const matched = matches.filter((m) => m.player);

  async function upload() {
    setRunning(true);
    for (const m of matched) {
      const fd = new FormData();
      fd.set("auctionId", ctx.auctionId);
      fd.set("auctionPlayerId", m.player!.auctionPlayerId);
      fd.set("photo", m.file);
      try {
        const r = await setPlayerPhotoAction(fd);
        setProgress((p) => ({ ...p, [m.file.name]: r.ok ? "done" : r.error }));
      } catch {
        setProgress((p) => ({ ...p, [m.file.name]: "Upload failed." }));
      }
    }
    setRunning(false);
  }

  const doneCount = Object.values(progress).filter((v) => v === "done").length;
  return (
    <Dialog open onClose={running ? () => {} : onClose} title="Upload player photos" size="lg">
      <p className="text-sm text-muted">
        Name each file after the player&apos;s lot number (for example <code className="num">12.jpg</code> or <code className="num">lot-012.png</code>) or full name (<code>arvan-kelovel.jpg</code>). JPEG, PNG or WebP, up to 3 MB each. Each photo is cropped square and compressed.
      </p>
      <div>
        <label htmlFor="photo-files" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-4 font-semibold hover:border-text">
          <Camera className="size-4" aria-hidden="true" /> Choose photos
        </label>
        <input id="photo-files" type="file" multiple accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => { setFiles([...(e.target.files ?? [])]); setProgress({}); }} />
      </div>
      {files.length ? (
        <div className="max-h-72 overflow-y-auto rounded-[var(--radius-sm)] border border-line scrollbar-thin">
          <table className="w-full text-sm">
            <caption className="sr-only">Photo matches</caption>
            <thead className="sticky top-0 bg-surface-2"><tr><th scope="col" className="p-2 text-left">File</th><th scope="col" className="p-2 text-left">Player</th><th scope="col" className="p-2 text-left">Result</th></tr></thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.file.name} className="border-t border-line">
                  <td className="max-w-40 truncate p-2">{m.file.name}</td>
                  <td className="p-2">{m.player ? `#${m.player.lotNo} ${m.player.fullName}` : <span className="text-danger">No match</span>}</td>
                  <td className="p-2">{progress[m.file.name] === "done" ? <Badge tone="sold">Saved</Badge> : progress[m.file.name] ? <span className="text-danger">{progress[m.file.name]}</span> : m.player ? "Ready" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-sm" aria-live="polite">{files.length ? `${matched.length} of ${files.length} files matched. ${doneCount ? `${doneCount} saved.` : ""}` : ""}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={running}>Close</Button>
        <Button variant="primary" disabled={matched.length === 0 || running} loading={running} loadingLabel="Uploading" onClick={upload}>Upload {matched.length} {matched.length === 1 ? "photo" : "photos"}</Button>
      </div>
    </Dialog>
  );
}

function BulkDialog({ kind, ids, ctx, sets, onClose }: { kind: "bulkSet" | "bulkPrice" | "bulkDelete"; ids: string[]; ctx: Ctx; sets: string[]; onClose: (done: boolean) => void }) {
  const run = useAdminAction(bulkPlayersAction);
  const [setName, setSetName] = useState(sets[0] ?? "Main");
  const [setOrder, setSetOrder] = useState("1");
  const [price, setPrice] = useState("");
  if (kind === "bulkDelete") {
    return (
      <ConfirmDialog
        open
        onClose={() => onClose(false)}
        title={ids.length === 1 ? "Delete this player?" : `Delete ${ids.length} players?`}
        consequences={["They are removed from this auction, with their bids and photos.", "Sold players give their points back to the team that bought them.", "A player on the floor is taken off it first. The audit log keeps the names."]}
        confirmLabel="Delete players"
        danger
        busy={run.pending}
        error={run.result && !run.result.ok ? run.result.error : null}
        onConfirm={() => run.run({ auctionId: ctx.auctionId, ids, action: "delete" }, (r) => r.ok && onClose(true))}
      />
    );
  }
  return (
    <Dialog open onClose={() => onClose(false)} title={kind === "bulkSet" ? `Move ${ids.length} players to a set` : `Set base price for ${ids.length} players`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (kind === "bulkSet") run.run({ auctionId: ctx.auctionId, ids, action: "set", setName, setOrder: Number(setOrder) }, (r) => r.ok && onClose(true));
          else run.run({ auctionId: ctx.auctionId, ids, action: "basePrice", basePrice: Number(price) }, (r) => r.ok && onClose(true));
        }}
      >
        {run.result && !run.result.ok ? <FormStatus kind="error">{run.result.error}</FormStatus> : null}
        {kind === "bulkSet" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="bulkSetName" label="Set name">
              <Input id="f-bulkSetName" list="bulk-sets" value={setName} onChange={(e) => setSetName(e.target.value)} maxLength={40} />
              <datalist id="bulk-sets">{sets.map((s) => <option key={s} value={s} />)}</datalist>
            </Field>
            <Field name="bulkSetOrder" label="Set order">
              <Input id="f-bulkSetOrder" type="number" min={0} max={999} value={setOrder} onChange={(e) => setSetOrder(e.target.value)} className="num" />
            </Field>
          </div>
        ) : (
          <Field name="bulkPrice" label={`Base price (${ctx.unit})`}>
            <Input id="f-bulkPrice" inputMode="numeric" className="num" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} required />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onClose(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={run.pending} disabled={kind === "bulkPrice" && price === ""}>Apply</Button>
        </div>
      </form>
    </Dialog>
  );
}

function RetainDialog({ player, ctx, onClose }: { player: AdminPlayer; ctx: Ctx; onClose: () => void }) {
  const run = useAdminAction(retainPlayerAction);
  const [teamId, setTeamId] = useState(player.previousTeamId ?? ctx.teams[0]?.id ?? "");
  const [price, setPrice] = useState(String(player.basePrice));
  return (
    <Dialog open onClose={onClose} title={`Retain ${player.fullName}`} description="The player joins the team before bidding starts. The price comes out of that team's purse.">
      <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); run.run({ auctionId: ctx.auctionId, auctionPlayerId: player.auctionPlayerId, teamId, price: Number(price) }, (r) => r.ok && onClose()); }}>
        {run.result && !run.result.ok ? <FormStatus kind="error">{run.result.error}</FormStatus> : null}
        <Field name="retainTeam" label="Team">
          <SelectWrap>
            <Select id="f-retainTeam" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {ctx.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </SelectWrap>
        </Field>
        <Field name="retainPrice" label={`Retention price (${ctx.unit})`}>
          <Input id="f-retainPrice" inputMode="numeric" className="num" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={run.pending}>Retain player</Button>
        </div>
      </form>
    </Dialog>
  );
}
