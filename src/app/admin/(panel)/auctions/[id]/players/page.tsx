import { PlayersManager } from "@/components/admin/players-manager";
import { getAdminAuction, listAdminPlayers, listAdminTeams } from "@/lib/admin/queries";

export const metadata = { title: "Players | Admin" };

export default async function PlayersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, players, teams] = await Promise.all([getAdminAuction(id), listAdminPlayers(id), listAdminTeams(id)]);
  return (
    <PlayersManager
      players={players}
      ctx={{
        auctionId: a.id,
        status: a.status,
        unit: a.pointsUnitLabel,
        config: a.sportConfig,
        categoryPrices: a.categoryBasePrices,
        defaultBasePrice: a.defaultBasePrice,
        retentionsEnabled: a.retentionsEnabled,
        teams: teams.map((t) => ({ id: t.id, name: t.name, shortName: t.shortName })),
      }}
    />
  );
}
