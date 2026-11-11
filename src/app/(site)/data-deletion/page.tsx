import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/content/page-header";
import { DeletionForm } from "@/components/public/deletion-form";
import { getT } from "@/lib/i18n/server";
import { issueFormToken } from "@/lib/security/form-token";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.deletion.metaTitle"), description: t("pages.deletion.metaDescription"), path: "/data-deletion" });
}

export default async function DataDeletionPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("pages.deletion.title")} intro={t("pages.deletion.intro")} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
          <DeletionForm formToken={issueFormToken()} />
        </div>
        <p className="mt-6">
          <Link href="/data-deletion/status" className="link font-semibold text-accent-text">
            {t("pages.deletion.statusLink")}
          </Link>
        </p>
      </div>
    </>
  );
}
