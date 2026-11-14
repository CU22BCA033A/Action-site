"use client";

import { ExternalLink, Plus, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Checkbox, Field, FormStatus, Input, describedBy } from "@/components/ui/field";
import { updateRegistrationSettingsAction } from "@/lib/admin/actions/registrations";
import { fromLocalInput, toLocalInput } from "@/lib/client/datetime";
import { formatDateTime } from "@/lib/format";
import { useAdminAction } from "./use-admin-action";

export type RegistrationSettingsValue = {
  auctionId: string;
  link: string;
  open: boolean;
  openNow: boolean;
  opensAt: string | null;
  closesAt: string | null;
  playerTypes: string[];
  useNationality: boolean;
};

/** Where registration stands right now, in plain words. */
function statusOf(v: RegistrationSettingsValue): { label: string; tone: "sold" | "accent" | "neutral"; detail: string } {
  const now = Date.now();
  if (!v.open) return { label: "Closed", tone: "neutral", detail: "Registration is switched off." };
  if (v.opensAt && Date.parse(v.opensAt) > now) return { label: "Scheduled", tone: "accent", detail: `Opens ${formatDateTime(v.opensAt)}.` };
  if (v.closesAt && Date.parse(v.closesAt) <= now) return { label: "Ended", tone: "neutral", detail: `Closed ${formatDateTime(v.closesAt)}.` };
  return { label: "Open now", tone: "sold", detail: v.closesAt ? `Closes ${formatDateTime(v.closesAt)}.` : "No closing time set." };
}

export function RegistrationSettings({ value }: { value: RegistrationSettingsValue }) {
  const router = useRouter();
  const save = useAdminAction(updateRegistrationSettingsAction);
  const [open, setOpen] = useState(value.open);
  const [opensAt, setOpensAt] = useState(toLocalInput(value.opensAt));
  const [closesAt, setClosesAt] = useState(toLocalInput(value.closesAt));
  const [types, setTypes] = useState<string[]>(value.playerTypes);
  const [draftType, setDraftType] = useState("");
  const [useNationality, setUseNationality] = useState(value.useNationality);
  const fe = save.fieldErrors;
  const status = statusOf(value);

  const addType = () => {
    const t = draftType.trim();
    if (!t || types.some((x) => x.toLowerCase() === t.toLowerCase())) return setDraftType("");
    setTypes([...types, t.slice(0, 40)]);
    setDraftType("");
  };

  const submit = () =>
    save.run(
      { auctionId: value.auctionId, open, opensAt: fromLocalInput(opensAt), closesAt: fromLocalInput(closesAt), playerTypes: types, useNationality },
      (r) => r.ok && router.refresh(),
    );

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="reg-settings-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="reg-settings-title" className="flex flex-wrap items-center gap-2 text-xl">
            Player registration <Badge tone={status.tone}>{status.label}</Badge>
          </h2>
          <p className="mt-1 text-sm text-muted">{status.detail}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={value.link} label="Copy link" />
          <a href={value.link} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius-xs)] border border-line-strong px-3 text-sm font-semibold hover:border-accent-edge">
            <ExternalLink className="size-4" aria-hidden="true" /> Open form
          </a>
        </div>
      </div>
      <p className="mt-3 break-all rounded-[var(--radius-sm)] border border-line bg-surface-2 px-3 py-2 font-mono text-sm text-muted">{value.link}</p>

      <div className="mt-5">
        <Checkbox id="reg-open" name="reg-open" checked={open} onChange={(e) => setOpen(e.target.checked)} label="Registration switched on" hint="Players can register only while this is on and the time is between the opening and closing times." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field name="reg-opensAt" label="Opens at" optional hint="Empty: opens as soon as it is switched on." error={fe.opensAt}>
          <Input id="f-reg-opensAt" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} aria-describedby={describedBy("reg-opensAt", true, Boolean(fe.opensAt))} />
        </Field>
        <Field name="reg-closesAt" label="Closes at" optional hint="Empty: stays open until switched off." error={fe.closesAt}>
          <Input id="f-reg-closesAt" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} aria-describedby={describedBy("reg-closesAt", true, Boolean(fe.closesAt))} />
        </Field>
      </div>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold">
          Player types <span className="font-normal text-faint">Optional</span>
        </legend>
        <p className="mt-1 text-sm text-muted">For example Student, Teacher, Faculty or Alumni. Players pick one when they register, and it shows on their card.</p>
        {types.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {types.map((t) => (
              <li key={t} className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-surface-2 py-1 pl-3 pr-1 text-sm font-semibold">
                {t}
                <button type="button" onClick={() => setTypes(types.filter((x) => x !== t))} className="grid size-7 place-items-center rounded-full text-muted hover:bg-surface-3 hover:text-text" aria-label={`Remove ${t}`}>
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 flex max-w-md gap-2">
          <label htmlFor="reg-type-new" className="sr-only">New player type</label>
          <Input
            id="reg-type-new"
            value={draftType}
            maxLength={40}
            placeholder="Add a type"
            onChange={(e) => setDraftType(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addType();
              }
            }}
          />
          <Button size="sm" onClick={addType} icon={<Plus className="size-4" aria-hidden="true" />} className="h-11">Add</Button>
        </div>
        {fe.playerTypes ? <p className="mt-2 text-sm text-danger">{fe.playerTypes}</p> : null}
      </fieldset>

      <div className="mt-6">
        <Checkbox
          id="reg-nationality"
          name="reg-nationality"
          checked={useNationality}
          onChange={(e) => setUseNationality(e.target.checked)}
          label="Ask domestic or overseas"
          hint="Only needed when you use an overseas limit in the rules. Off: the question is hidden everywhere."
        />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="primary" loading={save.pending} onClick={submit} icon={<Save className="size-4" aria-hidden="true" />}>
          Save registration settings
        </Button>
        {save.result ? <FormStatus kind={save.result.ok ? "success" : "error"}>{save.result.ok ? save.result.message : save.result.error}</FormStatus> : null}
      </div>
    </section>
  );
}
