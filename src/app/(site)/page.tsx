import { ArrowRight, BarChart3, Gavel, KeyRound, MonitorPlay, SlidersHorizontal, Users, } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroScene } from "@/components/home/hero-scene";
import { TeamStatsCard } from "@/components/home/team-stats-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badges";
import { TeamMark } from "@/components/auction/identity";
import { listPublicAuctions } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { getSnapshot } from "@/lib/live/engine";
import { pageMeta } from "@/lib/site";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getT();
  return pageMeta({ title: t("home.metaTitle"), description: t("home.metaDescription"), path: "/" });
}


export default async function HomePage() {
  const { t } = await getT();
  const auctions = await listPublicAuctions();
  // Only the sports the organiser actually runs auctions for, never the full catalogue.
  const sportNames = [...new Set(auctions.map((a) => a.sportName))];
  const featured = auctions[0];
  const snapshot = featured ? await getSnapshot(featured.id) : null;

  const isLive = snapshot && (snapshot.auction.status === "live" || snapshot.auction.status === "paused");
  const isDone = snapshot?.auction.status === "completed";

  const teamById = new Map(snapshot?.teams.map((tm) => [tm.id, tm]) ?? []);
  const signings = (snapshot?.recentSales ?? []).filter((s) => s.status === "sold").slice(0, 6);
  const steps = [
    { icon: SlidersHorizontal, title: t("home.step1Title"), body: t("home.step1Body"), href: "/how-it-works", cta: t("home.howLink") },
    { icon: KeyRound, title: t("home.step2Title"), body: t("home.step2Body"), href: "/join", cta: t("home.ctaJoin") },
    { icon: MonitorPlay, title: t("home.step3Title"), body: t("home.step3Body"), href: "/auctions", cta: t("home.ctaWatch") },
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-line">
        <div className="hero-aurora" aria-hidden="true" />
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="text-center lg:text-left">
            {sportNames.length ? <p className="rise eyebrow">{sportNames.join(" · ")}</p> : null}
            <h1 className="mt-5 text-[clamp(2.25rem,5.2vw,4rem)] font-bold leading-[1.04] tracking-[-0.04em]">
              <span className="rise block text-text" style={{ ["--d" as string]: "80ms" }}>{t("home.titleTop")}</span>
              <span className="rise block pb-1 text-gold-live" style={{ ["--d" as string]: "200ms" }}>{t("home.titleBottom")}</span>
            </h1>
            <hr className="rise rule-gold mx-auto mt-6 w-16 lg:mx-0" style={{ ["--d" as string]: "320ms" }} />
            <p className="rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted lg:mx-0" style={{ ["--d" as string]: "380ms" }}>{t("home.lead")}</p>
            <div className="rise mt-10 flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ ["--d" as string]: "500ms" }}>
              <ButtonLink href="/auctions" variant="primary" size="xl" className="sm:min-w-[200px]" icon={<Gavel className="size-5" aria-hidden="true" />}>
                {t("home.ctaWatch")}
              </ButtonLink>
              <ButtonLink href="/join" variant="royal" size="xl" className="sm:min-w-[200px]" icon={<KeyRound className="size-5" aria-hidden="true" />}>
                {t("home.ctaJoin")}
              </ButtonLink>
            </div>
          </div>

          {snapshot ? (
            <div className="rise card-gold frame-gold overflow-hidden" style={{ ["--d" as string]: "300ms" }}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">{snapshot.auction.sportName}</p>
                    <p className="display truncate text-lg font-bold uppercase text-gold">{snapshot.auction.name}</p>
                  </div>
                  <Badge tone={isLive ? "live" : isDone ? "sold" : "accent"}>
                    {isLive ? t("home.featuredLive") : isDone ? t("home.featuredDone") : t("home.featuredNext")}
                  </Badge>
                </div>
                <dl className="grid grid-cols-3 divide-x divide-line border-b border-line text-center">
                  <div className="px-2 py-4">
                    <dd className="num text-xl font-bold text-accent-text sm:text-2xl">{formatPoints(snapshot.totals.spent)}</dd>
                    <dt className="mt-1 text-xs text-muted">{t("home.spent")}</dt>
                  </div>
                  <div className="px-2 py-4">
                    <dd className="num text-xl font-bold text-royal-light sm:text-2xl">{formatPoints(snapshot.totals.remaining)}</dd>
                    <dt className="mt-1 text-xs text-muted">{t("home.remaining")}</dt>
                  </div>
                  <div className="px-2 py-4">
                    <dd className="num text-xl font-bold text-remaining sm:text-2xl">{formatPoints(snapshot.counts.sold)}</dd>
                    <dt className="mt-1 text-xs text-muted">{t("home.playersSold")}</dt>
                  </div>
                </dl>
                <div className="px-5 py-4">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-muted">{t("home.signingsTitle")}</h2>
                  {signings.length ? (
                    <ul className="mt-2 divide-y divide-line">
                      {signings.map((s) => {
                        const team = teamById.get(s.teamId);
                        return (
                          <li key={s.auctionPlayerId} className="flex items-center gap-3 py-2.5">
                            {team ? <TeamMark team={team} size={28} /> : null}
                            <p className="min-w-0 flex-1 truncate">
                              <span className="font-bold">{team?.shortName ?? ""}</span>{" "}
                              <span className="text-muted">{t("home.signed")}</span> <span className="font-semibold">{s.fullName}</span>
                            </p>
                            <span className="num font-bold text-accent-text">{formatPoints(s.price)}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="mt-2 text-muted">{t("home.noSignings")}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 border-t border-line p-4 sm:flex-row">
                  <ButtonLink href={`/auctions/${snapshot.auction.slug}${isDone ? "/results" : ""}`} variant="primary" className="flex-1" icon={<ArrowRight className="size-4" aria-hidden="true" />}>
                    {isDone ? t("home.viewResults") : t("home.watch")}
                  </ButtonLink>
                  <ButtonLink href={`/auctions/${snapshot.auction.slug}/teams`} variant="glass" className="flex-1" icon={<Users className="size-4" aria-hidden="true" />}>
                    {t("live.tab.teams")}
                  </ButtonLink>
                  <ButtonLink href={`/auctions/${snapshot.auction.slug}/stats`} variant="secondary" className="flex-1" icon={<BarChart3 className="size-4" aria-hidden="true" />}>
                    {t("live.tab.stats")}
                  </ButtonLink>
                </div>
            </div>
          ) : (
            <div className="rise" style={{ ["--d" as string]: "250ms" }}>
              <HeroScene />
            </div>
          )}
        </div>
      </section>

      {snapshot && snapshot.teams.length ? (
        <section className="border-b border-line">
          <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
            <TeamStatsCard teams={snapshot.teams} />
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="who-title">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="who-title" className="text-3xl sm:text-4xl">{t("home.stepsTitle")}</h2>
          <Link href="/how-it-works" className="link inline-flex items-center gap-2 font-semibold text-accent-text">
            {t("home.howLink")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-10 grid gap-x-10 gap-y-12 md:grid-cols-3">
          {steps.map((s) => (
            <article key={s.title} className="border-t-2 border-[color-mix(in_srgb,var(--accent-edge)_70%,transparent)] pt-6">
              <s.icon className="size-6 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
              <h3 className="mt-4 text-xl">{s.title}</h3>
              <p className="mt-3 leading-relaxed text-muted">{s.body}</p>
              <Link href={s.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-text underline decoration-line-strong underline-offset-4 hover:decoration-accent-edge">
                {s.cta}
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
