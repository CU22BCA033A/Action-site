import type { Metadata } from "next";
import { NotFoundBody } from "@/components/content/not-found-body";
import { SiteChrome } from "@/components/layout/site-chrome";
import { getT } from "@/lib/i18n/server";
import { pageTitle } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return { title: pageTitle(t("errors.notFoundTitle")), description: t("errors.notFoundBody"), robots: { index: false, follow: true } };
}

export default function NotFound() {
  return (
    <SiteChrome>
      <NotFoundBody />
    </SiteChrome>
  );
}
