import { ChevronDown } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/content/page-header";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.faq.metaTitle"), description: t("pages.faq.metaDescription"), path: "/faq" });
}

const nums = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export default async function FaqPage() {
  const { t } = await getT();
  const items = nums.map((n) => ({ q: t(`pages.faq.q${n}`), a: t(`pages.faq.a${n}`) }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
  return (
    <>
      <PageHeader title={t("pages.faq.title")} intro={t("pages.faq.intro")} />
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
          {items.map((i, idx) => (
            <details key={i.q} className="group" open={idx === 0}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold [&::-webkit-details-marker]:hidden">
                <span className="text-lg">{i.q}</span>
                <ChevronDown className="size-5 shrink-0 text-muted group-open:rotate-180" aria-hidden="true" />
              </summary>
              <p className="px-5 pb-5 text-muted">{i.a}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-muted">
          <Link href="/how-it-works" className="link font-semibold text-accent-text">
            {t("home.howLink")}
          </Link>
          {" · "}
          <Link href="/contact" className="link font-semibold text-accent-text">
            {t("nav.contact")}
          </Link>
        </p>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </>
  );
}
