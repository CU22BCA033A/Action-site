import { Check, Circle, ExternalLink, MonitorPlay, Projector } from "lucide-react";
import Link from "next/link";
import { AdminSection } from "@/components/admin/admin-shell";
import { CopyButton } from "@/components/ui/copy-button";
import { getAdminAuction, listAdminPlayers, listAdminTeams, listRegistrations } from "@/lib/admin/queries";
import { validateSlabs } from "@/lib/rules/slabs";
import { absoluteUrl } from "@/lib/site";

export const metadata = { title: "Auction overview | Admin" };

export default async function AuctionOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, teams, players, regs] = await Promise.all([getAdminAuction(id), listAdminTeams(id), listAdminPlayers(id), listRegistrations(id)]);
  const base = `/admin/auctions/${id}`;
  const slabProblem = validateSlabs(a.slabs);
  const codes = teams.filter((t) => t.codeActive).length;
  const pending = regs.filter((r) => r.status === "pending").length;
  const steps = [
    { done: !slabProblem, title: "Rules and bid slabs", detail: slabProblem ? slabProblem.message : `${a.slabs.length} slabs, squad ${a.squadMin} to ${a.squadMax}, purse ${a.purse} ${a.pointsUnitLabel} by default`, href: `${base}/settings` },
    { done: teams.length >= 2, title: "Teams with their purses", detail: `${teams.length} teams`, href: `${base}/teams` },
    { done: codes === teams.length && teams.length > 0, title: "Access codes for team owners", detail: `${codes} of ${teams.length} teams have a code`, href: `${base}/teams` },
    { done: players.length > 0, title: "Players", detail: `${players.length} players${pending ? `, ${pending} registrations waiting for review` : ""}`, href: `${base}/players` },
    { done: players.length > 0, title: "Queue order and sets", detail: `${new Set(players.map((p) => p.setName)).size} sets`, href: `${base}/queue` },
    { done: a.status !== "draft", title: "Publish or go live", detail: `Status: ${a.status}`, href: base },
  ];
  const publicUrl = absoluteUrl(`/auctions/${a.slug}`);
  const joinUrl = absoluteUrl("/join");
  const registerUrl = absoluteUrl(`/auctions/${a.slug}/register`);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
      <AdminSection title="Setup checklist" description="Work down the list. Each step links to the screen that does it.">
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Link href={s.href} className="flex items-start gap-3 rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3 hover:border-line-strong">
                <span className={`mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-sold text-sold-ink" : "border border-line-strong text-muted"}`}>
                  {s.done ? <Check className="size-4" aria-hidden="true" /> : <Circle className="size-2.5" aria-hidden="true" />}
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {i + 1}. {s.title}
                    <span className="sr-only">{s.done ? " (done)" : " (to do)"}</span>
                  </span>
                  <span className="block text-sm text-muted">{s.detail}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </AdminSection>
      <div className="flex flex-col gap-6">
        <AdminSection title="Links to share">
          <dl className="flex flex-col gap-4 text-sm">
            <div>
              <dt className="font-semibold">Public live page</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="num min-w-0 break-all text-muted">{publicUrl}</code>
                <CopyButton value={publicUrl} />
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Team owner join page</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="num min-w-0 break-all text-muted">{joinUrl}</code>
                <CopyButton value={joinUrl} />
              </dd>
            </div>
            <div>
              <dt className="font-semibold">Player registration</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="num min-w-0 break-all text-muted">{registerUrl}</code>
                <CopyButton value={registerUrl} />
              </dd>
              <dd className="mt-1 text-muted">{a.registrationOpen ? "Open. Turn it off in Rules." : "Closed. Turn it on in Rules."}</dd>
            </div>
          </dl>
        </AdminSection>
        <AdminSection title="Screens">
          <ul className="flex flex-col gap-2 text-sm">
            <li>
              <Link className="link inline-flex items-center gap-2" href={`/auctions/${a.slug}`} target="_blank">
                <ExternalLink className="size-4" aria-hidden="true" /> Public live view
              </Link>
            </li>
            <li>
              <Link className="link inline-flex items-center gap-2" href={`/auctions/${a.slug}/screen`} target="_blank">
                <Projector className="size-4" aria-hidden="true" /> Projector screen
              </Link>
            </li>
            <li>
              <Link className="link inline-flex items-center gap-2" href={`/auctions/${a.slug}/overlay`} target="_blank">
                <MonitorPlay className="size-4" aria-hidden="true" /> Broadcast overlay for OBS
              </Link>
            </li>
          </ul>
          {a.status === "draft" ? <p className="mt-3 text-sm text-muted">Public screens open once the auction is published.</p> : null}
        </AdminSection>
      </div>
    </div>
  );
}
