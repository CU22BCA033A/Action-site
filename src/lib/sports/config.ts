import { z } from "zod";
import { slabSchema, validateSlabs } from "@/lib/rules/slabs";

/**
 * A sport is data. This schema validates the JSON stored in app.sports.config
 * and in app.sport_presets.config. Components never hardcode a sport's roles.
 */

export const keySchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "Use lowercase letters, numbers and underscores, starting with a letter.");

const label = z.string().trim().min(1, "Enter a label.").max(40, "Keep labels under 40 characters.");

export const roleSchema = z.object({
  key: keySchema,
  label,
  subRoles: z.array(label).max(12).default([]),
  hidden: z.boolean().default(false),
});
export type SportRole = z.infer<typeof roleSchema>;

export const statFieldSchema = z.object({
  key: keySchema,
  label,
  kind: z.enum(["integer", "decimal"]).default("integer"),
  showOnCard: z.boolean().default(true),
});
export type StatField = z.infer<typeof statFieldSchema>;

const countMap = z.record(z.string(), z.number().int().min(0).max(99));
const priceMap = z.record(z.string(), z.number().int().min(0));

export const auctionDefaultsSchema = z
  .object({
    pointsUnitLabel: z.string().trim().min(1).max(24),
    purse: z.number().int().min(0),
    squadMin: z.number().int().min(0).max(99),
    squadMax: z.number().int().min(1).max(99),
    maxOverseas: z.number().int().min(0).max(99),
    roleMinimums: countMap.default({}),
    roleMaximums: countMap.default({}),
    defaultBasePrice: z.number().int().min(0),
    categoryBasePrices: priceMap.default({}),
    slabs: z.array(slabSchema).min(1),
    bidTimerSeconds: z.number().int().min(3).max(600).nullable(),
    timerExtensionSeconds: z.number().int().min(1).max(600).nullable(),
    reserveRuleEnabled: z.boolean(),
    rtmEnabled: z.boolean(),
    rtmLabel: z.enum(["RTM", "FBM"]),
    rtmAllowFinalRaise: z.boolean(),
    rtmCardsPerTeam: z.number().int().min(0).max(20),
    retentionsEnabled: z.boolean(),
    maxRetentions: z.number().int().min(0).max(30),
  })
  .superRefine((d, ctx) => {
    if (d.squadMin > d.squadMax) {
      ctx.addIssue({ code: "custom", path: ["squadMin"], message: "Squad minimum cannot be more than squad maximum." });
    }
    const slabProblem = validateSlabs(d.slabs);
    if (slabProblem) ctx.addIssue({ code: "custom", path: ["slabs"], message: slabProblem.message });
    for (const [role, max] of Object.entries(d.roleMaximums)) {
      const min = d.roleMinimums[role];
      if (min !== undefined && min > max) {
        ctx.addIssue({ code: "custom", path: ["roleMaximums", role], message: "A role maximum cannot be below its minimum." });
      }
    }
  });
export type AuctionDefaults = z.infer<typeof auctionDefaultsSchema>;

export const sportConfigSchema = z
  .object({
    roles: z.array(roleSchema).min(1, "Add at least one role."),
    categories: z.array(z.string().trim().min(1).max(24)).max(20).default([]),
    tags: z.array(z.string().trim().min(1).max(24)).max(30).default([]),
    statFields: z.array(statFieldSchema).max(12).default([]),
    defaults: auctionDefaultsSchema,
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.roles.forEach((r, i) => {
      if (seen.has(r.key)) ctx.addIssue({ code: "custom", path: ["roles", i, "key"], message: "Role keys must be unique." });
      seen.add(r.key);
    });
    const statSeen = new Set<string>();
    c.statFields.forEach((s, i) => {
      if (statSeen.has(s.key)) ctx.addIssue({ code: "custom", path: ["statFields", i, "key"], message: "Stat keys must be unique." });
      statSeen.add(s.key);
    });
    for (const key of [...Object.keys(c.defaults.roleMinimums), ...Object.keys(c.defaults.roleMaximums)]) {
      if (!seen.has(key)) ctx.addIssue({ code: "custom", path: ["defaults"], message: `Unknown role "${key}" in squad rules.` });
    }
  });
export type SportConfig = z.infer<typeof sportConfigSchema>;

export function roleLabel(config: Pick<SportConfig, "roles">, key: string): string {
  return config.roles.find((r) => r.key === key)?.label ?? key;
}

export function visibleRoles(config: Pick<SportConfig, "roles">): SportRole[] {
  return config.roles.filter((r) => !r.hidden);
}
