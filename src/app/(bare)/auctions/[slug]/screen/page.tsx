import type { Metadata } from "next";
import { ProjectorScreen } from "@/components/live/projector";
import { getPublicSnapshot } from "@/lib/data/public";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const s = await getPublicSnapshot(slug);
  const { t } = await getT();
  if (!s) return {};
  return pageMeta({ title: t("screen.title", { name: s.auction.name }), description: t("meta.screen", { name: s.auction.name }), path: `/auctions/${slug}/screen`, noIndex: true });
}

export default function ScreenPage() {
  return <ProjectorScreen />;
}
