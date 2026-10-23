/**
 * Number and date formatting. Latin digits with Indian grouping in every
 * language, so prices read the same on every screen.
 */
const intFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export function formatPoints(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return intFmt.format(value);
}

export function formatStat(value: unknown): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "";
  return Number.isInteger(value) ? intFmt.format(value) : decFmt.format(value);
}

const dateLocales = { en: "en-IN", kn: "kn-IN", hi: "hi-IN" } as const;

export function formatDate(value: string | Date | null | undefined, locale: keyof typeof dateLocales = "en"): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(dateLocales[locale], { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(d);
}

export function formatDateTime(value: string | Date | null | undefined, locale: keyof typeof dateLocales = "en"): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(dateLocales[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(d);
}

export function formatTime(value: string | Date | null | undefined, locale: keyof typeof dateLocales = "en"): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(dateLocales[locale], { hour: "numeric", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" }).format(d);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}
