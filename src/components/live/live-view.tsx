"use client";

import { BarChart3, ChevronDown, Download, Eye, History, Home, ListOrdered, Projector, Radio, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LogoMark } from "@/components/brand/logo";
import { PlayerPhoto, TeamMark } from "@/components/auction/identity";
import { RoleIcon } from "@/components/auction/role-icon";
import { formatPoints } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { ConnectionBanner, Price, roleInfo, teamById } from "./bits";
import { useLive } from "./live-provider";
import { RoomStage } from "./room-stage";
import { playSold, readSound, useSaleSound } from "./sale-sound";
import { SoldMoment, useSoldMoment } from "./sold-moment";
import { useCountdown } from "./use-live-auction";

/**
 * The live auction room, laid out like the owner's reference: a slim top
 * bar, then three full-height columns (teams, the player, live activity)
 * under one header row. Each column scrolls on its own. Phones stack them:
 * player, teams, activity.
 */
export function LiveView() {
  const { snapshot, connection } = useLive();
  const { t } = useI18n();
  const sold = useSoldMoment(snapshot, 2300, () => {
    if (readSound()) playSold();
  });
  return (
    <div className="flex min-h-dvh flex-col bg-bg xl:h-dvh">
      <a href="#room" className="sr-only-focusable fixed left-3 top-3 z-[70] rounded-[var(--radius-sm)] border-2 border-focus bg-surface px-4 py-3 font-semibold">
        {t("common.skipToContent")}
      </a>
      {sold.active ? <SoldMoment snapshot={snapshot} onDismiss={sold.dismiss} /> : null}
      <RoomTopBar />
      <ConnectionBanner state={connection} />
      <main
        id="room"
        tabIndex={-1}
        className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] outline-none lg:grid-cols-[22rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)_21rem] 2xl:grid-cols-[24.5rem_minmax(0,1fr)_29rem]"
      >
        <div className="order-1 flex min-h-0 min-w-0 flex-col lg:order-2">
          <FloorPanel />
        </div>
        <div className="order-2 min-h-0 min-w-0 border-t border-line lg:order-1 lg:row-span-2 lg:border-r lg:border-t-0 xl:row-span-1">
          <TeamsRail snapshot={snapshot} />
        </div>
        <div className="order-3 min-h-0 min-w-0 border-t border-line lg:col-start-2 xl:col-start-auto xl:border-l xl:border-t-0">
          <ActivityFeed snapshot={snapshot} />
        </div>
      </main>
    </div>
  );
}

/** Two stacked squares: the usual "copy" glyph, drawn to match the bar. */
function CopyGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="8" y="8" width="12" height="12" rx="2.5" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

