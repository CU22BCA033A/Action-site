import "server-only";
import { db } from "@/lib/db";
import { broadcast } from "./broadcast";
import type { BidEntry, EngineResult, FloorState, Snapshot } from "./types";

/** Allow-list of engine functions callable from server code. */
type EngineFn =
  | "place_bid"
  | "move_to_floor"
  | "start_bidding"
  | "pause_floor"
  | "resume_floor"
  | "reset_timer"
  | "undo_last_bid"
  | "mark_sold"
  | "mark_unsold"
  | "return_to_pool"
  | "force_assign"
  | "rtm_action"
  | "start_accelerated_round"
  | "reorder_queue"
  | "correct_sale"
  | "adjust_purse"
  | "retain_player"
  | "update_auction_settings"
  | "admin_delete_players"
  | "admin_delete_team";

export async function callEngine(fn: EngineFn, args: unknown[]): Promise<EngineResult> {
  const placeholders = args.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await db().unsafe(`select app.${fn}(${placeholders}) as r`, args as never[]);
  const r = (rows[0] as { r: EngineResult } | undefined)?.r;
  if (!r) return { ok: false, code: "NOT_FOUND", message: "Not found.", floor: null };
  return { ...r, floor: r.floor ?? null };
}

/** Runs an engine call and broadcasts the change when it succeeded. */
export async function runAndBroadcast(auctionId: string, fn: EngineFn, args: unknown[]): Promise<EngineResult> {
  const res = await callEngine(fn, args);
  if (res.ok && res.code !== "DUPLICATE" && res.floor) {
    if (fn === "place_bid") {
      const bid = await latestBid(auctionId);
      if (bid) await broadcast(auctionId, { seq: res.floor.eventSeq, kind: "bid", floor: res.floor, bid });
      else await broadcast(auctionId, { seq: res.floor.eventSeq, kind: "refresh" });
    } else if (["start_bidding", "pause_floor", "resume_floor", "reset_timer"].includes(fn)) {
      await broadcast(auctionId, { seq: res.floor.eventSeq, kind: "floor", floor: res.floor });
    } else {
      await broadcast(auctionId, { seq: res.floor.eventSeq, kind: "refresh" });
    }
  }
  return res;
}

async function latestBid(auctionId: string): Promise<BidEntry | null> {
  const rows = await db()<BidEntry[]>`
    select b.id, b.team_id as "teamId", b.amount, b.created_at as "createdAt", b.auction_player_id as "auctionPlayerId",
      p.full_name as "playerName", b.source
    from app.bids b join app.auction_players ap on ap.id = b.auction_player_id join app.players p on p.id = ap.player_id
    where b.auction_id = ${auctionId} and not b.voided order by b.created_at desc, b.id desc limit 1`;
  const r = rows[0];
  return r ? { ...r, createdAt: new Date(r.createdAt).toISOString() } : null;
}

export async function getSnapshot(auctionId: string): Promise<Snapshot | null> {
  const rows = await db()<{ s: Snapshot | null }[]>`select app.public_snapshot(${auctionId}) as s`;
  return rows[0]?.s ?? null;
}

export async function getFloor(auctionId: string): Promise<FloorState | null> {
  const rows = await db()<{ f: FloorState | null }[]>`select app.floor_json(${auctionId}) as f`;
  return rows[0]?.f ?? null;
}

/** Broadcast a refresh after admin edits that change what viewers see. */
export async function bumpAndRefresh(auctionId: string) {
  const rows = await db()<{ seq: number }[]>`select app._bump(${auctionId})::int as seq`;
  const seq = rows[0]?.seq;
  if (seq !== undefined) await broadcast(auctionId, { seq, kind: "refresh" });
}
