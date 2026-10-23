import { Eye } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { JoinForm } from "@/components/manager/join-form";
import { getTeamSession } from "@/lib/auth/team";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("join.metaTitle"), description: t("join.metaDescription"), path: "/join" });
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ ended?: string }> }) {
  const { t } = await getT();
  const { ended } = await searchParams;
  if (await getTeamSession()) redirect("/manager");
  return (
    <div className="mx-auto flex max-w-lg flex-col px-4 py-12 sm:py-20">
      <h1 className="text-4xl uppercase sm:text-5xl">{t("join.title")}</h1>
      <p className="mt-3 text-lg text-muted">{t("join.intro")}</p>
      <div className="mt-8 rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
        <JoinForm ended={ended === "1"} />
      </div>
      <p className="mt-6 text-muted">{t("join.noAccount")}</p>
      <p className="mt-2">
        <Link href="/auctions" className="link inline-flex items-center gap-2 font-semibold text-accent-text">
          <Eye className="size-4" aria-hidden="true" />
          {t("join.watchInstead")}
        </Link>
      </p>
    </div>
  );
}
