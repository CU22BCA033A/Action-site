"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { runAndBroadcast } from "@/lib/live/engine";
import type { EngineResult } from "@/lib/live/types";

const uuid = z.uuid();
const base = { auctionId: uuid, expectedVersion: z.number().int().min(0) };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("move_to_floor"), auctionPlayerId: uuid, ...base }),
  z.object({ action: z.literal("start_bidding"), ...base }),
  z.object({ action: z.literal("pause_floor"), ...base }),
  z.object({ action: z.literal("resume_floor"), ...base }),
  z.object({ action: z.literal("reset_timer"), ...base }),
  z.object({ action: z.literal("undo_last_bid"), ...base }),
  z.object({ action: z.literal("mark_sold"), ...base }),
  z.object({ action: z.literal("mark_unsold"), ...base }),
  z.object({ action: z.literal("return_to_pool"), auctionPlayerId: uuid, ...base }),
  z.object({ action: z.literal("force_assign"), auctionPlayerId: uuid, teamId: uuid, price: z.number().int().min(0), reason: z.string().trim().min(1).max(300), ...base }),
  z.object({ action: z.literal("bid_on_behalf"), teamId: uuid, idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/), ...base }),
  z.object({ action: z.literal("rtm"), step: z.enum(["offer", "match", "decline", "raise", "no_raise", "match_raise", "decline_raise"]), amount: z.number().int().positive().optional(), ...base }),
  z.object({ action: z.literal("start_accelerated_round"), ...base }),
]);

export type FloorInput = z.input<typeof schema>;

/** Every floor control goes through the database engine; this only routes and audits who asked. */
export async function floorAction(input: FloorInput): Promise<EngineResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, code: "INVALID", message: "That request was not valid.", floor: null };
  const v = parsed.data;
  const a = admin.actorId;
  switch (v.action) {
    case "move_to_floor":
    case "return_to_pool":
      return runAndBroadcast(v.auctionId, v.action, [v.auctionId, v.auctionPlayerId, v.expectedVersion, a]);
    case "force_assign":
      return runAndBroadcast(v.auctionId, "force_assign", [v.auctionId, v.auctionPlayerId, v.teamId, v.price, v.expectedVersion, a, v.reason]);
    case "bid_on_behalf":
      return runAndBroadcast(v.auctionId, "place_bid", [v.auctionId, v.teamId, v.expectedVersion, v.idempotencyKey, "admin_on_behalf", a, null]);
    case "rtm":
      return runAndBroadcast(v.auctionId, "rtm_action", [v.auctionId, v.step, v.expectedVersion, "admin", a, null, v.amount ?? null]);
    default:
      return runAndBroadcast(v.auctionId, v.action, [v.auctionId, v.expectedVersion, a]);
  }
}
