import { NextResponse } from "next/server";
import { getConsoleSnapshot } from "@/lib/admin/console-data";
import { getAdminSession } from "@/lib/auth/admin";

const noStore = { "Cache-Control": "no-store" };

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return NextResponse.json({ error: "session_ended" }, { status: 401, headers: noStore });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  const data = await getConsoleSnapshot(id);
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404, headers: noStore });
  return NextResponse.json(data, { headers: noStore });
}
