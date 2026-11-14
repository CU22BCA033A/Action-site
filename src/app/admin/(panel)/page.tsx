import { Plus } from "lucide-react";
import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { Badge, statusTone } from "@/components/ui/badges";
import { ButtonLink } from "@/components/ui/button";
import { listAdminAuctions } from "@/lib/admin/queries";
import { formatDateTime } from "@/lib/format";
import { siteUrlMismatch } from "@/lib/site";

export const metadata = { title: "Auctions | Admin" };

export default async function AdminDashboard() {
  const auctions = await listAdminAuctions();
  const mismatch = siteUrlMismatch();
  return (
    <>
      <AdminPageHeader
        title="Auctions"
        description="Every auction you run, newest first. Open one to set rules, add teams and players, and run the floor."
        actions={
          <ButtonLink href="/admin/auctions/new" variant="primary" icon={<Plus className="size-5" aria-hidden="true" />}>
            New auction
          </ButtonLink>
        }
      />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {mismatch ? (
          <div role="alert" className="mb-6 rounded-[var(--radius-md)] border border-warning bg-[color-mix(in_srgb,var(--warning)_10%,transparent)] p-4 text-sm">
            <p className="font-semibold">The SITE_URL setting in Vercel does not match this site.</p>
            <p className="mt-1 text-muted">
              It is set to <span className="font-mono text-text">{mismatch.configured}</span>, but this site is{" "}
              <span className="font-mono text-text">{mismatch.actual}</span>. Shared links already use the right address. To tidy up, open Vercel,
              Settings, Environment Variables, and change SITE_URL to <span className="font-mono text-text">{mismatch.actual}</span> or delete it, then redeploy.
            </p>
          </div>
        ) : null}
        {auctions.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
            <h2 className="text-2xl">No auctions yet</h2>
            <p className="mt-2 text-muted">Create your first auction, then add its teams and players. To practise first, create a private test auction and delete it afterwards.</p>
          </div>
        ) : (
          <ul className="grid gap-3">
            {auctions.map((a) => (
              <li key={a.id}>
                <Link href={`/admin/auctions/${a.id}`} className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 hover:border-line-strong sm:grid-cols-[1fr_auto] sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={statusTone(a.status)}>{a.status}</Badge>
                      {a.rehearsal ? <Badge tone="accent">Rehearsal</Badge> : null}
                      {!a.public ? <Badge>Private</Badge> : null}
                      <span className="text-sm text-muted">{a.sportName}</span>
                    </div>
                    <p className="display mt-2 truncate text-xl font-bold uppercase">{a.name}</p>
                    <p className="text-sm text-muted">
                      /{a.slug}
                      {a.startsAt ? ` / ${formatDateTime(a.startsAt)}` : ""}
                    </p>
                  </div>
                  <dl className="num grid grid-cols-4 gap-4 text-center text-sm">
                    <div>
                      <dt className="text-muted">Teams</dt>
                      <dd className="text-lg font-bold">{a.teamCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Players</dt>
                      <dd className="text-lg font-bold">{a.playerCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Sold</dt>
                      <dd className="text-lg font-bold text-sold">{a.soldCount}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Pending</dt>
                      <dd className={`text-lg font-bold ${a.pendingRegistrations ? "text-accent-text" : ""}`}>{a.pendingRegistrations}</dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
