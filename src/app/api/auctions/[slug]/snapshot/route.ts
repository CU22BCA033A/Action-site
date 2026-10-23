import { NextResponse } from "next/server";
import { getAuctionIdBySlug } from "@/lib/data/public";
import { getSnapshot } from "@/lib/live/engine";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getAuctionIdBySlug(slug);
  if (!a) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  const snapshot = await getSnapshot(a.id);
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
