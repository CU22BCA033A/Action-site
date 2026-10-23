import { getAuctionIdBySlug, listAuctionPlayers } from "@/lib/data/public";
import { getSnapshot } from "@/lib/live/engine";
import { toCsv } from "@/lib/csv";

/** Public sold list as CSV. Public-safe columns only. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getAuctionIdBySlug(slug);
  if (!a) return new Response("Not found", { status: 404 });
  const s = await getSnapshot(a.id);
  if (!s) return new Response("Not found", { status: 404 });
  const teams = new Map(s.teams.map((t) => [t.id, t.name]));
  const roles = new Map(s.auction.sportConfig.roles.map((r) => [r.key, r.label]));
  const rows = (await listAuctionPlayers(a.id)).filter((p) => p.status === "sold" || p.status === "retained");
  const csv = toCsv(
    ["Lot", "Player", "Role", "Sub-role", "Category", "Status", "Team", `Price (${s.auction.pointsUnitLabel})`],
    rows.map((p) => [p.lotNo, p.fullName, roles.get(p.roleKey) ?? p.roleKey, p.subRole ?? "", p.category ?? "", p.status, teams.get(p.soldToTeamId ?? "") ?? "", p.soldPrice ?? ""]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}-results.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
