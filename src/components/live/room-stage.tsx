"use client";

import { Eye, ListOrdered } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerPhoto, TeamMark } from "@/components/auction/identity";
import { formatPoints, formatStat } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Price, roleInfo, teamById } from "./bits";

/** Stat values take turns between plain, green, blue and gold, as on a broadcast scorecard. */
const STAT_TONES = ["text-text", "text-remaining", "text-royal-light", "text-accent-text"];

/** Round countdown: a thin ring that empties as time runs out. */
function TimerRing({ left, total }: { left: number; total: number }) {
  const { t } = useI18n();
  const r = 34;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, left / total)) : 0;
  const tone = left <= 5 ? "var(--live)" : left <= 10 ? "var(--warning)" : "var(--remaining)";
  return (
    <div className="relative size-20 shrink-0" role="timer" aria-label={left === 0 ? t("time.timeUp") : t("time.secondsLeft", { s: left })}>
      <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="4" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={tone} strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - frac)} className="transition-[stroke-dashoffset] duration-300" />
      </svg>
      <span aria-hidden="true" className="absolute inset-0 flex flex-col items-center justify-center leading-none" style={{ color: tone }}>
        <span className="num text-2xl font-extrabold">{left}</span>
        <span className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.14em]">sec</span>
      </span>
    </div>
  );
}

/**
 * The player on the floor in the auction room: base price and bidder on top,
 * a thin timer bar, then the photo beside the name, stats and current bid.
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

  return (
    <article aria-labelledby="stage-name" className={`flex h-full flex-col overflow-hidden rounded-[1.5rem] border bg-surface ${sold ? "border-sold" : "border-line"}`}>
      {/* Phones have no room header row, so base price and bidder sit here. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 border-b border-line px-5 py-3 lg:hidden">
        <p className="flex items-baseline gap-2">
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{t("live.basePrice")}</span>
          <span className="num font-extrabold">{formatPoints(p.basePrice)}</span>
        </p>
        <p className="ml-auto flex min-w-0 items-center gap-2">
          <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{sold ? t("live.boughtBy") : t("live.bidder")}</span>
          <span className="truncate font-extrabold">{shownTeam ? shownTeam.shortName : unsold ? t("phase.unsold") : t("common.none")}</span>
        </p>
      </div>

      <div className="h-1 shrink-0 bg-surface-3" aria-hidden="true">
        {timerShown ? (
          <div className="h-full bg-remaining transition-[width] duration-300 ease-linear" style={{ width: `${Math.max(0, Math.min(100, ((timerLeft ?? 0) / total) * 100))}%` }} />
        ) : sold ? (
          <div className="h-full w-full bg-sold" />
        ) : null}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] items-center gap-6 p-5 sm:p-7 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] lg:gap-10 lg:p-8 xl:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]">
        <div className="relative mx-auto w-full max-w-[19rem]">
          <PlayerPhoto name={p.fullName} photoPath={p.photoPath} priority sizes="(min-width: 768px) 304px, 90vw" className="!aspect-[4/5] !rounded-[1.25rem] border border-line" />
          {live ? (
            <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-2.5 py-1 text-xs font-bold uppercase text-white">
              <span aria-hidden="true" className="live-dot size-1.5 rounded-full bg-current" />
              {t("status.live")}
            </span>
          ) : null}
          <span className="num absolute right-3 top-3 rounded-full bg-[color-mix(in_srgb,var(--bg)_80%,transparent)] px-2.5 py-1 text-xs font-bold">#{p.lotNo}</span>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <ul className="flex flex-wrap gap-2" aria-label={t("register.role")}>
            <li className="rounded-full border border-[color-mix(in_srgb,var(--royal)_60%,transparent)] bg-[color-mix(in_srgb,var(--royal)_16%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-royal-light">
              {role.label}
              {p.subRole ? ` · ${p.subRole}` : ""}
            </li>
            <li className="rounded-full border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-accent-text">
              {t(`nationality.${p.nationalityGroup}`)}
            </li>
            {p.category ? <li className="rounded-full border border-line-strong px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] text-muted">{p.category}</li> : null}
          </ul>

          <h2 id="stage-name" className="text-4xl leading-[1.02] sm:text-5xl xl:text-[3.4rem]">{p.fullName}</h2>

          {stats.length ? (
            <dl className="grid grid-cols-2 overflow-hidden rounded-[1rem] border border-line bg-surface-2 sm:grid-cols-4">
              {stats.map((s, i) => (
                <div key={s.key} className={`flex flex-col items-center px-2 py-4 text-center ${i ? "border-l border-line" : ""} ${i === 2 ? "max-sm:border-l-0 max-sm:border-t" : ""} ${i === 3 ? "max-sm:border-t" : ""}`}>
                  <dt className="order-1 max-w-full truncate text-[0.62rem] font-bold uppercase tracking-[0.12em] text-faint">{s.label}</dt>
                  <dd className={`num order-2 mt-1.5 whitespace-nowrap text-2xl font-extrabold 2xl:text-3xl ${STAT_TONES[i % STAT_TONES.length]}`}>{formatStat(p.stats[s.key]) || "0"}</dd>
                </div>
              ))}
            </dl>
          ) : null}

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-faint">{sold ? t("live.soldFor") : t("live.currentBid")}</p>
              {sold || leader ? (
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className={`flex items-baseline gap-2 ${sold ? "text-remaining" : "text-text"}`}>
                    <Price value={sold ? f.lastResultPrice : f.currentPrice} className="text-5xl font-extrabold leading-none xl:text-6xl" />
                    <span className="text-lg font-bold text-muted">{unit}</span>
                  </p>
                  {shownTeam ? (
                    <span className="inline-flex items-center gap-2 rounded-[0.75rem] border border-line-strong bg-surface-2 py-1.5 pl-1.5 pr-3 text-sm font-extrabold">
                      <TeamMark team={shownTeam} size={26} className="rounded-[0.5rem]" />
                      {shownTeam.shortName}
                    </span>
                  ) : null}
                </div>
              ) : (
                <p className="mt-1 text-lg font-semibold text-muted">{unsold ? t("live.noBuyer") : t("live.noBidsYet")}</p>
              )}
            </div>
            {timerShown ? <TimerRing left={timerLeft ?? 0} total={total} /> : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-3 border-t border-line p-4 sm:p-5">
        <p className="flex min-h-14 flex-1 items-center justify-center gap-2.5 rounded-[1rem] border border-line bg-surface-2 px-4 text-center text-sm font-extrabold uppercase tracking-[0.14em] text-faint">
          <Eye className="size-5 shrink-0" aria-hidden="true" />
          {t("live.spectator")}
        </p>
        <Link
          href={`/auctions/${a.slug}/results`}
          aria-label={t("live.tab.results")}
          title={t("live.tab.results")}
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-[1rem] border border-line bg-surface-2 text-muted hover:border-line-strong hover:text-text"
        >
          <ListOrdered className="size-5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
