import type { Metadata } from "next";
import { LegalPage } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";
import { privacySections } from "@/lib/legal/content";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.legal.privacyTitle"), description: t("pages.legal.privacyDescription"), path: "/privacy" });
}

export default async function Page() {
  const { t } = await getT();
  return <LegalPage title={t("pages.legal.privacyTitle")} sections={privacySections()} />;
}
