import type { Metadata } from "next";
import { PageHeader } from "@/components/content/page-header";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.licenses.metaTitle"), description: t("pages.licenses.metaDescription"), path: "/licenses" });
}

const fonts = [
  { name: "Archivo", use: "Headings, text, prices and timers", licence: "SIL Open Font License 1.1", file: "/licenses/archivo-OFL.txt" },
  { name: "Noto Sans Devanagari", use: "Hindi text", licence: "SIL Open Font License 1.1", file: "/licenses/noto-sans-devanagari-OFL.txt" },
  { name: "Noto Sans Kannada", use: "Kannada text", licence: "SIL Open Font License 1.1", file: "/licenses/noto-sans-kannada-OFL.txt" },
];

function Row({ name, use, licence, file, view }: { name: string; use: string; licence: string; file: string; view: string }) {
  return (
    <li className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="font-bold">{name}</p>
        <p className="text-sm text-muted">{use}</p>
      </div>
      <p className="text-sm">
        {licence}
        {" · "}
        <a className="link font-semibold text-accent-text" href={file}>
          {view}
        </a>
      </p>
    </li>
  );
}

export default async function LicensesPage() {
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t("pages.licenses.title")} intro={t("pages.licenses.intro")} />
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        <section>
          <h2 className="text-xl">{t("pages.licenses.fonts")}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            {fonts.map((f) => (
              <Row key={f.name} {...f} view={t("pages.licenses.view")} />
            ))}
          </ul>
        </section>
        <section>
          <h2 className="text-xl">{t("pages.licenses.icons")}</h2>
          <ul className="mt-2 divide-y divide-line border-y border-line">
            <Row name="Lucide" use="Interface icons" licence="ISC License" file="/licenses/lucide-ISC.txt" view={t("pages.licenses.view")} />
          </ul>
        </section>
        <section>
          <h2 className="text-xl">{t("pages.licenses.images")}</h2>
          <p className="mt-2 text-muted">{t("pages.licenses.imagesBody")}</p>
        </section>
        <section>
          <h2 className="text-xl">{t("pages.licenses.software")}</h2>
          <p className="mt-2 text-muted">{t("pages.licenses.softwareBody")}</p>
        </section>
      </div>
    </>
  );
}
