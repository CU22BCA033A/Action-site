"use client";

import { Eye, EyeOff, LogIn } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FormStatus, Input } from "@/components/ui/field";
import { loginAction, type LoginState } from "@/lib/auth/admin-actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error ? <FormStatus kind="error">{state.error}</FormStatus> : null}
      <Field name="username" label="Username">
        <Input id="f-username" name="username" autoComplete="username" required defaultValue={state.username} autoCapitalize="off" spellCheck={false} />
      </Field>
      <Field name="password" label="Password">
        <div className="relative">
          <Input id="f-password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-14" />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            aria-controls="f-password"
            className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-[var(--radius-sm)] text-muted hover:text-text"
          >
            {show ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel="Signing in" icon={<LogIn className="size-5" aria-hidden="true" />}>
        Sign in
      </Button>
      <p className="text-sm text-muted">
        There is no password reset by email. The site owner changes the password by setting a new hash in the hosting settings.
      </p>
    </form>
  );
}
