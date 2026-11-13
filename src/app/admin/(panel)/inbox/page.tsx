import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { MessageCard, type InboxMessage } from "@/components/admin/inbox-manager";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";

export const metadata = { title: "Contact inbox | Admin", robots: { index: false } };

const FILTERS = [
  { key: "all", label: "All (new first)" },
  { key: "new", label: "New" },
  { key: "open", label: "Not archived" },
  { key: "archived", label: "Archived" },
] as const;

/** Messages sent from the public contact form. */
export default async function InboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();
  // All by default, new first and archived last, so a changed card stays on screen with its confirmation.
  const { show = "all" } = await searchParams;
  const filter = FILTERS.some((f) => f.key === show) ? show : "all";
  const sql = db();
  const rows = await sql<(Omit<InboxMessage, "utm" | "createdAt"> & { createdAt: Date; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null })[]>`
    select id, reference_id as reference, name, email, message, status, created_at as "createdAt",
      utm_source as "utmSource", utm_medium as "utmMedium", utm_campaign as "utmCampaign"
    from app.contact_messages
    where ${filter === "all" ? sql`true` : filter === "open" ? sql`status <> 'archived'` : sql`status = ${filter}`}
    order by case status when 'new' then 0 when 'read' then 1 else 2 end, created_at desc limit 200`;
  const counts = (await sql<{ fresh: number }[]>`select count(*) filter (where status = 'new')::int as fresh from app.contact_messages`)[0];
  const messages: InboxMessage[] = rows.map((r) => ({
    id: r.id,
    reference: r.reference,
    name: r.name,
    email: r.email,
    message: r.message,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    utm: [r.utmSource, r.utmMedium, r.utmCampaign].filter(Boolean).join(" / "),
  }));
  return (
    <>
      <AdminPageHeader
        title="Contact inbox"
        description={`Messages from the contact form. ${counts?.fresh ?? 0} new. Reply by email; the address is a link. The campaign source shows only when the sender allowed it.`}
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav aria-label="Filter messages" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/inbox?show=${f.key}`}
              aria-current={filter === f.key ? "page" : undefined}
              className="inline-flex min-h-10 items-center rounded-full border border-line px-4 text-sm font-semibold text-muted hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
            >
              {f.label}
            </Link>
          ))}
        </nav>
        {messages.length === 0 ? <p className="mt-8 text-muted">No messages here.</p> : null}
        <ul className="mt-6 flex flex-col gap-4">
          {messages.map((m) => (
            <MessageCard key={m.id} m={m} />
          ))}
        </ul>
      </div>
    </>
  );
}
