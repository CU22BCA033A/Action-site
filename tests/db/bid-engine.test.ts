import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { call, connect, floor, key, liveAuction, openPlayer, type Sql } from "../support/db";

let sql: Sql;
beforeAll(() => {
  sql = connect(6);
});
afterAll(async () => {
  await sql.end();
});

const bid = (auctionId: string, teamId: string, version: number, k = key()) =>
  call(sql, "place_bid", [auctionId, teamId, version, k, "admin_on_behalf", "test"]);

describe("place_bid basics", () => {
  it("opens at base price, then follows the slab increments", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const p = players[0]!;
    let f = await openPlayer(sql, auctionId, p.id);
    const r1 = await bid(auctionId, teams[0]!.id, f.version);
    expect(r1.ok).toBe(true);
    expect(r1.floor.currentPrice).toBe(p.base_price);
    // Base price 20 sits in the 0 to 100 band with increments of 5.
    const r2 = await bid(auctionId, teams[1]!.id, r1.floor.version);
    expect(r2.floor.currentPrice).toBe(p.base_price + 5);
    expect(r2.floor.nextBidAmount).toBe(p.base_price + 10);
    f = await floor(sql, auctionId);
    expect(f.leading_team_id).toBe(teams[1]!.id);
  });

  it("rejects the leading team, stale versions and replays the same idempotency key", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const k = key();
    const r1 = await bid(auctionId, teams[0]!.id, f.version, k);
    expect(r1.code).toBe("OK");
    expect((await bid(auctionId, teams[0]!.id, r1.floor.version)).code).toBe("ALREADY_LEADING");
    expect((await bid(auctionId, teams[1]!.id, f.version)).code).toBe("STALE");
    const dup = await bid(auctionId, teams[0]!.id, f.version, k);
    expect(dup.code).toBe("DUPLICATE");
    const count = await sql`select count(*)::int c from app.bids where auction_id = ${auctionId}`;
    expect(count[0]!.c).toBe(1);
  });

  it("refuses bids when the floor is not live or the timer has run out", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    let f = await floor(sql, auctionId);
    expect((await bid(auctionId, teams[0]!.id, f.version)).code).toBe("NOT_LIVE");
    f = await openPlayer(sql, auctionId, players[0]!.id);
    await sql`update app.floor_state set timer_ends_at = now() - interval '1 second' where auction_id = ${auctionId}`;
    const r = await bid(auctionId, teams[0]!.id, f.version);
    expect(r.code).toBe("NOT_LIVE");
    expect(r.message).toMatch(/Time is up/);
  });

  it("extends the timer for late bids", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    await sql`update app.floor_state set timer_ends_at = clock_timestamp() + interval '2 seconds' where auction_id = ${auctionId}`;
    await bid(auctionId, teams[0]!.id, f.version);
    const rows = await sql<{ left: number }[]>`select extract(epoch from timer_ends_at - clock_timestamp())::float as left from app.floor_state where auction_id = ${auctionId}`;
    // Default extension is 10 seconds.
    expect(rows[0]!.left).toBeGreaterThan(8);
  });
});

