import { permanentRedirect } from "next/navigation";

/**
 * The public site shows only the sport of each published auction, never the
 * full catalogue. Old links to the sports list land on the auctions page.
 */
export default function SportsPage() {
  permanentRedirect("/auctions");
}
