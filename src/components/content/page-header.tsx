import type { ReactNode } from "react";

/** Heading block shared by content pages: eyebrow, title, intro, optional date. */
export function PageHeader({ eyebrow, title, intro, meta }: { eyebrow?: string; title: string; intro?: ReactNode; meta?: ReactNode }) {
  return (
    <header className="border-b border-line">
      <div className="mx-auto max-w-5xl px-4 pb-8 pt-10 sm:px-6 sm:pt-14">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="mt-3 text-4xl tracking-[-0.025em] [text-wrap:balance] sm:text-5xl">{title}</h1>
        <hr className="rule-gold mt-5 w-14" />
        {intro ? <p className="mt-5 max-w-3xl text-lg leading-relaxed text-muted">{intro}</p> : null}
        {meta ? <p className="mt-3 text-sm text-faint">{meta}</p> : null}
      </div>
    </header>
  );
}

/** "On this page" list. Plain anchor links; no scroll-spy or animation. */
export function OnThisPage({ title, items }: { title: string; items: { id: string; label: string }[] }) {
  return (
    <nav aria-labelledby="toc-title" className="rounded-[var(--radius-md)] border border-line bg-surface p-4 lg:sticky lg:top-24">
      <h2 id="toc-title" className="text-xs font-bold uppercase tracking-wider text-muted">
        {title}
      </h2>
      <ol className="mt-3 space-y-1">
        {items.map((it, i) => (
          <li key={it.id}>
            <a href={`#${it.id}`} className="flex min-h-9 items-center gap-2 rounded-[var(--radius-xs)] px-2 text-sm hover:bg-surface-2">
              <span className="num w-5 text-faint">{i + 1}.</span>
              <span>{it.label}</span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
