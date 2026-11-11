import { Mail, Phone } from "lucide-react";
import type { Metadata } from "next";
import { siteConfig } from "@config";
import { PageHeader } from "@/components/content/page-header";
import { ContactForm } from "@/components/public/contact-form";
import { getT } from "@/lib/i18n/server";
import { issueFormToken } from "@/lib/security/form-token";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.contact.metaTitle"), description: t("pages.contact.metaDescription"), path: "/contact" });
}

export default async function ContactPage() {
  const { t } = await getT();
  const { contactEmail, contactPhone } = siteConfig;
  const phoneHref = contactPhone ? `tel:${contactPhone.replace(/[^\d+]/g, "")}` : null;
  return (
    <>
      <PageHeader title={t("pages.contact.title")} intro={t("pages.contact.intro")} />
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
          <ContactForm formToken={issueFormToken()} />
        </div>
        <aside className="rounded-[var(--radius-md)] border border-line bg-surface p-5">
          <h2 className="text-lg">{t("pages.contact.direct")}</h2>
          {contactEmail || phoneHref ? (
            <ul className="mt-4 flex flex-col gap-3">
              {contactEmail ? (
                <li>
                  <a href={`mailto:${contactEmail}`} className="link inline-flex min-h-11 items-center gap-2 font-semibold">
                    <Mail className="size-5 text-accent-text" aria-hidden="true" />
                    {contactEmail}
                  </a>
                </li>
              ) : null}
              {phoneHref ? (
                <li>
                  <a href={phoneHref} className="link inline-flex min-h-11 items-center gap-2 font-semibold">
                    <Phone className="size-5 text-accent-text" aria-hidden="true" />
                    {contactPhone}
                  </a>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="mt-3 text-muted">{t("pages.contact.noDirect")}</p>
          )}
        </aside>
      </div>
    </>
  );
}
