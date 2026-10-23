import { PrintButton } from "@/components/admin/print-button";
import { getAdminAuction, listAdminPlayers, listAdminTeams } from "@/lib/admin/queries";
import { requireAdminPage } from "@/lib/auth/admin";
import { formatDate, formatDateTime, formatPoints } from "@/lib/format";

export const metadata = { title: "Results sheet | Admin", robots: { index: false } };

/** Print-friendly squads and results. Use the browser's Save as PDF. */
export default async function PrintResults({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [a, players, teams] = await Promise.all([getAdminAuction(id), listAdminPlayers(id), listAdminTeams(id)]);
  const roleLabel = (k: string) => a.sportConfig.roles.find((r) => r.key === k)?.label ?? k;
  const unsold = players.filter((p) => p.status === "unsold");
  return (
    <main id="main" className="mx-auto max-w-4xl bg-surface px-6 py-8 text-text print:max-w-none print:px-0">
      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>
      <h1 className="text-3xl uppercase">{a.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {a.sportName}
        {a.startsAt ? `, ${formatDate(a.startsAt)}` : ""}. Amounts are in {a.pointsUnitLabel}. Generated {formatDateTime(new Date())}.
        {a.rehearsal ? " Rehearsal on invented demo data." : ""}
      </p>
      {teams.map((t) => {
        const squad = players.filter((p) => p.soldToTeamId === t.id && (p.status === "sold" || p.status === "retained"));
        return (
          <section key={t.id} className="mt-8 break-inside-avoid">
            <h2 className="text-xl uppercase">{t.name}</h2>
            <p className="text-sm text-muted">
              {squad.length} players. Spent {formatPoints(t.purseSpent)} of {formatPoints(t.purseTotal)}, {formatPoints(t.purseTotal - t.purseSpent)} left.
              {t.ownerDisplayName ? ` Owner: ${t.ownerDisplayName}.` : ""}
            </p>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="py-1 pr-2">Lot</th>
                  <th scope="col" className="py-1 pr-2">Player</th>
                  <th scope="col" className="py-1 pr-2">Role</th>
                  <th scope="col" className="py-1 pr-2">How</th>
                  <th scope="col" className="py-1 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {squad.map((p) => (
                  <tr key={p.auctionPlayerId} className="border-b border-line">
                    <td className="num py-1 pr-2">{p.lotNo}</td>
                    <td className="py-1 pr-2">{p.fullName}</td>
                    <td className="py-1 pr-2">{roleLabel(p.roleKey)}{p.subRole ? `, ${p.subRole}` : ""}</td>
                    <td className="py-1 pr-2">{p.status === "retained" ? "Retained" : "Bought"}</td>
                    <td className="num py-1 text-right">{formatPoints(p.soldPrice)}</td>
                  </tr>
                ))}
                {squad.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-1 text-muted">No players.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}
      {unsold.length ? (
        <section className="mt-8">
          <h2 className="text-xl uppercase">Unsold</h2>
          <p className="mt-1 text-sm">{unsold.map((p) => `${p.lotNo} ${p.fullName}`).join(", ")}</p>
        </section>
      ) : null}
    </main>
  );
}
