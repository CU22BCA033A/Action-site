import { AdminPageHeader } from "@/components/admin/admin-shell";
import { AuditTable } from "@/components/admin/audit-table";
import { listAudit } from "@/lib/admin/audit";

export const metadata = { title: "Audit log | Admin" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ group?: string; before?: string }> }) {
  const { group = "", before } = await searchParams;
  const rows = await listAudit({ prefix: group, beforeId: before ? Number(before) || undefined : undefined });
  return (
    <>
      <AdminPageHeader title="Audit log" description="Every admin action, bid, rule change and correction across all auctions." />
      <AuditTable rows={rows} basePath="/admin/audit" prefix={group} showAuction exportHref={`/api/admin/audit?group=${encodeURIComponent(group)}`} />
    </>
  );
}
