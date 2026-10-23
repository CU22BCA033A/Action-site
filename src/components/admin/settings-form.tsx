"use client";

import { RotateCcw, Save, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, Textarea, describedBy } from "@/components/ui/field";
import { undoLastSettingsAction, updateSettingsAction } from "@/lib/admin/actions/settings";
import type { Conflict } from "@/lib/admin/result";
import type { AdminAuction } from "@/lib/admin/queries";
import type { AuctionDefaults } from "@/lib/sports/config";
import { AdminSection } from "./admin-shell";
import { fromDraft, SlabEditor, toDraft, type SlabDraft } from "./slab-editor";
import { useAdminAction } from "./use-admin-action";

type Num = string;
type Draft = {
  name: string;
  slug: string;
  startsAt: string;
  isPublic: boolean;
  registrationOpen: boolean;
  pointsUnitLabel: string;
  purse: Num;
  defaultBasePrice: Num;
  categoryBasePrices: Record<string, Num>;
  squadMin: Num;
  squadMax: Num;
  maxOverseas: Num;
  roleMinimums: Record<string, Num>;
  roleMaximums: Record<string, Num>;
  slabs: SlabDraft[];
  timerOn: boolean;
  bidTimerSeconds: Num;
  timerExtensionSeconds: Num;
  reserveRuleEnabled: boolean;
  rtmEnabled: boolean;
  rtmLabel: "RTM" | "FBM";
  rtmAllowFinalRaise: boolean;
  rtmCardsPerTeam: Num;
  retentionsEnabled: boolean;
  maxRetentions: Num;
};

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const mapS = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]));

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function rulesToDraft(r: AuctionDefaults): Omit<Draft, "name" | "slug" | "startsAt" | "isPublic" | "registrationOpen"> {
  return {
    pointsUnitLabel: r.pointsUnitLabel,
    purse: s(r.purse),
    defaultBasePrice: s(r.defaultBasePrice),
    categoryBasePrices: mapS(r.categoryBasePrices),
    squadMin: s(r.squadMin),
    squadMax: s(r.squadMax),
    maxOverseas: s(r.maxOverseas),
    roleMinimums: mapS(r.roleMinimums),
    roleMaximums: mapS(r.roleMaximums),
    slabs: toDraft(r.slabs),
    timerOn: r.bidTimerSeconds !== null,
    bidTimerSeconds: s(r.bidTimerSeconds ?? 30),
    timerExtensionSeconds: s(r.timerExtensionSeconds ?? 10),
    reserveRuleEnabled: r.reserveRuleEnabled,
    rtmEnabled: r.rtmEnabled,
    rtmLabel: r.rtmLabel,
    rtmAllowFinalRaise: r.rtmAllowFinalRaise,
    rtmCardsPerTeam: s(r.rtmCardsPerTeam),
    retentionsEnabled: r.retentionsEnabled,
    maxRetentions: s(r.maxRetentions),
  };
}

const toInt = (v: Num) => (v.trim() === "" ? Number.NaN : Number(v));
const counts = (m: Record<string, Num>) =>
  Object.fromEntries(Object.entries(m).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, Number(v)]));

