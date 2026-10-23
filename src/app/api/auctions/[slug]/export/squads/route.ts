import { getAuctionIdBySlug, listAuctionPlayers } from "@/lib/data/public";
import { getSnapshot } from "@/lib/live/engine";
import { toCsv } from "@/lib/csv";

/** Every team's squad as CSV, ordered by team then role. Public-safe columns only. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getAuctionIdBySlug(slug);
  if (!a) return new Response("Not found", { status: 404 });
  const s = await getSnapshot(a.id);
  if (!s) return new Response("Not found", { status: 404 });
  const roles = s.auction.sportConfig.roles;
  const roleOrder = new Map(roles.map((r, i) => [r.key, i]));
  const players = (await listAuctionPlayers(a.id)).filter((p) => p.status === "sold" || p.status === "retained");
  const rows: unknown[][] = [];
  for (const t of [...s.teams].sort((x, y) => x.name.localeCompare(y.name))) {
    const squad = players.filter((p) => p.soldToTeamId === t.id).sort((x, y) => (roleOrder.get(x.roleKey) ?? 99) - (roleOrder.get(y.roleKey) ?? 99));
    for (const p of squad) rows.push([t.name, p.lotNo, p.fullName, roles.find((r) => r.key === p.roleKey)?.label ?? p.roleKey, p.subRole ?? "", p.status, p.soldPrice ?? ""]);
  }
  const csv = toCsv(["Team", "Lot", "Player", "Role", "Sub-role", "How", `Price (${s.auction.pointsUnitLabel})`], rows);
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}-squads.csv"`, "Cache-Control": "no-store" },
  });
}
