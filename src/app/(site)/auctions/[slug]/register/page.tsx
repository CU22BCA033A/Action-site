import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterForm } from "@/components/register/register-form";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { issueFormToken } from "@/lib/security/form-token";
import { pageMeta } from "@/lib/site";
import { sportConfigSchema } from "@/lib/sports/config";

async function load(slug: string) {
  const row = (await db()<{
    name: string;
    open: boolean;
    switchedOn: boolean;
    opensAt: string | null;
    closesAt: string | null;
    playerTypes: string[];
    useNationality: boolean;
    notYetOpen: boolean;
    ended: boolean;
    config: unknown;
    sportName: string;
    rehearsal: boolean;
  }[]>`
    select a.name, app.registration_is_open(a) as open, a.registration_open as "switchedOn",
      a.registration_opens_at as "opensAt", a.registration_closes_at as "closesAt",
      a.player_types as "playerTypes", a.use_nationality as "useNationality",
      coalesce(a.registration_opens_at > now(), false) as "notYetOpen", coalesce(a.registration_closes_at <= now(), false) as ended,
      s.config, s.name as "sportName", a.rehearsal
    from app.auctions a join app.sports s on s.id = a.sport_id
    where a.slug = ${slug} and a.deleted_at is null and a.status <> 'archived'`)[0];
  return row ? { ...row, config: sportConfigSchema.parse(row.config) } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = await load(slug);
  const { t } = await getT();
  if (!a) return { title: t("common.pageNotFound") };
  return pageMeta({ title: t("register.metaTitle", { name: a.name }), description: t("register.metaDescription", { name: a.name }), path: `/auctions/${slug}/register`, noIndex: !a.open || a.rehearsal });
}

/** Works before the auction is published, so organisers can collect players early. */
export default async function RegisterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await load(slug);
  if (!a) notFound();
  const { t, locale } = await getT();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">{a.sportName}</p>
      <h1 className="mt-1 text-4xl sm:text-5xl">{t("register.title")}</h1>
      {a.open ? (
        <>
          <p className="mt-3 text-lg text-muted">{t("register.intro", { name: a.name })}</p>
          {a.closesAt ? <p className="mt-2 text-sm font-semibold text-accent-text">{t("register.closesOn", { date: formatDateTime(a.closesAt, locale) })}</p> : null}
          {a.rehearsal ? <p className="mt-3 rounded-[var(--radius-sm)] border border-paused bg-info-surface p-3 text-sm">{t("common.rehearsalNote")}</p> : null}
          <div className="mt-8 rounded-[var(--radius-md)] border border-line bg-surface p-5 sm:p-6">
            <RegisterForm slug={slug} config={a.config} formToken={issueFormToken()} playerTypes={a.playerTypes} useNationality={a.useNationality} />
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-[var(--radius-md)] border border-line bg-surface p-6">
          {a.switchedOn && a.opensAt && a.notYetOpen ? (
            <>
              <h2 className="text-2xl">{t("register.soonTitle")}</h2>
              <p className="mt-2 text-muted">{t("register.opensOn", { date: formatDateTime(a.opensAt, locale) })}</p>
            </>
          ) : (
            <>
              <h2 className="text-2xl">{t("register.closedTitle")}</h2>
              <p className="mt-2 text-muted">
                {a.switchedOn && a.closesAt && a.ended ? t("register.closedOn", { date: formatDateTime(a.closesAt, locale) }) : t("register.closedBody")}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
