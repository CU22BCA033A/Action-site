"use client";

import { useT } from "@/components/i18n/i18n-provider";

export function SkipLink({ target = "main" }: { target?: string }) {
  const t = useT();
  return (
    <a
      href={`#${target}`}
      className="sr-only-focusable fixed left-3 top-3 z-[70] rounded-[var(--radius-sm)] border-2 border-focus bg-surface px-4 py-3 font-semibold text-text"
    >
      {t("common.skipToContent")}
    </a>
  );
}
