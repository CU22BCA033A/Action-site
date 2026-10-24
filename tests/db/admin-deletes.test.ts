import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, connect, key, liveAuction, openPlayer, type Sql } from "../support/db";

let sql: Sql;
beforeAll(() => {
  sql = connect(4);
});
afterAll(async () => {
  await sql.end();
});

const bid = (auctionId: string, teamId: string, version: number) =>
  call(sql, "place_bid", [auctionId, teamId, version, key(), "admin_on_behalf", "test"]);

async function onFloor(auctionId: string) {
  const rows = await sql<{ current: string | null; phase: string }[]>`
    select current_auction_player_id as current, phase from app.floor_state where auction_id = ${auctionId}`;
  return rows[0]!;
}

async function sell(auctionId: string, teamId: string, apId: string) {
  const f = await openPlayer(sql, auctionId, apId);
  const r = await bid(auctionId, teamId, f.version);
  return call(sql, "mark_sold", [auctionId, r.floor.version, "test"]);
}

describe("admin_delete_players", () => {
  it("deletes a sold player and refunds the team", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const p = players[0]!;
    expect((await sell(auctionId, teams[0]!.id, p.id)).ok).toBe(true);
    const before = await sql<{ spent: number }[]>`select purse_spent as spent from app.teams where id = ${teams[0]!.id}`;
    expect(before[0]!.spent).toBe(p.base_price);

    const r = await call(sql, "admin_delete_players", [auctionId, [p.id], "test"]);
    expect(r.ok).toBe(true);
    const after = await sql<{ spent: number }[]>`select purse_spent as spent from app.teams where id = ${teams[0]!.id}`;
    expect(after[0]!.spent).toBe(0);
    expect((await sql`select 1 from app.auction_players where id = ${p.id}`).length).toBe(0);
    expect((await sql`select 1 from app.bids where auction_player_id = ${p.id}`).length).toBe(0);
    const audit = await sql`select 1 from app.audit_log where auction_id = ${auctionId} and action = 'player.delete'`;
    expect(audit.length).toBe(1);
  });

  it("takes a player off the floor while bidding is open", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f0 = await openPlayer(sql, auctionId, players[1]!.id);
    await bid(auctionId, teams[0]!.id, f0.version);
    const r = await call(sql, "admin_delete_players", [auctionId, [players[1]!.id], "test"]);
    expect(r.ok).toBe(true);
    const f = await onFloor(auctionId);
    expect(f.current).toBeNull();
    expect(f.phase).toBe("idle");
  });
});

describe("admin_delete_team", () => {
  it("returns its players to the pool, voids its bids and revokes access", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const t = teams[0]!;
    await sell(auctionId, t.id, players[0]!.id);
    const r = await call(sql, "admin_delete_team", [auctionId, t.id, "test"]);
    expect(r.ok).toBe(true);
    const ap = await sql<{ status: string; team: string | null }[]>`select status, sold_to_team_id as team from app.auction_players where id = ${players[0]!.id}`;
    expect(ap[0]).toEqual({ status: "pool", team: null });
    const live = await sql`select 1 from app.bids where team_id = ${t.id} and not voided`;
    expect(live.length).toBe(0);
    const team = await sql<{ deleted: boolean }[]>`select deleted_at is not null as deleted from app.teams where id = ${t.id}`;
    expect(team[0]!.deleted).toBe(true);
  });

  it("clears the floor when the deleted team is leading", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f0 = await openPlayer(sql, auctionId, players[2]!.id);
    await bid(auctionId, teams[1]!.id, f0.version);
    const r = await call(sql, "admin_delete_team", [auctionId, teams[1]!.id, "test"]);
    expect(r.ok).toBe(true);
    const f = await onFloor(auctionId);
    expect(f.current).toBeNull();
    const ap = await sql<{ status: string }[]>`select status from app.auction_players where id = ${players[2]!.id}`;
    expect(ap[0]!.status).toBe("pool");
  });
});
