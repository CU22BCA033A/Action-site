"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { useT } from "@/components/i18n/i18n-provider";

type Theme = "dark" | "light";

function readTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => null);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    // A first-party preference cookie, read on the server so the page never flashes.
    document.cookie = `theme=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }

  const label = theme === "light" ? t("theme.toDark") : t("theme.toLight");
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong hover:text-text ${className}`}
    >
      {theme === "light" ? <Moon className="size-5" aria-hidden="true" /> : <Sun className="size-5" aria-hidden="true" />}
    </button>
  );
}
