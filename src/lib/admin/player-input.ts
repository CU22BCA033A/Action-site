import { z } from "zod";
import type { SportConfig } from "@/lib/sports/config";

/** Player fields as entered by the admin, the CSV import or a registration. */
export const playerInputSchema = z.object({
  fullName: z.string().trim().min(2, "Use at least 2 characters.").max(80, "Use at most 80 characters."),
  roleKey: z.string().trim().min(1, "Choose a role."),
  subRole: z.string().trim().max(40).optional().transform((v) => (v ? v : null)),
  category: z.string().trim().max(24).optional().transform((v) => (v ? v : null)),
  tags: z.array(z.string().trim().min(1).max(24)).max(10).default([]),
  nationalityGroup: z.enum(["domestic", "overseas"], { error: "Choose domestic or overseas." }),
  stats: z.record(z.string(), z.number().finite().min(0, "Stats cannot be negative.").max(1_000_000)).default({}),
  bioShort: z.string().trim().max(160, "Keep the bio under 160 characters.").default(""),
  dateOfBirth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && Date.parse(v) < Date.now() && Date.parse(v) > Date.parse("1920-01-01")), "Enter a real date as YYYY-MM-DD."),
  guardianConsent: z.boolean().nullable().default(null),
});
export type PlayerInput = z.output<typeof playerInputSchema>;

export function isUnder18(dob: string | null, today = new Date()): boolean {
  if (!dob) return false;
  const d = new Date(dob);
  const eighteen = new Date(d.getFullYear() + 18, d.getMonth(), d.getDate());
  return eighteen > today;
}

/** Checks the values that depend on the sport's configuration. */
export function sportProblems(config: SportConfig, p: PlayerInput): Record<string, string> {
  const errors: Record<string, string> = {};
  const role = config.roles.find((r) => r.key === p.roleKey);
  if (!role) errors.roleKey = "Choose one of this sport's roles.";
  else if (p.subRole && !role.subRoles.includes(p.subRole)) errors.subRole = role.subRoles.length ? `Use one of: ${role.subRoles.join(", ")}.` : "This role has no sub-roles.";
  if (p.category && !config.categories.includes(p.category)) errors.category = config.categories.length ? `Use one of: ${config.categories.join(", ")}.` : "This sport has no categories.";
  const statKeys = new Set(config.statFields.map((s) => s.key));
  for (const key of Object.keys(p.stats)) if (!statKeys.has(key)) errors.stats = `Unknown stat "${key}".`;
  for (const s of config.statFields) {
    const v = p.stats[s.key];
    if (v !== undefined && s.kind === "integer" && !Number.isInteger(v)) errors[`stats.${s.key}`] = `${s.label} must be a whole number.`;
  }
  for (const tag of p.tags) if (config.tags.length && !config.tags.includes(tag)) errors.tags = `Use tags from: ${config.tags.join(", ")}.`;
  return errors;
}

/** Map a CSV header cell to a field: accepts spaces, dashes and case. */
export function normaliseHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export const CSV_BASE_COLUMNS = [
  "full_name",
  "role",
  "sub_role",
  "category",
  "nationality",
  "tags",
  "base_price",
  "set_name",
  "set_order",
  "bio",
  "date_of_birth",
  "guardian_consent",
] as const;

export function csvTemplateHeader(config: SportConfig): string[] {
  return [...CSV_BASE_COLUMNS, ...config.statFields.map((s) => s.key)];
}

/** One example row built from the sport's own roles, so the template always validates. */
export function csvTemplateExample(config: SportConfig): string[] {
  const role = config.roles.find((r) => !r.hidden) ?? config.roles[0]!;
  return [
    "Example Player",
    role.key,
    role.subRoles[0] ?? "",
    config.categories[0] ?? "",
    "domestic",
    "",
    "",
    "Main",
    "1",
    "Short bio, up to 160 characters",
    "",
    "",
    ...config.statFields.map(() => "0"),
  ];
}

export type CsvRowResult = {
  line: number;
  ok: boolean;
  errors: string[];
  value?: PlayerInput & { basePrice: number | null; setName: string; setOrder: number };
};

const yes = new Set(["yes", "y", "true", "1"]);

