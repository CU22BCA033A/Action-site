import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar, RoleChip } from "@/components/auction/identity";
import { LiveRefresh } from "@/components/live/live-refresh";
import { getPublicSnapshot, listAuctionPlayers } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("auction.queueTitle", { name: s.auction.name }), description: t("meta.auctionQueue", { name: s.auction.name }), path: `/auctions/${slug}/queue`, noIndex: s.auction.rehearsal });
}

export default async function QueuePage({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t } = await getT();
  const config = s.auction.sportConfig;
  const waiting = (await listAuctionPlayers(s.auction.id)).filter((p) => p.status === "pool");
  const sets: { name: string; items: typeof waiting }[] = [];
  for (const p of waiting) {
    const last = sets.at(-1);
    if (last && last.name === p.setName) last.items.push(p);
    else sets.push({ name: p.setName, items: [p] });
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <h2 className="text-2xl">{t("auction.queueTitle", { name: s.auction.name })}</h2>
      <p className="mt-2 max-w-2xl text-muted">{t("auction.queueIntro")}</p>
      {sets.length === 0 ? (
        <p className="mt-8 rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{t("auction.queueEmpty")}</p>
      ) : (
        <div className="mt-6 flex flex-col gap-8">
          {sets.map((set, si) => (
            <section key={`${set.name}-${si}`} aria-labelledby={`set-${si}`}>
              <h3 id={`set-${si}`} className="mb-3 flex items-baseline gap-3 text-lg">
                {set.name}
                <span className="text-sm font-semibold text-muted">{t("auction.setCount", { n: set.items.length })}</span>
              </h3>
              <ol className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
                {set.items.map((p) => {
                  const ri = Math.max(0, config.roles.findIndex((r) => r.key === p.roleKey));
                  return (
                    <li key={p.auctionPlayerId} className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
                      <span className="num w-12 shrink-0 text-sm font-bold text-info">#{String(p.lotNo).padStart(3, "0")}</span>
                      <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
                      <div className="min-w-0 flex-1">
                        <Link href={`/players/${p.id}`} className="block truncate font-bold hover:underline">
                          {p.fullName}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <RoleChip size="sm" label={config.roles[ri]?.label ?? p.roleKey} index={ri} subRole={p.subRole} />
                          {p.category ? <span className="text-xs text-muted">{p.category}</span> : null}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num font-bold">{formatPoints(p.basePrice)}</p>
                        <p className="text-xs text-muted">{t("auction.base")}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
