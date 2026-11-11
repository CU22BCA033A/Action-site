import type { Metadata } from "next";
import { PageHeader } from "@/components/content/page-header";
import { RoleChip } from "@/components/auction/identity";
import { listSports } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";
import { visibleRoles } from "@/lib/sports/config";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("pages.sports.metaTitle"), description: t("pages.sports.metaDescription"), path: "/sports" });
}

export default async function SportsPage() {
  const { t } = await getT();
  const sports = await listSports();
  return (
    <>
      <PageHeader title={t("pages.sports.title")} intro={t("pages.sports.intro")} />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        {sports.length === 0 ? <p className="text-muted">{t("pages.sports.empty")}</p> : null}
        <ul className="flex flex-col gap-6">
          {sports.map((s) => {
            const d = s.config.defaults;
            const roles = visibleRoles(s.config);
            return (
              <li key={s.id} id={s.key} className="scroll-mt-24 rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
                <h2 className="text-2xl text-accent-text">{s.name}</h2>
                <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 md:grid-cols-2">
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted">{t("pages.sports.roles")}</h3>
                    <ul className="mt-3 flex flex-col gap-2">
                      {roles.map((r, i) => (
                        <li key={r.key} className="flex flex-wrap items-center gap-2">
                          <RoleChip label={r.label} index={i} size="sm" />
                          {r.subRoles.length ? <span className="text-sm text-muted">{r.subRoles.join(", ")}</span> : null}
                        </li>
                      ))}
                    </ul>
                    {s.config.categories.length ? (
                      <>
                        <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t("pages.sports.categories")}</h3>
                        <p className="mt-2">{s.config.categories.join(", ")}</p>
                      </>
                    ) : null}
                    {s.config.statFields.length ? (
                      <>
                        <h3 className="mt-5 text-xs font-bold uppercase tracking-wider text-muted">{t("pages.sports.stats")}</h3>
                        <p className="mt-2">{s.config.statFields.map((f) => f.label).join(", ")}</p>
                      </>
                    ) : null}
                  </section>
                  <section>
                    <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 border-b border-line pb-4">
                      <dt className="text-muted">{t("pages.sports.squad")}</dt>
                      <dd className="num text-right font-bold">{t("pages.sports.squadRange", { min: d.squadMin, max: d.squadMax })}</dd>
                      <dt className="text-muted">{t("pages.sports.purse")}</dt>
                      <dd className="num text-right font-bold">{formatPoints(d.purse)} {d.pointsUnitLabel}</dd>
                      <dt className="text-muted">{t("pages.sports.overseas")}</dt>
                      <dd className="num text-right font-bold">{d.maxOverseas}</dd>
                      <dt className="text-muted">{t("pages.sports.timer")}</dt>
                      <dd className="num text-right font-bold">{d.bidTimerSeconds ? t("pages.sports.timerValue", { s: d.bidTimerSeconds }) : t("pages.sports.noTimer")}</dd>
                      <dt className="text-muted">{t("pages.sports.rtm")}</dt>
                      <dd className="text-right font-bold">{d.rtmEnabled ? d.rtmLabel : t("common.off")}</dd>
                    </dl>
                    <h3 className="mt-4 text-xs font-bold uppercase tracking-wider text-muted">{t("pages.sports.slabs")}</h3>
                    <ul className="num mt-2 flex flex-col gap-1">
                      {d.slabs.map((sl) => (
                        <li key={sl.from}>
                          {sl.to === null
                            ? t("pages.sports.slabFrom", { from: formatPoints(sl.from), inc: formatPoints(sl.increment) })
                            : t("pages.sports.slabRange", { from: formatPoints(sl.from), to: formatPoints(sl.to), inc: formatPoints(sl.increment) })}
                        </li>
                      ))}
                    </ul>
                  </section>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