describe("eligibility rules", () => {
  it("INSUFFICIENT_PURSE when the bid exceeds purse left", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    await sql`update app.teams set purse_total = 10 where id = ${teams[0]!.id}`;
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    expect((await bid(auctionId, teams[0]!.id, f.version)).code).toBe("INSUFFICIENT_PURSE");
  });

  it("RESERVE_VIOLATION when a bid leaves too little to fill the minimum squad", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    // squad_min 15, base 20: reserve for 14 more players = 280. Purse 300 allows a max bid of 20.
    await sql`update app.teams set purse_total = 300 where id = ${teams[0]!.id}`;
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const r1 = await bid(auctionId, teams[1]!.id, f.version);
    expect(r1.ok).toBe(true);
    const r2 = await bid(auctionId, teams[0]!.id, r1.floor.version);
    expect(r2.code).toBe("RESERVE_VIOLATION");
    const max = await sql<{ m: number }[]>`select app.max_bid_for(${teams[0]!.id}) m`;
    expect(max[0]!.m).toBe(20);
  });

  it("allows the same bid when the reserve rule is off", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    await sql`update app.teams set purse_total = 300 where id = ${teams[0]!.id}`;
    await sql`update app.auctions set reserve_rule_enabled = false where id = ${auctionId}`;
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const r1 = await bid(auctionId, teams[1]!.id, f.version);
    expect((await bid(auctionId, teams[0]!.id, r1.floor.version)).ok).toBe(true);
  });

  it("SQUAD_FULL, OVERSEAS_LIMIT and ROLE_LIMIT", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const team = teams[0]!.id;
    await sql`update app.auctions set squad_min = 0, squad_max = 1, role_minimums = '{}'::jsonb where id = ${auctionId}`;
    await sql`update app.auction_players set status = 'sold', sold_to_team_id = ${team}, sold_price = 0 where id = ${players[5]!.id}`;
    let f = await openPlayer(sql, auctionId, players[0]!.id);
    expect((await bid(auctionId, team, f.version)).code).toBe("SQUAD_FULL");

    await sql`update app.auctions set squad_max = 10, max_overseas = 0 where id = ${auctionId}`;
    await sql`update app.players set nationality_group = 'overseas' where id = ${players[0]!.player_id}`;
    f = await floor(sql, auctionId);
    expect((await bid(auctionId, team, f.version)).code).toBe("OVERSEAS_LIMIT");

    await sql`update app.players set nationality_group = 'domestic' where id = ${players[0]!.player_id}`;
    const role = await sql<{ role_key: string }[]>`select role_key from app.players where id = ${players[0]!.player_id}`;
    await sql`update app.players set role_key = ${role[0]!.role_key} where id = ${players[5]!.player_id}`;
    await sql`update app.auctions set role_maximums = ${sql.json({ [role[0]!.role_key]: 1 })} where id = ${auctionId}`;
    f = await floor(sql, auctionId);
    expect((await bid(auctionId, team, f.version)).code).toBe("ROLE_LIMIT");
  });

  it("ROLE_LIMIT when the last open slots are needed for required roles", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const p = players[0]!;
    const role = (await sql<{ role_key: string }[]>`select role_key from app.players where id = ${p.player_id}`)[0]!.role_key;
    const other = role === "wicketkeeper" ? "batter" : "wicketkeeper";
    await sql`update app.auctions set squad_min = 0, squad_max = 1, role_minimums = ${sql.json({ [other]: 1 })} where id = ${auctionId}`;
    const f = await openPlayer(sql, auctionId, p.id);
    expect((await bid(auctionId, teams[0]!.id, f.version)).code).toBe("ROLE_LIMIT");
  });
});

