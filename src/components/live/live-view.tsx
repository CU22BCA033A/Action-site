"use client";

import { Globe2, History, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { formatPoints } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Meter, Price, teamById } from "./bits";
import { PlayerSpotlight } from "./player-spotlight";
import { useLive } from "./live-provider";
import { playSold, readSound } from "./sale-sound";
import { SoldMoment, useSoldMoment } from "./sold-moment";
import { useCountdown } from "./use-live-auction";

export function LiveView() {
  const { snapshot } = useLive();
  const sold = useSoldMoment(snapshot, 2300, () => {
    if (readSound()) playSold();
  });
  return (
    <>
      {sold.active ? <SoldMoment snapshot={snapshot} onDismiss={sold.dismiss} /> : null}
      {/*
        Auction room: teams and purses on the left, the player in the middle,
        live activity on the right, all on one screen from xl up. Each side
        column scrolls on its own. Phones: player first, then teams, then activity.
      */}
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:py-5 xl:h-[max(34rem,calc(100dvh-17.5rem))] xl:grid-cols-[17rem_minmax(0,1fr)_18rem]">
        <div className="order-1 min-h-0 min-w-0 lg:order-2">
          <FloorPanel />
        </div>
        <div className="order-2 min-h-0 min-w-0 lg:order-1 lg:row-span-2 xl:row-span-1">
          <TeamsRail snapshot={snapshot} />
        </div>
        <div className="order-3 min-h-0 min-w-0">
          <ActivityFeed snapshot={snapshot} />
        </div>
      </div>
    </>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card flex max-h-[40rem] flex-col overflow-hidden lg:h-full lg:max-h-none" aria-label={title}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3.5">
        <h2 className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.18em] text-muted">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">{children}</div>
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
      <section aria-live="polite" className="card-gold flex min-h-96 flex-col xl:h-full items-center justify-center gap-4 px-6 py-16 text-center">
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
    <section aria-label={t("live.tab.live")} className="flex flex-col gap-4 xl:h-full">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
      <PlayerSpotlight snapshot={snapshot} timerLeft={left} wide />
      {f.phase === "rtm_pending" && rtmTeam ? (
        <p className="card border-paused px-4 py-3 text-sm font-semibold">
          {t(`live.rtm.${f.rtmStage ?? "offered"}`, { label: snapshot.auction.rtmLabel, team: rtmTeam.name, leader: leader?.name ?? "" })}
        </p>
      ) : null}
    </section>
  );
}

/** Bids on the player on the floor, newest first, then the latest sales. */
function ActivityFeed({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const unit = snapshot.auction.pointsUnitLabel;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === snapshot.floor.currentAuctionPlayerId);
  return (
    <Panel title={t("live.activity")} icon={<History className="size-4 text-accent-text" aria-hidden="true" />}>
      <h3 className="px-4 pt-4 font-sans text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.bidHistory")}</h3>
      {bids.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{t("live.noBidsYet")}</p>
      ) : (
        <ol className="mt-2">
          {bids.map((b, i) => {
            const team = teamById(snapshot, b.teamId);
            return (
              <li key={b.id} className={`flex items-center gap-3 border-l-2 px-4 py-2.5 ${i === 0 ? "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "border-transparent"}`}>
                {team ? <TeamMark team={team} size={28} className="rounded-[var(--radius-xs)]" /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide">{team?.name}</span>
                <span className="num shrink-0 font-bold text-accent-text">{formatPoints(b.amount)}</span>
              </li>
            );
          })}
        </ol>
      )}
      <h3 className="mt-2 border-t border-line px-4 pt-4 font-sans text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.recentSales")}</h3>
      {snapshot.recentSales.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{t("live.noSales")}</p>
      ) : (
        <ol className="mt-1 divide-y divide-line">
          {snapshot.recentSales.map((s) => {
            const team = teamById(snapshot, s.teamId);
            return (
              <li key={s.auctionPlayerId} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                <PlayerAvatar name={s.fullName} photoPath={s.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${s.playerId}`} className="block truncate text-sm font-bold hover:underline">
                    {s.fullName}
                  </Link>
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{team ? t("live.soldTo", { team: team.name }) : null}</p>
                </div>
                <span className="shrink-0 text-right">
                  <Price value={s.price} tick={false} className="font-bold text-accent-text" />
                  <span className="block text-[0.7rem] text-faint">{unit}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

/** Compact team list: rank, logo, name, squad count and purse left with a thin bar. */
export function TeamsRail({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const unit = snapshot.auction.pointsUnitLabel;
  const ranked = [...snapshot.teams].sort((a, b) => b.purseLeft - a.purseLeft || a.name.localeCompare(b.name));
  const leadingId = snapshot.floor.phase === "live" ? snapshot.floor.leadingTeamId : null;
  return (
    <Panel title={t("live.auctionTeams")} icon={<Users className="size-4 text-accent-text" aria-hidden="true" />}>
      {ranked.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t("live.noTeams")}</p>
      ) : (
        <ol className="divide-y divide-line">
          {ranked.map((team, i) => (
            <li key={team.id}>
              <Link
                href={`/teams/${team.id}`}
                className={`block border-l-2 px-3 py-2.5 hover:bg-surface-2 ${leadingId === team.id ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-transparent"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankClass(i)}`} aria-label={t("live.rank", { n: i + 1 })}>
                    {i + 1}
                  </span>
                  <TeamMark team={team} size={34} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold uppercase leading-tight tracking-wide" title={team.name}>{team.name}</p>
                    <p className="sr-only">{t("live.squadLine", { n: team.squadCount, max: snapshot.auction.squadMax, o: team.overseasCount })}</p>
                    <p aria-hidden="true" className="num mt-0.5 flex items-center gap-2 text-[0.7rem] font-semibold text-muted">
                      <span className="inline-flex items-center gap-1"><Users className="size-3" />{team.squadCount}/{snapshot.auction.squadMax}</span>
                      {snapshot.auction.maxOverseas > 0 ? <span className="inline-flex items-center gap-1"><Globe2 className="size-3" />{team.overseasCount}/{snapshot.auction.maxOverseas}</span> : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Price value={team.purseLeft} tick={false} className="text-base font-bold text-accent-text" />
                    <p className="text-[0.65rem] uppercase tracking-wide text-faint">{t("live.unitLeft", { unit })}</p>
                  </div>
                </div>
                <div className="mt-2 pl-[2.1rem]">
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
