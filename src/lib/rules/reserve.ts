/**
 * Purse reserve rule, mirrored from app.max_bid_for for previews and tests.
 * max_bid = purse_left - max(squad_min - squad_count - 1, 0) * min_base_price
 * never below zero.
 */
export function maxBid(input: {
  purseTotal: number;
  purseSpent: number;
  squadMin: number;
  squadCount: number;
  minBasePrice: number;
  reserveRuleEnabled: boolean;
}): number {
  const left = input.purseTotal - input.purseSpent;
  if (!input.reserveRuleEnabled) return Math.max(left, 0);
  const slotsToFill = Math.max(input.squadMin - input.squadCount - 1, 0);
  return Math.max(left - slotsToFill * input.minBasePrice, 0);
}
