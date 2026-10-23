import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlayersBrowser } from "@/components/auction/players-browser";
import { LiveRefresh } from "@/components/live/live-refresh";
import { getPublicSnapshot, listAuctionPlayers } from "@/lib/data/public";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("auction.playersTitle", { name: s.auction.name }), description: t("meta.auctionPlayers", { name: s.auction.name, n: s.counts.total }), path: `/auctions/${slug}/players`, noIndex: s.auction.rehearsal });
}

export default async function PlayersPage({ params }: Props) {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  if (!s) notFound();
  const { t } = await getT();
  const players = await listAuctionPlayers(s.auction.id);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <LiveRefresh />
      <h2 className="text-2xl">{t("auction.playersTitle", { name: s.auction.name })}</h2>
      <p className="mt-2 mb-6 max-w-2xl text-muted">{t("auction.playersIntro")}</p>
      <PlayersBrowser
        config={s.auction.sportConfig}
        teams={s.teams.map((x) => ({ id: x.id, name: x.name, shortName: x.shortName, logoPath: x.logoPath, primaryColor: x.primaryColor }))}
        players={players.map((p) => ({
          id: p.id, lotNo: p.lotNo, fullName: p.fullName, photoPath: p.photoPath, roleKey: p.roleKey, subRole: p.subRole,
          category: p.category, nationalityGroup: p.nationalityGroup, status: p.status, basePrice: p.basePrice,
          soldPrice: p.soldPrice, soldToTeamId: p.soldToTeamId, setName: p.setName,
        }))}
      />
    </div>
  );
}
