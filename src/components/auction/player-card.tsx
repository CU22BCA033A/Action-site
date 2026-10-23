import Link from "next/link";
import { formatPoints, formatStat } from "@/lib/format";
import type { SportConfig } from "@/lib/sports/config";
import { PlayerAvatar, RoleChip } from "./identity";

/** Squad and pool card in the style of a team sheet. Server component. */
export function PlayerCard({
  player,
  config,
  price,
  priceLabel,
  unit,
  statusLabel,
}: {
  player: {
    id: string;
    fullName: string;
    photoPath: string | null;
    roleKey: string;
    subRole: string | null;
    category: string | null;
    stats: Record<string, number>;
    lotNo: number;
  };
  config: SportConfig;
  price: number | null;
  priceLabel: string;
  unit: string;
  statusLabel?: string;
}) {
  const roleIndex = Math.max(0, config.roles.findIndex((r) => r.key === player.roleKey));
  const roleLabel = config.roles[roleIndex]?.label ?? player.roleKey;
  const statLine = config.statFields
    .filter((s) => s.showOnCard)
    .slice(0, 3)
    .map((s) => `${formatStat(player.stats[s.key]) || "0"} ${s.label.toLowerCase()}`)
    .join(", ");
  return (
    <article className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3 hover:border-line-strong sm:gap-4 sm:p-4">
      <PlayerAvatar name={player.fullName} photoPath={player.photoPath} size={60} className="rounded-[var(--radius-sm)]" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/players/${player.id}`} className="font-bold leading-tight hover:underline">
            {player.fullName}
          </Link>
          <span className="num rounded-[var(--radius-xs)] bg-info-surface px-1.5 py-0.5 text-xs font-bold text-info">#{String(player.lotNo).padStart(3, "0")}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <RoleChip size="sm" label={roleLabel} index={roleIndex} subRole={player.subRole} />
          {player.category ? <span className="text-xs font-semibold text-muted">{player.category}</span> : null}
          {statusLabel ? <span className="text-xs font-semibold text-muted">{statusLabel}</span> : null}
        </div>
        {statLine ? <p className="mt-1 truncate text-xs text-faint">{statLine}</p> : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="num text-lg font-bold text-accent-text">{price === null ? "" : formatPoints(price)}</p>
        <p className="text-xs text-muted">{price === null ? "" : priceLabel || unit}</p>
      </div>
    </article>
  );
}
