"use client";

import { Gavel, Globe2, Radio, Timer, Users } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { formatPoints, formatStat, formatTime } from "@/lib/format";
import type { Snapshot } from "@/lib/live/types";
import { Meter, PhaseBadge, Price, roleInfo, teamById } from "./bits";
import { useLive } from "./live-provider";
import { useCountdown } from "./use-live-auction";

export function LiveView() {
  const { snapshot } = useLive();
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)_minmax(0,21rem)]">
      <div className="order-2 lg:order-1">
        <RecentSales snapshot={snapshot} />
      </div>
      <div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
        <FloorPanel />
        <BidTicker snapshot={snapshot} />
        <UpNext snapshot={snapshot} />
      </div>
      <div className="order-3">
        <TeamStandings snapshot={snapshot} />
      </div>
    </div>
  );
}

function Panel({ title, icon, children, action }: { title: string; icon?: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-line bg-surface" aria-label={title}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 className="flex items-center gap-2 text-base">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function FloorPanel({ big = false }: { big?: boolean }) {
  const { snapshot, serverNow } = useLive();
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const unit = snapshot.auction.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);

  if (!p) {
    return (
      <section aria-live="polite" className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-[var(--radius-md)] border border-line bg-surface px-6 py-12 text-center">
        <span className="inline-flex size-24 items-center justify-center rounded-full bg-surface-2 text-muted">
          <Radio className="size-11" aria-hidden="true" />
        </span>
        <h2 className="text-2xl sm:text-3xl">{t("live.waitingTitle")}</h2>
        <p className="max-w-sm text-muted">{snapshot.auction.status === "completed" ? t("live.completedBody") : t("live.waitingBody")}</p>
      </section>
    );
  }

  const role = roleInfo(snapshot, p.roleKey);
  const statFields = snapshot.auction.sportConfig.statFields.filter((s) => s.showOnCard);
  const sold = f.phase === "sold";
  const unsold = f.phase === "unsold";
  const buyer = teamById(snapshot, f.lastResultTeamId);
  const rtmTeam = teamById(snapshot, f.rtmTeamId);
  const announce =
    sold && buyer ? t("live.announceSold", { player: p.fullName, team: buyer.name, price: formatPoints(f.lastResultPrice), unit }) :
    unsold ? t("live.announceUnsold", { player: p.fullName }) :
    leader ? t("live.announceBid", { price: formatPoints(f.currentPrice), unit, team: leader.name }) : "";

  return (
    <section className={`rounded-[var(--radius-md)] border bg-surface ${sold ? "border-sold" : unsold ? "border-unsold" : f.phase === "live" ? "border-accent-edge" : "border-line"}`} aria-labelledby="floor-player-name">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <PhaseBadge phase={f.phase} hasPlayer />
          <span className="num rounded-[var(--radius-xs)] bg-info-surface px-2 py-1 text-xs font-bold text-info">{t("live.lot", { n: p.lotNo })}</span>
          <span className="text-sm text-muted">{p.setName}</span>
        </div>
        {f.phase === "live" && left !== null ? (
          <span className={`num inline-flex items-center gap-1.5 text-lg font-bold ${left <= 5 ? "text-live" : "text-text"}`} aria-label={left === 0 ? t("time.timeUp") : t("time.secondsLeft", { s: left })}>
            <Timer className="size-5" aria-hidden="true" />
            {left === 0 ? t("time.timeUp") : `${left}s`}
          </span>
        ) : null}
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
        <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={big ? 220 : 168} priority className="rounded-[var(--radius-md)] border border-line" />
        <div className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 id="floor-player-name" className={big ? "text-4xl" : "text-2xl sm:text-3xl"}>
              {p.fullName}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleChip label={role.label} index={role.index} subRole={p.subRole} />
              {p.category ? <span className="rounded-[var(--radius-xs)] border border-line-strong px-2 py-1 text-xs font-bold">{t("live.category", { c: p.category })}</span> : null}
              <span className="rounded-[var(--radius-xs)] border border-line-strong px-2 py-1 text-xs font-bold">{t(`nationality.${p.nationalityGroup}`)}</span>
              {p.ageGroup ? <span className="text-xs text-muted">{t(`ageGroup.${p.ageGroup as "18_23"}`)}</span> : null}
            </div>
          </div>
          {statFields.length ? (
            <dl className="grid grid-cols-3 gap-2 2xl:grid-cols-5">
              {statFields.map((s) => (
                <div key={s.key} className="rounded-[var(--radius-sm)] bg-surface-2 px-2 py-1.5">
                  <dt className="truncate text-xs text-muted">{s.label}</dt>
                  <dd className="num whitespace-nowrap text-base font-bold">{formatStat(p.stats[s.key]) || "0"}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {p.bioShort ? <p className="text-sm text-muted">{p.bioShort}</p> : null}
        </div>
      </div>

      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
        <div className="bg-surface px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold text-muted">{sold ? t("live.soldFor") : leader ? t("live.currentBid") : t("live.basePrice")}</p>
          <p className="mt-1 flex items-baseline gap-2">
            <Price value={sold ? f.lastResultPrice : f.currentPrice} className={`${big ? "text-7xl" : "text-5xl sm:text-6xl"} font-extrabold ${sold ? "text-sold" : "text-accent-text"}`} />
            <span className="text-muted">{unit}</span>
          </p>
          {!sold && leader && f.nextBidAmount !== null && f.phase === "live" ? (
            <p className="mt-1 text-sm text-muted">{t("live.nextBid", { amount: formatPoints(f.nextBidAmount), unit })}</p>
          ) : null}
        </div>
        <div className="bg-surface px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold text-muted">{sold ? t("live.boughtBy") : t("live.leadingTeam")}</p>
          {(sold ? buyer : leader) ? (
            <div className="mt-2 flex items-center gap-3">
              <TeamMark team={(sold ? buyer : leader)!} size={52} className="rounded-[var(--radius-sm)]" />
              <span className="display text-xl font-bold uppercase">{(sold ? buyer : leader)!.name}</span>
            </div>
          ) : (
            <p className="mt-2 text-muted">{unsold ? t("live.noBuyer") : t("live.noBidsYet")}</p>
          )}
        </div>
      </div>

      {f.phase === "rtm_pending" && rtmTeam ? (
        <p className="border-t border-paused bg-info-surface px-4 py-3 text-sm font-semibold text-text sm:px-6">
          {t(`live.rtm.${f.rtmStage ?? "offered"}`, { label: snapshot.auction.rtmLabel, team: rtmTeam.name, leader: leader?.name ?? "" })}
        </p>
      ) : null}
    </section>
  );
}

function RecentSales({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  return (
    <Panel title={t("live.recentSales")} icon={<Gavel className="size-5 text-accent-text" aria-hidden="true" />}>
      {snapshot.recentSales.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t("live.noSales")}</p>
      ) : (
        <ol className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto p-3 scrollbar-thin">
          {snapshot.recentSales.map((s) => {
            const team = teamById(snapshot, s.teamId);
            return (
              <li key={s.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface-2 px-3 py-2.5">
                {team ? <TeamMark team={team} size={34} className="rounded-full" /> : null}
                <div className="min-w-0 flex-1">
                  <Link href={`/players/${s.playerId}`} className="block truncate font-bold hover:underline">
                    {s.fullName}
                  </Link>
                  <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted">{team?.name}</p>
                </div>
                <Price value={s.price} tick={false} className="text-lg font-bold text-accent-text" />
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export function TeamStandings({ snapshot, limit }: { snapshot: Snapshot; limit?: number }) {
  const { t } = useI18n();
  const unit = snapshot.auction.pointsUnitLabel;
  const ranked = [...snapshot.teams].sort((a, b) => b.purseLeft - a.purseLeft || a.name.localeCompare(b.name)).slice(0, limit);
  return (
    <Panel title={t("live.standings")} icon={<Users className="size-5 text-accent-text" aria-hidden="true" />}>
      {ranked.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted">{t("live.noTeams")}</p>
      ) : (
        <ol className="flex flex-col gap-2 p-3">
          {ranked.map((team, i) => (
            <li key={team.id}>
              <Link href={`/teams/${team.id}`} className="block rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3 hover:border-line-strong">
                <div className="flex items-center gap-3">
                  <span className={`num inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${i === 0 ? "bg-accent text-accent-ink" : "bg-surface-3 text-text"}`} aria-label={t("live.rank", { n: i + 1 })}>
                    {i + 1}
                  </span>
                  <TeamMark team={team} size={40} className="rounded-[var(--radius-sm)]" />
                  <div className="min-w-0 flex-1">
                    <p className="display truncate text-sm font-bold uppercase leading-tight tracking-wide" title={team.name}>{team.name}</p>
                    <p className="sr-only">{t("live.squadLine", { n: team.squadCount, max: snapshot.auction.squadMax, o: team.overseasCount })}</p>
                    <p aria-hidden="true" className="num mt-1 flex items-center gap-2.5 text-xs font-semibold text-muted">
                      <span className="inline-flex items-center gap-1"><Users className="size-3.5" />{team.squadCount}/{snapshot.auction.squadMax}</span>
                      {snapshot.auction.maxOverseas > 0 ? <span className="inline-flex items-center gap-1"><Globe2 className="size-3.5" />{team.overseasCount}/{snapshot.auction.maxOverseas}</span> : null}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Price value={team.purseLeft} tick={false} className="text-lg font-bold text-accent-text" />
                    <p className="text-xs text-muted">{t("live.unitLeft", { unit })}</p>
                  </div>
                </div>
                <div className="mt-2.5">
                  <Meter value={team.purseSpent} max={team.purseTotal} tone="spent" label={t("live.purseUsed", { team: team.name, pct: team.purseTotal ? Math.round((team.purseSpent / team.purseTotal) * 100) : 0 })} />
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function BidTicker({ snapshot }: { snapshot: Snapshot }) {
  const { t, locale } = useI18n();
  const current = snapshot.currentPlayer?.auctionPlayerId;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === current).slice(0, 8);
  if (!current) return null;
  return (
    <Panel title={t("live.bidHistory")}>
      {bids.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted">{t("live.noBidsYet")}</p>
      ) : (
        <ol className="divide-y divide-line">
          {bids.map((b, i) => {
            const team = teamById(snapshot, b.teamId);
            return (
              <li key={b.id} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? "bg-surface-2" : ""}`}>
                {team ? <TeamMark team={team} size={28} className="rounded-[var(--radius-xs)]" /> : null}
                <span className="min-w-0 flex-1 truncate font-semibold uppercase tracking-wide">{team?.name}</span>
                <span className="hidden text-xs text-faint sm:inline">{formatTime(b.createdAt, locale)}</span>
                <Price value={b.amount} tick={false} className={`text-base font-bold ${i === 0 ? "text-accent-text" : "text-muted"}`} />
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

function UpNext({ snapshot }: { snapshot: Snapshot }) {
  const { t } = useI18n();
  const items = snapshot.queue.slice(0, 6);
  if (items.length === 0) return null;
  return (
    <Panel title={t("live.upNext")} action={<Link href={`/auctions/${snapshot.auction.slug}/queue`} className="link text-sm text-muted hover:text-text">{t("common.viewAll")}</Link>}>
      <ul className="grid gap-2 p-3 sm:grid-cols-2">
        {items.map((q) => {
          const role = roleInfo(snapshot, q.roleKey);
          return (
            <li key={q.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] bg-surface-2 p-2.5">
              <PlayerAvatar name={q.fullName} photoPath={q.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{q.fullName}</p>
                <p className="truncate text-xs text-muted">
                  {role.label}
                  {q.category ? ` / ${q.category}` : ""}
                </p>
              </div>
              <span className="num text-xs font-bold text-info">#{String(q.lotNo).padStart(3, "0")}</span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
