import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TeamMark } from "@/components/auction/identity";
import { LiveRefresh } from "@/components/live/live-refresh";
import { getPublicSnapshot } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("auction.teamsTitle", { name: s.auction.name }), description: t("meta.auctionTeams", { name: s.auction.name, n: s.teams.length }), path: `/auctions/${slug}/teams`, noIndex: s.auction.rehearsal });
}

export default async function TeamsPage({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t } = await getT();
  const a = s.auction;
  const roles = a.sportConfig.roles.filter((r) => !r.hidden);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <h2 className="text-2xl">{t("auction.teamsTitle", { name: a.name })}</h2>
      <p className="mt-2 max-w-2xl text-muted">{t("auction.teamsIntro")}</p>
      {s.teams.length === 0 ? (
        <p className="mt-8 text-muted">{t("live.noTeams")}</p>
      ) : (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {s.teams.map((team) => {
            const pct = team.purseTotal ? Math.round((team.purseSpent / team.purseTotal) * 100) : 0;
            return (
              <li key={team.id} className="flex flex-col rounded-[var(--radius-md)] border border-line bg-surface">
                <div className="flex items-center gap-3 border-b border-line p-4" style={{ borderTop: `4px solid ${team.primaryColor}` }}>
                  <TeamMark team={team} size={56} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0">
                    <h3 className="text-lg">{team.name}</h3>
                    {team.ownerDisplayName ? <p className="text-sm text-muted">{t("auction.owner", { name: team.ownerDisplayName })}</p> : null}
                  </div>
                </div>
                <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
                  <div className="p-3">
                    <dt className="text-xs text-muted">{t("auction.purse")}</dt>
                    <dd className="num font-bold">{formatPoints(team.purseTotal)}</dd>
                  </div>
                  <div className="p-3">
                    <dt className="text-xs text-muted">{t("auction.spent")}</dt>
                    <dd className="num font-bold text-spent">{formatPoints(team.purseSpent)}</dd>
                  </div>
                  <div className="p-3">
                    <dt className="text-xs text-muted">{t("auction.left")}</dt>
                    <dd className="num font-bold text-remaining">{formatPoints(team.purseLeft)}</dd>
                  </div>
                </dl>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-semibold">{t("auction.squadOf", { n: team.squadCount, max: a.squadMax })}</span>
                      <span className="text-muted">{t("auction.pctUsed", { pct })}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
                      <div className="h-full bg-spent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-muted">{t("auction.roleCounts")}</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {roles.map((r) => {
                        const n = team.roleCounts[r.key] ?? 0;
                        const min = a.roleMinimums[r.key];
                        const met = min === undefined || n >= min;
                        return (
                          <li key={r.key} className={`rounded-[var(--radius-xs)] border px-2 py-1 text-xs font-semibold ${met ? "border-line-strong" : "border-accent-edge text-accent-text"}`}>
                            {min !== undefined ? t("auction.roleProgress", { role: r.label, n, min }) : t("auction.roleCount", { role: r.label, n })}
                            {!met ? <span className="sr-only">{` ${t("auction.needMore")}`}</span> : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <p className="text-sm text-muted">
                    {t("auction.overseasCount", { n: team.overseasCount, max: a.maxOverseas })}
                    {a.rtmEnabled ? `. ${t("auction.rtmCards", { label: a.rtmLabel, n: team.rtmCardsLeft })}` : ""}
                  </p>
                  <Link href={`/teams/${team.id}`} className="link mt-auto self-start font-semibold">
                    {t("auction.viewSquad")}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
