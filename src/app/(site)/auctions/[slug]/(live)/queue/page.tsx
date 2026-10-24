import { permanentRedirect } from "next/navigation";

/** The admin picks players in any order, so there is no public queue. Old links land on the player list. */
export default async function QueuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  permanentRedirect(`/auctions/${slug}/players`);
}
