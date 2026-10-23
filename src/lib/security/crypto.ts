import "server-only";
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";

/** No 0, O, 1, I or L, so codes read cleanly over the phone. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomFromAlphabet(length: number, alphabet = CODE_ALPHABET): string {
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(alphabet.length)];
  return out;
}

/** Team access code, format XXXXX-XXXXX. */
export function generateAccessCode(): string {
  return `${randomFromAlphabet(5)}-${randomFromAlphabet(5)}`;
}

/** Uppercases, strips spaces and dashes, then re-inserts the dash. */
export function normaliseAccessCode(input: string): string | null {
  const raw = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 10) return null;
  for (const ch of raw) if (!CODE_ALPHABET.includes(ch)) return null;
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}

export function hashAccessCode(code: string): string {
  return createHmac("sha256", getEnv().CODE_PEPPER).update(`code:${code}`).digest("hex");
}

export function hashIp(ip: string): string {
  return createHmac("sha256", getEnv().CODE_PEPPER).update(`ip:${ip}`).digest("hex").slice(0, 32);
}

/** Reference IDs shown to people: prefix plus 8 unambiguous characters. */
export function referenceId(prefix: "REG" | "DEL" | "MSG"): string {
  return `${prefix}-${randomFromAlphabet(8)}`;
}

export function constantTimeEqual(a: string, b: string): boolean {
  const key = randomBytes(32);
  const ha = createHmac("sha256", key).update(a).digest();
  const hb = createHmac("sha256", key).update(b).digest();
  return timingSafeEqual(ha, hb);
}
