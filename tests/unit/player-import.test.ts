import { describe, expect, it } from "vitest";
import { csvTemplateExample, csvTemplateHeader, isUnder18, validateCsvRows } from "@/lib/admin/player-input";
import { parseCsv, toCsv } from "@/lib/csv";
import { sportConfigSchema } from "@/lib/sports/config";
import { seedSports } from "@/lib/sports/seed-data";

const cricket = sportConfigSchema.parse(seedSports.find((s) => s.key === "cricket")!.config);
const kabaddi = sportConfigSchema.parse(seedSports.find((s) => s.key === "kabaddi")!.config);

describe("CSV player import", () => {
  it("accepts the downloadable template for every sport", () => {
    for (const s of seedSports) {
      const config = sportConfigSchema.parse(s.config);
      const csv = toCsv(csvTemplateHeader(config), [csvTemplateExample(config)]);
      const { results, headerErrors } = validateCsvRows(parseCsv(csv), config);
      expect(headerErrors, s.key).toEqual([]);
      expect(results[0]?.ok, `${s.key}: ${results[0]?.errors.join("; ")}`).toBe(true);
    }
  });

  it("reports row-level problems with line numbers", () => {
    const csv = [
      "Full Name,Role,Sub-role,Nationality,Runs,base_price",
      "Aru Velo,Bowler,Pace,domestic,12,30",
      ",Batter,,domestic,,",
      "Kai Rao,Goalkeeper,,domestic,,",
      "Mo Lin,bowler,Leg,overseas,abc,-5",
    ].join("\n");
    const { results } = validateCsvRows(parseCsv(csv), cricket);
    expect(results.map((r) => r.ok)).toEqual([true, false, false, false]);
    expect(results[1]!.line).toBe(3);
    expect(results[2]!.errors.join(" ")).toMatch(/role:/);
    expect(results[3]!.errors.join(" ")).toMatch(/not a number/);
    expect(results[3]!.errors.join(" ")).toMatch(/base_price/);
    expect(results[3]!.errors.join(" ")).toMatch(/sub_role/);
    expect(results[0]!.value).toMatchObject({ roleKey: "bowler", subRole: "Pace", stats: { runs: 12 }, basePrice: 30 });
  });

  it("rejects unknown columns and missing required ones", () => {
    expect(validateCsvRows(parseCsv("name,role\nA,B"), cricket).headerErrors.length).toBeGreaterThan(0);
  });

  it("checks categories and the guardian consent rule", () => {
    const young = new Date(Date.now() - 15 * 365.25 * 86400000).toISOString().slice(0, 10);
    const csv = `full_name,role,category,nationality,date_of_birth,guardian_consent\nTe Ra,raider,Z,domestic,,\nYo Un,raider,a,domestic,${young},\nYo Ok,raider,B,domestic,${young},yes`;
    const r = validateCsvRows(parseCsv(csv), kabaddi).results;
    expect(r[0]!.errors.join(" ")).toMatch(/category/);
    expect(r[1]!.errors.join(" ")).toMatch(/guardian/);
    expect(r[2]!.ok).toBe(true);
    expect(isUnder18(young)).toBe(true);
    expect(isUnder18("1990-01-01")).toBe(false);
  });

  it("neutralises spreadsheet formulas when exporting", () => {
    expect(toCsv(["a"], [["=SUM(A1)"]])).toContain("'=SUM(A1)");
  });
});
