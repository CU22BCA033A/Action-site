import type { Metadata } from "next";
import { LiveView } from "@/components/live/live-view";
import { getPublicSnapshot } from "@/lib/data/public";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return { title: t("common.pageNotFound") };
  return pageMeta({
    title: t("meta.auctionLive.title", { name: s.auction.name }),
    description: t("meta.auctionLive.description", { name: s.auction.name, sport: s.auction.sportName, teams: s.teams.length }),
    path: `/auctions/${slug}`,
    noIndex: s.auction.rehearsal,
  });
}

export default function AuctionLivePage() {
  return <LiveView />;
}
