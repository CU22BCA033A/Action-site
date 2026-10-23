"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { runAndBroadcast } from "@/lib/live/engine";
import { invalid, type ActionResult } from "../result";

const schema = z.object({
  auctionId: z.uuid(),
  auctionPlayerId: z.uuid(),
  action: z.enum(["price", "move", "return"]),
  price: z.number().int().min(0).nullable().optional(),
  teamId: z.uuid().nullable().optional(),
  reason: z.string().trim().min(1, "Give a reason.").max(300),
});

/** Audited result corrections. Purses and squads of both teams change in one transaction. */
export async function correctResultAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const v = parsed.data;
  const res = await runAndBroadcast(v.auctionId, "correct_sale", [v.auctionId, v.auctionPlayerId, v.action, v.price ?? null, v.teamId ?? null, admin.actorId, v.reason]);
  revalidatePath(`/admin/auctions/${v.auctionId}`, "layout");
  return res.ok ? { ok: true, message: res.message } : { ok: false, code: res.code, error: res.message };
}
