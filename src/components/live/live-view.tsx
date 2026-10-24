"use client";

import { Gavel, Globe2, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { formatPoints } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Meter, Price, teamById } from "./bits";
import { PlayerSpotlight } from "./player-spotlight";
import { useLive } from "./live-provider";
import { SoldMoment, useSoldMoment } from "./sold-moment";
import { useCountdown } from "./use-live-auction";

export function LiveView() {
  const { snapshot } = useLive();
  const sold = useSoldMoment(snapshot, 2300);
  return (
    <>
      {sold.active ? <SoldMoment snapshot={snapshot} onDismiss={sold.dismiss} /> : null}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)_minmax(0,1fr)] lg:py-8">
        <div className="order-2 lg:order-1">
          <RecentSales snapshot={snapshot} />
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <FloorPanel />
        </div>
        <div className="order-3">
          <TeamStandings snapshot={snapshot} />
        </div>
      </div>
    </>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FloorPanel() {
  const { snapshot, serverNow } = useLive();
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const unit = snapshot.auction.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const buyer = teamById(snapshot, f.lastResultTeamId);
  const rtmTeam = teamById(snapshot, f.rtmTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);

  if (!p) {
    return (
      <section aria-live="polite" className="card-gold flex min-h-96 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <span className="inline-flex size-24 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-3)_60%,transparent)] text-muted">
          <Radio className="size-11" aria-hidden="true" />
        </span>
        <h2 className="text-2xl">{t("live.waitingTitle")}</h2>
        <p className="max-w-sm text-muted">{snapshot.auction.status === "completed" ? t("live.completedBody") : t("live.waitingBody")}</p>
      </section>
    );
  }

  const announce =
    f.phase === "sold" && buyer ? t("live.announceSold", { player: p.fullName, team: buyer.name, price: formatPoints(f.lastResultPrice), unit }) :
    f.phase === "unsold" ? t("live.announceUnsold", { player: p.fullName }) :
    leader ? t("live.announceBid", { price: formatPoints(f.currentPrice), unit, team: leader.name }) : "";

  return (
    <section aria-label={t("live.tab.live")} className="flex flex-col gap-4">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
      <PlayerSpotlight snapshot={snapshot} timerLeft={left} />
      {f.phase === "rtm_pending" && rtmTeam ? (
        <p className="card border-paused px-4 py-3 text-sm font-semibold">
          {t(`live.rtm.${f.rtmStage ?? "offered"}`, { label: snapshot.auction.rtmLabel, team: rtmTeam.name, leader: leader?.name ?? "" })}
        </p>
      ) : null}
    </section>
  );
}

function RecentSales({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  return (
    <Panel title={t("live.recentSales")} icon={<Gavel className="size-5 text-accent-text" aria-hidden="true" />}>
      {snapshot.recentSales.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t("live.noSales")}</p>
      ) : (
        <ol className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto p-3 scrollbar-thin">
          {snapshot.recentSales.map((s) => {
            const team = teamById(snapshot, s.teamId);
            return (
              <li key={s.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] px-3 py-2.5">
                <PlayerAvatar name={s.fullName} photoPath={s.photoPath} size={48} className="rounded-[var(--radius-sm)]" />
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${s.playerId}`} className="block truncate font-bold hover:underline">
                    {s.fullName}
                  </Link>
                  <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    {team ? <TeamMark team={team} size={18} className="rounded-full" /> : null}
                    <span className="truncate">{team?.name}</span>
                  </p>
                </div>
                <Price value={s.price} tick={false} className="text-lg font-bold text-accent-text" />
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export function TeamStandings({ snapshot, limit }: { snapshot: Snapshot; limit?: number }) {
  const { t } = useI18n();
  const unit = snapshot.auction.pointsUnitLabel;
  const ranked = [...snapshot.teams].sort((a, b) => b.purseLeft - a.purseLeft || a.name.localeCompare(b.name)).slice(0, limit);
  return (
    <Panel title={t("live.standings")} icon={<Users className="size-5 text-accent-text" aria-hidden="true" />}>
      {ranked.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t("live.noTeams")}</p>
      ) : (
        <ol className="flex flex-col gap-2 p-3">
          {ranked.map((team, i) => (
            <li key={team.id}>
              <Link href={`/teams/${team.id}`} className={`block rounded-[var(--radius-md)] border bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] p-3 transition-shadow duration-300 hover:border-line-strong ${snapshot.floor.leadingTeamId === team.id && snapshot.floor.phase === "live" ? "glow-gold border-[color-mix(in_srgb,var(--accent)_50%,transparent)]" : "border-line"}`}>
                <div className="flex items-center gap-3">
                  <span className={`num inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${rankClass(i)}`} aria-label={t("live.rank", { n: i + 1 })}>
                    {i + 1}
                  </span>
                  <TeamMark team={team} size={40} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <p className="display truncate text-sm font-bold uppercase leading-tight tracking-wide" title={team.name}>{team.name}</p>
                    <p className="sr-only">{t("live.squadLine", { n: team.squadCount, max: snapshot.auction.squadMax, o: team.overseasCount })}</p>
                    <p aria-hidden="true" className="num mt-1 flex items-center gap-2.5 text-xs font-semibold text-muted">
                      <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{team.squadCount}/{snapshot.auction.squadMax}</span>
                      {snapshot.auction.maxOverseas > 0 ? <span className="inline-flex items-center gap-1"><Globe2 className="size-3.5" />{team.overseasCount}/{snapshot.auction.maxOverseas}</span> : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Price value={team.purseLeft} tick={false} className="text-lg font-bold text-accent-text" />
                    <p className="text-xs text-muted">{t("live.unitLeft", { unit })}</p>
                  </div>
                </div>
                <div className="mt-2.5">
                  <Meter value={team.purseLeft} max={team.purseTotal} tone={purseTone(team.purseLeft, team.purseTotal)} label={t("live.purseLeftPct", { team: team.name, pct: team.purseTotal ? Math.round((team.purseLeft / team.purseTotal) * 100) : 0 })} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/** Gold, silver and bronze for the top three, as on the original standings. */
function rankClass(i: number) {
  if (i === 0) return "bg-accent text-accent-ink";
  if (i === 1) return "bg-[#9ca3af] text-[#0b1220]";
  if (i === 2) return "bg-[#c2410c] text-white";
  return "bg-surface-3 text-muted";
}

/** Remaining purse bar: green above 60%, amber above 30%, red below. */
function purseTone(left: number, total: number): "sold" | "warning" | "spent" {
  const pct = total > 0 ? (left / total) * 100 : 0;
  return pct > 60 ? "sold" : pct > 30 ? "warning" : "spent";
}
