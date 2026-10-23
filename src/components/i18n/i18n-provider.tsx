"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { createTranslator, type TranslateFn } from "@/lib/i18n/translate";

type Ctx = { locale: Locale; t: TranslateFn<Dictionary>; numberLocale: string };

const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({ locale, dict, children }: { locale: Locale; dict: Dictionary; children: ReactNode }) {
  const value = useMemo<Ctx>(() => ({ locale, t: createTranslator(dict), numberLocale: "en-IN" }), [locale, dict]);
  return <I18nContext value={value}>{children}</I18nContext>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export function useT() {
  return useI18n().t;
}