/** Slim bar: brand, auction name, spectating and status pills, copy link; section links on the right. */
function RoomTopBar() {
  const { snapshot } = useLive();
  const { t } = useI18n();
  const a = snapshot.auction;
  const base = `/auctions/${a.slug}`;
  const [copied, setCopied] = useState(false);
  const live = a.status === "live";
  const links = [
    { href: `${base}/teams`, label: t("live.tab.teams"), icon: Users },
    { href: `${base}/players`, label: t("live.tab.players"), icon: UserRound },
    { href: `${base}/results`, label: t("live.tab.results"), icon: ListOrdered },
    { href: `${base}/stats`, label: t("live.tab.stats"), icon: BarChart3 },
  ];
  const iconBtn = "inline-flex size-10 shrink-0 items-center justify-center rounded-[0.7rem] border border-line bg-surface text-muted hover:border-line-strong hover:text-text";
  return (
    <header className="flex min-h-16 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-bg px-4 py-2.5 sm:px-5">
      <Link href="/" aria-label={t("nav.home")} className="shrink-0">
        <LogoMark className="size-8" />
      </Link>
      <h1 className="min-w-0 truncate text-sm font-extrabold uppercase tracking-[0.14em] sm:text-base">{a.name}</h1>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--royal)_55%,transparent)] bg-[color-mix(in_srgb,var(--royal)_14%,transparent)] px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-royal-light">
        <Eye className="size-3.5" aria-hidden="true" />
        <span className="max-sm:sr-only">{t("live.spectating")}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em]">
        <span aria-hidden="true" className={`size-1.5 rounded-full ${live ? "live-dot bg-remaining" : "bg-muted"}`} />
        {t(`status.${a.status}`)}
      </span>
      {a.rehearsal ? (
        <span title={t("common.rehearsalNote")} className="inline-flex shrink-0 items-center rounded-full border border-paused bg-info-surface px-2.5 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.12em]">
          {t("common.rehearsal")}
          <span className="sr-only">: {t("common.rehearsalNote")}</span>
        </span>
      ) : null}
      <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
      <button
        type="button"
        className={`${iconBtn} max-sm:hidden`}
        aria-label={copied ? t("common.copied") : t("live.copyLink")}
        title={t("live.copyLink")}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked */
          }
        }}
      >
        {copied ? <span className="text-xs font-bold text-remaining">OK</span> : <CopyGlyph />}
      </button>

      <nav aria-label={t("live.tabsLabel")} className="ml-auto flex items-center gap-1 sm:gap-1.5">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex h-10 min-w-10 items-center justify-center gap-2 rounded-[0.7rem] border border-transparent px-2 text-sm font-semibold text-muted hover:border-line hover:text-text sm:px-2.5">
            <l.icon className="size-4" aria-hidden="true" />
            <span className="hidden 2xl:inline">{l.label}</span>
            <span className="sr-only 2xl:hidden">{l.label}</span>
          </Link>
        ))}
        <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <SoundButton className={iconBtn} />
        <Link href={`${base}/screen`} className={`${iconBtn} max-sm:hidden`} aria-label={t("live.projector")} title={t("live.projector")}>
          <Projector className="size-4" aria-hidden="true" />
        </Link>
        <Link href="/" className={`${iconBtn} max-sm:hidden`} aria-label={t("nav.home")} title={t("nav.home")}>
          <Home className="size-4" aria-hidden="true" />
        </Link>
      </nav>
    </header>
  );
}

function SoundButton({ className }: { className: string }) {
  const { t } = useI18n();
  const [on, toggle] = useSaleSound();
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? t("screen.soundOn") : t("screen.soundOff")} title={on ? t("screen.soundOn") : t("screen.soundOff")} className={`${className} ${on ? "!border-accent !text-accent-text" : ""}`}>
      {on ? (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" /></svg>
      ) : (
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 5 6 9H2v6h4l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
      )}
    </button>
  );
}

