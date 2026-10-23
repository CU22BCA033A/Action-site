import { ArrowRight, Gavel, KeyRound, MonitorPlay, SlidersHorizontal, Trophy, Wallet } from "lucide-react";
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
      <section className="border-b border-line">
        <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
          <span className="inline-flex size-20 items-center justify-center rounded-[var(--radius-md)] border border-line-strong bg-surface text-accent-text sm:size-24">
            <Trophy className="size-11 sm:size-14" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <ul className="mt-6 flex flex-wrap justify-center gap-2" aria-label={t("nav.sports")}>
            {sports.map((s) => (
              <li key={s.id} className="rounded-full border border-line-strong px-3 py-1 text-xs font-bold uppercase tracking-wider text-muted">
                {s.name}
              </li>
            ))}
          </ul>
          <h1 className="mt-6 uppercase">
            <span className="block text-[clamp(2.6rem,8vw,5.5rem)] text-accent-text">{t("home.titleTop")}</span>
            <span className="mt-1 block text-[clamp(2.1rem,6.4vw,4.4rem)] text-text">{t("home.titleBottom")}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted sm:text-xl">{t("home.lead")}</p>
          <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <ButtonLink href="/auctions" variant="primary" size="lg" icon={<Gavel className="size-5" aria-hidden="true" />}>
              {t("home.ctaWatch")}
            </ButtonLink>
            <ButtonLink href="/join" variant="secondary" size="lg" icon={<KeyRound className="size-5" aria-hidden="true" />}>
              {t("home.ctaJoin")}
            </ButtonLink>
          </div>
        </div>
      </section>

      {snapshot ? (
        <section className="border-b border-line bg-bg-sunken">
          <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-14 text-center sm:px-6">
            <Badge tone={isLive ? "live" : isDone ? "sold" : "accent"} className="h-8 px-3 text-sm">
              {isLive ? t("home.featuredLive") : isDone ? t("home.featuredDone") : t("home.featuredNext")}
            </Badge>
            <h2 className="mt-5 uppercase">
              <span className="block text-[clamp(2.2rem,7vw,4.5rem)] text-accent-text">{first}</span>
              {rest ? <span className="mt-1 block text-[clamp(1.6rem,5vw,3.2rem)] text-text">{rest}</span> : null}
            </h2>
            <p className="mt-3 text-lg text-muted">{snapshot.auction.sportName}</p>
            <dl className="mt-8 grid w-full grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-[var(--radius-md)] border border-line bg-surface px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-accent-text">{formatPoints(snapshot.totals.spent)}</dd>
                <dt className="mt-1 text-xs text-muted sm:text-sm">{t("home.spent")}</dt>
              </div>
              <div className="rounded-[var(--radius-md)] border border-line bg-surface px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-info">{formatPoints(snapshot.totals.remaining)}</dd>
                <dt className="mt-1 text-xs text-muted sm:text-sm">{t("home.remaining")}</dt>
              </div>
              <div className="rounded-[var(--radius-md)] border border-line bg-surface px-2 py-4 sm:px-4">
                <dd className="num text-xl min-[400px]:text-2xl sm:text-3xl font-extrabold text-remaining">{formatPoints(snapshot.counts.sold)}</dd>
                <dt className="mt-1 text-xs text-muted sm:text-sm">{t("home.playersSold")}</dt>
              </div>
            </dl>
            <div className="mt-6 w-full text-left">
              <TeamStatsCard teams={snapshot.teams} />
            </div>
            <div className="mt-6">
              <ButtonLink href={`/auctions/${snapshot.auction.slug}${isDone ? "/results" : ""}`} variant="primary" size="lg" icon={<ArrowRight className="size-5" aria-hidden="true" />}>
                {isDone ? t("home.viewResults") : t("home.watch")}
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
            <li key={s.title} className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="num inline-flex size-10 items-center justify-center rounded-full bg-accent text-lg font-extrabold text-accent-ink">{i + 1}</span>
                <s.icon className="size-6 text-accent-text" aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-xl">{s.title}</h3>
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
        <section className="border-y border-line bg-bg-sunken">
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
                <Link href={`/sports#${s.key}`} className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 hover:border-line-strong">
                  <span className="display text-lg font-bold uppercase">{s.name}</span>
                  <span className="text-sm text-muted">{t("home.rolesCount", { n: s.config.roles.filter((r) => !r.hidden).length })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <aside className="rounded-[var(--radius-md)] border border-line bg-surface p-6">
          <Wallet className="size-8 text-remaining" aria-hidden="true" />
          <h2 className="mt-4 text-2xl">{t("home.freeTitle")}</h2>
          <p className="mt-2 text-muted">{t("home.freeBody")}</p>
        </aside>
      </section>
    </>
  );
}
