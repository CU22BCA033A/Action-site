"use client";

import { Send } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Checkbox, Field, FormErrorSummary, FormStatus, Input, Textarea, describedBy } from "@/components/ui/field";
import { UTM_KEYS, UTM_STORAGE_KEY } from "@/lib/consent";
import { sendContactAction, type ContactState } from "@/lib/public/contact-actions";

function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label htmlFor="website">Website</label>
      <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
    </div>
  );
}

export function ContactForm({ formToken }: { formToken: string }) {
  const t = useT();
  const [state, action, pending] = useActionState<ContactState, FormData>(sendContactAction, { status: "idle" });
  const fe = state.status === "error" ? state.fields : {};
  const err = (k: keyof typeof fe) => (fe[k] ? t(`pages.contact.err.${fe[k]!}`) : undefined);

  if (state.status === "done") {
    return (
      <div className="flex flex-col gap-4" role="status">
        <h2 className="text-2xl">{t("pages.contact.doneTitle")}</h2>
        <p className="text-muted">{t("pages.contact.doneBody")}</p>
        <div className="rounded-[var(--radius-md)] border-2 border-accent-edge bg-surface-2 p-4">
          <p className="text-sm font-semibold text-muted">{t("pages.contact.reference")}</p>
          <p className="num mt-1 select-all text-2xl font-extrabold tracking-wider text-accent-text">{state.reference}</p>
          <div className="mt-3">
            <CopyButton value={state.reference} />
          </div>
        </div>
        <a href="/contact" className="link w-fit font-semibold">
          {t("pages.contact.another")}
        </a>
      </div>
    );
  }

  const summary = Object.entries(fe).map(([name, key]) => ({ name, message: t(`pages.contact.err.${key}`) }));
  return (
    <form
      className="flex flex-col gap-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const data = new FormData(e.currentTarget);
        try {
          const utm = JSON.parse(localStorage.getItem(UTM_STORAGE_KEY) ?? "{}") as Record<string, string>;
          for (const k of UTM_KEYS) if (utm[k]) data.set(k, utm[k]);
        } catch {
          /* storage blocked or empty */
        }
        startTransition(() => action(data));
      }}
    >
      <input type="hidden" name="formToken" value={formToken} />
      <Honeypot />
      {state.status === "error" && state.form ? <FormStatus kind="error">{t(`pages.contact.err.${state.form}`)}</FormStatus> : null}
      {summary.length ? <FormErrorSummary title={summary.length === 1 ? t("errors.formSummary", { count: 1 }) : t("errors.formSummaryMany", { count: summary.length })} errors={summary} /> : null}
      <Field name="name" label={t("pages.contact.name")} error={err("name")}>
        <Input id="f-name" name="name" required maxLength={80} autoComplete="name" aria-invalid={fe.name ? true : undefined} aria-describedby={describedBy("name", false, Boolean(fe.name))} />
      </Field>
      <Field name="email" label={t("pages.contact.email")} hint={t("pages.contact.emailHint")} error={err("email")}>
        <Input id="f-email" name="email" type="email" required maxLength={254} autoComplete="email" inputMode="email" aria-invalid={fe.email ? true : undefined} aria-describedby={describedBy("email", true, Boolean(fe.email))} />
      </Field>
      <Field name="message" label={t("pages.contact.message")} error={err("message")}>
        <Textarea id="f-message" name="message" required maxLength={4000} rows={6} aria-invalid={fe.message ? true : undefined} aria-describedby={describedBy("message", false, Boolean(fe.message))} />
      </Field>
      <Checkbox
        name="consent"
        id="f-consent"
        required
        error={err("consent")}
        label={
          <>
            {t("pages.contact.consent")}{" "}
            <Link href="/privacy" className="link font-semibold">
              {t("pages.contact.privacy")}
            </Link>
            .
          </>
        }
      />
      <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel={t("pages.contact.submitting")} icon={<Send className="size-4" aria-hidden="true" />} className="sm:w-fit">
        {pending ? t("pages.contact.submitting") : t("pages.contact.submit")}
      </Button>
    </form>
  );
}

export { Honeypot };
