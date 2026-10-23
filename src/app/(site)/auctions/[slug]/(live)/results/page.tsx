import { Download } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { LiveRefresh } from "@/components/live/live-refresh";
import { buttonClass } from "@/components/ui/button";
import { getPublicSnapshot, listAuctionPlayers } from "@/lib/data/public";
import { formatDateTime, formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("auction.resultsTitle", { name: s.auction.name }), description: t("meta.auctionResults", { name: s.auction.name }), path: `/auctions/${slug}/results`, noIndex: s.auction.rehearsal });
}

export default async function ResultsPage({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t, locale } = await getT();
  const config = s.auction.sportConfig;
  const all = await listAuctionPlayers(s.auction.id);
  const teams = new Map(s.teams.map((x) => [x.id, x]));
  const sold = all.filter((p) => p.status === "sold").sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
  const retained = all.filter((p) => p.status === "retained");
  const unsold = all.filter((p) => p.status === "unsold");
  const roleLabel = (k: string) => config.roles.find((r) => r.key === k)?.label ?? k;
  const updated = s.auction.completedAt ?? s.auction.updatedAt;

  const list = (rows: typeof all, priceLabel: string) => (
    <ul className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
      {rows.map((p) => {
        const team = p.soldToTeamId ? teams.get(p.soldToTeamId) : undefined;
        return (
          <li key={p.auctionPlayerId} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-3 sm:grid-cols-[3.5rem_auto_1fr_1fr_auto] sm:px-4">
            <span className="num hidden text-sm font-bold text-info sm:block">#{String(p.lotNo).padStart(3, "0")}</span>
            <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
            <div className="min-w-0">
              <Link href={`/players/${p.id}`} className="block truncate font-bold hover:underline">
                {p.fullName}
              </Link>
              <p className="truncate text-xs text-muted">
                {roleLabel(p.roleKey)}
                {p.category ? `, ${p.category}` : ""}
              </p>
              {team ? <p className="truncate text-xs font-semibold sm:hidden">{team.name}</p> : null}
            </div>
            <div className="hidden min-w-0 items-center gap-2 sm:flex">
              {team ? (
                <>
                  <TeamMark team={team} size={28} className="rounded-[var(--radius-xs)]" />
                  <Link href={`/teams/${team.id}`} className="truncate font-semibold hover:underline">
                    {team.name}
                  </Link>
                </>
              ) : null}
            </div>
            <div className="text-right">
              <p className="num font-bold text-accent-text">{p.soldPrice !== null ? formatPoints(p.soldPrice) : formatPoints(p.basePrice)}</p>
              <p className="text-xs text-muted">{priceLabel}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl">{t("auction.resultsTitle", { name: s.auction.name })}</h2>
          <p className="mt-2 text-sm text-muted">{t("common.lastUpdated", { date: formatDateTime(updated, locale) })}</p>
        </div>
        <a href={`/api/auctions/${slug}/export/results`} className={buttonClass("secondary", "md")} download>
          <Download className="size-4" aria-hidden="true" />
          {t("auction.downloadCsv")}
        </a>
      </div>

      <section className="mt-8" aria-labelledby="sold-heading">
        <h3 id="sold-heading" className="mb-3 text-lg">
          {t("auction.soldList")} <span className="num text-base text-muted">({sold.length})</span>
        </h3>
        {sold.length ? list(sold, s.auction.pointsUnitLabel) : <p className="text-muted">{t("auction.noResults")}</p>}
      </section>
      {retained.length ? (
        <section className="mt-8" aria-labelledby="retained-heading">
          <h3 id="retained-heading" className="mb-3 text-lg">
            {t("auction.retainedList")} <span className="num text-base text-muted">({retained.length})</span>
          </h3>
          {list(retained, s.auction.pointsUnitLabel)}
        </section>
      ) : null}
      <section className="mt-8" aria-labelledby="unsold-heading">
        <h3 id="unsold-heading" className="mb-3 text-lg">
          {t("auction.unsoldList")} <span className="num text-base text-muted">({unsold.length})</span>
        </h3>
        {unsold.length ? list(unsold, t("auction.base")) : <p className="text-muted">{t("auction.noUnsold")}</p>}
      </section>
    </div>
  );
}
