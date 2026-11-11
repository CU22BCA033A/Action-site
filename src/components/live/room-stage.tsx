"use client";

import { Eye, ListOrdered } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerPhoto, TeamMark } from "@/components/auction/identity";
import { formatPoints, formatStat } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Price, roleInfo, teamById } from "./bits";

/** Stat values in the reference's order: white, green, cyan, amber. */
const STAT_TONES = ["text-[#fafafa]", "text-[#22c55e]", "text-[#22d3ee]", "text-[#f59e0b]"];

const LABEL = "text-[0.6875rem] font-extrabold uppercase tracking-[0.14em] text-faint";

/** Round countdown: a green ring, amber under 10 seconds, red under 5. */
function TimerRing({ left }: { left: number }) {
  const { t } = useI18n();
  const tone = left <= 5 ? "border-[#ef4444] bg-[#ef4444]/10 text-[#f87171]" : left <= 10 ? "border-[#f59e0b] bg-[#f59e0b]/10 text-[#fbbf24]" : "border-[#16a34a] bg-[#16a34a]/10 text-[#22c55e]";
  return (
    <div
      role="timer"
      aria-label={left === 0 ? t("time.timeUp") : t("time.secondsLeft", { s: left })}
      className={`flex size-[5rem] shrink-0 flex-col items-center justify-center rounded-full border-2 leading-none ${tone}`}
    >
      <span aria-hidden="true" className="num text-[1.75rem] font-extrabold">{left}</span>
      <span aria-hidden="true" className="mt-1 text-[0.55rem] font-extrabold uppercase tracking-[0.14em]">sec</span>
    </div>
  );
}

/**
 * The player on the floor, matching the owner's reference: a card with a
 * green timer line along its top edge, the photo beside role pills, a large
 * name, a four-stat strip, the current bid with the bidding team's badge and
 * a countdown ring, and a read-only bar at the bottom.
 */
