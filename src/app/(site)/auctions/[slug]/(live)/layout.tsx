import { notFound } from "next/navigation";
import { AuctionTabs, AuctionTopBar } from "@/components/live/auction-chrome";
import { LiveProvider } from "@/components/live/live-provider";
import { getPublicSnapshot } from "@/lib/data/public";

export default async function AuctionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getPublicSnapshot(slug);
  if (!snapshot) notFound();
  return (
    <LiveProvider initial={snapshot} snapshotUrl={`/api/auctions/${slug}/snapshot`}>
      <AuctionTopBar />
      <AuctionTabs slug={slug} />
      {children}
    </LiveProvider>
  );
}
