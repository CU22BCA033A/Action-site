"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button } from "@/components/ui/button";
import { Field, FormStatus, Input, describedBy, fieldIds } from "@/components/ui/field";
import { joinAction, type JoinState } from "@/lib/auth/join-actions";

const ALPHABET = /[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g;

/** Uppercases, drops anything outside the code alphabet, inserts the dash. */
export function formatCode(raw: string): string {
  const clean = raw.toUpperCase().replace(ALPHABET, "").slice(0, 10);
  return clean.length > 5 ? `${clean.slice(0, 5)}-${clean.slice(5)}` : clean;
}

export function JoinForm({ ended }: { ended: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<JoinState, FormData>(joinAction, {});
  const [code, setCode] = useState(state.code ?? "");
  const [touched, setTouched] = useState(false);

  const length = code.replace("-", "").length;
  const localError = touched && length === 0 ? t("join.required") : touched && length !== 10 ? t("join.format") : undefined;
  const serverError =
    code !== state.code ? undefined : state.error === "INVALID" ? t("join.invalid") : state.error === "TOO_MANY" ? t("join.tooMany") : state.error === "IN_USE" ? t("join.inUse", { n: state.inUse ?? 0 }) : undefined;
  const error = localError ?? serverError;
  const ids = fieldIds("code");

  return (
    <form
      action={action}
      onSubmit={(e) => {
        setTouched(true);
        if (length !== 10) {
          e.preventDefault();
          document.getElementById(ids.input)?.focus();
        }
      }}
      className="flex flex-col gap-5"
      noValidate
    >
      {ended && !state.error ? <FormStatus kind="info">{t("join.ended")}</FormStatus> : null}
      <Field name="code" label={t("join.codeLabel")} hint={t("join.codeHint")} error={error}>
        <Input
          id={ids.input}
          name="code"
          value={code}
          onChange={(e) => setCode(formatCode(e.target.value))}
          onBlur={() => setTouched(true)}
          autoComplete="one-time-code"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          maxLength={11}
          required
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy("code", true, Boolean(error))}
          className="num h-16 text-center text-3xl font-bold tracking-[0.2em]"
        />
      </Field>
      <Button type="submit" variant="primary" size="xl" loading={pending} loadingLabel={t("join.submitting")} icon={<KeyRound className="size-5" aria-hidden="true" />} className="w-full">
        {t("join.submit")}
      </Button>
    </form>
  );
}
