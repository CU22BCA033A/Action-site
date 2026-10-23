import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { RoleChip } from "@/components/auction/identity";
import { listSportsAdmin } from "@/lib/admin/queries";

export const metadata = { title: "Sports | Admin" };

export default async function SportsAdminPage() {
  const sports = await listSportsAdmin();
  return (
    <>
      <AdminPageHeader title="Sports" description="Roles, categories, stats and default rules for each sport. These are data you can edit: new auctions use them, existing auctions keep their own rules." />
      <ul className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 sm:px-6">
        {sports.map((s) => (
          <li key={s.id}>
            <Link href={`/admin/sports/${s.key}`} className="flex h-full flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-5 hover:border-line-strong">
              <span className="display text-2xl font-bold uppercase">{s.name}</span>
              <span className="flex flex-wrap gap-1.5">
                {s.config.roles.filter((r) => !r.hidden).map((r, i) => <RoleChip key={r.key} size="sm" label={r.label} index={i} />)}
              </span>
              <span className="text-sm text-muted">{s.config.statFields.length} stat fields, {s.config.categories.length ? `categories ${s.config.categories.join(", ")}` : "no categories"}, used by {s.auctionCount} auctions</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
