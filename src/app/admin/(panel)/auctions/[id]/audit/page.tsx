import { AuditTable } from "@/components/admin/audit-table";
import { listAudit } from "@/lib/admin/audit";

export const metadata = { title: "Auction audit | Admin" };

export default async function AuctionAuditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ group?: string; before?: string }> }) {
  const { id } = await params;
  const { group = "", before } = await searchParams;
  const rows = await listAudit({ auctionId: id, prefix: group, beforeId: before ? Number(before) || undefined : undefined });
  return <AuditTable rows={rows} basePath={`/admin/auctions/${id}/audit`} prefix={group} showAuction={false} exportHref={`/api/admin/audit?auctionId=${id}&group=${encodeURIComponent(group)}`} />;
}
