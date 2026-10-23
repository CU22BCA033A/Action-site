"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";

type Theme = "dark" | "light";

/** Inline script run before paint, so the page never flashes the wrong theme. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'}document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','dark')}})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
  const t = useT();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage blocked: the choice lasts for this page only */
    }
    setTheme(next);
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
