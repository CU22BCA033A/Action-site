export const locales = ["en", "kn", "hi"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const LOCALE_COOKIE = "lang";

export const localeNames: Record<Locale, { native: string; english: string; htmlLang: string }> = {
  en: { native: "English", english: "English", htmlLang: "en-IN" },
  kn: { native: "ಕನ್ನಡ", english: "Kannada", htmlLang: "kn-IN" },
  hi: { native: "हिन्दी", english: "Hindi", htmlLang: "hi-IN" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/** Picks a supported locale from an Accept-Language header. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return defaultLocale;
  const parts = header
    .split(",")
    .map((p) => {
      const [tag, q] = p.trim().split(";q=");
      return { tag: (tag ?? "").toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { tag } of parts) {
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}
