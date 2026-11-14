"use client";

import { Eye, ListOrdered } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerPhoto, TeamMark } from "@/components/auction/identity";
import { RoleIcon } from "@/components/auction/role-icon";
import { formatPoints, formatStat } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Price, roleInfo, teamById } from "./bits";

/** Stat values in the reference's order: white, green, cyan, amber. */
const STAT_TONES = ["text-text", "text-[#22c55e]", "text-[#22d3ee]", "text-[#f59e0b]"];

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
      <span aria-hidden="true" className="num text-[1.5rem] font-extrabold">{left}</span>
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
  // Accent for the photo frame and card glow: the bidding team's colour, gold before any bid, green once sold.
  const glow = sold ? "#22c55e" : /^#[0-9a-f]{6}$/i.test(shownTeam?.primaryColor ?? "") ? shownTeam!.primaryColor : "#ffbf00";
  const barPct = timerShown ? Math.max(0, Math.min(100, ((timerLeft ?? 0) / total) * 100)) : sold ? 100 : 0;

  return (
    <article
      aria-labelledby="stage-name"
      className="@container relative flex flex-col overflow-hidden rounded-[2rem] border border-line bg-surface xl:min-h-0 xl:flex-1"
      style={{ backgroundImage: `radial-gradient(90% 70% at 18% 0%, ${glow}26, transparent 62%), radial-gradient(70% 60% at 100% 100%, ${glow}12, transparent 60%)` }}
    >
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

      <div className="grid grid-cols-[minmax(0,1fr)] items-center gap-8 px-6 py-8 xl:min-h-0 xl:flex-1 xl:items-stretch @[36rem]:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] @[36rem]:px-8 @[42rem]:grid-cols-[minmax(0,19.5rem)_minmax(0,1fr)] @[48rem]:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] @[52rem]:gap-12 @[52rem]:px-12 @[52rem]:py-12 @[60rem]:grid-cols-[minmax(0,25rem)_minmax(0,1fr)] @[52rem]:py-10">
        {/* Photo in a frame lit in the colour of the team that is bidding (gold before any bid, green once sold). */}
        <div className="relative mx-auto w-full max-w-[22rem] @[36rem]:max-w-none xl:flex xl:h-full xl:max-h-[30rem] xl:self-center 2xl:max-h-[34rem]">
          <div
            className="rounded-[2rem] p-[3px] xl:flex xl:w-full xl:flex-col"
            style={{ background: `linear-gradient(160deg, ${glow}, ${glow}33 38%, var(--line-strong) 60%, ${glow}66)`, boxShadow: `0 24px 60px -24px ${glow}88` }}
          >
            <div className="relative overflow-hidden rounded-[calc(2rem-3px)] xl:flex-1" style={{ background: `radial-gradient(85% 65% at 50% 100%, ${glow}55, #161616 70%)` }}>
              <PlayerPhoto name={p.fullName} photoPath={p.photoPath} priority sizes="(min-width: 1536px) 400px, (min-width: 768px) 340px, 90vw" className="!aspect-[4/5] !rounded-none !bg-transparent xl:!aspect-auto xl:absolute xl:inset-0 xl:h-full" />
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgb(0_0_0/0.75))]" />
              <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-2">
                <span className="num rounded-full border border-white/15 bg-black/55 px-3 py-1 text-sm font-extrabold text-white">#{p.lotNo}</span>
                {p.setName ? <span className="truncate rounded-full border border-white/15 bg-black/55 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.12em] text-white">{p.setName}</span> : null}
              </div>
              {live ? (
                <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-2.5 py-1 text-[0.6875rem] font-extrabold uppercase text-white">
                  <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-current" />
                  {t("status.live")}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col xl:justify-center">
          <ul className="flex flex-wrap gap-2" aria-label={t("register.role")}>
            <li className="rounded-full border border-[#3b82f6]/40 bg-[#3b82f6]/10 inline-flex items-center gap-1.5 px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-[#60a5fa]">
              {role.icon ? <RoleIcon icon={role.icon} className="size-5 -my-1" /> : null}
              {role.label}
              {p.subRole ? ` · ${p.subRole}` : ""}
            </li>
            {p.playerType || p.nationalityGroup === "overseas" ? (
              <li className="rounded-full border border-[#a855f7]/40 bg-[#a855f7]/10 px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-[#c084fc]">
                {p.playerType ?? t("nationality.overseas")}
              </li>
            ) : null}
            {p.category ? <li className="rounded-full border border-line-strong px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-muted">{p.category}</li> : null}
            <li className="rounded-full border border-[#ffbf00]/35 bg-[#ffbf00]/10 px-3 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.08em] text-[#ffd34d]">
              {t("live.basePrice")} {formatPoints(p.basePrice)}
            </li>
          </ul>

          <h2 id="stage-name" className="mt-5 text-[1.875rem] font-extrabold leading-[1.08] tracking-[-0.025em] @[52rem]:text-[2.5rem] @[60rem]:text-[2.875rem]">
            {p.fullName}
          </h2>

          {stats.length ? (
            <dl className="mt-8 grid grid-cols-2 overflow-hidden rounded-[1.25rem] border border-line bg-surface-2 py-1 @[46rem]:grid-cols-4">
              {stats.map((s, i) => (
                <div key={s.key} className={`relative flex flex-col items-center px-2 py-4 text-center before:absolute before:left-1/2 before:top-0 before:h-[3px] before:w-8 before:-translate-x-1/2 before:rounded-b-full before:bg-current before:opacity-70 ${STAT_TONES[i % STAT_TONES.length]} ${i % 2 === 1 ? "border-l border-line" : ""} ${i >= 2 ? "border-t border-line @[46rem]:border-t-0" : ""} ${i === 2 ? "@[46rem]:border-l" : ""}`}>
                  <dt className="order-1 mt-1 max-w-full truncate text-[0.625rem] font-extrabold uppercase tracking-[0.12em] text-faint">{s.label}</dt>
                  <dd className={`num order-2 mt-2 whitespace-nowrap text-[1.375rem] font-bold leading-none ${STAT_TONES[i % STAT_TONES.length]}`}>{formatStat(p.stats[s.key]) || "0"}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div
            className="mt-8 flex items-center justify-between gap-4 rounded-[1.5rem] border p-5 @[52rem]:p-6"
            style={{ borderColor: `${glow}55`, background: `linear-gradient(135deg, ${glow}26, ${glow}08 55%, transparent)` }}
          >
            <div className="min-w-0">
              <p className={LABEL}>{sold ? t("live.soldFor") : t("live.currentBid")}</p>
              {sold || leader ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <p className={`flex items-baseline gap-2 ${sold ? "text-[#22c55e]" : "text-text"}`}>
                    <Price value={sold ? f.lastResultPrice : f.currentPrice} className="text-[2.125rem] font-extrabold leading-none tracking-[-0.02em] @[52rem]:text-[2.5rem]" />
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
                  <span className="num text-[2.125rem] font-extrabold leading-none tracking-[-0.02em]">{unsold ? "-" : "0"}</span>
                  <span className="text-xl font-extrabold">{unsold ? t("phase.unsold") : unit}</span>
                </p>
              )}
            </div>
            {timerShown ? <TimerRing left={timerLeft ?? 0} /> : null}
          </div>
        </div>
      </div>

      <div className="flex gap-4 border-t border-line p-5 @[36rem]:gap-5 @[36rem]:px-8 @[36rem]:py-6">
        <p className="flex min-h-[4.5rem] flex-1 items-center justify-center gap-3 rounded-[1.25rem] border border-line bg-surface-2 px-4 text-center text-sm font-semibold text-faint @[36rem]:min-h-[4.5rem] @[36rem]:text-base">
          <Eye className="size-5 shrink-0" aria-hidden="true" />
          {t("live.spectator")}
        </p>
        <Link
          href={`/auctions/${a.slug}/results`}
          aria-label={t("live.tab.results")}
          title={t("live.tab.results")}
          className="inline-flex size-[4.5rem] shrink-0 items-center justify-center rounded-[1.25rem] @[36rem]:size-[5.5rem] border border-line bg-surface-2 text-muted hover:border-line-strong hover:text-text"
        >
          <ListOrdered className="size-6" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
