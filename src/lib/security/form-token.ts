import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/**
 * Signed timestamp placed in public forms. Rejecting forms sent within a few
 * seconds of loading stops most automated spam without any third party.
 */
const MIN_MS = 3_000;
const MAX_MS = 2 * 60 * 60 * 1000;

function sign(ts: string) {
  return createHmac("sha256", getEnv().SESSION_SECRET).update(`form:${ts}`).digest("base64url");
}

export function issueFormToken(now = Date.now()): string {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export type FormTokenCheck = "ok" | "too_fast" | "expired" | "invalid";

export function checkFormToken(token: string | null | undefined, now = Date.now()): FormTokenCheck {
  if (!token) return "invalid";
  const [ts, sig] = token.split(".");
  if (!ts || !sig || !/^\d{10,16}$/.test(ts)) return "invalid";
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return "invalid";
  const age = now - Number(ts);
  if (age < MIN_MS) return "too_fast";
  if (age > MAX_MS) return "expired";
  return "ok";
}
