"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, FormStatus, Input } from "@/components/ui/field";
import { hashAdminPassword, type HashResult } from "./actions";

export function HashForm() {
  const [pw, setPw] = useState("");
  const [again, setAgain] = useState("");
  const [result, setResult] = useState<HashResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await hashAdminPassword(pw, again)));
      }}
    >
      <Field name="pw" label="Admin password" hint="At least 12 characters with letters and numbers, or a passphrase of 20 characters or more.">
        <Input id="f-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="f-pw-hint" />
      </Field>
      <Field name="again" label="Type it again">
        <Input id="f-again" type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
      </Field>
      <div>
        <Button type="submit" variant="primary" loading={pending} loadingLabel="Making the hash">Make the hash</Button>
      </div>
      {result && !result.ok ? <FormStatus kind="error">{result.error}</FormStatus> : null}
      {result?.ok ? (
        <div className="flex flex-col gap-2 rounded-[var(--radius-sm)] border border-sold p-3">
          <p className="text-sm font-semibold">Copy this into ADMIN_PASSWORD_HASH. Sign in later with the password you just typed.</p>
          <code className="num break-all text-sm text-muted">{result.hash}</code>
          <div><CopyButton value={result.hash} /></div>
        </div>
      ) : null}
    </form>
  );
}
