/**
 * Pre-launch gate. Fails (exit 1) until the site is ready to go public:
 *  - every env name read by the code is listed in .env.example
 *  - no secret-looking strings are committed
 *  - business details in site.config.ts are filled and a custom domain is set
 *  - favicon, privacy, terms, refund, cookie and deletion pages exist
 *  - every page has a title and description
 *  - no em dashes, emoji or "made with" builder tags in the source
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requiredSiteConfigKeys, siteConfig } from "../site.config";

const root = process.cwd();
const problems: string[] = [];
const files = execSync("git ls-files --cached --others --exclude-standard", { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && existsSync(join(root, f)));
const text = (f: string) => readFileSync(join(root, f), "utf8");
const isText = (f: string) => /\.(ts|tsx|js|mjs|cjs|css|md|json|sql|txt|example|toml|yml|yaml)$/.test(f) || f === ".env.example";
const src = files.filter((f) => /^(src|scripts|supabase|tests|site\.config)/.test(f) && isText(f));

// 1. env names
const example = text(".env.example");
const envNames = new Set<string>();
for (const f of src.filter((f) => /\.(ts|tsx)$/.test(f))) {
  for (const m of text(f).matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) envNames.add(m[1]!);
}
const platform = new Set(["NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "VERCEL_PROJECT_PRODUCTION_URL", "NEXT_RUNTIME", "CI", "TEST_DATABASE_URL", "PORT", "E2E_BASE_URL", "TEST_DB_URL"]);
for (const n of envNames) if (!platform.has(n) && !new RegExp(`^${n}=`, "m").test(example)) problems.push(`.env.example does not list ${n}`);

// 2. secrets
const secretPatterns: [RegExp, string][] = [
  [/\$argon2id\$v=\d+\$m=\d+/, "an argon2 password hash"],
  [/eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, "a JWT (Supabase key?)"],
  [/postgres(ql)?:\/\/[^:\s]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)/, "a database URL with a password"],
  [/sk_(live|test)_[A-Za-z0-9]{10,}/, "an API secret key"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
];
for (const f of files.filter(isText)) {
  if (f.endsWith("launch-check.ts")) continue;
  const body = text(f);
  for (const [re, what] of secretPatterns) if (re.test(body)) problems.push(`${f} looks like it contains ${what}`);
}
if (files.includes(".env.local") || files.includes(".env")) problems.push("an .env file is tracked by git");

// 3. business details and domain
for (const k of requiredSiteConfigKeys) if (!String(siteConfig[k] ?? "").trim()) problems.push(`site.config.ts: ${k} is empty`);
if (!siteConfig.useCustomDomain || !siteConfig.productionDomain.trim()) problems.push("site.config.ts: connect a custom domain, then set productionDomain and useCustomDomain: true");

// 4. required files and pages
const mustExist = [
  "public/favicon.ico",
  "public/icon.svg",
  "public/apple-icon.png",
  "src/app/(site)/privacy/page.tsx",
  "src/app/(site)/terms/page.tsx",
  "src/app/(site)/refund-policy/page.tsx",
  "src/app/(site)/cookies/page.tsx",
  "src/app/(site)/data-deletion/page.tsx",
  "src/app/not-found.tsx",
  "src/app/sitemap.ts",
  "src/app/robots.ts",
];
for (const f of mustExist) if (!existsSync(join(root, f))) problems.push(`missing ${f}`);

// 5. titles and descriptions
for (const f of files.filter((f) => /^src\/app\/.*\/page\.tsx$/.test(f))) {
  const body = text(f);
  // Admin and setup pages are private and noindex; redirect-only pages render nothing.
  if (f.startsWith("src/app/admin/") || f.includes("/setup/") || /permanentRedirect\(|redirect\(/.test(body) && !/return \(/.test(body)) continue;
  const own = /export (async )?function generateMetadata|export const metadata/.test(body);
  if (!own) problems.push(`${f} has no title or description (generateMetadata)`);
  if (own && /pageMeta\(|description:/.test(body) === false) problems.push(`${f} sets metadata without a description`);
}

// 6. copy bans
const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
for (const f of src.concat(files.filter((f) => f.startsWith("docs/") && !f.endsWith("BUILD_PROMPT.md")))) {
  const body = text(f);
  if (body.includes("\u2014") && !/i18n\.test\.ts$/.test(f)) problems.push(`${f} contains an em dash`);
  if (/\.(tsx|ts)$/.test(f) && emoji.test(body)) problems.push(`${f} contains an emoji`);
  if (/made with (ai|lovable|v0|bolt)|lovable-tagger|built with lovable/i.test(body) && !f.endsWith("launch-check.ts")) problems.push(`${f} contains a "made with" builder tag`);
}

if (problems.length) {
  console.error(`launch-check: ${problems.length} problem(s)\n - ${problems.join("\n - ")}`);
  process.exit(1);
}
console.log("launch-check: ready to launch");
