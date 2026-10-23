import type { Metadata } from "next";
import { ObsOverlay } from "@/components/live/overlay";
import { getPublicSnapshot } from "@/lib/data/public";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("screen.overlayTitle", { name: s.auction.name }), description: t("meta.overlay", { name: s.auction.name }), path: `/auctions/${slug}/overlay`, noIndex: true });
}

export default async function OverlayPage() {
  const { t } = await getT();
  return (
    <>
      <h1 className="sr-only">{t("screen.overlayHeading")}</h1>
      <ObsOverlay />
    </>
  );
}
