import { ArrowRight, BarChart3, Gavel, KeyRound, MonitorPlay, SlidersHorizontal, Trophy, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TeamStatsCard } from "@/components/home/team-stats-card";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badges";
import { listPublicAuctions, listSports } from "@/lib/data/public";
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
  const [auctions, sports] = await Promise.all([listPublicAuctions(), listSports()]);
  const featured = auctions[0];
  const snapshot = featured ? await getSnapshot(featured.id) : null;
  const shots = screens.filter((s) => existsSync(join(process.cwd(), "public", "screens", `${s.file}.webp`)));

  const isLive = snapshot && (snapshot.auction.status === "live" || snapshot.auction.status === "paused");
  const isDone = snapshot?.auction.status === "completed";
  const nameWords = snapshot?.auction.name.split(/\s+/) ?? [];
  const first = nameWords[0] ?? "";
  const rest = nameWords.slice(1).join(" ");

  return (
    <>
      <section className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 top-10 size-72 rounded-full bg-royal opacity-20 blur-3xl sm:left-[10%] sm:size-96" />
          <div className="absolute -right-24 bottom-0 size-72 rounded-full bg-accent opacity-10 blur-3xl sm:right-[10%] sm:size-96" />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20">
          <span className="float relative inline-flex">
            <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent opacity-30 blur-2xl" />
            <Trophy className="relative size-20 text-accent-text sm:size-24" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label={t("nav.sports")}>
            {sports.map((s) => (
              <li key={s.id} className="rounded-full border border-line bg-[color-mix(in_srgb,var(--surface)_60%,transparent)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">
                {s.name}
              </li>
            ))}
          </ul>
          <h1 className="mt-6 uppercase">
            <span className="block pb-1 text-[clamp(2.4rem,8vw,4.5rem)] font-black tracking-wide text-gold">{t("home.titleTop")}</span>
            <span className="mt-1 block text-[clamp(1.75rem,5.6vw,3rem)] font-bold tracking-wide text-text">{t("home.titleBottom")}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted">{t("home.lead")}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/auctions" variant="primary" size="xl" className="sm:min-w-[200px]" icon={<Gavel className="size-5" aria-hidden="true" />}>
              {t("home.ctaWatch")}
            </ButtonLink>
            <ButtonLink href="/join" variant="royal" size="xl" className="sm:min-w-[200px]" icon={<KeyRound className="size-5" aria-hidden="true" />}>
              {t("home.ctaJoin")}
            </ButtonLink>
          </div>
        </div>
      </section>

      {snapshot ? (
        <section className="border-b border-line">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6">
            <Badge tone={isLive ? "live" : isDone ? "sold" : "accent"} className="h-8 px-3 text-sm">
              {isLive ? t("home.featuredLive") : isDone ? t("home.featuredDone") : t("home.featuredNext")}
            </Badge>
            <h2 className="mt-5 uppercase">
              <span className="block pb-1 text-[clamp(2.2rem,7vw,4.5rem)] font-black text-gold">{first}</span>
              {rest ? <span className="mt-1 block text-[clamp(1.6rem,5vw,3.2rem)] text-text">{rest}</span> : null}
            </h2>
            <p className="mt-3 text-lg text-muted">{snapshot.auction.sportName}</p>
            <dl className="mt-8 grid w-full grid-cols-3 gap-2 sm:gap-3">
              <div className="card px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-bold text-accent-text">{formatPoints(snapshot.totals.spent)}</dd>
                <dt className="mt-1 text-xs text-muted">{t("home.spent")}</dt>
              </div>
              <div className="card px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-bold text-royal-light">{formatPoints(snapshot.totals.remaining)}</dd>
                <dt className="mt-1 text-xs text-muted">{t("home.remaining")}</dt>
              </div>
              <div className="card px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-bold text-remaining">{formatPoints(snapshot.counts.sold)}</dd>
                <dt className="mt-1 text-xs text-muted">{t("home.playersSold")}</dt>
              </div>
            </dl>
            <div className="mt-6 w-full text-left">
              <TeamStatsCard teams={snapshot.teams} />
            </div>
            <div className="mt-8 flex w-full flex-col flex-wrap justify-center gap-3 sm:flex-row">
              <ButtonLink href={`/auctions/${snapshot.auction.slug}${isDone ? "/results" : ""}`} variant="primary" size="xl" className="sm:min-w-[200px]" icon={<ArrowRight className="size-5" aria-hidden="true" />}>
                {isDone ? t("home.viewResults") : t("home.watch")}
              </ButtonLink>
              <ButtonLink href={`/auctions/${snapshot.auction.slug}/teams`} variant="glass" size="xl" className="sm:min-w-[200px]" icon={<Users className="size-5" aria-hidden="true" />}>
                {t("live.tab.teams")}
              </ButtonLink>
              <ButtonLink href={`/auctions/${snapshot.auction.slug}/stats`} variant="secondary" size="xl" className="sm:min-w-[200px]" icon={<BarChart3 className="size-5" aria-hidden="true" />}>
                {t("live.tab.stats")}
              </ButtonLink>
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-3xl sm:text-4xl">{t("home.stepsTitle")}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            { icon: SlidersHorizontal, title: t("home.step1Title"), body: t("home.step1Body") },
            { icon: KeyRound, title: t("home.step2Title"), body: t("home.step2Body") },
            { icon: MonitorPlay, title: t("home.step3Title"), body: t("home.step3Body") },
          ].map((s, i) => (
            <li key={s.title} className="card p-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex size-12 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-accent-text">
                  <s.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="num text-sm font-bold text-faint">0{i + 1}</span>
              </div>
              <h3 className="mt-4 text-lg">{s.title}</h3>
              <p className="mt-2 text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-6">
          <Link href="/how-it-works" className="link inline-flex items-center gap-2 font-semibold text-accent-text">
            {t("home.howLink")}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </p>
      </section>

      {shots.length ? (
        <section className="border-y border-line bg-[color-mix(in_srgb,var(--bg-sunken)_60%,transparent)]">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-3xl sm:text-4xl">{t("home.screensTitle")}</h2>
              <Badge tone="accent">{t("common.demoData")}</Badge>
            </div>
            <p className="mt-2 text-muted">{t("home.screensNote")}</p>
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              {shots.map((s, i) => (
                <figure key={s.file} className={i === 0 ? "lg:col-span-2" : ""}>
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

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-3xl sm:text-4xl">{t("home.sportsTitle")}</h2>
          <p className="mt-2 text-muted">{t("home.sportsBody")}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {sports.map((s) => (
              <li key={s.id}>
                <Link href={`/sports#${s.key}`} className="flex items-center justify-between gap-3 card p-4 hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]">
                  <span className="display text-lg font-bold uppercase">{s.name}</span>
                  <span className="text-sm text-muted">{t("home.rolesCount", { n: s.config.roles.filter((r) => !r.hidden).length })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="card-gold p-6">
          <Wallet className="size-8 text-remaining" aria-hidden="true" />
          <h2 className="mt-4 text-2xl">{t("home.freeTitle")}</h2>
          <p className="mt-2 text-muted">{t("home.freeBody")}</p>
        </aside>
      </section>
    </>
  );
}