describe("floor controls", () => {
  it("undo restores the previous price and leader, then sale moves purse and squad", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const p = players[0]!;
    const f = await openPlayer(sql, auctionId, p.id);
    const a = await bid(auctionId, teams[0]!.id, f.version);
    const b = await bid(auctionId, teams[1]!.id, a.floor.version);
    const undo = await call(sql, "undo_last_bid", [auctionId, b.floor.version, "test"]);
    expect(undo.ok).toBe(true);
    expect(undo.floor.currentPrice).toBe(p.base_price);
    expect(undo.floor.leadingTeamId).toBe(teams[0]!.id);
    const sold = await call(sql, "mark_sold", [auctionId, undo.floor.version, "test"]);
    expect(sold.code).toBe("SOLD");
    const t = await sql<{ purse_spent: number }[]>`select purse_spent from app.teams where id = ${teams[0]!.id}`;
    expect(t[0]!.purse_spent).toBe(p.base_price);
    const ap = await sql<{ status: string; sold_to_team_id: string }[]>`select status, sold_to_team_id from app.auction_players where id = ${p.id}`;
    expect(ap[0]).toMatchObject({ status: "sold", sold_to_team_id: teams[0]!.id });
    const audit = await sql`select action from app.audit_log where auction_id = ${auctionId} order by id`;
    expect(audit.map((r) => r.action)).toEqual(expect.arrayContaining(["floor.move_to_floor", "floor.start", "bid.placed_on_behalf", "bid.undone", "floor.sold"]));
  });

  it("mark_unsold only without a leading bid; return_to_pool voids bids", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const a = await bid(auctionId, teams[0]!.id, f.version);
    expect((await call(sql, "mark_unsold", [auctionId, a.floor.version, "test"])).code).toBe("HAS_BIDS");
    const back = await call(sql, "return_to_pool", [auctionId, players[0]!.id, a.floor.version, "test"]);
    expect(back.ok).toBe(true);
    const voided = await sql`select count(*)::int c from app.bids where auction_player_id = ${players[0]!.id} and voided`;
    expect(voided[0]!.c).toBe(1);
    const f2 = await openPlayer(sql, auctionId, players[1]!.id);
    expect((await call(sql, "mark_unsold", [auctionId, f2.version, "test"])).ok).toBe(true);
  });

  it("pause stores the remaining time and resume restores it", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const paused = await call(sql, "pause_floor", [auctionId, f.version, "test"]);
    expect(paused.floor.phase).toBe("paused");
    expect((await bid(auctionId, teams[0]!.id, paused.floor.version)).code).toBe("NOT_LIVE");
    const resumed = await call(sql, "resume_floor", [auctionId, paused.floor.version, "test"]);
    expect(resumed.floor.phase).toBe("live");
    expect((await bid(auctionId, teams[0]!.id, resumed.floor.version)).ok).toBe(true);
  });

  it("blocks under-18 players without guardian consent from the floor", async () => {
    const { auctionId, players } = await liveAuction(sql);
    await sql`update app.players set date_of_birth = current_date - interval '15 years', guardian_consent = null where id = ${players[0]!.player_id}`;
    const f = await floor(sql, auctionId);
    expect((await call(sql, "move_to_floor", [auctionId, players[0]!.id, f.version, "test"])).code).toBe("CONSENT_REQUIRED");
  });
});

describe("Right to Match and Final Bid Match", () => {
  it("RTM: previous team matches, winner raises once, previous team matches the raise", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const [winner, prev] = [teams[0]!.id, teams[1]!.id];
    await sql`update app.auctions set rtm_enabled = true, rtm_allow_final_raise = true where id = ${auctionId}`;
    await sql`update app.teams set rtm_cards_left = 1 where id = ${prev}`;
    await sql`update app.auction_players set previous_team_id = ${prev} where id = ${players[0]!.id}`;
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const a = await bid(auctionId, winner, f.version);
    const offer = await call(sql, "rtm_action", [auctionId, "offer", a.floor.version, "admin", "test", null, null]);
    expect(offer.floor.phase).toBe("rtm_pending");
    // The leading bidder cannot answer for the previous team.
    expect((await call(sql, "rtm_action", [auctionId, "match", offer.floor.version, "team", "s", winner, null])).code).toBe("NOT_AUTHORISED");
    const match = await call(sql, "rtm_action", [auctionId, "match", offer.floor.version, "team", "s", prev, null]);
    expect(match.ok).toBe(true);
    const raise = await call(sql, "rtm_action", [auctionId, "raise", match.floor.version, "team", "s", winner, 60]);
    expect(raise.ok).toBe(true);
    expect(raise.floor.currentPrice).toBe(60);
    const final = await call(sql, "rtm_action", [auctionId, "match_raise", raise.floor.version, "team", "s", prev, null]);
    expect(final.code).toBe("SOLD");
    const res = await sql<{ sold_to_team_id: string; sold_price: number }[]>`select sold_to_team_id, sold_price from app.auction_players where id = ${players[0]!.id}`;
    expect(res[0]).toMatchObject({ sold_to_team_id: prev, sold_price: 60 });
    const cards = await sql<{ rtm_cards_left: number }[]>`select rtm_cards_left from app.teams where id = ${prev}`;
    expect(cards[0]!.rtm_cards_left).toBe(0);
  });

  it("FBM without a final raise: matching buys at the final bid; declining keeps the card", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const [winner, prev] = [teams[0]!.id, teams[1]!.id];
    await sql`update app.auctions set rtm_enabled = true, rtm_label = 'FBM', rtm_allow_final_raise = false where id = ${auctionId}`;
    await sql`update app.teams set rtm_cards_left = 2 where id = ${prev}`;
    await sql`update app.auction_players set previous_team_id = ${prev} where id in (${players[0]!.id}, ${players[1]!.id})`;

    let f = await openPlayer(sql, auctionId, players[0]!.id);
    let a = await bid(auctionId, winner, f.version);
    let offer = await call(sql, "rtm_action", [auctionId, "offer", a.floor.version, "admin", "test", null, null]);
    const declined = await call(sql, "rtm_action", [auctionId, "decline", offer.floor.version, "admin", "test", null, null]);
    expect(declined.code).toBe("SOLD");
    expect((await sql`select rtm_cards_left from app.teams where id = ${prev}`)[0]!.rtm_cards_left).toBe(2);

    f = await openPlayer(sql, auctionId, players[1]!.id);
    a = await bid(auctionId, winner, f.version);
    offer = await call(sql, "rtm_action", [auctionId, "offer", a.floor.version, "admin", "test", null, null]);
    const matched = await call(sql, "rtm_action", [auctionId, "match", offer.floor.version, "admin", "test", null, null]);
    expect(matched.code).toBe("SOLD");
    expect((await sql`select sold_to_team_id from app.auction_players where id = ${players[1]!.id}`)[0]!.sold_to_team_id).toBe(prev);
    expect((await sql`select rtm_cards_left from app.teams where id = ${prev}`)[0]!.rtm_cards_left).toBe(1);
  });
});

