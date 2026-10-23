"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, describedBy } from "@/components/ui/field";
import { createAuctionAction } from "@/lib/admin/actions/auctions";
import { errorList, useAdminAction } from "./use-admin-action";

type Sport = { id: string; name: string; roles: string[] };
type Preset = { id: string; sportId: string; name: string; description: string; isExample: boolean };

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

const labels = { sportId: "Sport", presetId: "Starting rules", name: "Name", slug: "Link", startsAt: "Start" };

export function NewAuctionForm({ sports, presets }: { sports: Sport[]; presets: Preset[] }) {
  const [sportId, setSportId] = useState(sports[0]?.id ?? "");
  const [presetId, setPresetId] = useState("defaults");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [startsAt, setStartsAt] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [rehearsal, setRehearsal] = useState(false);
  const { run, pending, result, fieldErrors } = useAdminAction(createAuctionAction);

  const sportPresets = useMemo(() => presets.filter((p) => p.sportId === sportId), [presets, sportId]);
  const preset = sportPresets.find((p) => p.id === presetId);
  const sport = sports.find((s) => s.id === sportId);

  return (
    <form
      className="flex flex-col gap-6"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        run({ sportId, presetId, name, slug, startsAt: startsAt || undefined, isPublic: rehearsal ? false : isPublic, rehearsal });
      }}
    >
      {result && !result.ok ? (
        Object.keys(fieldErrors).length ? <FormErrorSummary title={result.error} errors={errorList(fieldErrors, labels)} /> : <FormStatus kind="error">{result.error}</FormStatus>
      ) : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">Sport</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {sports.map((s) => (
            <label key={s.id} className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 has-[:checked]:border-accent-edge has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
              <input
                type="radio"
                name="sport"
                value={s.id}
                checked={sportId === s.id}
                onChange={() => {
                  setSportId(s.id);
                  setPresetId("defaults");
                }}
                className="mt-1 size-5 accent-[var(--accent)]"
              />
              <span>
                <span className="display block text-lg font-bold uppercase">{s.name}</span>
                <span className="text-sm text-muted">{s.roles.join(", ")}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field name="presetId" label="Starting rules" hint="Fills the rules form on the next screen. Nothing here is fixed." error={fieldErrors.presetId}>
        <SelectWrap>
          <Select id="f-presetId" value={presetId} onChange={(e) => setPresetId(e.target.value)} aria-describedby={describedBy("presetId", true, Boolean(fieldErrors.presetId))}>
            <option value="defaults">{sport?.name ?? "Sport"} defaults</option>
            {sportPresets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isExample ? " (example, review every value)" : ""}
              </option>
            ))}
          </Select>
        </SelectWrap>
      </Field>
      {preset ? <FormStatus kind="info">{preset.description}</FormStatus> : null}

      <Field name="name" label="Auction name" error={fieldErrors.name}>
        <Input
          id="f-name"
          value={name}
          maxLength={120}
          required
          aria-invalid={fieldErrors.name ? true : undefined}
          aria-describedby={describedBy("name", false, Boolean(fieldErrors.name))}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field name="slug" label="Link" hint={`The public page will be /auctions/${slug || "your-link"}`} error={fieldErrors.slug}>
        <Input
          id="f-slug"
          value={slug}
          maxLength={80}
          required
          className="num"
          aria-invalid={fieldErrors.slug ? true : undefined}
          aria-describedby={describedBy("slug", true, Boolean(fieldErrors.slug))}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
        />
      </Field>
      <Field name="startsAt" label="Start date and time" optional hint="Shown on the public page. India time." error={fieldErrors.startsAt}>
        <Input id="f-startsAt" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} aria-describedby={describedBy("startsAt", true, Boolean(fieldErrors.startsAt))} />
      </Field>

      <div className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-4">
        <Checkbox
          id="f-rehearsal"
          name="rehearsal"
          checked={rehearsal}
          onChange={(e) => setRehearsal(e.target.checked)}
          label="Rehearsal on demo data"
          hint="Adds eight invented teams and 48 invented players so you can practise. Rehearsals are never listed publicly and never mixed with real results."
        />
        <Checkbox
          id="f-public"
          name="public"
          checked={rehearsal ? false : isPublic}
          disabled={rehearsal}
          onChange={(e) => setIsPublic(e.target.checked)}
          label="List on the public auctions page"
          hint="Private auctions are still visible to anyone who has the link once you publish them."
        />
      </div>

      <div>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel="Creating" icon={<Plus className="size-5" aria-hidden="true" />}>
          Create auction
        </Button>
      </div>
    </form>
  );
}
