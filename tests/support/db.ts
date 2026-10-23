import postgres from "postgres";
import { createDemoAuction } from "@/lib/domain/demo";
import { sportConfigSchema } from "@/lib/sports/config";
import { seedSports } from "@/lib/sports/seed-data";

export type Sql = postgres.Sql<Record<string, never>>;

export function testUrl(): string {
  const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL missing");
  const url = new URL(base);
  url.pathname = `/${url.pathname.slice(1) || "postgres"}_test`;
  return url.toString();
}

export function connect(max = 4): Sql {
  return postgres(testUrl(), { max, onnotice: () => {}, prepare: false }) as unknown as Sql;
}

export async function ensureSports(sql: Sql) {
  for (const s of seedSports) {
    await sql`insert into app.sports(key, name, config, sort_order)
      values (${s.key}, ${s.name}, ${sql.json(sportConfigSchema.parse(s.config))}, ${s.sortOrder})
      on conflict (key) do nothing`;
  }
}

let counter = 0;
/** A fresh live demo auction with N teams. Returns ids for convenience. */
export async function liveAuction(sql: Sql, opts: { sportKey?: string; teams?: number; players?: number; slug?: string } = {}) {
  await ensureSports(sql);
  const slug = opts.slug ?? `t-${Date.now().toString(36)}-${counter++}`;
  const auctionId = await sql.begin((tx) =>
    createDemoAuction(tx as never, { sportKey: opts.sportKey ?? "cricket", name: slug, slug, teamCount: opts.teams ?? 8, playerCount: opts.players ?? 30 }),
  );
  await sql`update app.auctions set status = 'live' where id = ${auctionId}`;
  const teams = await sql<{ id: string; name: string }[]>`select id, name from app.teams where auction_id = ${auctionId} order by name`;
  const players = await sql<{ id: string; base_price: number; player_id: string }[]>`
    select id, base_price, player_id from app.auction_players where auction_id = ${auctionId} order by queue_position`;
  return { auctionId, teams, players };
}

export async function floor(sql: Sql, auctionId: string) {
  const rows = await sql<{ version: number; phase: string; current_price: number; leading_team_id: string | null }[]>`
    select version::int as version, phase, current_price, leading_team_id from app.floor_state where auction_id = ${auctionId}`;
  return rows[0]!;
}

export async function call<T = Record<string, unknown>>(sql: Sql, fn: string, args: unknown[]): Promise<T & { ok: boolean; code: string; message: string; floor: { version: number; currentPrice: number; nextBidAmount: number | null; leadingTeamId: string | null; phase: string } }> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await sql.unsafe(`select app.${fn}(${placeholders}) as r`, args as never[]);
  return (rows[0] as unknown as { r: never }).r;
}

/** Put a player on the floor and open bidding. */
export async function openPlayer(sql: Sql, auctionId: string, auctionPlayerId: string) {
  let f = await floor(sql, auctionId);
  const moved = await call(sql, "move_to_floor", [auctionId, auctionPlayerId, f.version, "test"]);
  if (!moved.ok) throw new Error(`move_to_floor: ${moved.code}`);
  f = await floor(sql, auctionId);
  const started = await call(sql, "start_bidding", [auctionId, f.version, "test"]);
  if (!started.ok) throw new Error(`start_bidding: ${started.code}`);
  return floor(sql, auctionId);
}

export function key() {
  return `k-${crypto.randomUUID()}`;
}
