import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamSession } from "@/lib/auth/team";
import { runAndBroadcast } from "@/lib/live/engine";
import { rateLimit } from "@/lib/security/rate-limit";

const body = z.object({
  action: z.enum(["match", "decline", "raise", "no_raise", "match_raise", "decline_raise"]),
  expectedVersion: z.number().int().min(0),
  amount: z.number().int().positive().max(1_000_000_000).optional(),
});

const noStore = { "Cache-Control": "no-store" };

/** Right to Match or Final Bid Match answers. The database checks which team may answer each step. */
export async function POST(req: Request) {
  const session = await getTeamSession();
  if (!session) return NextResponse.json({ ok: false, code: "NOT_AUTHORISED", message: "Your session has ended.", floor: null }, { status: 401, headers: noStore });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, code: "INVALID", message: "Invalid request.", floor: null }, { status: 400, headers: noStore });
  if (!(await rateLimit(`rtm:${session.sessionId}`, 10, 5))) {
    return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: "Too many requests.", floor: null }, { status: 429, headers: noStore });
  }
  const { action, expectedVersion, amount } = parsed.data;
  const res = await runAndBroadcast(session.auctionId, "rtm_action", [
    session.auctionId,
    action,
    expectedVersion,
    "team",
    session.actorId,
    session.teamId,
    amount ?? null,
  ]);
  return NextResponse.json(res, { headers: noStore });
}
