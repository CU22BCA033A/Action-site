"use client";

import { ArrowUp, MessageSquare } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";

/** Thin solid bar showing how far the page has been read. */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setPct(max > 0 ? Math.min(100, (window.scrollY / max) * 100) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function BackToTop() {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
        document.getElementById("main")?.focus({ preventScroll: true });
      }}
      aria-label={t("common.backToTop")}
      title={t("common.backToTop")}
      className="no-print fixed bottom-20 right-4 z-30 inline-flex size-12 items-center justify-center rounded-[var(--radius-sm)] border border-line-strong bg-surface text-text hover:border-text sm:right-6"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
    </button>
  );
}

/** Public pages only. Never rendered in the admin or team consoles. */
export function FloatingContact() {
  const t = useT();
  return (
    <Link
      href="/contact"
      className="no-print fixed bottom-4 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] border border-accent-edge bg-accent px-4 font-semibold text-accent-ink hover:bg-accent-hover sm:right-6"
    >
      <MessageSquare className="size-5" aria-hidden="true" />
      <span>{t("nav.contact")}</span>
    </Link>
  );
}
