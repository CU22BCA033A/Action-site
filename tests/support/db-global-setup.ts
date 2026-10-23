import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import postgres from "postgres";
import { config as loadDotenv } from "dotenv";
import { existsSync } from "node:fs";

/**
 * Creates a fresh test database next to DATABASE_URL (same server, name
 * suffixed with _test), applies every migration, then seeds the sports.
 */
export default async function setup() {
  try {
    return await run();
  } catch (e) {
    console.error("DB SETUP FAILED:", e instanceof Error ? e.stack : e);
    throw new Error(String(e));
  }
}

async function run() {
  if (!process.env.DATABASE_URL && existsSync(".env.local")) loadDotenv({ path: ".env.local", quiet: true });
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error("Set DATABASE_URL or TEST_DATABASE_URL to run database tests.");
  const url = new URL(base);
  const dbName = `${url.pathname.slice(1) || "postgres"}_test`;
  const admin = postgres({ ...parse(url), database: "postgres", max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists "${dbName}" with (force)`);
  await admin.unsafe(`create database "${dbName}"`);
  await admin.end();

  url.pathname = `/${dbName}`;
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const dir = join(process.cwd(), "supabase", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await sql.unsafe(readFileSync(join(dir, f), "utf8"));
  }
  await sql.end();
  process.env.TEST_DB_URL = url.toString();
  return () => {};
}

function parse(url: URL) {
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}
