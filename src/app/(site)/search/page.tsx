import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/content/page-header";
import { Button } from "@/components/ui/button";
import { searchPublic, type SearchResult } from "@/lib/data/public";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.search.metaTitle"), description: t("pages.search.metaDescription"), path: "/search", noIndex: true });
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { t } = await getT();
  const raw = (await searchParams).q;
  const q = typeof raw === "string" ? raw.trim().slice(0, 80) : "";
  const results = q.length >= 2 ? await searchPublic(q) : [];
  const groups: { kind: SearchResult["kind"]; title: string }[] = [
    { kind: "auction", title: t("pages.search.auctions") },
    { kind: "team", title: t("pages.search.teams") },
    { kind: "player", title: t("pages.search.players") },
  ];
  return (
    <>
      <PageHeader title={t("pages.search.title")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <form method="get" role="search" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="f-q" className="text-sm font-semibold">
              {t("pages.search.label")}
            </label>
            <input
              id="f-q"
              name="q"
              type="search"
              defaultValue={q}
              minLength={2}
              maxLength={80}
              placeholder={t("pages.search.placeholder")}
              aria-describedby="f-q-hint"
              className="h-12 w-full min-w-0 rounded-[var(--radius-sm)] border border-line bg-bg-sunken px-3"
            />
            <p id="f-q-hint" className="text-sm text-muted">
              {t("pages.search.hint")}
            </p>
          </div>
          <Button type="submit" variant="primary" size="lg" icon={<Search className="size-4" aria-hidden="true" />} className="sm:mb-7">
            {t("pages.search.submit")}
          </Button>
        </form>
        {q.length >= 2 ? (
          <section aria-live="polite">
            <p className="font-semibold">{results.length ? t("pages.search.results", { n: results.length, q }) : t("pages.search.none", { q })}</p>
            {groups.map((g) => {
              const items = results.filter((r) => r.kind === g.kind);
              if (!items.length) return null;
              return (
                <div key={g.kind} className="mt-6">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{g.title}</h2>
                  <ul className="mt-2 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
                    {items.map((r) => (
                      <li key={r.href}>
                        <Link href={r.href} className="flex min-h-14 flex-col justify-center px-4 py-3 hover:bg-surface-2">
                          <span className="font-bold">{r.title}</span>
                          <span className="text-sm text-muted">{r.subtitle}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        ) : null}
      </div>
    </>
  );
}
