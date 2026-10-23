import { describe, expect, it } from "vitest";
import { incrementFor, nextBidAmount, validateSlabs, workedExamples } from "@/lib/rules/slabs";
import { maxBid } from "@/lib/rules/reserve";

const ipl = [
  { from: 0, to: 100, increment: 5 },
  { from: 100, to: 200, increment: 10 },
  { from: 200, to: null, increment: 20 },
];

describe("slab maths", () => {
  it("picks the band where from <= price < to", () => {
    expect(incrementFor(ipl, 0)).toBe(5);
    expect(incrementFor(ipl, 95)).toBe(5);
    expect(incrementFor(ipl, 100)).toBe(10);
    expect(incrementFor(ipl, 120)).toBe(10);
    expect(incrementFor(ipl, 199)).toBe(10);
    expect(incrementFor(ipl, 200)).toBe(20);
    expect(incrementFor(ipl, 100000)).toBe(20);
  });

  it("first bid is the base price, later bids add the increment", () => {
    expect(nextBidAmount(ipl, 30, false, 30)).toBe(30);
    expect(nextBidAmount(ipl, 120, true, 30)).toBe(130);
    expect(nextBidAmount(ipl, 95, true, 30)).toBe(100);
    expect(nextBidAmount([], 95, true, 30)).toBeNull();
  });

  it("validates gaps, overlaps, zero increments and open ends", () => {
    expect(validateSlabs(ipl)).toBeNull();
    expect(validateSlabs([])?.code).toBe("EMPTY");
    expect(validateSlabs([{ from: 0, to: 50, increment: 5 }, { from: 60, to: null, increment: 5 }])?.code).toBe("GAP");
    expect(validateSlabs([{ from: 0, to: 50, increment: 5 }, { from: 40, to: null, increment: 5 }])?.code).toBe("OVERLAP");
    expect(validateSlabs([{ from: 0, to: null, increment: 0 }])?.code).toBe("ZERO_INCREMENT");
    expect(validateSlabs([{ from: 0, to: null, increment: 5 }, { from: 10, to: null, increment: 5 }])?.code).toBe("OPEN_NOT_LAST");
    expect(validateSlabs([{ from: 0, to: 100, increment: 5 }])?.code).toBe("LAST_NOT_OPEN");
    expect(validateSlabs([{ from: 10, to: null, increment: 5 }])?.code).toBe("GAP");
  });

  it("gives one worked example per band", () => {
    const ex = workedExamples(ipl);
    expect(ex).toHaveLength(3);
    expect(ex[1]).toEqual({ from: 120, to: 130 });
  });
});

describe("reserve maths", () => {
  it("keeps enough purse for the remaining minimum squad", () => {
    expect(maxBid({ purseTotal: 1000, purseSpent: 20, squadMin: 15, squadCount: 1, minBasePrice: 20, reserveRuleEnabled: true })).toBe(720);
    expect(maxBid({ purseTotal: 1000, purseSpent: 0, squadMin: 0, squadCount: 0, minBasePrice: 20, reserveRuleEnabled: true })).toBe(1000);
    expect(maxBid({ purseTotal: 100, purseSpent: 90, squadMin: 15, squadCount: 0, minBasePrice: 20, reserveRuleEnabled: true })).toBe(0);
    expect(maxBid({ purseTotal: 300, purseSpent: 0, squadMin: 15, squadCount: 0, minBasePrice: 20, reserveRuleEnabled: false })).toBe(300);
  });
});
