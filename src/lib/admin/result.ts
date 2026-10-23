import { z } from "zod";

/** What every admin server action returns. Never throws for expected problems. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string>; conflicts?: Conflict[] };

export type Conflict = { teamId: string; teamName: string; issue: string; role?: string; detail: string };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError): ActionResult<never> {
  const fieldErrors = fieldErrorsFrom(error);
  const count = Object.keys(fieldErrors).length;
  return { ok: false, error: count === 1 ? "Fix 1 problem before saving." : `Fix ${count} problems before saving.`, fieldErrors };
}
