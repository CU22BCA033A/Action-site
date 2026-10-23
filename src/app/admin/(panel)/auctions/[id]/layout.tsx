import { AuctionAdminHeader } from "@/components/admin/auction-admin-header";
import { getAdminAuction } from "@/lib/admin/queries";

export default async function AuctionAdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await getAdminAuction(id);
  return (
    <>
      <AuctionAdminHeader auction={{ id: a.id, name: a.name, slug: a.slug, status: a.status, sportName: a.sportName, rehearsal: a.rehearsal, isPublic: a.isPublic }} />
      {children}
    </>
  );
}
