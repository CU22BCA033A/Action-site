import { ArrowRight, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, statusTone } from "@/components/ui/badges";
import { listPublicAuctions, type AuctionListItem } from "@/lib/data/public";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("auctionsPage.metaTitle"), description: t("auctionsPage.metaDescription"), path: "/auctions" });
}

export default async function AuctionsPage() {
  const { t, locale } = await getT();
  const all = await listPublicAuctions();
  const groups = [
    { key: "live", title: t("auctionsPage.live"), items: all.filter((a) => a.status === "live" || a.status === "paused") },
    { key: "upcoming", title: t("auctionsPage.upcoming"), items: all.filter((a) => a.status === "scheduled") },
    { key: "completed", title: t("auctionsPage.completed"), items: all.filter((a) => a.status === "completed") },
  ].filter((g) => g.items.length > 0);

  const Card = ({ a }: { a: AuctionListItem }) => (
    <li>
      <Link
        href={`/auctions/${a.slug}`}
        aria-label={t("auctionsPage.open", { name: a.name })}
        className="flex h-full flex-col gap-4 rounded-[var(--radius-md)] border border-line bg-surface p-5 hover:border-line-strong"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold uppercase tracking-wider text-muted">{a.sportName}</span>
          <Badge tone={statusTone(a.status)}>{t(`status.${a.status as "live"}`)}</Badge>
        </div>
        <h3 className="text-2xl uppercase text-accent-text">{a.name}</h3>
        {a.startsAt ? <p className="text-sm text-muted">{formatDate(a.startsAt, locale)}</p> : null}
        <p className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {t("auctionsPage.teams", { n: a.teamCount })}
          </span>
          <span>{t("auctionsPage.players", { n: a.playerCount })}</span>
          <span>{t("auctionsPage.sold", { n: a.soldCount })}</span>
        </p>
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-accent-text">
          {t(a.status === "completed" ? "home.viewResults" : "home.watch")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-4xl sm:text-5xl">{t("auctionsPage.title")}</h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{t("auctionsPage.intro")}</p>
      {groups.length === 0 ? (
        <p className="mt-10 rounded-[var(--radius-md)] border border-line bg-surface p-6 text-muted">{t("auctionsPage.empty")}</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="mt-10" aria-labelledby={`group-${g.key}`}>
            <h2 id={`group-${g.key}`} className="text-2xl">
              {g.title}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((a) => (
                <Card key={a.id} a={a} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
