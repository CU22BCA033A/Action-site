"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { TeamMark } from "@/components/auction/identity";
import { useT } from "@/components/i18n/i18n-provider";
import { formatPoints } from "@/lib/format";
import type { PublicTeam } from "@/lib/live/types";

/**
 * Team stats card from the landing reference. Paged by the viewer only:
 * no auto-rotation, so nothing moves unless someone asks it to.
 */
export function TeamStatsCard({ teams }: { teams: PublicTeam[] }) {
  const t = useT();
  const [i, setI] = useState(0);
  if (teams.length === 0) return null;
  const team = teams[i % teams.length]!;
  const go = (d: number) => setI((v) => (v + d + teams.length) % teams.length);

  return (
    <section aria-roledescription="carousel" aria-label={t("home.teamStats")} className="card w-full p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm uppercase tracking-[0.18em] text-muted">{t("home.teamStats")}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label={t("home.prevTeam")} className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong hover:text-text">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className="hidden items-center gap-1.5 min-[420px]:flex">
            {teams.map((tm, idx) => (
              <button
                key={tm.id}
                type="button"
                onClick={() => setI(idx)}
                aria-label={t("home.showTeam", { team: tm.name })}
                aria-current={idx === i ? "true" : undefined}
                className="flex h-6 items-center"
              >
                <span className={`block h-2 rounded-full transition-[width] duration-300 ${idx === i ? "w-4 bg-accent" : "w-2 bg-line-strong hover:bg-muted"}`} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => go(1)} aria-label={t("home.nextTeam")} className="inline-flex size-9 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong hover:text-text">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div aria-live="polite" aria-atomic="true">
        <p className="sr-only">{t("home.teamOf", { a: i + 1, b: teams.length })}</p>
        <div className="mt-4 flex items-center gap-4">
          <TeamMark team={team} size={64} className="rounded-[var(--radius-md)] border-2 border-[color-mix(in_srgb,var(--accent)_30%,transparent)]" />
          <div className="min-w-0">
            <p className="display truncate text-xl font-bold uppercase sm:text-2xl">{team.name}</p>
            <p className="text-muted">{t("home.playersAcquired", { n: team.squadCount })}</p>
          </div>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--spent)_30%,transparent)] bg-[color-mix(in_srgb,var(--spent)_20%,transparent)] px-3 py-3 text-center">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t("live.totalSpent")}</dt>
            <dd className="num mt-1 text-2xl font-extrabold text-spent sm:text-3xl">{formatPoints(team.purseSpent)}</dd>
          </div>
          <div className="rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--sold)_30%,transparent)] bg-[color-mix(in_srgb,var(--sold)_20%,transparent)] px-3 py-3 text-center">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{t("live.remaining")}</dt>
            <dd className="num mt-1 text-2xl font-extrabold text-remaining sm:text-3xl">{formatPoints(team.purseLeft)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
