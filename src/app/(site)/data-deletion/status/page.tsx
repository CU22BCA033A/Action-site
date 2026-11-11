import type { Metadata } from "next";
import { PageHeader } from "@/components/content/page-header";
import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/ui/field";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.deletionStatus.metaTitle"), description: t("pages.deletionStatus.metaDescription"), path: "/data-deletion/status", noIndex: true });
}

type Row = { status: "received" | "verified" | "completed" | "rejected"; note: string; createdAt: Date };

export default async function DeletionStatusPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { t, locale } = await getT();
  const raw = (await searchParams).ref;
  const ref = typeof raw === "string" ? raw.trim().toUpperCase().slice(0, 20) : "";
  const valid = /^DEL-[A-Z0-9]{8}$/.test(ref);
  const row = valid
    ? (await db()<Row[]>`select status, status_note as note, created_at as "createdAt" from app.deletion_requests where reference_id = ${ref}`)[0]
    : undefined;
  return (
    <>
      <PageHeader title={t("pages.deletionStatus.title")} intro={t("pages.deletionStatus.intro")} />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-10 sm:px-6">
        <form method="get" className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <label htmlFor="f-ref" className="text-sm font-semibold">
              {t("pages.deletionStatus.label")}
            </label>
            <input
              id="f-ref"
              name="ref"
              defaultValue={ref}
              required
              maxLength={20}
              placeholder="DEL-XXXXXXXX"
              autoCapitalize="characters"
              spellCheck={false}
              className="num h-11 w-full min-w-0 rounded-[var(--radius-sm)] border border-line bg-bg-sunken px-3 uppercase"
            />
          </div>
          <Button type="submit" variant="primary">
            {t("pages.deletionStatus.submit")}
          </Button>
        </form>
        {ref && !row ? <FormStatus kind="error">{t("pages.deletionStatus.notFound")}</FormStatus> : null}
        {row ? (
          <div className="rounded-[var(--radius-md)] border border-line bg-surface p-5" role="status">
            <p className="num text-sm text-muted">{ref}</p>
            <p className="mt-2 text-lg font-bold">{t(`pages.deletionStatus.state.${row.status}`)}</p>
            <p className="mt-1 text-sm text-muted">{t("pages.deletionStatus.requested", { date: formatDate(row.createdAt, locale) })}</p>
            {row.note ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-sm font-semibold">{t("pages.deletionStatus.note")}</p>
                <p className="mt-1 text-muted">{row.note}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
