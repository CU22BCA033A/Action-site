"use client";

import { History, Radio, Users } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerPhoto, TeamMark } from "@/components/auction/identity";
import { formatPoints } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Price, roleInfo, teamById } from "./bits";
import { RoomStage } from "./room-stage";
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
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[19rem_minmax(0,1fr)] lg:gap-0 lg:px-0 lg:py-0 xl:h-[max(36rem,calc(100dvh-13.5rem))] xl:grid-cols-[19rem_minmax(0,1fr)_21rem]">
        <div className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
          <FloorPanel />
        </div>
        <div className="order-2 min-h-0 min-w-0 lg:order-1 lg:row-span-2 lg:border-r lg:border-line xl:row-span-1">
          <TeamsRail snapshot={snapshot} />
        </div>
        <div className="order-3 min-h-0 min-w-0 lg:border-l lg:border-line lg:px-6 lg:pb-6 xl:px-0 xl:pb-0">
          <ActivityFeed snapshot={snapshot} />
        </div>
      </div>
    </>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card flex max-h-[40rem] flex-col overflow-hidden lg:h-full lg:max-h-none lg:rounded-none lg:border-0 lg:bg-transparent" aria-label={title}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-5">
        <h2 className="flex items-center gap-2 font-sans text-xs font-bold uppercase tracking-[0.16em] text-muted">
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

  const shownTeam = f.phase === "sold" ? buyer : leader;
  const header = (
    <div className="hidden h-14 shrink-0 items-center gap-6 border-b border-line px-6 lg:flex">
      <p className="flex items-baseline gap-2">
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.basePrice")}</span>
        <span className="num text-lg font-extrabold">{p ? formatPoints(p.basePrice) : "-"}</span>
        {p ? <span className="text-sm text-muted">{unit}</span> : null}
      </p>
      <p className="ml-auto flex min-w-0 items-center gap-2 border-l border-line pl-6">
        <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{f.phase === "sold" ? t("live.boughtBy") : t("live.bidder")}</span>
        <span className="truncate font-extrabold uppercase tracking-wide">{shownTeam ? shownTeam.name : t("live.noBidsYet")}</span>
      </p>
    </div>
  );

  if (!p) {
    return (
      <>
        {header}
        <div className="min-h-0 flex-1 lg:p-6">
          <section aria-live="polite" className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-[1.5rem] border border-line bg-surface px-6 py-16 text-center xl:h-full">
            <span className="inline-flex size-24 items-center justify-center rounded-full bg-surface-2 text-muted">
              <Radio className="size-11" aria-hidden="true" />
            </span>
            <h2 className="text-2xl">{t("live.waitingTitle")}</h2>
            <p className="max-w-sm text-muted">{snapshot.auction.status === "completed" ? t("live.completedBody") : t("live.waitingBody")}</p>
          </section>
        </div>
      </>
    );
  }

  const announce =
    f.phase === "sold" && buyer ? t("live.announceSold", { player: p.fullName, team: buyer.name, price: formatPoints(f.lastResultPrice), unit }) :
    f.phase === "unsold" ? t("live.announceUnsold", { player: p.fullName }) :
    leader ? t("live.announceBid", { price: formatPoints(f.currentPrice), unit, team: leader.name }) : "";

  return (
    <>
      {header}
      <section aria-label={t("live.tab.live")} className="flex min-h-0 flex-1 flex-col gap-4 lg:p-6 xl:overflow-y-auto">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
        <RoomStage snapshot={snapshot} timerLeft={left} />
        {f.phase === "rtm_pending" && rtmTeam ? (
          <p className="card border-paused px-4 py-3 text-sm font-semibold">
            {t(`live.rtm.${f.rtmStage ?? "offered"}`, { label: snapshot.auction.rtmLabel, team: rtmTeam.name, leader: leader?.name ?? "" })}
          </p>
        ) : null}
      </section>
    </>
  );
}

