import { siteConfig } from "@config";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { BackToTop, FloatingContact, ScrollProgress } from "@/components/layout/page-utilities";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <ScrollProgress />
      <SiteHeader brand={siteConfig.brandName} />
      <main id="main" tabIndex={-1} className="flex-1 pb-24 outline-none">
        {children}
      </main>
      <SiteFooter />
      <BackToTop />
      <FloatingContact />
      <CookieConsent />
    </div>
  );
}
