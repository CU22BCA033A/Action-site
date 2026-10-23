import type { Metadata } from "next";
import { AdminShell } from "@/components/admin/admin-shell";
import { SkipLink } from "@/components/layout/skip-link";
import { requireAdminPage } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage();
  const rows = await db()<{ inbox: number; deletions: number }[]>`
    select (select count(*)::int from app.contact_messages where status = 'new') as inbox,
           (select count(*)::int from app.deletion_requests where status in ('received','verified')) as deletions`;
  return (
    <>
      <SkipLink />
      <AdminShell counts={rows[0] ?? { inbox: 0, deletions: 0 }}>{children}</AdminShell>
    </>
  );
}
