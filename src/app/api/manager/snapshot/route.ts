import { NextResponse } from "next/server";
import { getTeamSession } from "@/lib/auth/team";
import { getManagerSnapshot } from "@/lib/data/manager";

const noStore = { "Cache-Control": "no-store" };

export async function GET() {
  const session = await getTeamSession();
  if (!session) return NextResponse.json({ error: "session_ended" }, { status: 401, headers: noStore });
  const snapshot = await getManagerSnapshot(session);
  if (!snapshot) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json(snapshot, { headers: noStore });
}