describe("concurrency", () => {
  it("100 parallel bids at one version produce exactly one winner", async () => {
    const { auctionId, teams, players } = await liveAuction(sql, { teams: 8 });
    const pool = connect(40);
    try {
      const f = await openPlayer(sql, auctionId, players[0]!.id);
      const results = await Promise.all(
        Array.from({ length: 100 }, (_, i) =>
          call(pool, "place_bid", [auctionId, teams[i % teams.length]!.id, f.version, key(), "admin_on_behalf", "test"]),
        ),
      );
      const oks = results.filter((r) => r.ok);
      expect(oks).toHaveLength(1);
      expect(results.filter((r) => !r.ok).every((r) => r.code === "STALE" || r.code === "ALREADY_LEADING")).toBe(true);
      const bids = await sql`select count(*)::int c from app.bids where auction_id = ${auctionId}`;
      expect(bids[0]!.c).toBe(1);
    } finally {
      await pool.end();
    }
  });

  it("many racing rounds never drift purse, price or version", async () => {
    const { auctionId, teams, players } = await liveAuction(sql, { teams: 8, players: 12 });
    await sql`update app.auctions set reserve_rule_enabled = false where id = ${auctionId}`;
    const pool = connect(30);
    try {
      let expectedSpent = 0;
      for (const p of players.slice(0, 6)) {
        let f = await openPlayer(sql, auctionId, p.id);
        let accepted = 0;
        for (let round = 0; round < 12; round++) {
          const results = await Promise.all(
            teams.map((t) => call(pool, "place_bid", [auctionId, t.id, f.version, key(), "admin_on_behalf", "test"])),
          );
          const oks = results.filter((r) => r.ok);
          expect(oks.length).toBeLessThanOrEqual(1);
          accepted += oks.length;
          f = await floor(sql, auctionId);
        }
        const bidRows = await sql<{ amount: number }[]>`select amount from app.bids where auction_player_id = ${p.id} and not voided order by created_at, id`;
        expect(bidRows).toHaveLength(accepted);
        // Strictly increasing amounts, final price equals the last bid.
        for (let i = 1; i < bidRows.length; i++) expect(bidRows[i]!.amount).toBeGreaterThan(bidRows[i - 1]!.amount);
        expect(f.current_price).toBe(bidRows.at(-1)!.amount);
        const sold = await call(sql, "mark_sold", [auctionId, f.version, "test"]);
        expect(sold.ok).toBe(true);
        expectedSpent += f.current_price;
      }
      const sums = await sql<{ spent: number; sold: number }[]>`
        select (select coalesce(sum(purse_spent), 0)::int from app.teams where auction_id = ${auctionId}) as spent,
               (select coalesce(sum(sold_price), 0)::int from app.auction_players where auction_id = ${auctionId} and status = 'sold') as sold`;
      expect(sums[0]!.spent).toBe(expectedSpent);
      expect(sums[0]!.sold).toBe(expectedSpent);
    } finally {
      await pool.end();
    }
  });
});

