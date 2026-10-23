"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/admin/result";

/**
 * Runs an admin server action with a pending state, keeps the last error and
 * field errors, and prevents a second submit while the first is running.
 * A redirect thrown by the action is passed through to Next.js.
 */
export function useAdminAction<I, T = undefined>(action: (input: I) => Promise<ActionResult<T>>) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult<T> | null>(null);

  function run(input: I, onDone?: (r: ActionResult<T>) => void) {
    if (pending) return;
    start(async () => {
      try {
        const r = await action(input);
        setResult(r);
        onDone?.(r);
      } catch (e) {
        // Redirects are not errors; Next.js handles them.
        if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw e;
        const r: ActionResult<T> = { ok: false, error: "Could not reach the server. Check the connection and try again." };
        setResult(r);
        onDone?.(r);
      }
    });
  }

  const fieldErrors = result && !result.ok ? (result.fieldErrors ?? {}) : {};
  return { run, pending, result, fieldErrors, reset: () => setResult(null) };
}

export function errorList(fieldErrors: Record<string, string>, labels: Record<string, string>) {
  return Object.entries(fieldErrors)
    .filter(([k]) => k in labels)
    .map(([name, message]) => ({ name, message: `${labels[name]}: ${message}` }));
}
