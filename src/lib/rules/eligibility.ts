/**
 * Client-side preview of app._eligibility, used only to explain why the bid
 * button is disabled. The database is the authority on every bid.
 */
export type BidBlock =
  | { kind: "ok"; amount: number }
  | { kind: "noPlayer" }
  | { kind: "notOpen" }
  | { kind: "paused" }
  | { kind: "rtm" }
  | { kind: "timeUp" }
  | { kind: "leading" }
  | { kind: "noSlab" }
  | { kind: "code"; code: "INSUFFICIENT_PURSE" | "RESERVE_VIOLATION" | "SQUAD_FULL" | "OVERSEAS_LIMIT" | "ROLE_LIMIT"; role?: string };

export type EligibilityInput = {
  hasPlayer: boolean;
  phase: string;
  secondsLeft: number | null;
  leadingTeamId: string | null;
  teamId: string;
  nextBidAmount: number | null;
  team: { purseLeft: number; maxBid: number; squadCount: number; overseasCount: number; roleCounts: Record<string, number> };
  rules: { squadMax: number; maxOverseas: number; roleMinimums: Record<string, number>; roleMaximums: Record<string, number> };
  player: { roleKey: string; nationalityGroup: "domestic" | "overseas" } | null;
};

export function bidBlock(i: EligibilityInput): BidBlock {
  if (!i.hasPlayer || !i.player) return { kind: "noPlayer" };
  if (i.phase === "paused") return { kind: "paused" };
  if (i.phase === "rtm_pending") return { kind: "rtm" };
  if (i.phase !== "live") return { kind: "notOpen" };
  if (i.secondsLeft === 0) return { kind: "timeUp" };
  if (i.leadingTeamId === i.teamId) return { kind: "leading" };
  if (i.nextBidAmount === null) return { kind: "noSlab" };
  const amount = i.nextBidAmount;
  if (amount > i.team.purseLeft) return { kind: "code", code: "INSUFFICIENT_PURSE" };
  if (amount > i.team.maxBid) return { kind: "code", code: "RESERVE_VIOLATION" };
  if (i.team.squadCount + 1 > i.rules.squadMax) return { kind: "code", code: "SQUAD_FULL" };
  if (i.player.nationalityGroup === "overseas" && i.team.overseasCount + 1 > i.rules.maxOverseas) return { kind: "code", code: "OVERSEAS_LIMIT" };
  const role = i.player.roleKey;
  const roleMax = i.rules.roleMaximums[role];
  if (roleMax !== undefined && (i.team.roleCounts[role] ?? 0) + 1 > roleMax) return { kind: "code", code: "ROLE_LIMIT", role };
  let unmet = 0;
  for (const [r, min] of Object.entries(i.rules.roleMinimums)) {
    const have = (i.team.roleCounts[r] ?? 0) + (r === role ? 1 : 0);
    unmet += Math.max(min - have, 0);
  }
  if (i.rules.squadMax - (i.team.squadCount + 1) < unmet) return { kind: "code", code: "ROLE_LIMIT" };
  return { kind: "ok", amount };
}

/** Roles still short of their minimum, for the "roles still needed" list. */
export function roleNeeds(roleMinimums: Record<string, number>, roleCounts: Record<string, number>) {
  return Object.entries(roleMinimums)
    .map(([role, min]) => ({ role, need: Math.max(min - (roleCounts[role] ?? 0), 0) }))
    .filter((r) => r.need > 0);
}
