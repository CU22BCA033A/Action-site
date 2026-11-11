import type { Metadata } from "next";
import { CookieSettingsLink } from "@/components/layout/cookie-consent";
import { LegalPage } from "@/components/legal/legal-page";
import { getT } from "@/lib/i18n/server";
import { cookieRows, cookieSections } from "@/lib/legal/content";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.legal.cookiesTitle"), description: t("pages.legal.cookiesDescription"), path: "/cookies" });
}

export default async function CookiesPage() {
  const { t } = await getT();
  const table = (
    <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-line">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead className="bg-surface-2 text-xs uppercase tracking-wider text-muted">
          <tr>
            <th scope="col" className="p-3">Name</th>
            <th scope="col" className="p-3">Purpose</th>
            <th scope="col" className="p-3">Lasts</th>
            <th scope="col" className="p-3">Type</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {cookieRows().map((r) => (
            <tr key={r.name}>
              <th scope="row" className="p-3 font-mono font-semibold">{r.name}</th>
              <td className="p-3 text-muted">{r.purpose}</td>
              <td className="p-3 text-muted">{r.duration}</td>
              <td className="p-3">{r.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <LegalPage
      title={t("pages.legal.cookiesTitle")}
      sections={cookieSections()}
      extra={{ list: table, control: <p className="mt-3"><CookieSettingsLink /></p> }}
    />
  );
}
