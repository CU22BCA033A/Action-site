import { siteConfig } from "@config";
import { OnThisPage, PageHeader } from "@/components/content/page-header";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { LegalSection } from "@/lib/legal/content";
import type { ReactNode } from "react";

function Value({ value, missing }: { value: string; missing: string }) {
  return value ? <>{value}</> : <span className="italic text-faint">{missing}</span>;
}

/** Business details block. Empty values say so instead of showing invented text. */
export async function BusinessDetails() {
  const { t } = await getT();
  const missing = t("pages.toBeFilled");
  const c = siteConfig;
  const phoneHref = c.contactPhone ? `tel:${c.contactPhone.replace(/[^\d+]/g, "")}` : null;
  return (
    <dl className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-2 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:grid-cols-[12rem_minmax(0,1fr)]">
      <dt className="font-semibold">Operator</dt>
      <dd className="text-muted"><Value value={c.legalEntityName} missing={missing} /></dd>
      <dt className="font-semibold">Registered address</dt>
      <dd className="text-muted"><Value value={c.registeredAddress} missing={missing} /></dd>
      <dt className="font-semibold">Email</dt>
      <dd className="text-muted">{c.contactEmail ? <a className="link" href={`mailto:${c.contactEmail}`}>{c.contactEmail}</a> : <Value value="" missing={missing} />}</dd>
      {phoneHref ? (
        <>
          <dt className="font-semibold">Phone</dt>
          <dd className="text-muted"><a className="link" href={phoneHref}>{c.contactPhone}</a></dd>
        </>
      ) : null}
      <dt className="font-semibold">Grievance officer</dt>
      <dd className="text-muted">
        <Value value={c.grievanceOfficerName} missing={missing} />
        {c.grievanceOfficerEmail ? (
          <>
            {", "}
            <a className="link" href={`mailto:${c.grievanceOfficerEmail}`}>{c.grievanceOfficerEmail}</a>
          </>
        ) : null}
      </dd>
    </dl>
  );
}

export async function LegalPage({ title, sections, extra }: { title: string; sections: LegalSection[]; extra?: Record<string, ReactNode> }) {
  const { t, locale } = await getT();
  return (
    <>
      <PageHeader title={title} meta={t("common.lastUpdated", { date: formatDate(siteConfig.legalLastUpdated, locale) })} />
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside>
          <OnThisPage title={t("pages.onThisPage")} items={sections.map((s) => ({ id: s.id, label: s.title }))} />
        </aside>
        <div lang="en" className="max-w-prose">
          {locale !== "en" ? (
            <p lang={locale} className="mb-6 rounded-[var(--radius-sm)] border border-paused bg-info-surface p-3 text-sm">
              {t("pages.englishOnly")}
            </p>
          ) : null}
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 border-b border-line py-6 first:pt-0 last:border-0">
              <h2 className="text-xl">
                <span className="num mr-2 text-accent-text">{i + 1}.</span>
                {s.title}
              </h2>
              {s.blocks.map((b, j) =>
                b.kind === "p" ? (
                  <p key={j} className="mt-3 text-muted">{b.text}</p>
                ) : b.kind === "list" ? (
                  <ul key={j} className="mt-3 list-disc space-y-2 pl-5 text-muted marker:text-line-strong">
                    {b.items.map((it) => <li key={it}>{it}</li>)}
                  </ul>
                ) : (
                  <BusinessDetails key={j} />
                ),
              )}
              {extra?.[s.id]}
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
