import { createHmac, randomInt } from "node:crypto";
import postgres from "postgres";
import { createDemoAuction } from "@/lib/domain/demo";

/** Direct database access for setting up end-to-end scenarios. */
export function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (or .env.local) to run the end-to-end tests.");
  return postgres(url, { prepare: false, max: 2, onnotice: () => {} });
}
export type Sql = ReturnType<typeof connect>;

export async function call(sql: Sql, fn: string, args: unknown[]) {
  const ph = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await sql.unsafe(`select app.${fn}(${ph}) as r`, args as never[]);
  return (rows[0] as unknown as { r: { ok: boolean; code: string } }).r;
}

export async function floorVersion(sql: Sql, auctionId: string) {
  return (await sql<{ v: number }[]>`select version::int as v from app.floor_state where auction_id = ${auctionId}`)[0]!.v;
}

/** The access-code alphabet: no 0, O, 1, I or L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Same HMAC as src/lib/security/crypto.ts. */
function codeHash(code: string) {
  const pepper = process.env.CODE_PEPPER;
  if (!pepper) throw new Error("CODE_PEPPER is not set.");
  return createHmac("sha256", pepper).update(`code:${code}`).digest("hex");
}

/**
 * A fresh live rehearsal auction with four teams and a known access code for
 * the first team. Each run gets its own slug, so runs never collide.
 */
export async function createRoom(sql: Sql) {
  const slug = `e2e-${Date.now().toString(36)}`;
  const auctionId = await sql.begin((tx) => createDemoAuction(tx as never, { sportKey: "cricket", name: "E2E Cup", slug, teamCount: 4, playerCount: 10 }));
  await sql`update app.auctions set status = 'live', public = true, bid_timer_seconds = null where id = ${auctionId}`;
  const teams = await sql<{ id: string; name: string; shortName: string }[]>`
    select id, name, short_name as "shortName" from app.teams where auction_id = ${auctionId} order by name`;
  const players = await sql<{ id: string; fullName: string; basePrice: number }[]>`
    select ap.id, p.full_name as "fullName", ap.base_price as "basePrice"
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = ${auctionId} order by ap.queue_position`;
  const raw = Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  const code = `${raw.slice(0, 5)}-${raw.slice(5)}`;
  await sql`insert into app.team_access_codes(team_id, code_hash, code_hint) values (${teams[0]!.id}, ${codeHash(code)}, ${code.slice(-4)})`;
  return { auctionId, slug, teams, players, code };
}

/** Puts a player on the floor and opens bidding, through the bid engine. */
export async function openPlayer(sql: Sql, auctionId: string, auctionPlayerId: string) {
  const moved = await call(sql, "move_to_floor", [auctionId, auctionPlayerId, await floorVersion(sql, auctionId), "e2e"]);
  if (!moved.ok) throw new Error(`move_to_floor: ${moved.code}`);
  const started = await call(sql, "start_bidding", [auctionId, await floorVersion(sql, auctionId), "e2e"]);
  if (!started.ok) throw new Error(`start_bidding: ${started.code}`);
}

/** Hides a test auction afterwards. */
export async function dropRoom(sql: Sql, auctionId: string) {
  await sql`update app.auctions set deleted_at = now(), public = false where id = ${auctionId}`;
}

/** Wrong-password tests leave failed attempts behind; clear them so later logins are not slowed down. */
export async function clearLoginAttempts(sql: Sql) {
  await sql`delete from app.login_attempts`;
  await sql`delete from app.rate_limits where key like 'join:%' or key like 'contact:%'`;
}
