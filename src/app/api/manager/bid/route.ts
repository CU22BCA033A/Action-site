import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamSession } from "@/lib/auth/team";
import { runAndBroadcast } from "@/lib/live/engine";
import { rateLimit } from "@/lib/security/rate-limit";

const body = z.object({
  expectedVersion: z.number().int().min(0),
  idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
});

const noStore = { "Cache-Control": "no-store" };

/** Places one bid for the team in the session. Price and eligibility are decided by the database. */
export async function POST(req: Request) {
  const session = await getTeamSession();
  if (!session) {
    return NextResponse.json({ ok: false, code: "NOT_AUTHORISED", message: "Your session has ended.", floor: null }, { status: 401, headers: noStore });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "INVALID", message: "Invalid request.", floor: null }, { status: 400, headers: noStore });
  }
  if (!(await rateLimit(`bid:${session.sessionId}`, 10, 5))) {
    return NextResponse.json({ ok: false, code: "RATE_LIMITED", message: "Too many bids too quickly.", floor: null }, { status: 429, headers: noStore });
  }
  const res = await runAndBroadcast(session.auctionId, "place_bid", [
    session.auctionId,
    session.teamId,
    parsed.data.expectedVersion,
    parsed.data.idempotencyKey,
    "manager",
    session.actorId,
    session.sessionId,
  ]);
  return NextResponse.json(res, { headers: noStore });
}
