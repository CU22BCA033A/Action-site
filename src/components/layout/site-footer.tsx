import Link from "next/link";
import { siteConfig } from "@config";
import { LogoMark } from "@/components/brand/logo";
import { getT } from "@/lib/i18n/server";
import { CookieSettingsLink } from "./cookie-consent";

export async function SiteFooter() {
  const { t } = await getT();
  const year = new Date().getFullYear();
  const entity = siteConfig.legalEntityName || siteConfig.brandName;
  const phoneHref = siteConfig.contactPhone ? `tel:${siteConfig.contactPhone.replace(/[^+\d]/g, "")}` : null;

  const product = [
    { href: "/auctions", label: t("nav.auctions") },
    { href: "/how-it-works", label: t("nav.howItWorks") },
    { href: "/sports", label: t("nav.sports") },
    { href: "/faq", label: t("nav.faq") },
    { href: "/join", label: t("nav.join") },
    { href: "/search", label: t("nav.search") },
    { href: "/contact", label: t("nav.contact") },
    { href: "/admin/login", label: t("nav.admin") },
  ];
  const legal = [
    { href: "/privacy", label: t("footer.privacy") },
    { href: "/terms", label: t("footer.terms") },
    { href: "/refund-policy", label: t("footer.refund") },
    { href: "/cookies", label: t("footer.cookies") },
    { href: "/data-deletion", label: t("footer.dataDeletion") },
    { href: "/data-deletion/status", label: t("footer.deletionStatus") },
    { href: "/licenses", label: t("footer.licenses") },
  ];

  return (
    <footer className="mt-auto border-t border-line bg-bg-sunken">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.3fr_1fr_1fr_1.4fr]">
        <div className="flex flex-col gap-4">
          <Link href="/" className="inline-flex w-fit items-center gap-2.5" aria-label={siteConfig.brandName ? `${siteConfig.brandName}, ${t("nav.home")}` : t("nav.home")}>
            <LogoMark className="size-9" />
            {siteConfig.brandName ? <span className="display text-xl font-extrabold">{siteConfig.brandName}</span> : null}
          </Link>
          <p className="max-w-xs text-sm text-muted">{t("footer.virtualPoints")}</p>
        </div>

        <nav aria-label={t("footer.product")}>
          <h2 className="mb-3 font-sans text-sm font-bold text-text">{t("footer.product")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {product.map((l) => (
              <li key={l.href}>
                <Link className="link text-muted hover:text-text" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t("footer.legal")}>
          <h2 className="mb-3 font-sans text-sm font-bold text-text">{t("footer.legal")}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {legal.map((l) => (
              <li key={l.href}>
                <Link className="link text-muted hover:text-text" href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsLink />
            </li>
          </ul>
        </nav>

        <div>
          <h2 className="mb-3 font-sans text-sm font-bold text-text">{t("footer.company")}</h2>
          <dl className="flex flex-col gap-3 text-sm">
            {siteConfig.legalEntityName ? (
              <div>
                <dt className="sr-only">{t("footer.company")}</dt>
                <dd className="font-semibold text-text">{siteConfig.legalEntityName}</dd>
              </div>
            ) : null}
            {siteConfig.registeredAddress ? (
              <div>
                <dt className="text-faint">{t("footer.address")}</dt>
                <dd className="whitespace-pre-line text-muted">{siteConfig.registeredAddress}</dd>
              </div>
            ) : null}
            {siteConfig.contactEmail ? (
              <div>
                <dt className="text-faint">{t("footer.email")}</dt>
                <dd>
                  <a className="link text-muted hover:text-text" href={`mailto:${siteConfig.contactEmail}`}>
                    {siteConfig.contactEmail}
                  </a>
                </dd>
              </div>
            ) : null}
            {phoneHref ? (
              <div>
                <dt className="text-faint">{t("footer.phone")}</dt>
                <dd>
                  <a className="link text-muted hover:text-text" href={phoneHref}>
                    {siteConfig.contactPhone}
                  </a>
                </dd>
              </div>
            ) : null}
            {siteConfig.grievanceOfficerName || siteConfig.grievanceOfficerEmail ? (
              <div>
                <dt className="text-faint">{t("footer.grievance")}</dt>
                <dd className="text-muted">
                  {siteConfig.grievanceOfficerName}
                  {siteConfig.grievanceOfficerEmail ? (
                    <>
                      {siteConfig.grievanceOfficerName ? <br /> : null}
                      <a className="link hover:text-text" href={`mailto:${siteConfig.grievanceOfficerEmail}`}>
                        {siteConfig.grievanceOfficerEmail}
                      </a>
                    </>
                  ) : null}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-sm text-faint sm:px-6">
          <p>{t("footer.rights", { year, entity })}</p>
        </div>
      </div>
    </footer>
  );
}
