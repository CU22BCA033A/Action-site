"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FormErrorSummary, FormStatus, Input, Textarea, describedBy } from "@/components/ui/field";
import { requestDeletionAction, type DeletionState } from "@/lib/public/contact-actions";
import { Honeypot } from "./contact-form";

export function DeletionForm({ formToken }: { formToken: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<DeletionState, FormData>(requestDeletionAction, { status: "idle" });
  const fe = state.status === "error" ? state.fields : {};
  const err = (k: keyof typeof fe) => (fe[k] ? t(`pages.deletion.err.${fe[k]!}`) : undefined);

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-2xl">{t("pages.deletion.doneTitle")}</h2>
        <p className="text-muted">{t("pages.deletion.doneBody")}</p>
        <div className="rounded-[var(--radius-md)] border-2 border-accent-edge bg-surface-2 p-4">
          <p className="text-sm font-semibold text-muted">{t("pages.deletion.reference2")}</p>
          <p className="num mt-1 select-all text-2xl font-extrabold tracking-wider text-accent-text">{state.reference}</p>
          <div className="mt-3">
            <CopyButton value={state.reference} />
          </div>
        </div>
        <Link href={`/data-deletion/status?ref=${encodeURIComponent(state.reference)}`} className="link w-fit font-semibold">
          {t("pages.deletion.statusLink")}
        </Link>
      </div>
    );
  }

  const summary = Object.entries(fe).map(([name, key]) => ({ name, message: t(`pages.deletion.err.${key}`) }));
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="formToken" value={formToken} />
      <Honeypot />
      {state.status === "error" && state.form ? <FormStatus kind="error">{t(`pages.deletion.err.${state.form}`)}</FormStatus> : null}
      {summary.length ? <FormErrorSummary title={summary.length === 1 ? t("errors.formSummary", { count: 1 }) : t("errors.formSummaryMany", { count: summary.length })} errors={summary} /> : null}
      <Field name="name" label={t("pages.deletion.name")} error={err("name")}>
        <Input id="f-name" name="name" required maxLength={80} autoComplete="name" aria-invalid={fe.name ? true : undefined} aria-describedby={describedBy("name", false, Boolean(fe.name))} />
      </Field>
      <Field name="contact" label={t("pages.deletion.contact")} hint={t("pages.deletion.contactHint")} optional optionalLabel={t("common.optional")}>
        <Input id="f-contact" name="contact" maxLength={254} autoComplete="email" aria-describedby={describedBy("contact", true, false)} />
      </Field>
      <Field name="registrationRef" label={t("pages.deletion.reference")} hint={t("pages.deletion.referenceHint")} optional optionalLabel={t("common.optional")}>
        <Input id="f-registrationRef" name="registrationRef" maxLength={20} autoCapitalize="characters" spellCheck={false} className="num uppercase" aria-describedby={describedBy("registrationRef", true, false)} />
      </Field>
      <Field name="details" label={t("pages.deletion.details")} error={err("details")}>
        <Textarea id="f-details" name="details" required maxLength={2000} rows={5} aria-invalid={fe.details ? true : undefined} aria-describedby={describedBy("details", false, Boolean(fe.details))} />
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} icon={<Send className="size-4" aria-hidden="true" />} className="sm:w-fit">
        {pending ? t("pages.deletion.submitting") : t("pages.deletion.submit")}
      </Button>
    </form>
  );
}
