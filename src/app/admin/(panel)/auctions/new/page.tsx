import { AdminPageHeader } from "@/components/admin/admin-shell";
import { NewAuctionForm } from "@/components/admin/new-auction-form";
import { listPresets, listSportsAdmin } from "@/lib/admin/queries";

export const metadata = { title: "New auction | Admin" };

export default async function NewAuctionPage() {
  const [sports, presets] = await Promise.all([listSportsAdmin(), listPresets()]);
  return (
    <>
      <AdminPageHeader
        title="New auction"
        back={{ href: "/admin", label: "All auctions" }}
        description="Pick the sport and a starting set of rules. Every rule can be changed on the next screen, and again during the auction."
      />
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <NewAuctionForm
          sports={sports.map((s) => ({ id: s.id, name: s.name, roles: s.config.roles.filter((r) => !r.hidden).map((r) => r.label) }))}
          presets={presets.map((p) => ({ id: p.id, sportId: p.sportId, name: p.name, description: p.description, isExample: p.isExample }))}
        />
      </div>
    </>
  );
}
