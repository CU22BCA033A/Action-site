import { ResultsManager } from "@/components/admin/results-manager";
import { getAdminAuction, listAdminPlayers, listAdminTeams } from "@/lib/admin/queries";

export const metadata = { title: "Results | Admin" };

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, players, teams] = await Promise.all([getAdminAuction(id), listAdminPlayers(id), listAdminTeams(id)]);
  return <ResultsManager players={players} teams={teams} ctx={{ auctionId: a.id, slug: a.slug, unit: a.pointsUnitLabel, status: a.status }} />;
}
