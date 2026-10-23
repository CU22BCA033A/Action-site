"use client";

import { Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/brand/logo";
import { useT } from "@/components/i18n/i18n-provider";
import { buttonClass } from "@/components/ui/button";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

type NavKey = "auctions" | "howItWorks" | "sports" | "faq" | "contact";
const navItems: { href: string; key: NavKey }[] = [
  { href: "/auctions", key: "auctions" },
  { href: "/how-it-works", key: "howItWorks" },
  { href: "/sports", key: "sports" },
  { href: "/faq", key: "faq" },
  { href: "/contact", key: "contact" },
];

export function SiteHeader({ brand }: { brand: string }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) {
      d.close();
      triggerRef.current?.focus();
    }
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/" className="-ml-1 flex min-w-0 items-center gap-2.5 rounded-[var(--radius-sm)] px-1 py-1" aria-label={brand ? `${brand}, ${t("nav.home")}` : t("nav.home")}>
          <LogoMark className="size-8 shrink-0" />
          {brand ? <span className="truncate font-[family-name:var(--font-display)] text-xl font-extrabold tracking-wide">{brand}</span> : null}
        </Link>

        <nav aria-label={t("nav.primary")} className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="inline-flex h-11 items-center border-b-2 border-transparent px-3 text-[0.95rem] font-semibold text-muted hover:border-line-strong hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
                >
                  {t(`nav.${item.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <Link
            href="/search"
            aria-label={t("nav.search")}
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong hover:text-text"
          >
            <Search className="size-5" aria-hidden="true" />
          </Link>
          <div className="hidden sm:block">
            <LanguageSwitcher compact />
          </div>
          <ThemeToggle />
          <div className="ml-1 hidden md:block">
            <Link href="/join" className={buttonClass("primary", "md")}>
              {t("nav.join")}
            </Link>
          </div>
          <button
            ref={triggerRef}
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong lg:hidden"
            aria-label={t("common.openMenu")}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={t("common.menu")}
        onCancel={(e) => {
          e.preventDefault();
          setOpen(false);
        }}
        className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-sm border-l border-line-strong bg-surface p-0 text-text backdrop:bg-[var(--overlay)]"
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
      >
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-line px-4">
            <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold">{t("common.menu")}</span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong"
              aria-label={t("common.closeMenu")}
              onClick={() => setOpen(false)}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label={t("nav.primary")} className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="flex flex-col">
              {[{ href: "/", key: "home" as const }, ...navItems, { href: "/search", key: "search" as const }].map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={pathname === item.href ? "page" : undefined}
                    className="flex min-h-12 items-center border-l-4 border-transparent px-4 text-lg font-semibold hover:border-line-strong aria-[current=page]:border-accent"
                  >
                    {t(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex flex-col gap-3 border-t border-line p-4">
            <Link href="/join" className={buttonClass("primary", "lg", "w-full")}>
              {t("nav.join")}
            </Link>
            <LanguageSwitcher />
          </div>
        </div>
      </dialog>
    </header>
  );
}
