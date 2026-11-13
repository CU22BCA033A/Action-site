/**
 * Seeds the four launch sports and their example presets.
 *   npm run db:seed          sports and presets (safe for production; no demo data)
 * Existing sports are left untouched so admin edits are never overwritten.
 */
import postgres from "postgres";
import { sportConfigSchema, auctionDefaultsSchema } from "../src/lib/sports/config";
import { seedSports } from "../src/lib/sports/seed-data";
import { loadEnv } from "./load-env";

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} }) as unknown as postgres.Sql<Record<string, never>>;
  try {
    for (const s of seedSports) {
      const config = sportConfigSchema.parse(s.config);
      const inserted = await sql<{ id: string }[]>`
        insert into app.sports(key, name, config, sort_order) values (${s.key}, ${s.name}, ${sql.json(config)}, ${s.sortOrder})
        on conflict (key) do nothing returning id`;
      const sportId = inserted[0]?.id ?? (await sql<{ id: string }[]>`select id from app.sports where key = ${s.key}`)[0]!.id;
      console.log(inserted[0] ? `added sport ${s.name}` : `kept existing sport ${s.name}`);
      for (const p of s.presets) {
        const cfg = auctionDefaultsSchema.parse(p.config);
        await sql`insert into app.sport_presets(sport_id, name, description, is_example, config)
          values (${sportId}, ${p.name}, ${p.description}, ${p.isExample}, ${sql.json(cfg)})
          on conflict (sport_id, name) do nothing`;
      }
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
