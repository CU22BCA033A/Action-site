"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Badge, statusTone } from "@/components/ui/badges";
import { formatPoints } from "@/lib/format";
import type { FloorPhase, PublicTeam, Snapshot } from "@/lib/live/types";
import type { ConnectionState } from "./use-live-auction";

/** Price with tabular digits that ticks briefly when it changes. */
export function Price({ value, className = "", tick = true }: { value: number | null | undefined; className?: string; tick?: boolean }) {
  const [key, setKey] = useState(0);
  const prev = useRef(value);
  useEffect(() => {
    if (tick && prev.current !== value) setKey((k) => k + 1);
    prev.current = value;
  }, [value, tick]);
  return (
    <span className={`num inline-block ${className}`}>
      <span key={key} className={key ? "price-tick inline-block" : "inline-block"}>
        {formatPoints(value ?? 0)}
      </span>
    </span>
  );
}

export function ConnectionIndicator({ state, compact = false }: { state: ConnectionState; compact?: boolean }) {
  const { t } = useI18n();
  const label = t(`connection.${state}`);
  const tone = state === "connected" ? "text-sold border-sold" : state === "reconnecting" ? "text-accent-text border-accent-edge" : "text-live border-live";
  return (
    <span role="status" aria-live="polite" className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-bold ${tone}`}>
      <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
        {state === "connected" ? (
          <circle cx="6" cy="6" r="4" fill="currentColor" />
        ) : state === "reconnecting" ? (
          <circle cx="6" cy="6" r="4" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
        ) : (
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="2" />
        )}
      </svg>
      <span className={compact ? "sr-only sm:not-sr-only" : ""}>{label}</span>
    </span>
  );
}

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  const { t } = useI18n();
  if (state === "connected") return null;
  return (
    <div role="alert" className={`border-y px-4 py-2 text-center text-sm font-semibold ${state === "offline" ? "border-live bg-danger-surface text-text" : "border-accent-edge bg-surface-2 text-text"}`}>
      {state === "offline" ? t("connection.offlineBanner") : t("connection.reconnectingBanner")}
    </div>
  );
}

export function PhaseBadge({ phase, hasPlayer }: { phase: FloorPhase; hasPlayer: boolean }) {
  const { t } = useI18n();
  const label = phase === "idle" && hasPlayer ? t("phase.idleWithPlayer") : t(`phase.${phase}`);
  return <Badge tone={statusTone(phase === "idle" && hasPlayer ? "on_floor" : phase)}>{label}</Badge>;
}

export function teamById(snapshot: Snapshot, id: string | null | undefined): PublicTeam | undefined {
  if (!id) return undefined;
  return snapshot.teams.find((t) => t.id === id);
}

/** Role label and index from the sport config, for role chips. */
export function roleInfo(snapshot: Snapshot, key: string) {
  const roles = snapshot.auction.sportConfig.roles;
  const index = roles.findIndex((r) => r.key === key);
  return { label: roles[index]?.label ?? key, index: Math.max(index, 0) };
}

/** Solid progress bar with a text value elsewhere; never colour alone. */
export function Meter({ value, max, tone = "accent", label }: { value: number; max: number; tone?: "accent" | "spent" | "sold" | "info"; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const bg = tone === "spent" ? "bg-spent" : tone === "sold" ? "bg-sold" : tone === "info" ? "bg-info" : "bg-accent";
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full ${bg} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function usePoints() {
  const { t } = useI18n();
  return (n: number | null | undefined, unit: string) => t("common.points", { amount: formatPoints(n ?? 0), unit });
}
