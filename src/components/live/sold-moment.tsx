"use client";

import { Gavel, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { TeamMark } from "@/components/auction/identity";
import { formatPoints } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { roleInfo, teamById } from "./bits";

/**
 * True while a fresh sale should be celebrated. A sale already on the floor
 * when the page opened does not replay, and each sale plays once.
 */
export function useSoldMoment(snapshot: Snapshot, durationMs: number, onStart?: () => void) {
  const f = snapshot.floor;
  const [initialKey] = useState(`${f.currentAuctionPlayerId}:${f.phase}`);
  const [finished, setFinished] = useState<string | null>(null);
  const saleKey = f.phase === "sold" && f.currentAuctionPlayerId ? `${f.currentAuctionPlayerId}:sold` : null;
  const active = Boolean(saleKey && saleKey !== initialKey && saleKey !== finished);

  useEffect(() => {
    if (!active || !saleKey) return;
    onStart?.();
    const id = setTimeout(() => setFinished(saleKey), durationMs);
    return () => clearTimeout(id);
    // onStart is read when the sale lands; a new callback must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, saleKey, durationMs]);

  const dismiss = () => {
    if (saleKey) setFinished(saleKey);
  };
  return { active, dismiss };
}

/** Full-screen SOLD card from the original CPL site: gavel, gold title, buyer and price. */
export function SoldMoment({ snapshot, size = "page", onDismiss }: { snapshot: Snapshot; size?: "page" | "screen"; onDismiss?: () => void }) {
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const buyer = teamById(snapshot, f.lastResultTeamId);
  if (!p || !buyer) return null;
  const big = size === "screen";

  return (
    <div
      role="alert"
      onClick={onDismiss}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--overlay)] px-4 py-8 text-center backdrop-blur-xl"
    >
      <div className="sold-reveal flex max-w-full flex-col items-center gap-6 sm:gap-8">
        <span className="relative inline-flex">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent opacity-30 blur-3xl" />
          <Gavel className={`gavel-strike relative text-accent-text ${big ? "size-36" : "size-24 sm:size-32"}`} aria-hidden="true" />
        </span>
        <p className={`display pb-2 font-black leading-none text-gold ${big ? "text-[clamp(7rem,15vw,13rem)]" : "text-[clamp(4rem,16vw,8rem)]"}`}>
          {t("screen.sold")}
        </p>
        <div className="space-y-2">
          <p className={`display font-bold text-text ${big ? "text-5xl" : "text-3xl sm:text-4xl"}`}>{p.fullName}</p>
          <p className={`text-muted ${big ? "text-2xl" : "text-xl"}`}>{roleInfo(snapshot, p.roleKey).label}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-8">
          <div className="flex items-center gap-4">
            <TeamMark team={buyer} size={big ? 96 : 64} className="rounded-[var(--radius-md)] border-2 border-accent" />
            <div className="text-left">
              <p className="text-sm uppercase tracking-wider text-muted">{t("live.boughtBy")}</p>
              <p className={`display font-bold uppercase text-text ${big ? "text-4xl" : "text-2xl"}`}>{buyer.name}</p>
            </div>
          </div>
          <div className="hidden h-16 w-px bg-line sm:block" aria-hidden="true" />
          <div>
            <p className="text-sm uppercase tracking-wider text-muted">{t("screen.for")}</p>
            <p className={`num font-bold text-accent-text ${big ? "text-7xl" : "text-4xl"}`}>{formatPoints(f.lastResultPrice)}</p>
            <p className="text-sm text-muted">{snapshot.auction.pointsUnitLabel}</p>
          </div>
        </div>
        <div className="flex justify-center gap-4 text-accent-text" aria-hidden="true">
          <Trophy className="size-8 opacity-50" />
          <Trophy className="size-8" />
          <Trophy className="size-8 opacity-50" />
        </div>
      </div>
    </div>
  );
}
