import { QueueBuilder } from "@/components/admin/queue-builder";
import { getAdminAuction, listAdminPlayers } from "@/lib/admin/queries";

export const metadata = { title: "Queue | Admin" };

export default async function QueuePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a, players] = await Promise.all([getAdminAuction(id), listAdminPlayers(id)]);
  // Keyed by a hash of the order, so a save elsewhere loads the fresh queue.
  let hash = 5381;
  for (const ch of players.map((p) => `${p.auctionPlayerId}${p.setName}${p.setOrder}${p.queuePosition}${p.status}`).join("|")) hash = ((hash * 33) ^ ch.charCodeAt(0)) >>> 0;
  const key = String(hash);
  return <QueueBuilder key={key} players={players} ctx={{ auctionId: a.id, config: a.sportConfig, unit: a.pointsUnitLabel }} />;
}