describe("live rule changes", () => {
  it("a mid-auction slab change applies only to later bids and never touches purses", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const a = await bid(auctionId, teams[0]!.id, f.version);
    const b = await bid(auctionId, teams[1]!.id, a.floor.version);
    expect(b.floor.currentPrice).toBe(25);
    const before = await sql`select id, purse_total, purse_spent from app.teams where auction_id = ${auctionId} order by id`;
    const sv = (await sql<{ v: number }[]>`select settings_version::int v from app.auctions where id = ${auctionId}`)[0]!.v;

    const noReason = await call(sql, "update_auction_settings", [auctionId, sv, { name: "x" }, [{ from: 0, to: null, increment: 50 }], "test", "", false]);
    expect(noReason.code).toBe("REASON_REQUIRED");

    const upd = await call(sql, "update_auction_settings", [auctionId, sv, {}, [{ from: 0, to: null, increment: 50 }], "test", "faster bidding", false]);
    expect(upd.ok).toBe(true);
    const bids = await sql<{ amount: number }[]>`select amount from app.bids where auction_player_id = ${players[0]!.id} order by created_at`;
    expect(bids.map((x) => x.amount)).toEqual([20, 25]);
    const c = await bid(auctionId, teams[0]!.id, upd.floor.version);
    expect(c.floor.currentPrice).toBe(75);
    const after = await sql`select id, purse_total, purse_spent from app.teams where auction_id = ${auctionId} order by id`;
    expect(after).toEqual(before);
    const audit = await sql`select reason from app.audit_log where auction_id = ${auctionId} and action = 'auction.settings'`;
    expect(audit[0]!.reason).toBe("faster bidding");
  });

  it("rejects bad slabs and reports teams that would break a lowered squad maximum", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    await sql`update app.auction_players set status = 'sold', sold_to_team_id = ${teams[0]!.id}, sold_price = 20 where id in (${players[0]!.id}, ${players[1]!.id})`;
    const sv = (await sql<{ v: number }[]>`select settings_version::int v from app.auctions where id = ${auctionId}`)[0]!.v;
    const gap = await call(sql, "update_auction_settings", [auctionId, sv, {}, [{ from: 0, to: 50, increment: 5 }, { from: 60, to: null, increment: 10 }], "test", "x", false]);
    expect(gap.code).toBe("INVALID_SLABS");
    const conflict = await call<{ conflicts: { teamId: string; issue: string }[] }>(sql, "update_auction_settings", [auctionId, sv, { squad_min: 0, squad_max: 1 }, null, "test", "x", false]);
    expect(conflict.code).toBe("CONFLICTS");
    expect(conflict.conflicts[0]).toMatchObject({ teamId: teams[0]!.id, issue: "squad_max" });
    const confirmed = await call(sql, "update_auction_settings", [auctionId, sv, { squad_min: 0, squad_max: 1 }, null, "test", "x", true]);
    expect(confirmed.ok).toBe(true);
    const stale = await call(sql, "update_auction_settings", [auctionId, sv, { name: "y" }, null, "test", "x", false]);
    expect(stale.code).toBe("STALE");
  });
});

