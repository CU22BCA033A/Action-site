"use client";

import { FileWarning, Gauge, History, Inbox, LogOut, Menu, Trophy, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { logoutAction } from "@/lib/auth/admin-actions";

const nav = [
  { href: "/admin", label: "Auctions", icon: Gauge, exact: true },
  { href: "/admin/sports", label: "Sports", icon: Trophy },
  { href: "/admin/inbox", label: "Contact inbox", icon: Inbox },
  { href: "/admin/deletion-requests", label: "Deletion requests", icon: FileWarning },
  { href: "/admin/audit", label: "Audit log", icon: History },
];

export function AdminShell({ children, counts }: { children: ReactNode; counts: { inbox: number; deletions: number } }) {
  const pathname = usePathname();
  const [openedOn, setOpenedOn] = useState<string | null>(null);
  const open = openedOn === pathname;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href || pathname.startsWith("/admin/auctions") : pathname.startsWith(href));
  const badge = (href: string) => (href === "/admin/inbox" ? counts.inbox : href === "/admin/deletion-requests" ? counts.deletions : 0);

  const links = (
    <ul className="flex flex-col gap-1">
      {nav.map((n) => (
        <li key={n.href}>
          <Link
            href={n.href}
            aria-current={isActive(n.href, n.exact) ? "page" : undefined}
            className="flex min-h-11 items-center gap-3 rounded-[var(--radius-sm)] border-l-4 border-transparent px-3 font-semibold text-muted hover:bg-surface-2 hover:text-text aria-[current=page]:border-accent aria-[current=page]:bg-surface-2 aria-[current=page]:text-text"
          >
            <n.icon className="size-5" aria-hidden="true" />
            <span className="flex-1">{n.label}</span>
            {badge(n.href) > 0 ? (
              <span className="num rounded-full bg-accent px-2 text-xs font-bold text-accent-ink" aria-label={`${badge(n.href)} new`}>
                {badge(n.href)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );

  const footer = (
    <div className="flex items-center gap-2 border-t border-line p-3">
      <ThemeToggle />
      <form action={logoutAction} className="flex-1">
        <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 font-semibold hover:border-text">
          <LogOut className="size-4" aria-hidden="true" />
          Sign out
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/admin" className="flex h-16 items-center gap-2.5 border-b border-line px-4">
          <LogoMark className="size-8" />
          <span className="display text-lg font-bold uppercase">Admin</span>
        </Link>
        <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
          {links}
        </nav>
        {footer}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg px-4 lg:hidden">
          <button type="button" onClick={() => setOpenedOn(pathname)} aria-label="Open admin menu" aria-haspopup="dialog" className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong">
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <span className="display font-bold uppercase">Admin</span>
        </header>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 outline-none">
          {children}
        </main>
      </div>
      <dialog
        ref={ref}
        aria-label="Admin menu"
        onCancel={(e) => {
          e.preventDefault();
          setOpenedOn(null);
        }}
        onClick={(e) => {
          if (e.target === ref.current) setOpenedOn(null);
        }}
        className="m-0 h-dvh max-h-dvh w-72 max-w-[85vw] border-r border-line-strong bg-surface p-0 text-text backdrop:bg-[var(--overlay)]"
      >
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-line px-3">
            <span className="display font-bold uppercase">Admin</span>
            <button type="button" onClick={() => setOpenedOn(null)} aria-label="Close admin menu" className="inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong">
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Admin" className="flex-1 overflow-y-auto p-3">
            {links}
          </nav>
          {footer}
        </div>
      </dialog>
    </div>
  );
}

export function AdminPageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4 px-4 py-6 sm:px-6">
        <div className="min-w-0">
          {back ? (
            <Link href={back.href} className="link mb-2 inline-block text-sm text-muted hover:text-text">
              {back.label}
            </Link>
          ) : null}
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {description ? <div className="mt-2 max-w-3xl text-muted">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function AdminSection({ title, description, children, actions, id }: { title: ReactNode; description?: ReactNode; children: ReactNode; actions?: ReactNode; id?: string }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className="rounded-[var(--radius-md)] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-xl">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
