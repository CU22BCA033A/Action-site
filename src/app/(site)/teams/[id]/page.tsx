import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RoleChip, TeamMark } from "@/components/auction/identity";
import { PlayerCard } from "@/components/auction/player-card";
import { AuctionTopBar } from "@/components/live/auction-chrome";
import { LiveProvider } from "@/components/live/live-provider";
import { LiveRefresh } from "@/components/live/live-refresh";
import { getPublicTeam } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!uuid.test(id)) return {};
  const data = await getPublicTeam(id);
  const { t } = await getT();
  if (!data) return {};
  return pageMeta({
    title: t("auction.squadTitle", { team: data.team.name }),
    description: t("meta.team", { team: data.team.name, auction: data.snapshot.auction.name, n: data.team.squadCount }),
    path: `/teams/${id}`,
    noIndex: data.snapshot.auction.rehearsal,
  });
}

export default async function TeamPage({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const data = await getPublicTeam(id);
  if (!data) notFound();
  const { t } = await getT();
  const { snapshot, team, squad } = data;
  const a = snapshot.auction;
  const config = a.sportConfig;
  const roles = config.roles.map((r, index) => ({ ...r, index })).filter((r) => !r.hidden || squad.some((p) => p.roleKey === r.key));

  return (
    <LiveProvider initial={snapshot} snapshotUrl={`/api/auctions/${a.slug}/snapshot`}>
      <LiveRefresh />
      <AuctionTopBar />
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-4">
          <Link href={`/auctions/${a.slug}/teams`} aria-label={t("auction.backToTeams")} className="inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] border border-line-strong hover:border-text">
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <TeamMark team={team} size={80} className="rounded-[var(--radius-md)] border-2 border-accent-edge" />
          <div className="min-w-0">
            <h1 className="text-3xl uppercase sm:text-4xl">{team.name}</h1>
            <p className="mt-1 text-lg text-info">
              {t("auction.squadSummary", { n: team.squadCount, left: formatPoints(team.purseLeft), unit: a.pointsUnitLabel })}
            </p>
            {team.ownerDisplayName ? <p className="text-sm text-muted">{t("auction.owner", { name: team.ownerDisplayName })}</p> : null}
          </div>
        </div>

        {squad.length === 0 ? (
          <p className="mt-10 rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{t("auction.emptySquad")}</p>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-3">
            {roles.map((r) => {
              const items = squad.filter((p) => p.roleKey === r.key);
              if (items.length === 0) return null;
              return (
                <section key={r.key} aria-labelledby={`r-${r.key}`}>
                  <h2 id={`r-${r.key}`} className="mb-3 flex items-center gap-3 text-lg">
                    <RoleChip label={r.label} index={r.index} />
                    <span className="num text-sm text-muted">({items.length})</span>
                  </h2>
                  <ul className="flex flex-col gap-3">
                    {items.map((p) => (
                      <li key={p.auctionPlayerId}>
                        <PlayerCard
                          player={p}
                          config={config}
                          price={p.soldPrice}
                          priceLabel={a.pointsUnitLabel}
                          unit={a.pointsUnitLabel}
                          statusLabel={p.status === "retained" ? t("playerStatus.retained") : undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </LiveProvider>
  );
}
