"use client";

import { Languages } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { setLocaleAction } from "@/lib/i18n/actions";
import { localeNames, locales, type Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const id = useId();

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {t("lang.label")}
      </label>
      <Languages className="pointer-events-none absolute left-2.5 size-4 text-muted" aria-hidden="true" />
      <select
        id={id}
        value={locale}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as Locale;
          startTransition(async () => {
            await setLocaleAction(next);
            document.documentElement.lang = localeNames[next].htmlLang;
            router.refresh();
          });
        }}
        className={`h-11 cursor-pointer appearance-none rounded-[var(--radius-sm)] border border-transparent bg-transparent pl-8 pr-3 text-sm font-semibold text-text hover:border-line-strong ${compact ? "w-[7.5rem]" : ""}`}
      >
        {locales.map((l) => (
          <option key={l} value={l} lang={localeNames[l].htmlLang} className="bg-surface text-text">
            {localeNames[l].native}
          </option>
        ))}
      </select>
    </div>
  );
}
