import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { SportEditor } from "@/components/admin/sport-editor";
import { listPresets, listSportsAdmin } from "@/lib/admin/queries";
import { db } from "@/lib/db";

export const metadata = { title: "Edit sport | Admin" };

export default async function SportEditPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const sport = (await listSportsAdmin()).find((s) => s.key === key);
  if (!sport) notFound();
  const [presets, roleRows, catRows] = await Promise.all([
    listPresets(sport.id),
    db()<{ k: string; n: number }[]>`select role_key as k, count(*)::int as n from app.players where sport_id = ${sport.id} and deleted_at is null group by role_key`,
    db()<{ k: string; n: number }[]>`select category as k, count(*)::int as n from app.players where sport_id = ${sport.id} and deleted_at is null and category is not null group by category`,
  ]);
  return (
    <>
      <AdminPageHeader title={sport.name} back={{ href: "/admin/sports", label: "All sports" }} description="Changes here apply to new auctions and to forms. Existing auctions keep the rules they were created with." />
      <SportEditor
        key={sport.version}
        sport={{ id: sport.id, key: sport.key, name: sport.name, version: sport.version, config: sport.config }}
        presets={presets.map((p) => ({ id: p.id, name: p.name, description: p.description, isExample: p.isExample }))}
        usage={{ roles: Object.fromEntries(roleRows.map((r) => [r.k, r.n])), categories: Object.fromEntries(catRows.map((r) => [r.k, r.n])) }}
      />
    </>
  );
}
