import { describe, expect, it } from "vitest";
import en from "@/lib/i18n/dictionaries/en";
import hi from "@/lib/i18n/dictionaries/hi";
import kn from "@/lib/i18n/dictionaries/kn";
import { localeFromAcceptLanguage } from "@/lib/i18n/config";
import { format as fmt } from "@/lib/i18n/translate";

type Node = string | { [k: string]: Node };
function leaves(node: Node, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof node === "string") {
    out.set(prefix, node);
    return out;
  }
  for (const [k, v] of Object.entries(node)) for (const [p, s] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(p, s);
  return out;
}
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  const base = leaves(en as unknown as Node);
  for (const [name, dict] of [["kn", kn], ["hi", hi]] as const) {
    it(`${name} has exactly the English keys and the same placeholders`, () => {
      const other = leaves(dict as unknown as Node);
      expect([...other.keys()].sort()).toEqual([...base.keys()].sort());
      for (const [k, v] of base) {
        expect(placeholders(other.get(k)!), `${name}:${k}`).toEqual(placeholders(v));
        expect(other.get(k)!.trim().length, `${name}:${k} is empty`).toBeGreaterThan(0);
      }
    });
  }

  it("no string contains an em dash", () => {
    for (const d of [en, kn, hi]) for (const [k, v] of leaves(d as unknown as Node)) expect(v.includes("—"), k).toBe(false);
  });

  it("formats placeholders and picks a locale from Accept-Language", () => {
    expect(fmt("{a} of {b}", { a: 1, b: 2 })).toBe("1 of 2");
    expect(localeFromAcceptLanguage("kn-IN,kn;q=0.9,en;q=0.8")).toBe("kn");
    expect(localeFromAcceptLanguage("hi")).toBe("hi");
    expect(localeFromAcceptLanguage("fr-FR,de;q=0.5")).toBe("en");
  });
});
