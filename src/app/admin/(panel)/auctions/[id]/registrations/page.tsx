import { RegistrationsManager } from "@/components/admin/registrations-manager";
import { getAdminAuction, listAdminPlayers, listRegistrations } from "@/lib/admin/queries";
import { absoluteUrl } from "@/lib/site";

export const metadata = { title: "Registrations | Admin" };

export default async function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, regs, players] = await Promise.all([getAdminAuction(id), listRegistrations(id), listAdminPlayers(id)]);
  return (
    <RegistrationsManager
      regs={regs}
      ctx={{
        auctionId: a.id,
        open: a.registrationOpen,
        link: absoluteUrl(`/auctions/${a.slug}/register`),
        config: a.sportConfig,
        sets: [...new Set(players.map((p) => p.setName))],
        categoryPrices: a.categoryBasePrices,
        defaultBasePrice: a.defaultBasePrice,
        unit: a.pointsUnitLabel,
      }}
    />
  );
}
