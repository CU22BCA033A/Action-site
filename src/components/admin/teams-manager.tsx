"use client";

import { KeyRound, Pencil, Plus, Share2, ShieldOff, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { TeamMark } from "@/components/auction/identity";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Field, FormErrorSummary, FormStatus, Input, Textarea, describedBy } from "@/components/ui/field";
import { deleteTeamAction, endSessionAction, generateCodeAction, revokeCodeAction, saveTeamAction } from "@/lib/admin/actions/teams";
import type { ActionResult } from "@/lib/admin/result";
import type { AdminTeam } from "@/lib/admin/queries";
import { formatDateTime, formatPoints } from "@/lib/format";
import { contrastRatio } from "@/lib/media";
import { useAdminAction } from "./use-admin-action";

type Ctx = { auctionId: string; auctionName: string; status: string; defaultPurse: number; unit: string; joinUrl: string };

const ONLINE_MS = 90_000;

export function TeamsManager({ teams, ctx }: { teams: AdminTeam[]; ctx: Ctx }) {
  const [editing, setEditing] = useState<AdminTeam | "new" | null>(null);
  // Rendered on the server per request; stable within a render.
  const [now] = useState(() => Date.now());

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">
          {teams.length} teams. Each team has its own purse. Owners join with the team&apos;s access code; you can end any device&apos;s session.
        </p>
        <Button variant="primary" onClick={() => setEditing("new")} icon={<Plus className="size-4" aria-hidden="true" />}>
          Add team
        </Button>
      </div>
      <ul className="mt-5 grid gap-4 lg:grid-cols-2">
        {teams.map((t) => (
          <li key={t.id}>
            <TeamCard team={t} ctx={ctx} now={now} onEdit={() => setEditing(t)} />
          </li>
        ))}
      </ul>
      {editing ? <TeamDialog team={editing === "new" ? null : editing} ctx={ctx} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function TeamCard({ team, ctx, now, onEdit }: { team: AdminTeam; ctx: Ctx; now: number; onEdit: () => void }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"regen" | "revoke" | "delete" | null>(null);
  const gen = useAdminAction(generateCodeAction);
  const revoke = useAdminAction(revokeCodeAction);
  const del = useAdminAction(deleteTeamAction);
  const end = useAdminAction(endSessionAction);
  const online = team.sessions.filter((s) => now - Date.parse(s.lastSeenAt) < ONLINE_MS).length;

  const share = code
    ? `https://wa.me/?text=${encodeURIComponent(`${team.name}, ${ctx.auctionName}\nJoin to bid for your team: ${ctx.joinUrl}\nAccess code: ${code}\nKeep this code private.`)}`
    : "";

  const issue = () =>
    gen.run({ auctionId: ctx.auctionId, teamId: team.id }, (r) => {
      setConfirm(null);
      if (r.ok && r.data) setCode(r.data.code);
      router.refresh();
    });

  const busyResult: ActionResult<unknown> | null = gen.result ?? revoke.result ?? del.result ?? end.result;

  return (
    <article className="flex h-full flex-col rounded-[var(--radius-md)] border border-line bg-surface" aria-labelledby={`team-${team.id}`}>
      <div className="h-1.5 rounded-t-[var(--radius-md)]" style={{ background: team.primaryColor }} aria-hidden="true" />
      <div className="flex items-center gap-3 border-b border-line p-4">
        <TeamMark team={team} size={52} className="rounded-[var(--radius-sm)]" />
        <div className="min-w-0 flex-1">
          <h2 id={`team-${team.id}`} className="truncate text-lg uppercase">
            {team.name}
          </h2>
          <p className="truncate text-sm text-muted">{team.ownerDisplayName ? `Owner: ${team.ownerDisplayName}` : "No owner name"}</p>
        </div>
        <Button size="sm" onClick={onEdit} icon={<Pencil className="size-4" aria-hidden="true" />}>
          Edit
        </Button>
      </div>
      <dl className="num grid grid-cols-3 divide-x divide-line border-b border-line text-center">
        <div className="p-3">
          <dt className="text-xs text-muted">Purse</dt>
          <dd className="text-lg font-bold">{formatPoints(team.purseTotal)}</dd>
        </div>
        <div className="p-3">
          <dt className="text-xs text-muted">Spent</dt>
          <dd className="text-lg font-bold text-spent">{formatPoints(team.purseSpent)}</dd>
        </div>
        <div className="p-3">
          <dt className="text-xs text-muted">Players</dt>
          <dd className="text-lg font-bold">{team.squadCount}</dd>
        </div>
      </dl>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-sans text-sm font-bold">
            <KeyRound className="size-4 text-accent-text" aria-hidden="true" />
            Access code
          </h3>
          {team.codeActive ? <Badge tone="sold">Active, ends in {team.codeHint}</Badge> : <Badge tone="danger">No active code</Badge>}
        </div>

        {code ? (
          <div className="rounded-[var(--radius-sm)] border-2 border-accent-edge bg-surface-2 p-3" role="status">
            <p className="text-sm font-semibold">Give this code to the team owner. It is shown only now.</p>
            <p className="num mt-2 select-all text-3xl font-extrabold tracking-[0.15em] text-accent-text">{code}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton value={code} label="Copy code" />
              <CopyButton value={`${ctx.joinUrl}\n${code}`} label="Copy link and code" />
              <a href={share} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold hover:border-text">
                <Share2 className="size-4" aria-hidden="true" />
                Share on WhatsApp
              </a>
              <Button size="sm" variant="ghost" onClick={() => setCode(null)} icon={<X className="size-4" aria-hidden="true" />}>
                Hide
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={team.codeActive ? "secondary" : "primary"} loading={gen.pending} onClick={() => (team.codeActive ? setConfirm("regen") : issue())}>
            {team.codeActive ? "Regenerate code" : "Generate code"}
          </Button>
          {team.codeActive ? (
            <Button size="sm" variant="danger" onClick={() => setConfirm("revoke")} icon={<ShieldOff className="size-4" aria-hidden="true" />}>
              Revoke
            </Button>
          ) : null}
        </div>

        <div>
          <h3 className="font-sans text-sm font-bold">
            Signed-in devices <span className="num font-normal text-muted">({team.sessions.length} of {team.maxSessions}, {online} online now)</span>
          </h3>
          {team.sessions.length === 0 ? (
            <p className="mt-1 text-sm text-muted">Nobody is signed in for this team.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {team.sessions.map((s) => {
                const isOnline = now - Date.parse(s.lastSeenAt) < ONLINE_MS;
                return (
                  <li key={s.id} className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-surface-2 px-2 py-1.5 text-sm">
                    <Badge tone={isOnline ? "sold" : "neutral"}>{isOnline ? "Online" : "Away"}</Badge>
                    <span className="min-w-0 flex-1 truncate">
                      {s.userAgent || "Device"} <span className="text-muted">, since {formatDateTime(s.createdAt)}</span>
                    </span>
                    <Button size="sm" variant="ghost" loading={end.pending} onClick={() => end.run({ auctionId: ctx.auctionId, sessionId: s.id }, () => router.refresh())}>
                      End
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {busyResult && !busyResult.ok && !confirm ? <FormStatus kind="error">{busyResult.error}</FormStatus> : null}
        <div className="mt-auto pt-2">
          <Button size="sm" variant="quiet" onClick={() => setConfirm("delete")} icon={<Trash2 className="size-4" aria-hidden="true" />}>
            Delete team
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm === "regen"}
        onClose={() => setConfirm(null)}
        title={`New code for ${team.name}?`}
        consequences={["The current code stops working immediately.", `All ${team.sessions.length} signed-in devices for this team are signed out.`, "The new code is shown once."]}
        confirmLabel="Issue new code"
        busy={gen.pending}
        onConfirm={issue}
      />
      <ConfirmDialog
        open={confirm === "revoke"}
        onClose={() => setConfirm(null)}
        title={`Revoke ${team.name}'s code?`}
        consequences={["Nobody can join with this code any more.", "Every device signed in for this team is signed out at once.", "You can generate a new code later."]}
        confirmLabel="Revoke code"
        danger
        busy={revoke.pending}
        onConfirm={() => revoke.run({ auctionId: ctx.auctionId, teamId: team.id }, () => { setConfirm(null); router.refresh(); })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title={`Delete ${team.name}?`}
        consequences={["The team, its access code and every signed-in device are removed.", "Players it bought go back to the pool with their points refunded, so they can be auctioned again.", "Its bids stay in the history, marked void. If it is leading the player on the floor, that player goes back to the pool."]}
        confirmLabel="Delete team"
        danger
        busy={del.pending}
        error={del.result && !del.result.ok ? del.result.error : null}
        onConfirm={() => del.run({ auctionId: ctx.auctionId, teamId: team.id }, (r) => { if (r.ok) { setConfirm(null); router.refresh(); } })}
      />
    </article>
  );
}

function TeamDialog({ team, ctx, onClose }: { team: AdminTeam | null; ctx: Ctx; onClose: () => void }) {
  const router = useRouter();
  const save = useAdminAction(saveTeamAction);
  const [primary, setPrimary] = useState(team?.primaryColor ?? "#1F6FEB");
  const [secondary, setSecondary] = useState(team?.secondaryColor ?? "#F2F4F8");
  const [purse, setPurse] = useState(String(team?.purseTotal ?? ctx.defaultPurse));
  const [preview, setPreview] = useState<string | null>(null);
  const [removeLogo, setRemoveLogo] = useState(false);
  const fe = save.fieldErrors;
  const purseChanged = team && Number(purse) !== team.purseTotal;
  const needsReason = Boolean(purseChanged && ctx.status !== "draft" && ctx.status !== "scheduled");
  const lowContrast = contrastRatio(primary, "#FFFFFF") < 3 && contrastRatio(primary, "#000000") < 3;

  return (
    <Dialog open onClose={onClose} title={team ? `Edit ${team.name}` : "Add team"} size="lg">
      <form
        className="flex flex-col gap-4"
        encType="multipart/form-data"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("auctionId", ctx.auctionId);
          if (team) {
            fd.set("teamId", team.id);
            fd.set("version", String(team.version));
          }
          fd.set("removeLogo", removeLogo ? "1" : "");
          save.run(fd as never, (r) => {
            if (r.ok) {
              onClose();
              router.refresh();
            }
          });
        }}
      >
        {save.result && !save.result.ok ? (
          Object.keys(fe).length ? (
            <FormErrorSummary title={save.result.error} errors={Object.entries(fe).map(([name, message]) => ({ name, message }))} />
          ) : (
            <FormStatus kind="error">{save.result.error}</FormStatus>
          )
        ) : null}
        <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
          <Field name="name" label="Team name" error={fe.name}>
            <Input id="f-name" name="name" defaultValue={team?.name} required maxLength={80} aria-invalid={fe.name ? true : undefined} aria-describedby={describedBy("name", false, Boolean(fe.name))} />
          </Field>
          <Field name="shortName" label="Short name" error={fe.shortName}>
            <Input id="f-shortName" name="shortName" defaultValue={team?.shortName} required maxLength={6} className="num uppercase" aria-invalid={fe.shortName ? true : undefined} aria-describedby={describedBy("shortName", false, Boolean(fe.shortName))} />
          </Field>
        </div>
        <Field name="ownerDisplayName" label="Owner display name" optional hint="Shown publicly on the team page. Leave empty to hide." error={fe.ownerDisplayName}>
          <Input id="f-ownerDisplayName" name="ownerDisplayName" defaultValue={team?.ownerDisplayName} maxLength={80} aria-describedby={describedBy("ownerDisplayName", true, false)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="purseTotal" label={`Purse (${ctx.unit})`} hint={team ? `Already spent: ${formatPoints(team.purseSpent)}. The purse cannot go below that.` : "Prefilled from the auction default."} error={fe.purseTotal}>
            <Input id="f-purseTotal" name="purseTotal" inputMode="numeric" className="num" value={purse} onChange={(e) => setPurse(e.target.value.replace(/[^\d]/g, ""))} aria-invalid={fe.purseTotal ? true : undefined} aria-describedby={describedBy("purseTotal", true, Boolean(fe.purseTotal))} />
          </Field>
          <Field name="maxSessions" label="Devices allowed at once" hint="How many phones can use the code at the same time." error={fe.maxSessions}>
            <Input id="f-maxSessions" name="maxSessions" type="number" min={1} max={10} defaultValue={team?.maxSessions ?? 2} className="num" aria-describedby={describedBy("maxSessions", true, Boolean(fe.maxSessions))} />
          </Field>
        </div>
        {needsReason ? (
          <Field name="reason" label="Reason for changing the purse (saved in the audit log)" error={fe.reason}>
            <Textarea id="f-reason" name="reason" rows={2} maxLength={300} required aria-invalid={fe.reason ? true : undefined} aria-describedby={describedBy("reason", false, Boolean(fe.reason))} />
          </Field>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="primaryColor" label="Main colour" error={fe.primaryColor}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick main colour" value={primary} onChange={(e) => setPrimary(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-[var(--radius-sm)] border border-line bg-transparent" />
              <Input id="f-primaryColor" name="primaryColor" value={primary} onChange={(e) => setPrimary(e.target.value)} className="num" maxLength={7} />
            </div>
          </Field>
          <Field name="secondaryColor" label="Second colour" error={fe.secondaryColor}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label="Pick second colour" value={secondary} onChange={(e) => setSecondary(e.target.value.toUpperCase())} className="h-11 w-14 cursor-pointer rounded-[var(--radius-sm)] border border-line bg-transparent" />
              <Input id="f-secondaryColor" name="secondaryColor" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="num" maxLength={7} />
            </div>
          </Field>
        </div>
        {lowContrast ? <p className="text-sm text-muted">This main colour is mid-tone. Short names on it are drawn in whichever of black or white reads better.</p> : null}
        <Field name="logo" label="Logo" optional hint="JPEG, PNG or WebP, up to 3 MB. Stored as a small WebP." error={fe.logo}>
          <div className="flex flex-wrap items-center gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="New logo preview" width={56} height={56} className="size-14 rounded-[var(--radius-sm)] border border-line object-contain" />
            ) : team && !removeLogo ? (
              <TeamMark team={{ ...team, primaryColor: primary }} size={56} className="rounded-[var(--radius-sm)]" />
            ) : null}
            <input
              id="f-logo"
              name="logo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-describedby={describedBy("logo", true, Boolean(fe.logo))}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
                setRemoveLogo(false);
              }}
              className="text-sm file:mr-3 file:h-10 file:rounded-[var(--radius-sm)] file:border file:border-line-strong file:bg-surface-2 file:px-3 file:font-semibold file:text-text"
            />
            {team?.logoPath && !preview ? (
              <Button size="sm" variant="ghost" onClick={() => setRemoveLogo((v) => !v)} aria-pressed={removeLogo}>
                {removeLogo ? "Keep logo" : "Remove logo"}
              </Button>
            ) : null}
          </div>
        </Field>
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose} disabled={save.pending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={save.pending} loadingLabel="Saving">
            {team ? "Save team" : "Add team"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