/** Bids on the player on the floor, newest first, then the latest sales. */
function ActivityFeed({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const unit = snapshot.auction.pointsUnitLabel;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === snapshot.floor.currentAuctionPlayerId);
  return (
    <Panel title={t("live.activity")} icon={<History className="size-4 text-accent-text" aria-hidden="true" />}>
      <h3 className="px-5 pt-4 font-sans text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.bidHistory")}</h3>
      {bids.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{t("live.noBidsYet")}</p>
      ) : (
        <ol className="mt-2">
          {bids.map((b, i) => {
            const team = teamById(snapshot, b.teamId);
            return (
              <li key={b.id} className={`flex items-center gap-3 border-l-2 px-5 py-3 ${i === 0 ? "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,transparent)]" : "border-transparent"}`}>
                {team ? <TeamMark team={team} size={28} className="rounded-[var(--radius-xs)]" /> : null}
                <span className="min-w-0 flex-1 truncate text-sm font-bold">{team?.name}</span>
                <span className="num shrink-0 font-bold text-accent-text">{formatPoints(b.amount)}</span>
              </li>
            );
          })}
        </ol>
      )}
      <h3 className="mt-2 border-t border-line px-5 pt-4 font-sans text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.recentSales")}</h3>
      {snapshot.recentSales.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted">{t("live.noSales")}</p>
      ) : (
        <ol className="flex flex-col gap-4 p-4">
          {snapshot.recentSales.slice(0, 12).map((s) => {
            const team = teamById(snapshot, s.teamId);
            const role = roleInfo(snapshot, s.roleKey);
            return (
              <li key={s.auctionPlayerId}>
                <Link
                  href={`/players/${s.playerId}`}
                  className="block overflow-hidden rounded-[1.25rem] border border-line bg-[linear-gradient(180deg,var(--surface-2),color-mix(in_srgb,var(--accent)_9%,var(--surface)))] hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-3 p-4">
                    {team ? <TeamMark team={team} size={40} className="rounded-[0.75rem]" /> : <span />}
                    <p className="min-w-0 text-right leading-tight">
                      <span className="block text-[0.6rem] font-bold uppercase tracking-[0.3em] text-faint">{t("live.boughtBy")}</span>
                      <span className="mt-0.5 block truncate text-xs font-extrabold uppercase tracking-[0.18em]">{team?.name}</span>
                    </p>
                  </div>
                  <div className="mx-auto w-32">
                    <PlayerPhoto name={s.fullName} photoPath={s.photoPath} sizes="128px" className="!aspect-[4/5] !rounded-[0.9rem]" />
                  </div>
                  <p className="mt-3 px-4 text-center text-xl font-black uppercase leading-tight tracking-tight">{s.fullName}</p>
                  <p className="mt-1 px-4 text-center text-[0.65rem] font-bold uppercase tracking-[0.28em] text-muted">{role.label}</p>
                  <p className="m-4 flex items-baseline justify-center gap-2 rounded-[1rem] border border-line-strong bg-surface py-2.5">
                    <Price value={s.price} tick={false} className="text-2xl font-black" />
                    <span className="text-sm font-bold text-muted">{unit}</span>
                  </p>
                </Link>
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
                className={`block border-l-2 px-4 py-3.5 hover:bg-surface-2 ${leadingId === team.id ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : "border-transparent"}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={`num inline-flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${rankClass(i)}`} aria-label={t("live.rank", { n: i + 1 })}>
                    {i + 1}
                  </span>
                  <TeamMark team={team} size={34} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.95rem] font-bold leading-tight" title={team.name}>{team.name}</p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${team.ownerDisplayName ? "bg-remaining" : "bg-line-strong"}`} />
                      <span className="truncate">{team.ownerDisplayName || t("live.available")}</span>
                    </p>
                    <p className="sr-only">{t("live.squadLine", { n: team.squadCount, max: snapshot.auction.squadMax, o: team.overseasCount })}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Price value={team.purseLeft} tick={false} className="text-base font-extrabold" />
                    <p aria-hidden="true" className="num mt-0.5 text-[0.7rem] font-semibold text-faint">
                      {team.squadCount}/{snapshot.auction.squadMax}
                    </p>
                  </div>
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