describe("corrections and purse", () => {
  it("price change, move between teams and return to pool keep purses consistent", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const [t1, t2] = [teams[0]!.id, teams[1]!.id];
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const a = await bid(auctionId, t1, f.version);
    await call(sql, "mark_sold", [auctionId, a.floor.version, "test"]);
    const ap = players[0]!.id;
    expect((await call(sql, "correct_sale", [auctionId, ap, "price", 50, null, "test", ""])).code).toBe("REASON_REQUIRED");
    expect((await call(sql, "correct_sale", [auctionId, ap, "price", 50, null, "test", "typo"])).ok).toBe(true);
    expect((await sql`select purse_spent from app.teams where id = ${t1}`)[0]!.purse_spent).toBe(50);
    expect((await call(sql, "correct_sale", [auctionId, ap, "move", null, t2, "test", "wrong paddle"])).ok).toBe(true);
    expect((await sql`select purse_spent from app.teams where id = ${t1}`)[0]!.purse_spent).toBe(0);
    expect((await sql`select purse_spent from app.teams where id = ${t2}`)[0]!.purse_spent).toBe(50);
    expect((await call(sql, "correct_sale", [auctionId, ap, "return", null, null, "test", "redo"])).ok).toBe(true);
    expect((await sql`select purse_spent from app.teams where id = ${t2}`)[0]!.purse_spent).toBe(0);
    expect((await sql`select status from app.auction_players where id = ${ap}`)[0]!.status).toBe("pool");
  });

  it("never sets a purse below the points already spent", async () => {
    const { auctionId, teams } = await liveAuction(sql);
    await sql`update app.teams set purse_spent = 400 where id = ${teams[0]!.id}`;
    const v = (await sql<{ v: number }[]>`select version::int v from app.teams where id = ${teams[0]!.id}`)[0]!.v;
    expect((await call(sql, "adjust_purse", [auctionId, teams[0]!.id, 300, v, "test", "cut"])).code).toBe("PURSE_BELOW_SPENT");
    expect((await call(sql, "adjust_purse", [auctionId, teams[0]!.id, 900, v, "test", ""])).code).toBe("REASON_REQUIRED");
    expect((await call(sql, "adjust_purse", [auctionId, teams[0]!.id, 900, v, "test", "sponsor top up"])).ok).toBe(true);
    expect((await call(sql, "adjust_purse", [auctionId, teams[0]!.id, 950, v, "test", "again"])).code).toBe("STALE");
  });
});

describe("access control", () => {
  it("anon and authenticated roles cannot read any table or call any function", async () => {
    for (const role of ["anon", "authenticated"]) {
      await expect(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx.unsafe("select * from app.teams limit 1");
      })).rejects.toThrow(/permission denied/);
      await expect(sql.begin(async (tx) => {
        await tx.unsafe(`set local role ${role}`);
        await tx.unsafe("select app.public_snapshot(gen_random_uuid())");
      })).rejects.toThrow(/permission denied/);
    }
    const rls = await sql<{ relname: string }[]>`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'app' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rls).toEqual([]);
  });

  it("a manager session can bid only for its own team, and only while the session and code are active", async () => {
    const { auctionId, teams, players } = await liveAuction(sql);
    const [own, other] = [teams[0]!.id, teams[1]!.id];
    const code = await sql<{ id: string }[]>`insert into app.team_access_codes(team_id, code_hash) values (${own}, ${key()}) returning id`;
    const sess = await sql<{ id: string }[]>`insert into app.team_sessions(team_id, access_code_id, expires_at) values (${own}, ${code[0]!.id}, now() + interval '1 hour') returning id`;
    const sid = sess[0]!.id;
    const f = await openPlayer(sql, auctionId, players[0]!.id);
    const managerBid = (team: string, version: number) => call(sql, "place_bid", [auctionId, team, version, key(), "manager", "m", sid]);

    expect((await managerBid(other, f.version)).code).toBe("NOT_AUTHORISED");
    const ok = await managerBid(own, f.version);
    expect(ok.ok).toBe(true);

    await sql`update app.team_access_codes set active = false, revoked_at = now() where id = ${code[0]!.id}`;
    const b = await bid(auctionId, other, ok.floor.version);
    expect((await managerBid(own, b.floor.version)).code).toBe("NOT_AUTHORISED");

    await sql`update app.team_access_codes set active = true where id = ${code[0]!.id}`;
    await sql`update app.team_sessions set revoked_at = now() where id = ${sid}`;
    expect((await managerBid(own, b.floor.version)).code).toBe("NOT_AUTHORISED");
  });
});
