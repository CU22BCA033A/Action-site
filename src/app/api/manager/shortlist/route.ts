import { NextResponse } from "next/server";
import { z } from "zod";
import { getTeamSession } from "@/lib/auth/team";
import { setShortlisted } from "@/lib/data/manager";
import { rateLimit } from "@/lib/security/rate-limit";

const body = z.object({ auctionPlayerId: z.uuid(), on: z.boolean() });
const noStore = { "Cache-Control": "no-store" };

export async function POST(req: Request) {
  const session = await getTeamSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400, headers: noStore });
  if (!(await rateLimit(`shortlist:${session.sessionId}`, 60, 60))) return NextResponse.json({ ok: false }, { status: 429, headers: noStore });
  const ok = await setShortlisted(session, parsed.data.auctionPlayerId, parsed.data.on);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404, headers: noStore });
}
