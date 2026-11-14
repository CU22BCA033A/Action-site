import { shareUrl } from "@/lib/request-origin";
import { RegistrationsManager } from "@/components/admin/registrations-manager";
import { getAdminAuction, listAdminPlayers, listRegistrations } from "@/lib/admin/queries";

export const metadata = { title: "Registrations | Admin" };

export default async function RegistrationsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, regs, players] = await Promise.all([getAdminAuction(id), listRegistrations(id), listAdminPlayers(id)]);
  const link = await shareUrl(`/auctions/${a.slug}/register`);
  return (
    <RegistrationsManager
      regs={regs}
      ctx={{
        auctionId: a.id,
        open: a.registrationOpenNow,
        link,
        registration: {
          auctionId: a.id,
          link,
          open: a.registrationOpen,
          openNow: a.registrationOpenNow,
          opensAt: a.registrationOpensAt,
          closesAt: a.registrationClosesAt,
          playerTypes: a.playerTypes,
          useNationality: a.useNationality,
        },
        playerTypes: a.playerTypes,
        useNationality: a.useNationality,
        config: a.sportConfig,
        sets: [...new Set(players.map((p) => p.setName))],
        categoryPrices: a.categoryBasePrices,
        defaultBasePrice: a.defaultBasePrice,
        unit: a.pointsUnitLabel,
      }}
    />
  );
}
