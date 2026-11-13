import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { DeletionCard, type DeletionRequest } from "@/components/admin/inbox-manager";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const metadata = { title: "Deletion requests | Admin", robots: { index: false } };

/**
 * Data deletion requests from /data-deletion. Each one shows the matching
 * player registration when the requester gave its reference, and a status
 * and note that the requester sees on /data-deletion/status.
 */
export default async function DeletionRequestsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  // All requests by default, open ones first, so a saved card stays on screen with its confirmation.
  const { show = "all" } = await searchParams;
  const open = show === "open";
  const sql = db();
  const rows = await sql<{
    id: string; reference: string; name: string; contact: string; registrationRef: string | null; details: string;
    status: DeletionRequest["status"]; note: string; createdAt: Date;
    regId: string | null; regAuctionId: string | null; regAuctionName: string | null; regName: string | null; regStatus: string | null;
  }[]>`
    select d.id, d.reference_id as reference, d.requester_name as name, d.requester_contact as contact,
      d.registration_reference_id as "registrationRef", d.details, d.status, d.status_note as note, d.created_at as "createdAt",
      r.id as "regId", r.auction_id as "regAuctionId", a.name as "regAuctionName", r.full_name as "regName", r.status as "regStatus"
    from app.deletion_requests d
    left join app.player_registrations r on r.reference_id = d.registration_reference_id
    left join app.auctions a on a.id = r.auction_id
    where ${open ? sql`d.status in ('received','verified')` : sql`true`}
    order by (d.status in ('received','verified')) desc, d.created_at desc limit 200`;
  const requests: DeletionRequest[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    name: r.name,
    contact: r.contact,
    registrationRef: r.registrationRef,
    details: r.details,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    match: r.regId && r.regAuctionId ? { registrationId: r.regId, auctionId: r.regAuctionId, auctionName: r.regAuctionName ?? "", fullName: r.regName ?? "", status: r.regStatus ?? "" } : null,
  }));
  return (
    <>
      <AdminPageHeader
        title="Deletion requests"
        description="Requests to delete personal data. The privacy policy promises action within 30 days. The requester sees the status and your note on the public status page with their reference number."
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav aria-label="Filter requests" className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "All (open first)" },
            { key: "open", label: "Open only" },
          ].map((f) => (
            <Link
              key={f.key}
              href={`/admin/deletion-requests?show=${f.key}`}
              aria-current={(open ? "open" : "all") === f.key ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-muted hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {requests.length === 0 ? <p className="mt-8 text-muted">No requests here.</p> : null}
        <ul className="mt-6 flex flex-col gap-4">
          {requests.map((r) => (
            <DeletionCard key={r.id} r={r} />
          ))}
        </ul>
      </div>
    </>
  );
}
