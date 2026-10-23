import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { isLocale, LOCALE_COOKIE, localeFromAcceptLanguage, type Locale } from "./config";
import en, { type Dictionary } from "./dictionaries/en";
import hi from "./dictionaries/hi";
import kn from "./dictionaries/kn";
import { createTranslator } from "./translate";

const dictionaries: Record<Locale, Dictionary> = { en, kn, hi };

export const getLocale = cache(async (): Promise<Locale> => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  return localeFromAcceptLanguage((await headers()).get("accept-language"));
});

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

export const getT = cache(async () => {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  return { locale, dict, t: createTranslator(dict, en) };
});
