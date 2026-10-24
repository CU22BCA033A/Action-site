"use client";

import { Radio, Timer } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerPhoto, RoleChip, TeamMark } from "@/components/auction/identity";
import { formatPoints, formatStat } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Price, roleInfo, teamById } from "./bits";

/**
 * The player on the floor as a tall card with a big square photo, as on the
 * original CPL site: category strip, photo with LIVE, number and role laid
 * over it, then name, stats, base price and the current bid.
 */
export function PlayerSpotlight({
  snapshot,
  size = "md",
  timerLeft = null,
  priority = true,
}: {
  snapshot: Snapshot;
  size?: "md" | "lg";
  timerLeft?: number | null;
  priority?: boolean;
}) {
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  if (!p) return null;
  const unit = snapshot.auction.pointsUnitLabel;
  const role = roleInfo(snapshot, p.roleKey);
  const leader = teamById(snapshot, f.leadingTeamId);
  const buyer = teamById(snapshot, f.lastResultTeamId);
  const sold = f.phase === "sold";
  const unsold = f.phase === "unsold";
  const live = f.phase === "live";
  const statFields = snapshot.auction.sportConfig.statFields.filter((s) => s.showOnCard).slice(0, 4);
  const lg = size === "lg";
  const shownTeam = sold ? buyer : leader;

  return (
    <article
      aria-labelledby="spotlight-name"
      className={`relative overflow-hidden ${live ? "card-gold pulse-gold" : "card"} ${sold ? "!border-sold" : unsold ? "!border-unsold" : ""}`}
    >
      <p className={`px-3 py-1.5 text-center text-xs font-bold uppercase tracking-wider ${sold ? "bg-sold text-sold-ink" : "bg-[linear-gradient(90deg,var(--royal),var(--royal-dark))] text-royal-ink"}`}>
        {sold ? t("phase.sold") : unsold ? t("phase.unsold") : (p.category ?? p.setName ?? snapshot.auction.sportName)}
      </p>

      <div className={`relative bg-[color-mix(in_srgb,var(--surface-2)_70%,transparent)] ${lg ? "p-5" : "p-4 sm:p-5"}`}>
        <PlayerPhoto name={p.fullName} photoPath={p.photoPath} priority={priority} sizes={lg ? "(min-width: 1280px) 520px, 90vw" : "(min-width: 1024px) 420px, 90vw"} />
        {live || f.phase === "paused" ? (
          <span className={`absolute left-7 top-7 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase ${live ? "bg-live text-live-ink" : "bg-paused text-paused-ink"}`}>
            <Radio className={`size-3 ${live ? "live-dot" : ""}`} aria-hidden="true" />
            {live ? t("status.live") : t("status.paused")}
          </span>
        ) : null}
        <span className="num absolute right-7 top-7 rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-2 py-1 text-sm font-bold">#{p.lotNo}</span>
        <span className="absolute bottom-7 right-7">
          <RoleChip label={role.label} index={role.index} subRole={p.subRole} />
        </span>
        {live && timerLeft !== null ? (
          <span
            className={`num absolute bottom-7 left-7 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1 text-lg font-bold ${timerLeft <= 5 ? "border-live bg-[color-mix(in_srgb,var(--live)_25%,var(--surface))] text-live" : timerLeft <= 10 ? "border-warning bg-surface text-warning" : "border-line bg-surface text-accent-text"}`}
            aria-label={timerLeft === 0 ? t("time.timeUp") : t("time.secondsLeft", { s: timerLeft })}
          >
            <Timer className="size-4" aria-hidden="true" />
            {timerLeft}s
          </span>
        ) : null}
      </div>

      <div className={`flex flex-col gap-3 ${lg ? "p-5" : "p-4 sm:p-5"}`}>
        <div>
          <h2 id="spotlight-name" className={`truncate ${lg ? "text-3xl xl:text-4xl" : "text-2xl"}`}>{p.fullName}</h2>
          <p className="mt-1 text-sm text-muted">
            {[p.category, t(`nationality.${p.nationalityGroup}`)].filter(Boolean).join(" / ")}
          </p>
        </div>

        {statFields.length ? (
          <dl className="grid grid-cols-4 gap-2 rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--surface-3)_45%,transparent)] px-2 py-2">
            {statFields.map((s) => (
              <div key={s.key} className="min-w-0 text-center">
                <dd className="num text-lg font-bold">{formatStat(p.stats[s.key]) || "0"}</dd>
                <dt className="truncate text-xs text-muted">{s.label}</dt>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">{t("live.basePrice")}</p>
            <p className="num text-lg font-bold text-accent-text">
              {formatPoints(p.basePrice)} <span className="text-sm font-semibold text-muted">{unit}</span>
            </p>
          </div>
          {sold || leader ? (
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider text-muted">{sold ? t("live.soldFor") : t("live.currentBid")}</p>
              <Price value={sold ? f.lastResultPrice : f.currentPrice} className={`${lg ? "text-5xl" : "text-4xl"} font-bold leading-none ${sold ? "text-remaining" : "text-gold"}`} />
            </div>
          ) : null}
        </div>

        {shownTeam ? (
          <div className={`flex items-center gap-3 rounded-full border px-3 py-2 ${sold ? "border-sold" : "border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"}`}>
            <TeamMark team={shownTeam} size={32} className="rounded-full" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase">{shownTeam.name}</span>
            <span className="text-xs text-muted">{sold ? t("live.boughtBy") : t("live.leadingTeam")}</span>
          </div>
        ) : (
          <p className="rounded-full border border-line px-3 py-2 text-center text-sm text-muted">{unsold ? t("live.noBuyer") : t("live.noBidsYet")}</p>
        )}
      </div>
    </article>
  );
}
