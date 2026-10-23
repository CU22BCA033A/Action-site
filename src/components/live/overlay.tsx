"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { formatPoints } from "@/lib/format";
import { Price, roleInfo, teamById } from "./bits";
import { useLive } from "./live-provider";
import { useCountdown } from "./use-live-auction";

/**
 * Transparent lower third for OBS (add it as a Browser Source at 1920x1080).
 * Shows the player, price, leading team and the last few bids.
 */
export function ObsOverlay() {
  const { snapshot, serverNow } = useLive();
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const unit = snapshot.auction.pointsUnitLabel;
  const sold = f.phase === "sold";
  const team = teamById(snapshot, sold ? f.lastResultTeamId : f.leadingTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);
  const ticker = snapshot.bids.filter((b) => b.auctionPlayerId === p?.auctionPlayerId).slice(0, 5);

  return (
    <div className="obs-overlay fixed inset-x-0 bottom-0 p-8" data-theme-lock="dark">
      {p ? (
        <div className="flex max-w-[1600px] items-stretch overflow-hidden rounded-[var(--radius-md)] border-2 border-accent-edge bg-[#070b14] text-[#eef2f8]">
          <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={150} className="shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col justify-center px-6 py-4">
            <p className="text-lg font-semibold text-[#a6b1c4]">
              {t("live.lot", { n: p.lotNo })}, {roleInfo(snapshot, p.roleKey).label}
              {p.category ? `, ${t("live.category", { c: p.category })}` : ""}
            </p>
            <p className="display truncate text-5xl font-extrabold">{p.fullName}</p>
            {ticker.length ? (
              <p className="mt-2 truncate text-lg text-[#a6b1c4]">
                {ticker
                  .map((b) => `${teamById(snapshot, b.teamId)?.shortName ?? ""} ${formatPoints(b.amount)}`)
                  .join("   ")}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end justify-center border-l border-[#34425f] px-6">
            <p className="text-lg font-semibold text-[#a6b1c4]">{sold ? t("phase.sold") : team ? t("live.currentBid") : t("live.basePrice")}</p>
            <p className="flex items-baseline gap-2">
              <Price value={sold ? f.lastResultPrice : f.currentPrice} className={`text-7xl font-extrabold ${sold ? "text-[#2bd576]" : "text-[#ffc94a]"}`} />
              <span className="text-xl text-[#a6b1c4]">{unit}</span>
            </p>
            {left !== null ? <p className="num text-2xl font-bold">{left === 0 ? t("time.timeUp") : `${left}s`}</p> : null}
          </div>
          {team ? (
            <div className="flex w-72 shrink-0 items-center gap-3 border-l border-[#34425f] px-5">
              <TeamMark team={team} size={72} className="rounded-[var(--radius-sm)]" />
              <p className="display text-2xl font-bold leading-tight">{team.name}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
