import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ManagerConsole } from "@/components/manager/manager-console";
import { SkipLink } from "@/components/layout/skip-link";
import { requireTeamPage } from "@/lib/auth/team";
import { getManagerSnapshot } from "@/lib/data/manager";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("manager.metaTitle"), description: t("manager.metaDescription"), path: "/manager", noIndex: true });
}

/** Team console. No site chrome: nothing may cover the bid button. */
export default async function ManagerPage() {
  const session = await requireTeamPage();
  const snapshot = await getManagerSnapshot(session);
  if (!snapshot) notFound();
  return (
    <>
      <SkipLink />
      <ManagerConsole initial={snapshot} />
    </>
  );
}
