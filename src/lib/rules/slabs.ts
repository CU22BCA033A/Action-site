import { z } from "zod";

/**
 * Bid slab maths, shared by the admin editor, the manager console and tests.
 * The database (app.increment_for / app.validate_slabs) is the authority at
 * bid time. These functions mirror it exactly for previews.
 *
 * A slab covers prices where `from <= price < to`. `to: null` means no upper
 * limit. Slabs must start at 0, touch end to end, and the last one is open.
 */

export const slabSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().positive().nullable(),
  increment: z.number().int().positive(),
});
export type Slab = z.infer<typeof slabSchema>;

export type SlabProblem = { code: "EMPTY" | "GAP" | "OVERLAP" | "ZERO_INCREMENT" | "OPEN_NOT_LAST" | "BAD_RANGE" | "LAST_NOT_OPEN"; message: string; index?: number };

export function sortSlabs(slabs: readonly Slab[]): Slab[] {
  return [...slabs].sort((a, b) => a.from - b.from);
}

export function validateSlabs(input: readonly Slab[]): SlabProblem | null {
  if (input.length === 0) return { code: "EMPTY", message: "Add at least one bid slab." };
  const slabs = sortSlabs(input);
  let expected = 0;
  for (let i = 0; i < slabs.length; i++) {
    const s = slabs[i]!;
    if (s.from !== expected) {
      return s.from > expected
        ? { code: "GAP", message: `There is a gap between ${expected} and ${s.from}.`, index: i }
        : { code: "OVERLAP", message: `Slabs overlap at ${s.from}.`, index: i };
    }
    if (!Number.isInteger(s.increment) || s.increment <= 0) {
      return { code: "ZERO_INCREMENT", message: "Every increment must be more than zero.", index: i };
    }
    if (s.to === null && i < slabs.length - 1) {
      return { code: "OPEN_NOT_LAST", message: "Only the last slab can have no upper limit.", index: i };
    }
    if (s.to !== null && s.to <= s.from) {
      return { code: "BAD_RANGE", message: `Slab starting at ${s.from} must end above its start.`, index: i };
    }
    expected = s.to ?? -1;
  }
  if (expected !== -1) return { code: "LAST_NOT_OPEN", message: "The last slab must have no upper limit." };
  return null;
}

export function incrementFor(slabs: readonly Slab[], price: number): number | null {
  let match: Slab | null = null;
  for (const s of slabs) {
    if (s.from <= price && (s.to === null || price < s.to)) {
      if (!match || s.from > match.from) match = s;
    }
  }
  return match ? match.increment : null;
}

/** The amount of the next valid bid. First bid is the base price. */
export function nextBidAmount(slabs: readonly Slab[], currentPrice: number, hasLeader: boolean, basePrice: number): number | null {
  if (!hasLeader) return basePrice;
  const inc = incrementFor(slabs, currentPrice);
  return inc === null ? null : currentPrice + inc;
}

/** One worked example per slab, for the editor preview. */
export function workedExamples(slabs: readonly Slab[]): { from: number; to: number }[] {
  return sortSlabs(slabs).map((s) => {
    const sample = s.to === null ? s.from + s.increment * 2 : Math.min(s.from + s.increment * 2, s.to - 1);
    const price = Math.max(s.from, sample);
    const inc = incrementFor(slabs, price) ?? s.increment;
    return { from: price, to: price + inc };
  });
}
