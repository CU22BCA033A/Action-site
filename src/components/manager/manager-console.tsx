"use client";

import { Gavel, LogOut, Star, Timer, Tv } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ConnectionBanner, ConnectionIndicator, PhaseBadge, Price, roleInfo, teamById } from "@/components/live/bits";
import { useCountdown, useLiveAuction } from "@/components/live/use-live-auction";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { leaveAction } from "@/lib/auth/join-actions";
import type { ManagerSnapshot, ShortlistEntry } from "@/lib/data/manager";
import { formatPoints } from "@/lib/format";
import type { EngineResult, Snapshot } from "@/lib/live/types";
import { bidBlock, roleNeeds, type BidBlock } from "@/lib/rules/eligibility";
import { incrementFor } from "@/lib/rules/slabs";

type Feedback = { kind: "ok" | "error"; text: string } | null;

async function post(url: string, body: unknown): Promise<EngineResult> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  return (await res.json()) as EngineResult;
}

export function ManagerConsole({ initial }: { initial: ManagerSnapshot }) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const live = useLiveAuction<ManagerSnapshot>(initial, "/api/manager/snapshot", {
    onUnauthorized: () => router.replace("/join?ended=1"),
  });
  const { snapshot, connection, serverNow, applyFloor, refetch } = live;
  const me = snapshot.teams.find((x) => x.id === snapshot.me.teamId);
  const a = snapshot.auction;
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const unit = a.pointsUnitLabel;
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);

  const [pending, setPending] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, startLeaving] = useTransition();
  const [seenSettings, setSeenSettings] = useState(a.settingsVersion);

  const errorText = useCallback(
    (res: EngineResult) => {
      const known = ["NOT_LIVE", "STALE", "ALREADY_LEADING", "INSUFFICIENT_PURSE", "RESERVE_VIOLATION", "SQUAD_FULL", "OVERSEAS_LIMIT", "ROLE_LIMIT", "RATE_LIMITED", "NOT_AUTHORISED", "DUPLICATE"] as const;
      const code = known.find((k) => k === res.code);
      return code ? t(`errors.code.${code}`) : res.message || t("errors.generic");
    },
    [t],
  );

  const handleResult = useCallback(
    (res: EngineResult, okText: string) => {
      if (res.floor) applyFloor(res.floor);
      if (res.ok) setFeedback({ kind: "ok", text: okText });
      else {
        setFeedback({ kind: "error", text: errorText(res) });
        if (res.code === "NOT_AUTHORISED") router.replace("/join?ended=1");
      }
      void refetch();
    },
    [applyFloor, errorText, refetch, router],
  );

  if (!me) return null;

  const block: BidBlock =
    connection !== "connected"
      ? { kind: "notOpen" }
      : bidBlock({
          hasPlayer: Boolean(p),
          phase: f.phase,
          secondsLeft: left,
          leadingTeamId: f.leadingTeamId,
          teamId: me.id,
          nextBidAmount: f.nextBidAmount,
          team: me,
          rules: { squadMax: a.squadMax, maxOverseas: a.maxOverseas, roleMinimums: a.roleMinimums, roleMaximums: a.roleMaximums },
          player: p ? { roleKey: p.roleKey, nationalityGroup: p.nationalityGroup } : null,
        });

  const reason = (() => {
    if (connection !== "connected") return t("connection.bidsPaused");
    switch (block.kind) {
      case "ok":
        return null;
      case "noPlayer":
        return t("manager.noPlayer");
      case "notOpen":
        return t("manager.notOpen");
      case "paused":
        return t("manager.paused");
      case "rtm":
        return t("manager.rtmWaiting", { label: a.rtmLabel });
      case "timeUp":
        return t("manager.timeUp");
      case "leading":
        return t("errors.code.ALREADY_LEADING");
      case "noSlab":
        return t("manager.noSlab");
      case "code":
        return block.code === "ROLE_LIMIT" && block.role ? t("manager.roleFull", { role: roleInfo(snapshot, block.role).label }) : t(`errors.code.${block.code}`);
    }
  })();

  async function placeBid() {
    if (block.kind !== "ok" || pending !== null) return;
    const amount = block.amount;
    const key = crypto.randomUUID();
    setPending(amount);
    setFeedback(null);
    const body = { expectedVersion: f.version, idempotencyKey: key };
    try {
      let res: EngineResult;
      try {
        res = await post("/api/manager/bid", body);
      } catch {
        // Same key: a retry can never place the bid twice.
        res = await post("/api/manager/bid", body);
      }
      handleResult(res, t("manager.placed", { amount: formatPoints(res.amount ?? amount), unit }));
    } catch {
      setFeedback({ kind: "error", text: t("errors.network") });
      void refetch();
    } finally {
      setPending(null);
    }
  }

  async function rtm(action: string, amount?: number) {
    if (pending !== null) return;
    setPending(amount ?? f.currentPrice);
    setFeedback(null);
    try {
      const res = await post("/api/manager/rtm", { action, expectedVersion: f.version, amount });
      handleResult(res, res.message);
    } catch {
      setFeedback({ kind: "error", text: t("errors.network") });
    } finally {
      setPending(null);
    }
  }

  const leader = teamById(snapshot, f.leadingTeamId);
  const needs = roleNeeds(a.roleMinimums, me.roleCounts);
  const myBids = snapshot.bids.filter((b) => b.auctionPlayerId === p?.auctionPlayerId).slice(0, 6);
  const rulesChanged = a.settingsVersion > seenSettings;

  return (
    <div className="flex min-h-dvh flex-col pb-40">
      <header className="sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-2.5">
          <TeamMark team={me} size={40} className="rounded-[var(--radius-sm)]" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base font-bold uppercase">{me.name}</p>
            <p className="truncate text-xs text-muted">{a.name}</p>
          </div>
          <ConnectionIndicator state={connection} compact />
          <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)} icon={<LogOut className="size-4" aria-hidden="true" />} aria-label={t("common.leaveAuction")}>
            <span className="sr-only sm:not-sr-only">{t("common.leaveAuction")}</span>
          </Button>
        </div>
      </header>
      <ConnectionBanner state={connection} />
      {a.rehearsal ? <p className="border-b border-paused bg-info-surface px-4 py-2 text-center text-sm font-semibold">{t("common.rehearsalNote")}</p> : null}

      <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-4">
        <h1 className="sr-only">{t("manager.metaTitle")}</h1>
        {rulesChanged ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-accent-edge bg-surface-2 p-3 text-sm">
            <span>{t("manager.rulesUpdated")}</span>
            <Button size="sm" variant="ghost" onClick={() => setSeenSettings(a.settingsVersion)}>
              {t("common.close")}
            </Button>
          </div>
        ) : null}

        <section aria-labelledby="mgr-floor" className={`rounded-[var(--radius-md)] border bg-surface ${f.phase === "live" ? "border-accent-edge" : "border-line"}`}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
            <div className="flex items-center gap-2">
              <PhaseBadge phase={f.phase} hasPlayer={Boolean(p)} />
              {p ? <span className="num text-sm font-bold text-info">{t("live.lot", { n: p.lotNo })}</span> : null}
            </div>
            {f.phase === "live" && left !== null ? (
              <span className={`num inline-flex items-center gap-1 text-xl font-bold ${left <= 5 ? "text-live" : ""}`} aria-label={left === 0 ? t("time.timeUp") : t("time.secondsLeft", { s: left })}>
                <Timer className="size-5" aria-hidden="true" />
                {left}s
              </span>
            ) : null}
          </div>
          {p ? (
            <div className="flex items-center gap-3 p-3">
              <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={76} priority className="rounded-[var(--radius-sm)]" />
              <div className="min-w-0 flex-1">
                <h2 id="mgr-floor" className="truncate text-xl">
                  {p.fullName}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <RoleChip size="sm" {...roleInfo(snapshot, p.roleKey)} subRole={p.subRole} />
                  {p.nationalityGroup === "overseas" ? <span className="rounded-[var(--radius-xs)] border border-line-strong px-1.5 py-0.5 text-xs font-bold">{t("nationality.overseas")}</span> : null}
                  {p.category ? <span className="text-xs text-muted">{t("live.category", { c: p.category })}</span> : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {t("live.basePrice")}: <span className="num font-semibold text-text">{formatPoints(p.basePrice)}</span>
                </p>
              </div>
            </div>
          ) : (
            <p id="mgr-floor" className="p-4 text-muted">
              {t("manager.noPlayer")}
            </p>
          )}
          {p ? (
            <div className="grid grid-cols-2 gap-px border-t border-line bg-line">
              <div className="bg-surface px-3 py-2.5">
                <p className="text-xs font-semibold text-muted">{f.phase === "sold" ? t("live.soldFor") : t("live.currentBid")}</p>
                <p aria-live="polite">
                  <Price value={f.phase === "sold" ? f.lastResultPrice : f.currentPrice} className="text-4xl font-extrabold text-accent-text" />
                </p>
              </div>
              <div className="flex flex-col justify-center bg-surface px-3 py-2.5">
                {f.leadingTeamId === me.id ? (
                  <p className="inline-flex items-center gap-2 font-bold text-sold">
                    <span aria-hidden="true" className="inline-block size-2.5 rotate-45 bg-sold" />
                    {t("manager.youLead")}
                  </p>
                ) : leader ? (
                  <p className="flex items-center gap-2 font-semibold">
                    <TeamMark team={leader} size={28} className="rounded-[var(--radius-xs)]" />
                    <span className="truncate uppercase">{t("manager.leads", { team: leader.name })}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted">{t("live.noBidsYet")}</p>
                )}
              </div>
            </div>
          ) : null}
        </section>

        <RtmPanel snapshot={snapshot} meId={me.id} busy={pending !== null} onAction={rtm} />

        <p aria-live="polite" className={`min-h-6 text-sm font-semibold ${feedback?.kind === "error" ? "text-danger" : "text-sold"}`}>
          {feedback?.text}
        </p>

        <section aria-label={t("manager.purseLeft")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t("manager.purseLeft")} value={formatPoints(me.purseLeft)} tone="text-remaining" />
          <Stat label={t("manager.maxBid")} value={formatPoints(me.maxBid)} tone="text-accent-text" />
          <Stat label={t("manager.slotsLeft")} value={`${me.slotsLeft}`} sub={t("auction.squadOf", { n: me.squadCount, max: a.squadMax })} />
          <Stat label={t("manager.overseas")} value={`${me.overseasCount}/${a.maxOverseas}`} />
        </section>

        <section className="rounded-[var(--radius-md)] border border-line bg-surface p-3">
          <h2 className="text-base">{t("manager.roleNeeds")}</h2>
          {needs.length === 0 ? (
            <p className="mt-1 text-sm text-muted">{t("manager.allRolesMet")}</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {needs.map((n) => (
                <li key={n.role} className="rounded-[var(--radius-xs)] border border-accent-edge px-2 py-1 text-sm font-semibold text-accent-text">
                  {t("manager.roleNeed", { role: roleInfo(snapshot, n.role).label, n: n.need })}
                </li>
              ))}
            </ul>
          )}
          {a.rtmEnabled ? <p className="mt-2 text-sm text-muted">{t("manager.cardsLeft", { label: a.rtmLabel, n: me.rtmCardsLeft })}</p> : null}
        </section>

        {myBids.length ? (
          <section className="rounded-[var(--radius-md)] border border-line bg-surface">
            <h2 className="border-b border-line px-3 py-2 text-base">{t("manager.lastBids")}</h2>
            <ol className="divide-y divide-line">
              {myBids.map((b, i) => {
                const team = teamById(snapshot, b.teamId);
                return (
                  <li key={b.id} className={`flex items-center gap-2 px-3 py-2 ${b.teamId === me.id ? "bg-success-surface" : ""}`}>
                    {team ? <TeamMark team={team} size={24} className="rounded-[var(--radius-xs)]" /> : null}
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold uppercase">{team?.name}</span>
                    <Price value={b.amount} tick={false} className={`text-base font-bold ${i === 0 ? "text-accent-text" : "text-muted"}`} />
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        <Shortlist snapshot={snapshot} onChanged={refetch} />

        <section className="rounded-[var(--radius-md)] border border-line bg-surface">
          <h2 className="border-b border-line px-3 py-2 text-base">
            {t("manager.mySquad")} <span className="num text-muted">({snapshot.me.squad.length})</span>
          </h2>
          {snapshot.me.squad.length === 0 ? (
            <p className="p-3 text-sm text-muted">{t("manager.squadEmpty")}</p>
          ) : (
            <ul className="divide-y divide-line">
              {snapshot.me.squad.map((s) => (
                <li key={s.auctionPlayerId} className="flex items-center gap-3 px-3 py-2">
                  <PlayerAvatar name={s.fullName} photoPath={s.photoPath} size={36} className="rounded-[var(--radius-xs)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{s.fullName}</p>
                    <p className="text-xs text-muted">
                      {roleInfo(snapshot, s.roleKey).label}
                      {s.status === "retained" ? ` / ${t("playerStatus.retained")}` : ""}
                    </p>
                  </div>
                  <span className="num font-bold text-accent-text">{formatPoints(s.soldPrice)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link href={`/auctions/${a.slug}`} className="link inline-flex items-center gap-2 text-sm text-muted hover:text-text" target="_blank">
            <Tv className="size-4" aria-hidden="true" />
            {t("manager.viewLive")}
          </Link>
          <LanguageSwitcher />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-bg px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={placeBid}
            disabled={block.kind !== "ok" || pending !== null}
            aria-describedby={reason ? "bid-reason" : undefined}
            className="num flex min-h-20 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] border-2 border-accent-edge bg-accent px-4 text-2xl font-extrabold text-accent-ink hover:bg-accent-hover active:bg-accent-press disabled:cursor-not-allowed disabled:border-line-strong disabled:bg-surface-2 disabled:text-muted sm:text-3xl"
          >
            <Gavel className="size-7 shrink-0" aria-hidden="true" />
            <span>
              {pending !== null
                ? t("manager.placing", { amount: formatPoints(pending) })
                : t("manager.bid", { amount: formatPoints(block.kind === "ok" ? block.amount : f.nextBidAmount ?? p?.basePrice ?? 0), unit })}
            </span>
          </button>
          {reason ? (
            <p id="bid-reason" className="mt-2 text-center text-sm font-semibold text-muted">
              {reason}
            </p>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onConfirm={() => startLeaving(() => leaveAction())}
        busy={leaving}
        title={t("manager.leaveConfirmTitle")}
        consequences={[t("manager.leaveConfirmBody", { team: me.name })]}
        confirmLabel={t("common.leaveAuction")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        danger
      />
      <span className="sr-only" lang={locale} />
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-text" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-line bg-surface px-3 py-2.5">
      <p className="text-xs font-semibold text-muted">{label}</p>
      <p className={`num text-2xl font-extrabold ${tone}`}>{value}</p>
      {sub ? <p className="text-xs text-faint">{sub}</p> : null}
    </div>
  );
}

function RtmPanel({ snapshot, meId, busy, onAction }: { snapshot: Snapshot; meId: string; busy: boolean; onAction: (action: string, amount?: number) => void }) {
  const { t } = useI18n();
  const f = snapshot.floor;
  const a = snapshot.auction;
  const unit = a.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const rtmTeam = teamById(snapshot, f.rtmTeamId);
  const minRaise = f.currentPrice + (incrementFor(a.slabs, f.currentPrice) ?? 1);
  const [raise, setRaise] = useState<string>("");
  if (f.phase !== "rtm_pending" || !leader || !rtmTeam) return null;

  const box = (title: string, body: React.ReactNode) => (
    <section role="region" aria-label={title} className="rounded-[var(--radius-md)] border-2 border-paused bg-info-surface p-4">
      <h2 className="text-lg">{title}</h2>
      <div className="mt-3">{body}</div>
    </section>
  );

  if (f.rtmStage === "offered" && meId === rtmTeam.id) {
    return box(
      t("manager.rtmOfferTitle", { label: a.rtmLabel }),
      <>
        <p className="text-sm text-muted">{t("manager.rtmOfferBody", { leader: leader.name, amount: formatPoints(f.currentPrice), unit, label: a.rtmLabel })}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="primary" size="lg" disabled={busy} onClick={() => onAction("match")}>
            {t("manager.rtmMatch", { amount: formatPoints(f.currentPrice) })}
          </Button>
          <Button size="lg" disabled={busy} onClick={() => onAction("decline")}>
            {t("manager.rtmDecline")}
          </Button>
        </div>
      </>,
    );
  }
  if (f.rtmStage === "awaiting_raise" && meId === leader.id) {
    const value = Number(raise);
    const valid = Number.isInteger(value) && value >= minRaise;
    return box(
      t("manager.rtmRaiseTitle", { team: rtmTeam.name }),
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onAction("raise", value);
        }}
        className="flex flex-col gap-3"
      >
        <Field name="rtm-raise" label={t("manager.rtmRaiseLabel")} hint={`${t("live.nextBid", { amount: formatPoints(minRaise), unit })}`}>
          <Input id="f-rtm-raise" type="number" inputMode="numeric" min={minRaise} step={1} value={raise} onChange={(e) => setRaise(e.target.value)} className="num text-xl" aria-describedby="f-rtm-raise-hint" />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" variant="primary" size="lg" disabled={busy || !valid}>
            {t("manager.rtmRaise")}
          </Button>
          <Button size="lg" disabled={busy} onClick={() => onAction("no_raise")}>
            {t("manager.rtmNoRaise")}
          </Button>
        </div>
      </form>,
    );
  }
  if (f.rtmStage === "raised" && meId === rtmTeam.id) {
    return box(
      t("manager.rtmMatchRaiseTitle", { leader: leader.name, amount: formatPoints(f.currentPrice), unit }),
      <div className="grid grid-cols-2 gap-2">
        <Button variant="primary" size="lg" disabled={busy} onClick={() => onAction("match_raise")}>
          {t("manager.rtmMatch", { amount: formatPoints(f.currentPrice) })}
        </Button>
        <Button size="lg" disabled={busy} onClick={() => onAction("decline_raise")}>
          {t("manager.rtmDecline")}
        </Button>
      </div>,
    );
  }
  return <p className="rounded-[var(--radius-md)] border border-paused bg-info-surface p-3 text-sm font-semibold">{t("manager.rtmWaiting", { label: a.rtmLabel })}</p>;
}

function Shortlist({ snapshot, onChanged }: { snapshot: ManagerSnapshot; onChanged: () => Promise<void> }) {
  const { t } = useI18n();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const listed = new Set(snapshot.me.shortlist.map((s) => s.auctionPlayerId));
  const isOn = (id: string) => optimistic[id] ?? listed.has(id);

  async function toggle(id: string) {
    const next = !isOn(id);
    setOptimistic((o) => ({ ...o, [id]: next }));
    try {
      const res = await fetch("/api/manager/shortlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ auctionPlayerId: id, on: next }) });
      if (!res.ok) throw new Error();
      await onChanged();
    } catch {
      /* roll back */
    }
    setOptimistic((o) => {
      const copy = { ...o };
      delete copy[id];
      return copy;
    });
  }

  const shortlist: ShortlistEntry[] = snapshot.me.shortlist.filter((s) => isOn(s.auctionPlayerId));
  const upcoming = snapshot.queue.filter((q) => q.auctionPlayerId !== snapshot.currentPlayer?.auctionPlayerId);

  const StarButton = ({ id, name }: { id: string; name: string }) => {
    const on = isOn(id);
    return (
      <button
        type="button"
        onClick={() => toggle(id)}
        aria-pressed={on}
        aria-label={on ? t("manager.removeFrom", { name }) : t("manager.add", { name })}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-transparent hover:border-line-strong"
      >
        <Star className={`size-5 ${on ? "fill-accent text-accent-text" : "text-muted"}`} aria-hidden="true" />
      </button>
    );
  };

  return (
    <>
      <section className="rounded-[var(--radius-md)] border border-line bg-surface">
        <div className="border-b border-line px-3 py-2">
          <h2 className="text-base">{t("manager.shortlist")}</h2>
          <p className="text-xs text-muted">{t("manager.shortlistHint")}</p>
        </div>
        {shortlist.length === 0 ? (
          <p className="p-3 text-sm text-muted">{t("manager.shortlistEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line">
            {shortlist.map((s) => (
              <li key={s.auctionPlayerId} className="flex items-center gap-3 px-3 py-1.5">
                <span className="num w-10 text-xs font-bold text-info">#{String(s.lotNo).padStart(3, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{s.fullName}</p>
                  <p className="text-xs text-muted">
                    {roleInfo(snapshot, s.roleKey).label} / {t(`playerStatus.${s.status as "pool"}`)}
                  </p>
                </div>
                <StarButton id={s.auctionPlayerId} name={s.fullName} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {upcoming.length ? (
        <section className="rounded-[var(--radius-md)] border border-line bg-surface">
          <h2 className="border-b border-line px-3 py-2 text-base">{t("manager.upcoming")}</h2>
          <ul className="divide-y divide-line">
            {upcoming.map((q) => (
              <li key={q.auctionPlayerId} className="flex items-center gap-3 px-3 py-1.5">
                <span className="num w-10 text-xs font-bold text-info">#{String(q.lotNo).padStart(3, "0")}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{q.fullName}</p>
                  <p className="text-xs text-muted">
                    {roleInfo(snapshot, q.roleKey).label} / {t("live.basePrice")} <span className="num">{formatPoints(q.basePrice)}</span>
                  </p>
                </div>
                <StarButton id={q.auctionPlayerId} name={q.fullName} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
