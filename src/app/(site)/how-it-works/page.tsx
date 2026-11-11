import type { Metadata } from "next";
import { siteConfig } from "@config";
import { OnThisPage, PageHeader } from "@/components/content/page-header";
import { ButtonLink } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.how.metaTitle"), description: t("pages.how.metaDescription"), path: "/how-it-works" });
}

const keys = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const ids = ["setup", "players", "owners", "bidding", "limits", "timer", "rtm", "results"];

export default async function HowItWorksPage() {
  const { t, locale } = await getT();
  const sections = keys.map((n, i) => ({
    id: ids[i]!,
    title: t(`pages.how.s${n}Title`),
    body: t(`pages.how.s${n}Body`),
  }));
  return (
    <>
      <PageHeader
        title={t("pages.how.title")}
        intro={t("pages.how.intro")}
        meta={t("common.lastUpdated", { date: formatDate(siteConfig.legalLastUpdated, locale) })}
      />
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <OnThisPage title={t("pages.onThisPage")} items={sections.map((s) => ({ id: s.id, label: s.title }))} />
        </aside>
        <div>
          <ol className="divide-y divide-line">
            {sections.map((s, i) => (
              <li key={s.id} id={s.id} className="scroll-mt-24 py-7 first:pt-0">
                <h2 className="flex items-baseline gap-3 text-xl sm:text-2xl">
                  <span className="num text-accent-text">{i + 1}.</span>
                  <span>{s.title}</span>
                </h2>
                <p className="mt-3 max-w-prose text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-8 sm:flex-row">
            <ButtonLink href="/auctions" variant="primary" size="lg">
              {t("home.ctaWatch")}
            </ButtonLink>
            <ButtonLink href="/faq" variant="secondary" size="lg">
              {t("nav.faq")}
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
