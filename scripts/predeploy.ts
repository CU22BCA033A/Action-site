/**
 * Runs before `next build` on Vercel: applies database migrations and adds
 * the sports, so the database is always in step with the code.
 * Skipped locally and when DATABASE_URL is not set yet.
 */
import { execSync } from "node:child_process";

if (!process.env.VERCEL) {
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.log("predeploy: DATABASE_URL is not set, skipping database setup. Open /setup after this deploy.");
  process.exit(0);
}
try {
  execSync("npx tsx scripts/migrate.ts", { stdio: "inherit" });
  execSync("npx tsx scripts/seed.ts", { stdio: "inherit" });
} catch {
  console.error(
    "predeploy: database setup failed. Check DATABASE_URL in Vercel: use the Supabase Transaction pooler string (port 6543) with your database password.",
  );
  process.exit(1);
}
