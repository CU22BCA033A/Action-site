/**
 * Applies SQL files in supabase/migrations in name order, once each.
 * Usage: npm run db:migrate   (reads DATABASE_URL from .env.local or the environment)
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. See .env.example.");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
  try {
    await sql.unsafe("create schema if not exists app");
    await sql.unsafe(
      "create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())",
    );
    const dir = join(process.cwd(), "supabase", "migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const done = new Set((await sql<{ name: string }[]>`select name from app.schema_migrations`).map((r) => r.name));
    for (const file of files) {
      if (done.has(file)) continue;
      const body = readFileSync(join(dir, file), "utf8");
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into app.schema_migrations(name) values (${file})`;
      });
      console.log(`applied ${file}`);
    }
    console.log("migrations up to date");
    await ensureMediaBucket();
  } finally {
    await sql.end();
  }
}

/** Creates the public "media" storage bucket for photos and logos, once. */
async function ensureMediaBucket() {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.log("storage: Supabase keys not set, photos are saved on this computer (local development only)");
    return;
  }
  const res = await fetch(`${base}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ id: "media", name: "media", public: true, file_size_limit: 3 * 1024 * 1024, allowed_mime_types: ["image/webp"] }),
  });
  if (res.ok) console.log("storage: created the media bucket");
  else {
    const text = await res.text();
    if (/already exists|Duplicate/i.test(text)) console.log("storage: media bucket ready");
    else console.warn(`storage: could not create the media bucket (${res.status}). Create a public bucket named "media" in Supabase > Storage. ${text}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
