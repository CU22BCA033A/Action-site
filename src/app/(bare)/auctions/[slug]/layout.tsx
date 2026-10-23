import { notFound } from "next/navigation";
import { ForceDark } from "@/components/live/force-dark";
import { LiveProvider } from "@/components/live/live-provider";
import { getPublicSnapshot } from "@/lib/data/public";

/** Projector and overlay views: no site chrome, no banners, no controls. */
export default async function BareAuctionLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snapshot = await getPublicSnapshot(slug);
  if (!snapshot) notFound();
  return (
    <LiveProvider initial={snapshot} snapshotUrl={`/api/auctions/${slug}/snapshot`}>
      <ForceDark />
      {children}
    </LiveProvider>
  );
}
