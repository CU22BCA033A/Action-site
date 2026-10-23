import { describe, expect, it } from "vitest";
import { bidBlock, roleNeeds, type EligibilityInput } from "@/lib/rules/eligibility";

const base: EligibilityInput = {
  hasPlayer: true,
  phase: "live",
  secondsLeft: 20,
  leadingTeamId: "other",
  teamId: "me",
  nextBidAmount: 30,
  team: { purseLeft: 500, maxBid: 300, squadCount: 3, overseasCount: 0, roleCounts: { bowler: 1 } },
  rules: { squadMax: 10, maxOverseas: 2, roleMinimums: {}, roleMaximums: {} },
  player: { roleKey: "bowler", nationalityGroup: "domestic" },
};
const w = (o: Partial<EligibilityInput>) => bidBlock({ ...base, ...o });

describe("bid button guidance", () => {
  it("allows a valid bid and returns the amount", () => {
    expect(w({})).toEqual({ kind: "ok", amount: 30 });
  });
  it("explains every blocked state", () => {
    expect(w({ hasPlayer: false }).kind).toBe("noPlayer");
    expect(w({ phase: "idle" }).kind).toBe("notOpen");
    expect(w({ phase: "paused" }).kind).toBe("paused");
    expect(w({ phase: "rtm_pending" }).kind).toBe("rtm");
    expect(w({ secondsLeft: 0 }).kind).toBe("timeUp");
    expect(w({ leadingTeamId: "me" }).kind).toBe("leading");
    expect(w({ nextBidAmount: null }).kind).toBe("noSlab");
    expect(w({ nextBidAmount: 600 })).toMatchObject({ code: "INSUFFICIENT_PURSE" });
    expect(w({ nextBidAmount: 400 })).toMatchObject({ code: "RESERVE_VIOLATION" });
    expect(w({ team: { ...base.team, squadCount: 10 } })).toMatchObject({ code: "SQUAD_FULL" });
    expect(w({ player: { roleKey: "bowler", nationalityGroup: "overseas" }, rules: { ...base.rules, maxOverseas: 0 } })).toMatchObject({ code: "OVERSEAS_LIMIT" });
    expect(w({ rules: { ...base.rules, roleMaximums: { bowler: 1 } } })).toMatchObject({ code: "ROLE_LIMIT", role: "bowler" });
  });
  it("keeps open slots for unmet role minimums", () => {
    const r = w({ rules: { ...base.rules, squadMax: 4, roleMinimums: { wicketkeeper: 1 } } });
    expect(r).toMatchObject({ code: "ROLE_LIMIT" });
    expect(w({ rules: { ...base.rules, squadMax: 5, roleMinimums: { wicketkeeper: 1 } } }).kind).toBe("ok");
  });
  it("lists roles still needed", () => {
    expect(roleNeeds({ bowler: 4, wicketkeeper: 1 }, { bowler: 1 })).toEqual([
      { role: "bowler", need: 3 },
      { role: "wicketkeeper", need: 1 },
    ]);
  });
});
