import { ArrowLeft, Download, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { LiveRefresh } from "@/components/live/live-refresh";
import { buttonClass } from "@/components/ui/button";
import { getPublicSnapshot, listAuctionPlayers } from "@/lib/data/public";
import { formatPoints, formatStat } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ team?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("auction.teamsTitle", { name: s.auction.name }), description: t("meta.auctionTeams", { name: s.auction.name, n: s.teams.length }), path: `/auctions/${slug}/teams`, noIndex: s.auction.rehearsal });
}

/** Squads, as on the original CPL site: pick a team, then see its players grouped by role. */
export default async function SquadsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { team: teamId } = await searchParams;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t } = await getT();
  const a = s.auction;
  const unit = a.pointsUnitLabel;
  const base = `/auctions/${slug}/teams`;
  const selected = teamId ? s.teams.find((x) => x.id === teamId) : undefined;

  if (!selected) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <LiveRefresh />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl">{t("auction.squadsTitle")}</h2>
            <p className="mt-2 max-w-2xl text-muted">{t("auction.squadsIntro")}</p>
          </div>
          <a href={`/api/auctions/${slug}/export/squads`} className={buttonClass("secondary", "sm")}>
            <Download className="size-4" aria-hidden="true" />
            {t("auction.exportSquads")}
          </a>
        </div>
        {s.teams.length === 0 ? (
          <p className="mt-8 text-muted">{t("live.noTeams")}</p>
        ) : (
          <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
            {s.teams.map((team) => (
              <li key={team.id}>
                <Link
                  href={`${base}?team=${team.id}`}
                  className="card group flex h-full flex-col items-center p-5 text-center transition-[border-color,box-shadow] duration-300 hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)] hover:shadow-[0_0_30px_var(--glow-gold)] sm:p-6"
                >
                  <TeamMark team={team} size={80} className="rounded-[var(--radius-md)] border-2 border-[color-mix(in_srgb,var(--accent)_30%,transparent)] transition-colors group-hover:border-accent" />
                  <h3 className="mt-4 text-base sm:text-lg">{team.name}</h3>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
                    <Users className="size-4" aria-hidden="true" />
                    {t("auction.teamPlayers", { n: team.squadCount })}
                  </p>
                  <p className="num mt-1 text-sm font-semibold text-accent-text">{t("auction.teamRemaining", { left: formatPoints(team.purseLeft), unit })}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const players = (await listAuctionPlayers(a.id)).filter((p) => p.soldToTeamId === selected.id && (p.status === "sold" || p.status === "retained"));
  const roles = a.sportConfig.roles.filter((r) => !r.hidden || players.some((p) => p.roleKey === r.key));
  const statFields = a.sportConfig.statFields.filter((x) => x.showOnCard).slice(0, 3);
  const groups = roles.map((r, i) => ({ role: r, index: i, players: players.filter((p) => p.roleKey === r.key).sort((x, y) => (y.soldPrice ?? 0) - (x.soldPrice ?? 0)) }));
  const spent = players.reduce((n, p) => n + (p.soldPrice ?? 0), 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
        <Link href={base} aria-label={t("auction.backToTeams")} className="card inline-flex size-12 items-center justify-center hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]">
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          <TeamMark team={selected} size={64} className="rounded-[var(--radius-md)] border-2 border-accent" />
          <div className="min-w-0">
            <h2 className="text-2xl sm:text-3xl">{selected.name}</h2>
            <p className="num text-muted">
              {t("auction.teamPlayers", { n: players.length })} / {t("auction.teamRemaining", { left: formatPoints(selected.purseLeft), unit })}
            </p>
          </div>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="card px-3 py-3 text-center">
          <dt className="text-xs uppercase tracking-wider text-muted">{t("auction.purse")}</dt>
          <dd className="num text-xl font-bold">{formatPoints(selected.purseTotal)}</dd>
        </div>
        <div className="card px-3 py-3 text-center">
          <dt className="text-xs uppercase tracking-wider text-muted">{t("auction.spent")}</dt>
          <dd className="num text-xl font-bold text-spent">{formatPoints(spent)}</dd>
        </div>
        <div className="card px-3 py-3 text-center">
          <dt className="text-xs uppercase tracking-wider text-muted">{t("auction.left")}</dt>
          <dd className="num text-xl font-bold text-remaining">{formatPoints(selected.purseLeft)}</dd>
        </div>
      </dl>

      {players.length === 0 ? (
        <div className="card mt-8 p-12 text-center">
          <Trophy className="mx-auto size-16 text-muted" aria-hidden="true" />
          <p className="mt-4 text-lg text-muted">{t("auction.emptySquad")}</p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((g) => (
            <section key={g.role.key} aria-labelledby={`role-${g.role.key}`} className="flex flex-col gap-3">
              <h3 id={`role-${g.role.key}`} className="flex items-center gap-2 text-lg">
                <RoleChip label={g.role.label} index={g.index} />
                <span className="num text-sm font-normal text-muted">({g.players.length})</span>
              </h3>
              {g.players.length === 0 ? <p className="text-sm text-muted">{t("auction.noneInRole")}</p> : null}
              {g.players.map((p) => (
                <Link key={p.id} href={`/players/${p.id}`} className="card flex items-center gap-4 p-3 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]">
                  <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={72} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="truncate font-bold">{p.fullName}</span>
                      <span className="num shrink-0 rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--royal)_20%,transparent)] px-1.5 text-xs font-bold text-royal-light">#{p.lotNo}</span>
                    </p>
                    {p.category || p.subRole ? <p className="truncate text-xs text-muted">{[p.subRole, p.category].filter(Boolean).join(" / ")}</p> : null}
                    {statFields.length ? (
                      <p className="num truncate text-xs text-muted">{statFields.map((f) => `${formatStat(p.stats[f.key]) || 0} ${f.label}`).join(" / ")}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-lg font-bold text-accent-text">{formatPoints(p.soldPrice ?? 0)}</p>
                    <p className="text-xs text-muted">{p.status === "retained" ? t("playerStatus.retained") : unit}</p>
                  </div>
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