/** Field names as the CSV columns call them, for error messages. */
const COLUMN_NAME: Record<string, string> = {
  fullName: "full_name",
  roleKey: "role",
  subRole: "sub_role",
  nationalityGroup: "nationality",
  bioShort: "bio",
  dateOfBirth: "date_of_birth",
  guardianConsent: "guardian_consent",
};
const columnOf = (path: string) => COLUMN_NAME[path.split(".")[0] ?? ""] ?? path;

/** Validates parsed CSV rows. Line numbers count the header as line 1. */
export function validateCsvRows(rows: string[][], config: SportConfig): { header: string[]; results: CsvRowResult[]; headerErrors: string[] } {
  const [rawHeader, ...body] = rows;
  const header = (rawHeader ?? []).map(normaliseHeader);
  const headerErrors: string[] = [];
  for (const required of ["full_name", "role", "nationality"]) if (!header.includes(required)) headerErrors.push(`Missing column "${required}".`);
  const allowed = new Set<string>([...CSV_BASE_COLUMNS, ...config.statFields.map((s) => s.key)]);
  for (const h of header) if (h && !allowed.has(h)) headerErrors.push(`Unknown column "${h}".`);
  if (body.length > 1000) headerErrors.push("Import at most 1,000 players at a time.");
  if (headerErrors.length) return { header, results: [], headerErrors };

  const col = (row: string[], name: string) => {
    const i = header.indexOf(name);
    return i >= 0 ? (row[i] ?? "").trim() : "";
  };

  const results = body.map((row, idx): CsvRowResult => {
    const line = idx + 2;
    const errors: string[] = [];
    const roleCell = col(row, "role");
    const role = config.roles.find((r) => r.key === roleCell.toLowerCase() || r.label.toLowerCase() === roleCell.toLowerCase());
    const stats: Record<string, number> = {};
    for (const s of config.statFields) {
      const raw = col(row, s.key);
      if (raw === "") continue;
      const n = Number(raw);
      if (!Number.isFinite(n)) errors.push(`${s.label}: "${raw}" is not a number.`);
      else stats[s.key] = n;
    }
    const nat = col(row, "nationality").toLowerCase();
    const parsed = playerInputSchema.safeParse({
      fullName: col(row, "full_name"),
      roleKey: role?.key ?? roleCell,
      subRole: col(row, "sub_role") ? (role?.subRoles.find((s) => s.toLowerCase() === col(row, "sub_role").toLowerCase()) ?? col(row, "sub_role")) : undefined,
      category: col(row, "category").toUpperCase() || undefined,
      tags: col(row, "tags") ? col(row, "tags").split(/[;|]/).map((t) => t.trim()).filter(Boolean) : [],
      nationalityGroup: nat === "overseas" || nat === "foreign" ? "overseas" : nat === "domestic" || nat === "local" || nat === "" ? "domestic" : nat,
      stats,
      bioShort: col(row, "bio"),
      dateOfBirth: col(row, "date_of_birth") || undefined,
      guardianConsent: col(row, "guardian_consent") ? yes.has(col(row, "guardian_consent").toLowerCase()) : null,
    });
    if (!parsed.success) for (const i of parsed.error.issues) errors.push(`${columnOf(i.path.join(".")) || "row"}: ${i.message}`);
    const basePriceRaw = col(row, "base_price");
    const basePrice = basePriceRaw === "" ? null : Number(basePriceRaw);
    if (basePrice !== null && (!Number.isInteger(basePrice) || basePrice < 0)) errors.push("base_price must be a whole number of zero or more.");
    const setOrderRaw = col(row, "set_order");
    const setOrder = setOrderRaw === "" ? 1 : Number(setOrderRaw);
    if (!Number.isInteger(setOrder) || setOrder < 0) errors.push("set_order must be a whole number.");
    const setName = col(row, "set_name") || "Main";
    if (setName.length > 40) errors.push("set_name is longer than 40 characters.");
    if (parsed.success) {
      const sp = sportProblems(config, parsed.data);
      for (const [k, m] of Object.entries(sp)) errors.push(`${columnOf(k)}: ${m}`);
      if (isUnder18(parsed.data.dateOfBirth) && !parsed.data.guardianConsent) errors.push("Under 18: set guardian_consent to yes once a guardian has agreed.");
    }
    return errors.length || !parsed.success
      ? { line, ok: false, errors }
      : { line, ok: true, errors: [], value: { ...parsed.data, basePrice, setName, setOrder } };
  });
  return { header, results, headerErrors };
}
