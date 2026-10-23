"use client";

import { Camera, Send } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FormErrorSummary, FormStatus, Input, Select, SelectWrap, Textarea, describedBy } from "@/components/ui/field";
import { isUnder18 } from "@/lib/admin/player-input";
import { registerPlayerAction, type RegisterState } from "@/lib/public/register-action";
import type { SportConfig } from "@/lib/sports/config";

export function RegisterForm({ slug, config, formToken }: { slug: string; config: SportConfig; formToken: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerPlayerAction.bind(null, slug), { status: "idle" });
  const roles = config.roles.filter((r) => !r.hidden);
  const [roleKey, setRoleKey] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [dob, setDob] = useState("");
  const role = roles.find((r) => r.key === roleKey);
  const fe = state.status === "error" ? state.fields : {};
  const err = (k: keyof typeof fe) => (fe[k] ? t(`register.err.${fe[k]!}`) : undefined);

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-3xl">{t("register.doneTitle")}</h2>
        <p className="text-muted">{t("register.doneBody")}</p>
        <div className="rounded-[var(--radius-md)] border-2 border-accent-edge bg-surface-2 p-4">
          <p className="text-sm font-semibold text-muted">{t("register.reference")}</p>
          <p className="num mt-1 select-all text-3xl font-extrabold tracking-wider text-accent-text">{state.reference}</p>
          <div className="mt-3">
            <CopyButton value={state.reference} />
          </div>
        </div>
        {/* A full page load resets the form and issues a fresh form token. */}
        <a href={`/auctions/${slug}/register`} className="link w-fit font-semibold">
          {t("register.another")}
        </a>
      </div>
    );
  }

  const summary = Object.entries(fe).map(([name, key]) => ({ name, message: t(`register.err.${key}`) }));

  return (
    <form
      className="flex flex-col gap-5"
      encType="multipart/form-data"
      noValidate
      onSubmit={(e) => {
        // Submitting through a transition keeps every typed value if the server finds a problem.
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="formToken" value={formToken} />
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state.status === "error" && state.form ? <FormStatus kind="error">{t(`register.err.${state.form}`)}</FormStatus> : null}
      {summary.length ? <FormErrorSummary title={summary.length === 1 ? t("errors.formSummary", { count: 1 }) : t("errors.formSummaryMany", { count: summary.length })} errors={summary} /> : null}

      <Field name="fullName" label={t("register.fullName")} error={err("fullName")}>
        <Input id="f-fullName" name="fullName" required maxLength={80} autoComplete="name" aria-invalid={fe.fullName ? true : undefined} aria-describedby={describedBy("fullName", false, Boolean(fe.fullName))} />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="roleKey" label={t("register.role")} error={err("roleKey")}>
          <SelectWrap>
            <Select id="f-roleKey" name="roleKey" required value={roleKey} onChange={(e) => setRoleKey(e.target.value)} aria-invalid={fe.roleKey ? true : undefined} aria-describedby={describedBy("roleKey", false, Boolean(fe.roleKey))}>
              <option value="" disabled>
                {t("register.role")}
              </option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
        {role?.subRoles.length ? (
          <Field name="subRole" label={t("register.subRole")} optional optionalLabel={t("common.optional")}>
            <SelectWrap>
              <Select id="f-subRole" name="subRole" defaultValue="">
                <option value="">{t("register.noSubRole")}</option>
                {role.subRoles.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </SelectWrap>
          </Field>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-1.5 text-sm font-semibold">{t("register.nationality")}</legend>
        <div className="flex flex-wrap gap-5">
          {(["domestic", "overseas"] as const).map((n) => (
            <label key={n} className="flex min-h-11 cursor-pointer items-center gap-2">
              <input type="radio" name="nationalityGroup" value={n} defaultChecked={n === "domestic"} className="size-5 accent-[var(--accent)]" />
              {t(`nationality.${n}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <Field name="photo" label={t("register.photo")} hint={t("register.photoHint")} error={err("photo")}>
        <div className="flex flex-wrap items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={t("register.photoPreview")} width={112} height={112} className="size-28 rounded-[var(--radius-md)] border border-line object-cover" />
          ) : (
            <span aria-hidden="true" className="inline-flex size-28 items-center justify-center rounded-[var(--radius-md)] border border-dashed border-line-strong text-muted">
              <Camera className="size-8" />
            </span>
          )}
          <label htmlFor="f-photo" className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-4 font-semibold hover:border-text has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
            <Camera className="size-4" aria-hidden="true" />
            {preview ? t("register.photoChange") : t("register.photoChoose")}
            <input
              id="f-photo"
              name="photo"
              type="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              aria-invalid={fe.photo ? true : undefined}
              aria-describedby={describedBy("photo", true, Boolean(fe.photo))}
              onChange={(e) => {
                const f = e.target.files?.[0];
                setPreview(f ? URL.createObjectURL(f) : null);
              }}
            />
          </label>
        </div>
      </Field>

      {config.statFields.length ? (
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">
            {t("register.stats")} <span className="font-normal text-faint">{t("common.optional")}</span>
          </legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {config.statFields.map((s) => (
              <Field key={s.key} name={`stat_${s.key}`} label={s.label}>
                <Input id={`f-stat_${s.key}`} name={`stat_${s.key}`} inputMode={s.kind === "decimal" ? "decimal" : "numeric"} className="num" />
              </Field>
            ))}
          </div>
        </fieldset>
      ) : null}

      <Field name="bioShort" label={t("register.bio")} optional optionalLabel={t("common.optional")} hint={t("register.bioHint", { n: bio.length })}>
        <Textarea id="f-bioShort" name="bioShort" rows={2} maxLength={160} value={bio} onChange={(e) => setBio(e.target.value)} aria-describedby={describedBy("bioShort", true, false)} />
      </Field>

      <Field name="dateOfBirth" label={t("register.dob")} optional optionalLabel={t("common.optional")} hint={t("register.dobHint")} error={err("dateOfBirth")}>
        <Input id="f-dateOfBirth" name="dateOfBirth" type="date" value={dob} onChange={(e) => setDob(e.target.value)} aria-describedby={describedBy("dateOfBirth", true, Boolean(fe.dateOfBirth))} />
      </Field>
      {isUnder18(dob || null) ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-start gap-3">
            <input id="f-guardianConsent" name="guardianConsent" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" aria-describedby={fe.guardianConsent ? "f-guardianConsent-error" : undefined} />
            <label htmlFor="f-guardianConsent" className="text-sm">
              {t("register.guardian")}
            </label>
          </div>
          {fe.guardianConsent ? (
            <p id="f-guardianConsent-error" className="pl-8 text-sm font-medium text-danger">
              {t("register.err.guardian")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-1 rounded-[var(--radius-md)] border border-line bg-surface-2 p-4">
        <div className="flex items-start gap-3">
          <input id="f-consent" name="consent" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]" aria-invalid={fe.consent ? true : undefined} aria-describedby={["f-consent-note", fe.consent ? "f-consent-error" : ""].filter(Boolean).join(" ")} />
          <label htmlFor="f-consent" className="text-sm">
            {t("register.consent")}{" "}
            <Link href="/privacy" className="link font-semibold" target="_blank">
              {t("register.privacy")}
            </Link>
            .
          </label>
        </div>
        <p id="f-consent-note" className="pl-8 text-sm text-muted">
          {t("register.collectNote")}
        </p>
        {fe.consent ? (
          <p id="f-consent-error" className="pl-8 text-sm font-medium text-danger">
            {t("register.err.consent")}
          </p>
        ) : null}
      </div>

      <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel={t("register.submitting")} icon={<Send className="size-5" aria-hidden="true" />}>
        {t("register.submit")}
      </Button>
    </form>
  );
}
