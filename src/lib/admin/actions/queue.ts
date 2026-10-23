"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { runAndBroadcast } from "@/lib/live/engine";
import { invalid, type ActionResult } from "../result";

const schema = z.object({
  auctionId: z.uuid(),
  sets: z
    .array(z.object({ name: z.string().trim().min(1, "Every set needs a name.").max(40), ids: z.array(z.uuid()).max(2000) }))
    .min(1)
    .max(100),
});

/**
 * Saves set membership, set order and queue order in one go. Only players
 * still waiting (pool or unsold) are moved; anything sold or on the floor
 * keeps its place.
 */
export async function saveQueueAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { auctionId, sets } = parsed.data;
  const names = sets.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) return { ok: false, error: "Two sets have the same name. Rename one." };
  const all = sets.flatMap((s) => s.ids);
  if (new Set(all).size !== all.length) return { ok: false, error: "A player appears twice. Reload and try again." };
  const sql = db();
  const waiting = await sql<{ id: string }[]>`select id from app.auction_players where auction_id = ${auctionId} and status in ('pool','unsold')`;
  const waitingIds = new Set(waiting.map((w) => w.id));
  const moved = all.filter((id) => waitingIds.has(id));
  await sql.begin(async (tx) => {
    for (const [order, s] of sets.entries()) {
      const ids = s.ids.filter((id) => waitingIds.has(id));
      if (ids.length) await tx`update app.auction_players set set_name = ${s.name}, set_order = ${order + 1}, version = version + 1 where id = any(${ids}::uuid[])`;
    }
  });
  const res = await runAndBroadcast(auctionId, "reorder_queue", [auctionId, moved, admin.actorId]);
  revalidatePath(`/admin/auctions/${auctionId}`, "layout");
  return res.ok ? { ok: true, message: "Queue saved." } : { ok: false, error: res.message };
}
