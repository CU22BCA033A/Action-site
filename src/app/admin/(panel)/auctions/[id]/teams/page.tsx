import { shareUrl } from "@/lib/request-origin";
import { TeamsManager } from "@/components/admin/teams-manager";
import { getAdminAuction, listAdminTeams } from "@/lib/admin/queries";

export const metadata = { title: "Teams | Admin" };

export default async function TeamsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, teams] = await Promise.all([getAdminAuction(id), listAdminTeams(id)]);
  return (
    <TeamsManager
      teams={teams}
      ctx={{ auctionId: a.id, auctionName: a.name, status: a.status, defaultPurse: a.purse, unit: a.pointsUnitLabel, joinUrl: await shareUrl("/join") }}
    />
  );
}
