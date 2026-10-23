/**
 * Cookie consent, stored first-party in a cookie readable by the page:
 * "v1.<measurement 0|1>.<ISO date>". Essential storage is always allowed.
 * Campaign attribution (UTM) is stored only after consent.
 */
export const CONSENT_COOKIE = "consent";
export const UTM_STORAGE_KEY = "utm";
export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];
export type Utm = Partial<Record<UtmKey, string>>;

export type Consent = { measurement: boolean; date: string };

export function parseConsent(raw: string | undefined | null): Consent | null {
  if (!raw) return null;
  const [v, m, ...rest] = decodeURIComponent(raw).split(".");
  const date = rest.join(".");
  if (v !== "v1" || (m !== "0" && m !== "1") || !date) return null;
  return { measurement: m === "1", date };
}

export function serializeConsent(c: Consent): string {
  return encodeURIComponent(`v1.${c.measurement ? "1" : "0"}.${c.date}`);
}

/** Allowlist: letters, digits, space, dot, dash, underscore. Max 64 chars. */
export function sanitizeUtmValue(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[^A-Za-z0-9 ._-]/g, "").trim().slice(0, 64);
  return cleaned.length ? cleaned : undefined;
}

export function utmFromSearch(search: string): Utm {
  const params = new URLSearchParams(search);
  const out: Utm = {};
  for (const key of UTM_KEYS) {
    const v = sanitizeUtmValue(params.get(key));
    if (v) out[key] = v;
  }
  return out;
}