export function RoomStage({ snapshot, timerLeft }: { snapshot: Snapshot; timerLeft: number | null }) {
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  if (!p) return null;
  const a = snapshot.auction;
  const unit = a.pointsUnitLabel;
  const role = roleInfo(snapshot, p.roleKey);
  const leader = teamById(snapshot, f.leadingTeamId);
  const buyer = teamById(snapshot, f.lastResultTeamId);
  const sold = f.phase === "sold";
  const unsold = f.phase === "unsold";
  const live = f.phase === "live";
  const shownTeam = sold ? buyer : leader;
  const stats = a.sportConfig.statFields.filter((s) => s.showOnCard).slice(0, 4);
  const total = a.bidTimerSeconds ?? 0;
  const timerShown = live && timerLeft !== null && total > 0;
  const barPct = timerShown ? Math.max(0, Math.min(100, ((timerLeft ?? 0) / total) * 100)) : sold ? 100 : 0;

  return (
    <article aria-labelledby="stage-name" className="@container flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface">
      {/* Phones have no room header row, so base price and bidder sit here. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 py-3 lg:hidden">
        <p className="flex items-baseline gap-2">
          <span className={LABEL}>{t("live.basePrice")}:</span>
          <span className="num font-extrabold">{formatPoints(p.basePrice)}</span>
        </p>
        <p className="ml-auto flex min-w-0 items-center gap-2">
          <span className={LABEL}>{sold ? t("live.boughtBy") : t("live.bidder")}:</span>
          <span className="truncate font-extrabold uppercase">{shownTeam ? shownTeam.shortName : unsold ? t("phase.unsold") : t("common.none")}</span>
        </p>
      </div>

      <div className="h-1 shrink-0" aria-hidden="true">
        <div className="h-full rounded-r-full bg-[#22c55e] transition-[width] duration-300 ease-linear" style={{ width: `${barPct}%` }} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 px-6 py-8 @[36rem]:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] @[36rem]:px-8 @[52rem]:grid-cols-[minmax(0,18.75rem)_minmax(0,1fr)] @[52rem]:gap-12 @[52rem]:px-12 @[52rem]:py-12">
        <div className="relative mx-auto w-full max-w-[18.75rem] @[36rem]:max-w-none">
          <PlayerPhoto name={p.fullName} photoPath={p.photoPath} priority sizes="(min-width: 768px) 300px, 90vw" className="!aspect-[3/4] !rounded-[1.75rem] border border-line-strong !bg-[#1a1a1a]" />
          {live ? (
            <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase text-white">
              <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-current" />
              {t("status.live")}
            </span>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col">
          <ul className="flex flex-wrap gap-2" aria-label={t("register.role")}>
            <li className="rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-[#60a5fa]">
              {role.label}
              {p.subRole ? ` · ${p.subRole}` : ""}
            </li>
            <li className="rounded-full border border-[#a855f7]/40 bg-[#a855f7]/10 px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-[#c084fc]">
              {t(`nationality.${p.nationalityGroup}`)}
            </li>
            {p.category ? <li className="rounded-full border border-line-strong px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-muted">{p.category}</li> : null}
          </ul>

          <h2 id="stage-name" className="mt-5 text-[2.5rem] font-extrabold leading-[1.05] tracking-[-0.035em] @[52rem]:text-[3.5rem] @[60rem]:text-[4rem]">
            {p.fullName}
          </h2>

          {stats.length ? (
            <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-[1.25rem] border border-line bg-[#141414] py-1 @[46rem]:grid-cols-4">
              {stats.map((s, i) => (
                <div key={s.key} className={`flex flex-col items-center px-2 py-4 text-center ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line @[46rem]:border-t-0" : ""} ${i === 2 ? "@[46rem]:border-l" : ""}`}>
                  <dt className="order-1 max-w-full truncate text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-faint">{s.label}</dt>
                  <dd className={`num order-2 mt-2 whitespace-nowrap text-[1.75rem] font-bold leading-none ${STAT_TONES[i % STAT_TONES.length]}`}>{formatStat(p.stats[s.key]) || "0"}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="mt-10 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className={LABEL}>{sold ? t("live.soldFor") : t("live.currentBid")}</p>
              {sold || leader ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className={`flex items-baseline gap-2 ${sold ? "text-[#22c55e]" : "text-text"}`}>
                    <Price value={sold ? f.lastResultPrice : f.currentPrice} className="text-[2.5rem] font-extrabold leading-none tracking-[-0.02em]" />
                    <span className="text-xl font-extrabold">{unit}</span>
                  </p>
                  {shownTeam ? (
                    <span className="inline-flex items-center gap-2 rounded-[0.75rem] border border-line-strong bg-surface-2 py-1.5 pl-1.5 pr-3 text-[0.8125rem] font-extrabold">
                      <TeamMark team={shownTeam} size={26} className="rounded-[0.5rem]" />
                      {shownTeam.shortName}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-2 flex items-baseline gap-2">
                  <span className="num text-[2.5rem] font-extrabold leading-none tracking-[-0.02em]">{unsold ? "-" : "0"}</span>
                  <span className="text-xl font-extrabold">{unsold ? t("phase.unsold") : unit}</span>
                </p>
              )}
            </div>
            {timerShown ? <TimerRing left={timerLeft ?? 0} /> : null}
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-t border-line p-5 @[36rem]:gap-5 @[36rem]:px-8 @[36rem]:py-6">
        <p className="flex min-h-[4.5rem] flex-1 items-center justify-center gap-3 rounded-[1.25rem] border border-line bg-[#141414] px-4 text-center text-sm font-extrabold uppercase tracking-[0.12em] text-faint @[36rem]:min-h-[5.5rem] @[36rem]:text-lg">
          <Eye className="size-5 shrink-0" aria-hidden="true" />
          {t("live.spectator")}
        </p>
        <Link
          href={`/auctions/${a.slug}/results`}
          aria-label={t("live.tab.results")}
          title={t("live.tab.results")}
          className="inline-flex size-[4.5rem] shrink-0 items-center justify-center rounded-[1.25rem] @[36rem]:size-[5.5rem] border border-line bg-[#141414] text-muted hover:border-line-strong hover:text-text"
        >
          <ListOrdered className="size-6" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
