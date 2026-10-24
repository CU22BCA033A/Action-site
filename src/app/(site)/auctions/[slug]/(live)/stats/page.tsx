import { Award, BarChart3, Download, Target, TrendingUp, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { LiveRefresh } from "@/components/live/live-refresh";
import { buttonClass } from "@/components/ui/button";
import { getAuctionStats, getPublicSnapshot } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("stats.title", { name: s.auction.name }), description: t("meta.auctionStats", { name: s.auction.name }), path: `/auctions/${slug}/stats`, noIndex: s.auction.rehearsal });
}

export default async function StatsPage({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t } = await getT();
  const st = await getAuctionStats(s.auction.id);
  const unit = s.auction.pointsUnitLabel;
  const config = s.auction.sportConfig;
  const teams = new Map(s.teams.map((x) => [x.id, x]));
  const roleIndex = (k: string) => Math.max(0, config.roles.findIndex((r) => r.key === k));
  const roleLabel = (k: string) => config.roles.find((r) => r.key === k)?.label ?? k;
  const maxCat = Math.max(1, ...st.byCategory.map((c) => c.spent));
  const maxRole = Math.max(1, ...st.byRole.map((c) => c.spent));
  const available = s.counts.pool + s.counts.onFloor;

  const tiles = [
    { icon: Award, value: st.soldCount, label: t("stats.playersSold"), cls: "text-accent-text" },
    { icon: TrendingUp, value: st.totalSpent, label: t("stats.totalSpent"), cls: "text-remaining" },
    { icon: Target, value: st.averagePrice, label: t("stats.averagePrice"), cls: "text-royal-light" },
    { icon: BarChart3, value: st.highestPrice, label: t("stats.highestBid"), cls: "text-warning" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="flex items-center gap-3 text-2xl sm:text-3xl">
          <BarChart3 className="size-7 text-accent-text" aria-hidden="true" />
          {t("stats.heading")}
        </h2>
        <a href={`/api/auctions/${slug}/export/results`} className={buttonClass("secondary", "md")} download>
          <Download className="size-4" aria-hidden="true" />
          {t("stats.export")}
        </a>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col items-center gap-2 card px-3 py-6 text-center">
            <tile.icon className={`size-8 ${tile.cls}`} aria-hidden="true" />
            <dd className={`num order-2 text-3xl font-bold ${tile.cls}`}>{formatPoints(tile.value)}</dd>
            <dt className="order-3 text-sm text-muted">{tile.label}</dt>
          </div>
        ))}
      </dl>

      <section className="mt-8 card p-4 sm:p-6" aria-labelledby="top-heading">
        <h3 id="top-heading" className="flex items-center gap-2 text-xl">
          <Award className="size-6 text-accent-text" aria-hidden="true" />
          {t("stats.mostExpensive")}
        </h3>
        {st.topPlayers.length === 0 ? (
          <p className="mt-4 text-muted">{t("stats.noData")}</p>
        ) : (
          <ol className="mt-4 flex flex-col gap-2">
            {st.topPlayers.map((p, i) => {
              const team = teams.get(p.teamId);
              return (
                <li key={p.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)] px-3 py-3 sm:gap-4 sm:px-4">
                  <span className={`num w-10 shrink-0 text-2xl font-bold ${i === 0 ? "text-accent-text" : i === 1 ? "text-[#9ca3af]" : i === 2 ? "text-[#d97706]" : "text-muted"}`}>#{i + 1}</span>
                  <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={64} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${p.playerId}`} className="block truncate font-bold hover:underline">
                      {p.fullName}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RoleChip size="sm" label={roleLabel(p.roleKey)} index={roleIndex(p.roleKey)} subRole={p.subRole} />
                      {p.category ? <span className="text-xs text-muted">{p.category}</span> : null}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-lg font-bold text-accent-text">{t("common.points", { amount: formatPoints(p.price), unit })}</p>
                    <p className="max-w-40 truncate text-xs font-semibold uppercase tracking-wide text-muted">{team?.name}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[
          { id: "cat", title: t("stats.byCategory"), icon: BarChart3, rows: st.byCategory.map((c) => ({ key: c.key, label: c.key, spent: c.spent, players: c.players })), max: maxCat, tone: "bg-[linear-gradient(90deg,var(--royal),var(--accent))]", empty: t("stats.noCategories") },
          { id: "role", title: t("stats.byRole"), icon: Users, rows: st.byRole.map((c) => ({ key: c.key, label: roleLabel(c.key), spent: c.spent, players: c.players })), max: maxRole, tone: "bg-[linear-gradient(90deg,#22c55e,#34d399)]", empty: t("stats.noData") },
        ].map((block) => (
          <section key={block.id} className="card p-4 sm:p-6" aria-labelledby={`${block.id}-heading`}>
            <h3 id={`${block.id}-heading`} className="flex items-center gap-2 text-xl">
              <block.icon className="size-6 text-accent-text" aria-hidden="true" />
              {block.title}
            </h3>
            {block.rows.length === 0 ? (
              <p className="mt-4 text-muted">{block.empty}</p>
            ) : (
              <ul className="mt-4 flex flex-col gap-4">
                {block.rows.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{r.label}</span>
                      <span className="num font-bold text-accent-text">{t("common.points", { amount: formatPoints(r.spent), unit })}</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                        <div className={`h-full rounded-full ${block.tone}`} style={{ width: `${Math.max(2, (r.spent / block.max) * 100)}%` }} />
                      </div>
                      <span className="w-24 shrink-0 text-right text-xs text-muted">{t("stats.playerCount", { n: r.players })}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      <section className="mt-8 card p-4 sm:p-6" aria-labelledby="teams-heading">
        <h3 id="teams-heading" className="flex items-center gap-2 text-xl">
          <TrendingUp className="size-6 text-accent-text" aria-hidden="true" />
          {t("stats.teamSpending")}
        </h3>
        <div className="mt-4 hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-line text-sm">
                <th scope="col" className="py-3 pr-3 font-bold">{t("stats.team")}</th>
                <th scope="col" className="px-3 py-3 text-right font-bold">{t("stats.players")}</th>
                <th scope="col" className="px-3 py-3 text-right font-bold">{t("stats.spent")}</th>
                <th scope="col" className="px-3 py-3 text-right font-bold">{t("stats.avg")}</th>
                <th scope="col" className="py-3 pl-3 text-right font-bold">{t("stats.remaining")}</th>
              </tr>
            </thead>
            <tbody>
              {st.teams.map((row) => {
                const team = teams.get(row.teamId);
                if (!team) return null;
                return (
                  <tr key={row.teamId} className="border-b border-line">
                    <th scope="row" className="py-3 pr-3 font-semibold">
                      <Link href={`/teams/${team.id}`} className="flex items-center gap-3 uppercase tracking-wide hover:underline">
                        <TeamMark team={team} size={36} className="rounded-[var(--radius-xs)]" />
                        {team.name}
                      </Link>
                    </th>
                    <td className="num px-3 py-3 text-right">{row.players}</td>
                    <td className="num px-3 py-3 text-right text-accent-text">{formatPoints(row.spent)}</td>
                    <td className="num px-3 py-3 text-right text-muted">{formatPoints(row.average)}</td>
                    <td className="num py-3 pl-3 text-right text-remaining">{formatPoints(row.remaining)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 flex flex-col gap-2 md:hidden">
          {st.teams.map((row) => {
            const team = teams.get(row.teamId);
            if (!team) return null;
            return (
              <li key={row.teamId} className="rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)] p-3">
                <Link href={`/teams/${team.id}`} className="flex items-center gap-3 font-semibold uppercase tracking-wide">
                  <TeamMark team={team} size={32} className="rounded-[var(--radius-xs)]" />
                  {team.name}
                </Link>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted">{t("stats.players")}</dt>
                  <dd className="num text-right">{row.players}</dd>
                  <dt className="text-muted">{t("stats.spent")}</dt>
                  <dd className="num text-right text-accent-text">{formatPoints(row.spent)}</dd>
                  <dt className="text-muted">{t("stats.avg")}</dt>
                  <dd className="num text-right">{formatPoints(row.average)}</dd>
                  <dt className="text-muted">{t("stats.remaining")}</dt>
                  <dd className="num text-right text-remaining">{formatPoints(row.remaining)}</dd>
                </dl>
              </li>
            );
          })}
        </ul>
      </section>

      <dl className="mt-8 grid grid-cols-3 gap-3">
        {[
          { value: s.counts.sold + s.counts.retained, label: t("stats.sold"), cls: "!border-l-sold text-remaining" },
          { value: s.counts.unsold, label: t("stats.unsold"), cls: "!border-l-live text-live" },
          { value: available, label: t("stats.available"), cls: "!border-l-royal text-royal-light" },
        ].map((c) => (
          <div key={c.label} className={`card flex flex-col items-center !border-l-4 px-3 py-6 ${c.cls}`}>
            <dd className="num order-1 text-4xl font-bold">{c.value}</dd>
            <dt className="order-2 text-sm font-semibold text-muted">{c.label}</dt>
          </div>
        ))}
      </dl>
    </div>
  );
}
