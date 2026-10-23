import { notFound } from "next/navigation";
import { AuctionConsole } from "@/components/admin/auction-console";
import { getConsoleSnapshot } from "@/lib/admin/console-data";

export const metadata = { title: "Console | Admin" };

export default async function ConsolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getConsoleSnapshot(id);
  if (!data) notFound();
  return <AuctionConsole initial={data} auctionId={id} />;
}