/** Column header shared by the three columns, so they line up in one row. */
function ColumnHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex h-[4.25rem] shrink-0 items-center border-b border-line px-6 ${className}`}>{children}</div>;
}

const label = "text-[0.7rem] font-extrabold uppercase tracking-[0.16em] text-faint";

export function FloorPanel() {
  const { snapshot, serverNow } = useLive();
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const unit = snapshot.auction.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const buyer = teamById(snapshot, f.lastResultTeamId);
  const rtmTeam = teamById(snapshot, f.rtmTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);
  const shownTeam = f.phase === "sold" ? buyer : leader;

  const header = (
    <ColumnHeader className="hidden gap-6 lg:flex">
      <p className="flex items-baseline gap-2">
        <span className={label}>{t("live.basePrice")}:</span>
        <span className="num text-xl font-extrabold">{p ? formatPoints(p.basePrice) : "-"}</span>
        {p ? <span className="text-sm font-semibold text-muted">{unit}</span> : null}
      </p>
      <p className="ml-auto flex min-w-0 items-center gap-2 border-l border-line pl-6">
        <span className={label}>{f.phase === "sold" ? t("live.boughtBy") : t("live.bidder")}:</span>
        <span className={`truncate ${shownTeam ? "text-base font-extrabold" : "text-sm font-semibold text-muted"}`}>{shownTeam ? shownTeam.name : t("live.noBidsYet")}</span>
      </p>
    </ColumnHeader>
  );

  if (!p) {
    return (
      <>
        {header}
        <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 xl:p-10">
          <section aria-live="polite" className="flex min-h-96 flex-1 flex-col items-center justify-center gap-4 rounded-[2rem] border border-line bg-surface px-6 py-16 text-center">
            <span className="inline-flex size-24 items-center justify-center rounded-full bg-surface-2 text-muted">
              <Radio className="size-11" aria-hidden="true" />
            </span>
            <h2 className="text-3xl">{t("live.waitingTitle")}</h2>
            <p className="max-w-sm text-muted">{snapshot.auction.status === "completed" ? t("live.completedBody") : t("live.waitingBody")}</p>
          </section>
        </div>
      </>
    );
  }

  const announce =
    f.phase === "sold" && buyer ? t("live.announceSold", { player: p.fullName, team: buyer.name, price: formatPoints(f.lastResultPrice), unit }) :
    f.phase === "unsold" ? t("live.announceUnsold", { player: p.fullName }) :
    leader ? t("live.announceBid", { price: formatPoints(f.currentPrice), unit, team: leader.name }) : "";

  return (
    <>
      {header}
      <section aria-label={t("live.tab.live")} className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6 xl:overflow-y-auto 2xl:px-10 2xl:py-8">
        <p className="sr-only" aria-live="polite" aria-atomic="true">{announce}</p>
        <RoomStage snapshot={snapshot} timerLeft={left} />
        {f.phase === "rtm_pending" && rtmTeam ? (
          <p className="card border-paused px-4 py-3 text-sm font-semibold">
            {t(`live.rtm.${f.rtmStage ?? "offered"}`, { label: snapshot.auction.rtmLabel, team: rtmTeam.name, leader: leader?.name ?? "" })}
          </p>
        ) : null}
      </section>
    </>
  );
}

/** "5s ago" style label relative to the server clock of the snapshot. */
function useAgo(snapshot: Snapshot) {
  const { t } = useI18n();
  const now = Date.parse(snapshot.serverTime);
  return (iso: string | null) => {
    if (!iso) return "";
    const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
    if (s < 60) return t("live.secondsAgo", { n: s });
    if (s < 3600) return t("live.minutesAgo", { n: Math.floor(s / 60) });
    return t("live.hoursAgo", { n: Math.floor(s / 3600) });
  };
}

/** Live activity: a timeline of bids on the player on the floor, then a card for each recent sale. */
function ActivityFeed({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const ago = useAgo(snapshot);
  const unit = snapshot.auction.pointsUnitLabel;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === snapshot.floor.currentAuctionPlayerId);
  return (
    <section aria-labelledby="activity-title" className="flex max-h-[48rem] min-h-0 flex-col lg:max-h-none xl:h-full">
      <ColumnHeader className="px-0">
        <h2 id="activity-title" className="flex h-full items-center gap-2.5 border-b-2 border-text px-8 font-sans text-sm font-extrabold uppercase tracking-[0.14em]">
          <History className="size-4" aria-hidden="true" />
          {t("live.activity")}
        </h2>
      </ColumnHeader>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        <h3 className={`px-8 pt-6 ${label}`}>{t("live.bidHistory")}</h3>
        {bids.length === 0 ? (
          <p className="px-8 py-3 text-sm text-muted">{t("live.noBidsYet")}</p>
        ) : (
          <ol className="relative mx-8 mt-4 border-l border-line pb-2">
            {bids.map((b, i) => {
              const team = teamById(snapshot, b.teamId);
              return (
                <li key={b.id} className="relative pb-5 pl-6">
                  <span aria-hidden="true" className={`absolute -left-[5px] top-1.5 size-2.5 rounded-full border-2 border-bg ${i === 0 ? "bg-accent" : "bg-line-strong"}`} />
                  <p className={`text-[0.95rem] ${i === 0 ? "font-bold text-text" : "text-muted"}`}>
                    {t("live.bidEvent", { team: team?.name ?? "", amount: formatPoints(b.amount), unit })}
                  </p>
                  <p className={`mt-0.5 ${label}`}>{ago(b.createdAt)}</p>
                </li>
              );
            })}
          </ol>
        )}

        <h3 className={`mt-2 border-t border-line px-8 pt-6 ${label}`}>{t("live.recentSales")}</h3>
        {snapshot.recentSales.length === 0 ? (
          <p className="px-8 py-3 text-sm text-muted">{t("live.noSales")}</p>
        ) : (
          <ol className="flex flex-col gap-6 p-6">
            {snapshot.recentSales.slice(0, 12).map((s) => {
              const team = teamById(snapshot, s.teamId);
              const role = roleInfo(snapshot, s.roleKey);
              return (
                <li key={s.auctionPlayerId}>
                  <article className="overflow-hidden rounded-[1.75rem] border border-line bg-[radial-gradient(120%_70%_at_50%_100%,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_70%),linear-gradient(180deg,var(--surface),var(--bg))]">
                    <div className="flex items-start justify-between gap-3 p-5">
                      {team ? <TeamMark team={team} size={44} className="rounded-[0.9rem]" /> : <span />}
                      <p className="min-w-0 text-right leading-snug">
                        <span className="block truncate text-[0.6rem] font-extrabold uppercase tracking-[0.32em] text-royal-light">{snapshot.auction.name}</span>
                        <span className="block text-[0.62rem] font-bold uppercase tracking-[0.3em] text-muted">{t("live.boughtBy")}</span>
                        <span className="block truncate text-xs font-extrabold uppercase tracking-[0.2em]">{team?.name}</span>
                      </p>
                    </div>
                    <div className="mx-auto w-36">
                      <PlayerPhoto name={s.fullName} photoPath={s.photoPath} sizes="144px" className="!aspect-[4/5] !rounded-[1rem]" />
                    </div>
                    <h4 className="mt-4 px-5 text-center text-[1.375rem] font-extrabold uppercase leading-none tracking-[-0.02em]">{s.fullName}</h4>
                    <p className="mt-2 flex items-center justify-center gap-1.5 px-5 text-center text-[0.68rem] font-bold uppercase tracking-[0.3em] text-muted">{role.icon ? <RoleIcon icon={role.icon} className="size-4" /> : null}{role.label}</p>
                    <p className="mx-6 mt-5 flex items-baseline justify-center gap-2 rounded-t-[1.25rem] border border-b-0 border-line-strong bg-surface py-3">
                      <Price value={s.price} tick={false} className="text-[1.375rem] font-extrabold" />
                      <span className="text-sm font-bold text-muted">{unit}</span>
                    </p>
                  </article>
                  <a
                    href={`/api/auctions/${snapshot.auction.slug}/card/${s.auctionPlayerId}`}
                    download
                    className="mt-3 flex h-12 items-center justify-center gap-2 rounded-[1rem] border border-line bg-surface text-xs font-extrabold uppercase tracking-[0.16em] text-muted hover:border-line-strong hover:text-text"
                  >
                    <Download className="size-4" aria-hidden="true" />
                    {t("live.saveCard")}
                  </a>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

/** Teams with purse left and squad count; each row opens to show spending, limits and a squad link. */
export function TeamsRail({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const a = snapshot.auction;
  const unit = a.pointsUnitLabel;
  const leadingId = snapshot.floor.phase === "live" ? snapshot.floor.leadingTeamId : null;
  return (
    <section aria-labelledby="teams-title" className="flex max-h-[48rem] min-h-0 flex-col lg:h-full lg:max-h-none">
      <ColumnHeader>
        <h2 id="teams-title" className="font-sans text-sm font-extrabold uppercase tracking-[0.14em] text-muted">{t("live.auctionTeams")}</h2>
      </ColumnHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        {snapshot.teams.length === 0 ? <p className="px-3 py-6 text-sm text-muted">{t("live.noTeams")}</p> : null}
        <ol className="flex flex-col">
          {snapshot.teams.map((team, i) => {
            const isOpen = open === team.id;
            const roles = Object.entries(team.roleCounts).filter(([, n]) => n > 0);
            return (
              <li key={team.id} className={`rounded-[1rem] border-b border-line last:border-b-0 ${isOpen ? "border-b-transparent bg-surface" : ""} ${leadingId === team.id ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]" : ""}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`team-${team.id}`}
                  onClick={() => setOpen(isOpen ? null : team.id)}
                  className="flex w-full items-center gap-3 px-3 py-4 text-left"
                >
                  {/* The visible text forms the button's name (WCAG 2.5.3); the hidden prefix says what it does. */}
                  <span className="sr-only">{t("live.teamDetails")} </span>
                  <span className="num w-5 shrink-0 text-center text-sm font-semibold text-faint">{i + 1}</span>
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-[0.8rem] border border-line bg-surface-2">
                    <TeamMark team={team} size={32} className="rounded-[0.55rem]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.95rem] font-bold leading-tight">{team.name}</span>
                    <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted">
                      <span aria-hidden="true" className={`size-1.5 shrink-0 rounded-full ${team.ownerDisplayName ? "bg-remaining" : "bg-line-strong"}`} />
                      <span className="truncate">{team.ownerDisplayName || t("live.available")}</span>
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="num block text-[0.95rem] font-extrabold">{formatPoints(team.purseLeft)}</span>
                    <span className="num mt-0.5 block text-[0.7rem] font-semibold text-faint">
                      {team.squadCount}/{a.squadMax}
                    </span>
                  </span>
                  <ChevronDown className={`size-4 shrink-0 text-faint transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                </button>
                {isOpen ? (
                  <div id={`team-${team.id}`} className="px-3 pb-4">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-[0.8rem] bg-surface-2 px-3 py-2">
                        <dt className={label}>{t("auction.spent")}</dt>
                        <dd className="num font-extrabold text-spent">{formatPoints(team.purseSpent)} <span className="text-xs text-muted">{unit}</span></dd>
                      </div>
                      <div className="rounded-[0.8rem] bg-surface-2 px-3 py-2">
                        <dt className={label}>{t("manager.maxBid")}</dt>
                        <dd className="num font-extrabold text-accent-text">{formatPoints(team.maxBid)} <span className="text-xs text-muted">{unit}</span></dd>
                      </div>
                      {a.maxOverseas > 0 ? (
                        <div className="rounded-[0.8rem] bg-surface-2 px-3 py-2">
                          <dt className={label}>{t("nationality.overseas")}</dt>
                          <dd className="num font-extrabold">{team.overseasCount}/{a.maxOverseas}</dd>
                        </div>
                      ) : null}
                      {roles.map(([key, n]) => (
                        <div key={key} className="rounded-[0.8rem] bg-surface-2 px-3 py-2">
                          <dt className={`${label} truncate`}>{roleInfo(snapshot, key).label}</dt>
                          <dd className="num font-extrabold">{n}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link href={`/teams/${team.id}`} className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-accent-text hover:underline">
                      {t("live.viewSquad")}
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      <dl className="flex shrink-0 flex-wrap gap-x-5 gap-y-1 border-t border-line px-6 py-3 text-xs font-extrabold uppercase tracking-[0.1em]">
        <div className="flex gap-1.5">
          <dt className="text-faint">{t("live.totalSpent")}:</dt>
          <dd className="num text-spent">{formatPoints(snapshot.totals.spent)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-faint">{t("live.remaining")}:</dt>
          <dd className="num text-remaining">{formatPoints(snapshot.totals.remaining)}</dd>
        </div>
      </dl>
    </section>
  );
}
