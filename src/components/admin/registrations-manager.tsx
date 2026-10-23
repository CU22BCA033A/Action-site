"use client";

import { Check, ClipboardCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerAvatar } from "@/components/auction/identity";
import { Badge, statusTone } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog } from "@/components/ui/dialog";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, Textarea } from "@/components/ui/field";
import { approveRegistrationAction, deleteRegistrationAction, rejectRegistrationAction, setRegistrationOpenAction } from "@/lib/admin/actions/registrations";
import { isUnder18 } from "@/lib/admin/player-input";
import type { AdminRegistration } from "@/lib/admin/queries";
import { formatDateTime, formatPoints } from "@/lib/format";
import type { SportConfig } from "@/lib/sports/config";
import { useAdminAction } from "./use-admin-action";

type Ctx = { auctionId: string; open: boolean; link: string; config: SportConfig; sets: string[]; categoryPrices: Record<string, number>; defaultBasePrice: number; unit: string };

export function RegistrationsManager({ regs, ctx }: { regs: AdminRegistration[]; ctx: Ctx }) {
  const router = useRouter();
  const toggle = useAdminAction(setRegistrationOpenAction);
  const [reviewing, setReviewing] = useState<AdminRegistration | null>(null);
  const [rejecting, setRejecting] = useState<AdminRegistration | null>(null);
  const [deleting, setDeleting] = useState<AdminRegistration | null>(null);
  const reject = useAdminAction(rejectRegistrationAction);
  const del = useAdminAction(deleteRegistrationAction);
  const pending = regs.filter((r) => r.status === "pending");
  const roleLabel = (k: string) => ctx.config.roles.find((r) => r.key === k)?.label ?? k;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            Public registration <Badge tone={ctx.open ? "sold" : "neutral"}>{ctx.open ? "Open" : "Closed"}</Badge>
          </p>
          <p className="mt-1 break-all text-sm text-muted">{ctx.link}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={ctx.link} label="Copy registration link" />
          <Button size="sm" variant={ctx.open ? "secondary" : "primary"} loading={toggle.pending} onClick={() => toggle.run({ auctionId: ctx.auctionId, open: !ctx.open }, () => router.refresh())}>
            {ctx.open ? "Close registration" : "Open registration"}
          </Button>
        </div>
      </div>

      <h2 className="mt-6 text-2xl">
        Waiting for review <span className="num text-muted">({pending.length})</span>
      </h2>
      {regs.length === 0 ? (
        <p className="mt-3 text-muted">No registrations yet. Open registration and share the link.</p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {regs.map((r) => (
            <li key={r.id} className="flex gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-4">
              <PlayerAvatar name={r.fullName} photoPath={r.photoPath} size={96} className="rounded-[var(--radius-md)] border border-line" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={r.status === "pending" ? "accent" : statusTone(r.status === "approved" ? "sold" : "unsold")}>{r.status}</Badge>
                  <span className="num text-xs text-muted">{r.referenceId}</span>
                </div>
                <p className="truncate text-lg font-semibold">{r.fullName}</p>
                <p className="text-sm text-muted">
                  {roleLabel(r.roleKey)}
                  {r.subRole ? ` / ${r.subRole}` : ""} / {r.nationalityGroup === "overseas" ? "Overseas" : "Domestic"}
                  {r.dateOfBirth ? ` / born ${r.dateOfBirth}${isUnder18(r.dateOfBirth) ? (r.guardianConsent ? ", under 18 with guardian consent" : ", under 18 without consent") : ""}` : ""}
                </p>
                {r.bioShort ? <p className="text-sm">{r.bioShort}</p> : null}
                <p className="text-xs text-faint">Received {formatDateTime(r.createdAt)}</p>
                {r.rejectionReason ? <p className="text-sm text-danger">Reason: {r.rejectionReason}</p> : null}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  {r.status === "pending" ? (
                    <>
                      <Button size="sm" variant="primary" onClick={() => setReviewing(r)} icon={<ClipboardCheck className="size-4" aria-hidden="true" />}>
                        Review and approve
                      </Button>
                      <Button size="sm" onClick={() => setRejecting(r)} icon={<X className="size-4" aria-hidden="true" />}>
                        Reject
                      </Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="quiet" onClick={() => setDeleting(r)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {reviewing ? <ReviewDialog reg={reviewing} ctx={ctx} onClose={() => { setReviewing(null); router.refresh(); }} /> : null}
      <ConfirmDialog
        open={rejecting !== null}
        onClose={() => setRejecting(null)}
        title={`Reject ${rejecting?.fullName ?? ""}?`}
        consequences={["The player is not added to the auction.", "The registration stays listed as rejected until you delete it."]}
        confirmLabel="Reject"
        danger
        requireReason
        reasonLabel="Reason (kept with the registration)"
        busy={reject.pending}
        error={reject.result && !reject.result.ok ? reject.result.error : null}
        onConfirm={(reason) => rejecting && reject.run({ auctionId: ctx.auctionId, registrationId: rejecting.id, reason }, (r) => { if (r.ok) { setRejecting(null); router.refresh(); } })}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete the registration from ${deleting?.fullName ?? ""}?`}
        consequences={
          deleting?.status === "approved"
            ? ["The registration record is removed. The player already in the pool is not affected."]
            : ["The registration and its photo are removed for good.", "Use this to honour a deletion request."]
        }
        confirmLabel="Delete"
        danger
        busy={del.pending}
        error={del.result && !del.result.ok ? del.result.error : null}
        onConfirm={() => deleting && del.run({ auctionId: ctx.auctionId, registrationId: deleting.id }, (r) => { if (r.ok) { setDeleting(null); router.refresh(); } })}
      />
    </div>
  );
}

function ReviewDialog({ reg, ctx, onClose }: { reg: AdminRegistration; ctx: Ctx; onClose: () => void }) {
  const approve = useAdminAction(approveRegistrationAction);
  const cfg = ctx.config;
  const [fullName, setFullName] = useState(reg.fullName);
  const [roleKey, setRoleKey] = useState(reg.roleKey);
  const [subRole, setSubRole] = useState(reg.subRole ?? "");
  const [category, setCategory] = useState("");
  const [nat, setNat] = useState(reg.nationalityGroup);
  const [bio, setBio] = useState(reg.bioShort);
  const [consent, setConsent] = useState(Boolean(reg.guardianConsent));
  const [setName, setSetName] = useState(ctx.sets[ctx.sets.length - 1] ?? "Main");
  const [setOrder, setSetOrder] = useState("1");
  const [price, setPrice] = useState("");
  const role = cfg.roles.find((r) => r.key === roleKey);
  const fe = approve.fieldErrors;
  const under18 = isUnder18(reg.dateOfBirth);
  const defaultPrice = category && ctx.categoryPrices[category] !== undefined ? ctx.categoryPrices[category]! : ctx.defaultBasePrice;

  return (
    <Dialog open onClose={onClose} title={`Review ${reg.fullName}`} size="lg" description={`Reference ${reg.referenceId}. Edit anything that needs fixing, then approve to add the player to the pool.`}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          approve.run(
            {
              auctionId: ctx.auctionId,
              registrationId: reg.id,
              version: reg.version,
              player: { fullName, roleKey, subRole: subRole || undefined, category: category || undefined, tags: [], nationalityGroup: nat, stats: reg.stats, bioShort: bio, dateOfBirth: reg.dateOfBirth ?? undefined, guardianConsent: under18 ? consent : reg.guardianConsent },
              setName,
              setOrder: Number(setOrder),
              basePrice: price === "" ? null : Number(price),
            },
            (r) => r.ok && onClose(),
          );
        }}
      >
        {approve.result && !approve.result.ok ? (
          Object.keys(fe).length ? <FormErrorSummary title={approve.result.error} errors={Object.entries(fe).map(([name, message]) => ({ name, message: `${name}: ${message}` }))} /> : <FormStatus kind="error">{approve.result.error}</FormStatus>
        ) : null}
        <div className="flex gap-4">
          <PlayerAvatar name={reg.fullName} photoPath={reg.photoPath} size={128} className="rounded-[var(--radius-md)] border border-line" />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <Field name="rv-name" label="Full name">
              <Input id="f-rv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={80} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field name="rv-role" label="Role" error={fe.roleKey}>
                <SelectWrap>
                  <Select id="f-rv-role" value={roleKey} onChange={(e) => { setRoleKey(e.target.value); setSubRole(""); }}>
                    {cfg.roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </Select>
                </SelectWrap>
              </Field>
              {role?.subRoles.length ? (
                <Field name="rv-sub" label="Sub-role" optional error={fe.subRole}>
                  <SelectWrap>
                    <Select id="f-rv-sub" value={subRole} onChange={(e) => setSubRole(e.target.value)}>
                      <option value="">None</option>
                      {role.subRoles.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  </SelectWrap>
                </Field>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {cfg.categories.length ? (
            <Field name="rv-cat" label="Category" optional>
              <SelectWrap>
                <Select id="f-rv-cat" value={category} onChange={(e) => setCategory(e.target.value)}>
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
                <label key={n} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="rv-nat" checked={nat === n} onChange={() => setNat(n)} className="size-5 accent-[var(--accent)]" />
                  {n === "domestic" ? "Domestic" : "Overseas"}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {Object.keys(reg.stats).length ? (
          <p className="text-sm text-muted">
            Stats: {Object.entries(reg.stats).map(([k, v]) => `${cfg.statFields.find((s) => s.key === k)?.label ?? k} ${v}`).join(", ")}
          </p>
        ) : null}
        <Field name="rv-bio" label="Short bio" optional>
          <Textarea id="f-rv-bio" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} />
        </Field>
        {under18 ? <Checkbox id="f-rv-consent" name="rv-consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} error={fe.guardianConsent} label="A parent or guardian has agreed to this profile being published" /> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field name="rv-set" label="Set">
            <Input id="f-rv-set" list="rv-sets" value={setName} onChange={(e) => setSetName(e.target.value)} maxLength={40} />
            <datalist id="rv-sets">{ctx.sets.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field name="rv-order" label="Set order">
            <Input id="f-rv-order" type="number" min={0} max={999} value={setOrder} onChange={(e) => setSetOrder(e.target.value)} className="num" />
          </Field>
          <Field name="rv-price" label={`Base price (${ctx.unit})`} hint={`Empty uses ${formatPoints(defaultPrice)}.`}>
            <Input id="f-rv-price" inputMode="numeric" className="num" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} aria-describedby="f-rv-price-hint" />
          </Field>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={approve.pending} icon={<Check className="size-4" aria-hidden="true" />}>
            Approve and add to pool
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
