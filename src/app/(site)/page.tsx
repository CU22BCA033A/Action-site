import { ArrowRight, BarChart3, Gavel, KeyRound, MonitorPlay, SlidersHorizontal, Trophy, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

const screens = [
  { file: "live", key: "shotLive" as const, w: 1440, h: 900 },
  { file: "stats", key: "shotStats" as const, w: 1440, h: 900 },
  { file: "sold", key: "shotSold" as const, w: 1920, h: 1080 },
];

export default async function HomePage() {
  const { t } = await getT();
  const auctions = await listPublicAuctions();
  // Only the sports the organiser actually runs auctions for, never the full catalogue.
  const sportNames = [...new Set(auctions.map((a) => a.sportName))];
  const featured = auctions[0];
  const snapshot = featured ? await getSnapshot(featured.id) : null;
  const shots = screens.filter((s) => existsSync(join(process.cwd(), "public", "screens", `${s.file}.webp`)));

  const isLive = snapshot && (snapshot.auction.status === "live" || snapshot.auction.status === "paused");
  const isDone = snapshot?.auction.status === "completed";

  const liveShot = shots.find((s) => s.file === "live");
  // With no public auction the hero already shows the live view, so the gallery skips it.
  const gallery = snapshot ? shots : shots.filter((s) => s.file !== "live");
  const teamById = new Map(snapshot?.teams.map((tm) => [tm.id, tm]) ?? []);
  const signings = (snapshot?.recentSales ?? []).filter((s) => s.status === "sold").slice(0, 6);
  const steps = [
    { icon: SlidersHorizontal, title: t("home.step1Title"), body: t("home.step1Body") },
    { icon: KeyRound, title: t("home.step2Title"), body: t("home.step2Body") },
    { icon: MonitorPlay, title: t("home.step3Title"), body: t("home.step3Body") },
  ];

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] items-center gap-10 px-4 pb-14 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div className="text-center lg:text-left">
            {sportNames.length ? <p className="eyebrow">{sportNames.join(" · ")}</p> : null}
            <h1 className="mt-6 uppercase">
              <span className="block pb-1 text-[clamp(2.4rem,8vw,4.5rem)] font-black tracking-wide text-gold">{t("home.titleTop")}</span>
              <span className="mt-1 block text-[clamp(1.75rem,5.6vw,3rem)] font-bold tracking-wide text-text">{t("home.titleBottom")}</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted lg:mx-0">{t("home.lead")}</p>
            <div className="mt-8 flex w-full flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <ButtonLink href="/auctions" variant="primary" size="xl" className="sm:min-w-[200px]" icon={<Gavel className="size-5" aria-hidden="true" />}>
                {t("home.ctaWatch")}
              </ButtonLink>
              <ButtonLink href="/join" variant="royal" size="xl" className="sm:min-w-[200px]" icon={<KeyRound className="size-5" aria-hidden="true" />}>
                {t("home.ctaJoin")}
              </ButtonLink>
            </div>
            <ol className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-bold uppercase tracking-wider text-muted lg:justify-start" aria-label={t("home.stepsTitle")}>
              {steps.map((s, i) => (
                <li key={s.title} className="inline-flex items-center gap-2">
                  <span className="num inline-flex size-6 items-center justify-center rounded-full border border-line-strong text-xs text-text">{i + 1}</span>
                  {t(`home.stepShort${i + 1}` as "home.stepShort1")}
                </li>
              ))}
            </ol>
          </div>

          <div className="card-gold overflow-hidden">
            {snapshot ? (
              <>
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
              </>
            ) : liveShot ? (
              <figure>
                <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
                  <figcaption className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{t("home.screensTitle")}</figcaption>
                  <Badge tone="accent">{t("common.demoData")}</Badge>
                </div>
                <Image src="/screens/live.webp" alt={t("home.shotLive")} width={liveShot.w} height={liveShot.h} priority sizes="(min-width: 1024px) 560px, 100vw" className="h-auto w-full" />
                <p className="border-t border-line px-5 py-3 text-sm text-muted">{t("home.noAuctionBody")}</p>
              </figure>
            ) : (
              <div className="p-8 text-center">
                <Trophy className="mx-auto size-14 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
                <p className="mt-4 display text-lg font-bold uppercase">{t("home.noAuctionTitle")}</p>
                <p className="mt-2 text-muted">{t("home.noAuctionBody")}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {snapshot && snapshot.teams.length ? (
        <section className="border-b border-line">
          <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
            <TeamStatsCard teams={snapshot.teams} />
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <p className="eyebrow">{t("nav.howItWorks")}</p>
          <h2 className="mt-3 text-3xl sm:text-4xl">{t("home.stepsTitle")}</h2>
          <p className="mt-4">
            <Link href="/how-it-works" className="link inline-flex items-center gap-2 font-semibold text-accent-text">
              {t("home.howLink")}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </p>
        </div>
        <ol className="divide-y divide-line border-y border-line">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 py-6">
              <span className="num w-10 shrink-0 text-3xl font-bold text-accent-text">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="flex items-center gap-2 text-lg">
                  <s.icon className="size-5 shrink-0 text-royal-light" aria-hidden="true" />
                  {s.title}
                </h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {gallery.length ? (
        <section className="border-y border-line bg-[color-mix(in_srgb,var(--bg-sunken)_60%,transparent)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{t("common.demoData")}</p>
                <h2 className="mt-3 text-3xl sm:text-4xl">{t("home.screensTitle")}</h2>
              </div>
            </div>
            <p className="mt-2 text-muted">{t("home.screensNote")}</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {gallery.map((s, i) => (
                <figure key={s.file} className={i === 0 && gallery.length === 3 ? "lg:col-span-2" : ""}>
                  <Image
                    src={`/screens/${s.file}.webp`}
                    alt={t(`home.${s.key}`)}
                    width={s.w}
                    height={s.h}
                    sizes={i === 0 ? "(min-width: 1280px) 1216px, 100vw" : "(min-width: 1024px) 600px, 100vw"}
                    className="h-auto w-full rounded-[var(--radius-md)] border border-line-strong"
                  />
                  <figcaption className="mt-2 text-sm text-muted">{t(`home.${s.key}`)}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="card-gold flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-8">
          <Wallet className="size-10 shrink-0 text-remaining" aria-hidden="true" />
          <div>
            <h2 className="text-2xl">{t("home.freeTitle")}</h2>
            <p className="mt-2 max-w-3xl text-muted">{t("home.freeBody")}</p>
          </div>
        </div>
      </section>
    </>
  );
}