export function SettingsForm({ auction, current, sportDefaults }: { auction: AdminAuction; current: AuctionDefaults; sportDefaults: AuctionDefaults }) {
  const router = useRouter();
  const live = auction.status === "live" || auction.status === "paused";
  const locked = auction.status === "completed" || auction.status === "archived";
  const roles = auction.sportConfig.roles.filter((r) => !r.hidden);
  const categories = auction.sportConfig.categories;

  const initial: Draft = {
    name: auction.name,
    slug: auction.slug,
    startsAt: toLocalInput(auction.startsAt),
    isPublic: auction.isPublic,
    registrationOpen: auction.registrationOpen,
    ...rulesToDraft(current),
  };
  const [d, setD] = useState<Draft>(initial);
  const [reason, setReason] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [undoOpen, setUndoOpen] = useState(false);
  // After an undo, load the reverted values once the fresh props arrive.
  const [resetFrom, setResetFrom] = useState<number | null>(null);
  const save = useAdminAction(updateSettingsAction);
  const undo = useAdminAction(undoLastSettingsAction);
  const fe = save.fieldErrors;
  if (resetFrom !== null && auction.settingsVersion !== resetFrom) {
    setResetFrom(null);
    setD(initial);
  }
  const dirty = JSON.stringify(d) !== JSON.stringify(initial);

  const upd = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const num = (v: string) => v.replace(/[^\d]/g, "");

  function payload(confirmConflicts: boolean) {
    const slabs = fromDraft(d.slabs) ?? [];
    return {
      auctionId: auction.id,
      expectedVersion: auction.settingsVersion,
      reason,
      confirmConflicts,
      name: d.name,
      slug: d.slug,
      startsAt: d.startsAt ? new Date(d.startsAt).toISOString() : "",
      isPublic: d.isPublic,
      registrationOpen: d.registrationOpen,
      rules: {
        pointsUnitLabel: d.pointsUnitLabel,
        purse: toInt(d.purse),
        defaultBasePrice: toInt(d.defaultBasePrice),
        categoryBasePrices: counts(d.categoryBasePrices),
        squadMin: toInt(d.squadMin),
        squadMax: toInt(d.squadMax),
        maxOverseas: toInt(d.maxOverseas),
        roleMinimums: counts(d.roleMinimums),
        roleMaximums: counts(d.roleMaximums),
        slabs,
        bidTimerSeconds: d.timerOn ? toInt(d.bidTimerSeconds) : null,
        timerExtensionSeconds: d.timerOn && d.timerExtensionSeconds.trim() !== "" ? toInt(d.timerExtensionSeconds) : null,
        reserveRuleEnabled: d.reserveRuleEnabled,
        rtmEnabled: d.rtmEnabled,
        rtmLabel: d.rtmLabel,
        rtmAllowFinalRaise: d.rtmAllowFinalRaise,
        rtmCardsPerTeam: toInt(d.rtmCardsPerTeam || "0"),
        retentionsEnabled: d.retentionsEnabled,
        maxRetentions: toInt(d.maxRetentions || "0"),
      },
    };
  }

  function submit(confirmConflicts = false) {
    save.run(payload(confirmConflicts), (r) => {
      if (r.ok) {
        setConflicts(null);
        setReason("");
        router.refresh();
      } else if (r.code === "CONFLICTS") setConflicts(r.conflicts ?? []);
    });
  }

  const err = (path: string) => fe[path] ?? fe[`rules.${path}`];
  const labels: Record<string, string> = {
    name: "Name", slug: "Link", startsAt: "Start", reason: "Reason",
    "rules.pointsUnitLabel": "Points label", "rules.purse": "Default purse", "rules.defaultBasePrice": "Default base price",
    "rules.squadMin": "Squad minimum", "rules.squadMax": "Squad maximum", "rules.maxOverseas": "Overseas maximum",
    "rules.slabs": "Bid slabs", slabs: "Bid slabs", "rules.bidTimerSeconds": "Bid timer", "rules.timerExtensionSeconds": "Timer extension",
    "rules.rtmCardsPerTeam": "Cards per team", "rules.maxRetentions": "Retentions per team",
  };
  const summary = Object.entries(fe).map(([name, message]) => ({ name, message: `${labels[name] ?? name}: ${message}` }));

  if (locked) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <FormStatus kind="info">This auction is {auction.status}. Rules are locked. Change results through the audited corrections on the Results tab.</FormStatus>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 pb-32 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
    >
      {live ? (
        <FormStatus kind="info">
          This auction is {auction.status}. Saved changes apply from the next bid or the next player, never to bids already placed. A reason is required and teams that would break the new rules are listed before anything is saved.
        </FormStatus>
      ) : null}
      {save.result?.ok ? <FormStatus kind="success">{save.result.message}</FormStatus> : null}
      {undo.result?.ok ? <FormStatus kind="success">{undo.result.message}</FormStatus> : null}
      {save.result && !save.result.ok && save.result.code !== "CONFLICTS" ? (
        summary.length ? <FormErrorSummary title={save.result.error} errors={summary} /> : <FormStatus kind="error">{save.result.error}</FormStatus>
      ) : null}

      <AdminSection title="Basics" id="basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="name" label="Auction name" error={err("name")}>
            <Input id="f-name" value={d.name} onChange={(e) => upd("name", e.target.value)} aria-invalid={err("name") ? true : undefined} aria-describedby={describedBy("name", false, Boolean(err("name")))} />
          </Field>
          <Field name="slug" label="Link" hint={live ? "Locked while the auction runs." : `/auctions/${d.slug}`} error={err("slug")}>
            <Input id="f-slug" value={d.slug} disabled={live} onChange={(e) => upd("slug", e.target.value.toLowerCase())} className="num" aria-describedby={describedBy("slug", true, Boolean(err("slug")))} />
          </Field>
          <Field name="startsAt" label="Start date and time" optional error={err("startsAt")}>
            <Input id="f-startsAt" type="datetime-local" value={d.startsAt} onChange={(e) => upd("startsAt", e.target.value)} />
          </Field>
          <Field name="pointsUnitLabel" label="Points label" hint="Shown after every amount, for example points or lakh." error={err("pointsUnitLabel")}>
            <Input id="f-pointsUnitLabel" value={d.pointsUnitLabel} maxLength={24} onChange={(e) => upd("pointsUnitLabel", e.target.value)} aria-describedby={describedBy("pointsUnitLabel", true, Boolean(err("pointsUnitLabel")))} />
          </Field>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Checkbox id="f-isPublic" name="isPublic" checked={d.isPublic} onChange={(e) => upd("isPublic", e.target.checked)} label="List on the public auctions page" disabled={auction.rehearsal} hint={auction.rehearsal ? "Rehearsals are never listed." : undefined} />
          <Checkbox id="f-registrationOpen" name="registrationOpen" checked={d.registrationOpen} onChange={(e) => upd("registrationOpen", e.target.checked)} label="Player registration is open" hint="Lets players submit themselves for your review at /auctions/your-link/register." />
        </div>
      </AdminSection>

      <AdminSection title="Purse and base prices" id="purse" description="The purse here prefills new teams. Each team's own purse is set on the Teams tab.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="purse" label={`Default purse per team (${d.pointsUnitLabel})`} error={err("purse")}>
            <Input id="f-purse" inputMode="numeric" className="num" value={d.purse} onChange={(e) => upd("purse", num(e.target.value))} />
          </Field>
          <Field name="defaultBasePrice" label="Default base price" hint="Used when a player has no category price." error={err("defaultBasePrice")}>
            <Input id="f-defaultBasePrice" inputMode="numeric" className="num" value={d.defaultBasePrice} onChange={(e) => upd("defaultBasePrice", num(e.target.value))} aria-describedby={describedBy("defaultBasePrice", true, false)} />
          </Field>
        </div>
        {categories.length ? (
          <fieldset className="mt-4">
            <legend className="mb-2 font-semibold">Base price by category</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {categories.map((c) => (
                <Field key={c} name={`cat-${c}`} label={`Category ${c}`}>
                  <Input id={`f-cat-${c}`} inputMode="numeric" className="num" value={d.categoryBasePrices[c] ?? ""} onChange={(e) => upd("categoryBasePrices", { ...d.categoryBasePrices, [c]: num(e.target.value) })} />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-sm text-muted">Changing a price here does not change players already added. Edit them on the Players tab.</p>
          </fieldset>
        ) : null}
      </AdminSection>

      <AdminSection title="Squad rules" id="squad">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="squadMin" label="Squad minimum" error={err("squadMin")}>
            <Input id="f-squadMin" inputMode="numeric" className="num" value={d.squadMin} onChange={(e) => upd("squadMin", num(e.target.value))} />
          </Field>
          <Field name="squadMax" label="Squad maximum" error={err("squadMax")}>
            <Input id="f-squadMax" inputMode="numeric" className="num" value={d.squadMax} onChange={(e) => upd("squadMax", num(e.target.value))} />
          </Field>
          <Field name="maxOverseas" label="Overseas maximum" error={err("maxOverseas")}>
            <Input id="f-maxOverseas" inputMode="numeric" className="num" value={d.maxOverseas} onChange={(e) => upd("maxOverseas", num(e.target.value))} />
          </Field>
        </div>
        <div className="mt-5 overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[26rem] text-sm">
            <caption className="mb-2 text-left font-semibold">Required roles</caption>
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="pb-2 font-semibold">Role</th>
                <th scope="col" className="pb-2 font-semibold">At least</th>
                <th scope="col" className="pb-2 font-semibold">At most</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => (
                <tr key={r.key}>
                  <th scope="row" className="py-1 pr-3 text-left font-semibold">{r.label}</th>
                  <td className="py-1 pr-3">
                    <Input aria-label={`${r.label} minimum`} inputMode="numeric" className="num" value={d.roleMinimums[r.key] ?? ""} onChange={(e) => upd("roleMinimums", { ...d.roleMinimums, [r.key]: num(e.target.value) })} />
                  </td>
                  <td className="py-1">
                    <Input aria-label={`${r.label} maximum`} inputMode="numeric" className="num" value={d.roleMaximums[r.key] ?? ""} onChange={(e) => upd("roleMaximums", { ...d.roleMaximums, [r.key]: num(e.target.value) })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-sm text-muted">Leave a box empty for no limit. Roles come from the sport settings.</p>
        </div>
        <div className="mt-4">
          <Checkbox
            id="f-reserve"
            name="reserve"
            checked={d.reserveRuleEnabled}
            onChange={(e) => upd("reserveRuleEnabled", e.target.checked)}
            label="Purse reserve rule"
            hint="A team must always keep enough purse to fill its minimum squad at the lowest base price still in the pool."
          />
        </div>
      </AdminSection>

      <AdminSection title="Bid slabs" id="slabs" description={live ? "A change takes effect from the next bid, using the slab for the price at that moment." : undefined}>
        <SlabEditor rows={d.slabs} onChange={(rows) => upd("slabs", rows)} unit={d.pointsUnitLabel} error={err("slabs")} />
      </AdminSection>

      <AdminSection title="Timer" id="timer">
        <Checkbox id="f-timerOn" name="timerOn" checked={d.timerOn} onChange={(e) => upd("timerOn", e.target.checked)} label="Use a bid timer" hint="The server ends bidding when the timer runs out. Without a timer, the admin closes each player." />
        {d.timerOn ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="bidTimerSeconds" label="Seconds per player" error={err("bidTimerSeconds")}>
              <Input id="f-bidTimerSeconds" inputMode="numeric" className="num" value={d.bidTimerSeconds} onChange={(e) => upd("bidTimerSeconds", num(e.target.value))} />
            </Field>
            <Field name="timerExtensionSeconds" label="Each bid resets the clock to at least" hint="Stops last-second sniping. Leave empty to use the full timer." error={err("timerExtensionSeconds")}>
              <Input id="f-timerExtensionSeconds" inputMode="numeric" className="num" value={d.timerExtensionSeconds} onChange={(e) => upd("timerExtensionSeconds", num(e.target.value))} aria-describedby={describedBy("timerExtensionSeconds", true, false)} />
            </Field>
          </div>
        ) : null}
      </AdminSection>

      <AdminSection title="Match cards and retentions" id="rtm">
        <Checkbox id="f-rtm" name="rtm" checked={d.rtmEnabled} onChange={(e) => upd("rtmEnabled", e.target.checked)} label="Let a player's previous team match the winning bid" />
        {d.rtmEnabled ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field name="rtmLabel" label="Name of the card">
              <SelectWrap>
                <Select id="f-rtmLabel" value={d.rtmLabel} onChange={(e) => upd("rtmLabel", e.target.value as "RTM" | "FBM")}>
                  <option value="RTM">RTM, Right to Match</option>
                  <option value="FBM">FBM, Final Bid Match</option>
                </Select>
              </SelectWrap>
            </Field>
            <Field name="rtmCardsPerTeam" label="Cards per team" hint="Changing this adds or removes the difference for every team." error={err("rtmCardsPerTeam")}>
              <Input id="f-rtmCardsPerTeam" inputMode="numeric" className="num" value={d.rtmCardsPerTeam} onChange={(e) => upd("rtmCardsPerTeam", num(e.target.value))} aria-describedby={describedBy("rtmCardsPerTeam", true, false)} />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox id="f-rtmRaise" name="rtmRaise" checked={d.rtmAllowFinalRaise} onChange={(e) => upd("rtmAllowFinalRaise", e.target.checked)} label="After a match, the winning bidder may raise once" />
            </div>
          </div>
        ) : null}
        <div className="mt-5 border-t border-line pt-4">
          <Checkbox id="f-ret" name="ret" checked={d.retentionsEnabled} onChange={(e) => upd("retentionsEnabled", e.target.checked)} label="Allow retentions before the auction" hint="Retained players are assigned to their team at a set price before bidding starts." />
          {d.retentionsEnabled ? (
            <div className="mt-4 max-w-xs">
              <Field name="maxRetentions" label="Retentions per team" error={err("maxRetentions")}>
                <Input id="f-maxRetentions" inputMode="numeric" className="num" value={d.maxRetentions} onChange={(e) => upd("maxRetentions", num(e.target.value))} />
              </Field>
            </div>
          ) : null}
        </div>
      </AdminSection>

      {live ? (
        <AdminSection title="Reason for this change" id="reason">
          <Field name="reason" label="Reason (saved in the audit log)" error={err("reason")}>
            <Textarea id="f-reason" rows={2} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} aria-describedby={describedBy("reason", false, Boolean(err("reason")))} />
          </Field>
        </AdminSection>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg lg:left-64">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <Button type="submit" variant="primary" loading={save.pending} loadingLabel="Saving" icon={<Save className="size-4" aria-hidden="true" />} disabled={!dirty && !live}>
            Save rules
          </Button>
          <Button onClick={() => setD((x) => ({ ...x, ...rulesToDraft(sportDefaults) }))} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
            Reset to sport defaults
          </Button>
          <Button variant="ghost" onClick={() => setUndoOpen(true)} icon={<Undo2 className="size-4" aria-hidden="true" />}>
            Undo last change
          </Button>
          <span className="text-sm text-muted" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</span>
        </div>
      </div>

      <ConfirmDialog
        open={conflicts !== null}
        onClose={() => setConflicts(null)}
        title="Some teams would break the new rules"
        consequences={(conflicts ?? []).map((c) => `${c.teamName}: ${c.detail}.`).concat([
          "Saving anyway keeps those teams' players. They simply cannot win more players that break the rule.",
        ])}
        confirmLabel="Save anyway"
        busy={save.pending}
        danger
        error={save.result && !save.result.ok && save.result.code !== "CONFLICTS" ? save.result.error : null}
        onConfirm={() => submit(true)}
      />
      <ConfirmDialog
        open={undoOpen}
        onClose={() => setUndoOpen(false)}
        title="Undo the last rules change?"
        consequences={["The rules go back to what they were before the most recent save, including bid slabs.", "The same checks run as for a normal save, and the undo is recorded in the audit log."]}
        confirmLabel="Undo change"
        requireReason={live}
        busy={undo.pending}
        error={undo.result && !undo.result.ok ? (undo.result.conflicts?.length ? `Undo would break the rules for: ${undo.result.conflicts.map((c) => c.teamName).join(", ")}. Edit the rules instead.` : undo.result.error) : null}
        onConfirm={(r) =>
          undo.run({ auctionId: auction.id, expectedVersion: auction.settingsVersion, reason: r }, (res) => {
            if (res.ok) {
              setUndoOpen(false);
              setResetFrom(auction.settingsVersion);
              router.refresh();
            }
          })
        }
      />
    </form>
  );
}
