"use client";

import { ChevronDown, Gavel, LogOut, Radio, Tv } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { useI18n } from "@/components/i18n/i18n-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { ConnectionBanner, ConnectionIndicator, roleInfo, teamById } from "@/components/live/bits";
import { PlayerSpotlight } from "@/components/live/player-spotlight";
import { useCountdown, useLiveAuction } from "@/components/live/use-live-auction";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input } from "@/components/ui/field";
import { leaveAction } from "@/lib/auth/join-actions";
import type { ManagerSnapshot } from "@/lib/data/manager";
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

  const needs = roleNeeds(a.roleMinimums, me.roleCounts);
  const rulesChanged = a.settingsVersion > seenSettings;

  return (
    <div className="flex min-h-dvh flex-col pb-44">
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--surface)_90%,transparent)] shadow-[var(--card-shadow)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
          <TeamMark team={me} size={44} className="rounded-[var(--radius-sm)] border-2 border-[color-mix(in_srgb,var(--accent)_40%,transparent)]" />
          <div className="min-w-0 flex-1">
            <p className="display truncate text-base font-bold uppercase">{me.name}</p>
            <p className="truncate text-xs text-muted">{a.name}</p>
          </div>
          <ConnectionIndicator state={connection} compact />
          <Button variant="ghost" size="sm" onClick={() => setLeaveOpen(true)} icon={<LogOut className="size-4" aria-hidden="true" />} aria-label={t("common.leaveAuction")}>
            <span className="sr-only">{t("common.leaveAuction")}</span>
          </Button>
        </div>
      </header>
      <ConnectionBanner state={connection} />
      {a.rehearsal ? <p className="border-b border-paused bg-info-surface px-4 py-2 text-center text-sm font-semibold">{t("common.rehearsalNote")}</p> : null}

      <main id="main" className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-4">
        <h1 className="sr-only">{t("manager.metaTitle")}</h1>
        {rulesChanged ? (
          <div role="status" className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-3 text-sm">
            <span>{t("manager.rulesUpdated")}</span>
            <Button size="sm" variant="ghost" onClick={() => setSeenSettings(a.settingsVersion)}>
              {t("common.close")}
            </Button>
          </div>
        ) : null}

        <section aria-label={t("manager.purseLeft")} className="grid grid-cols-2 gap-3">
          <Stat label={t("manager.purseLeft")} value={formatPoints(me.purseLeft)} tone="text-remaining" />
          <Stat label={t("manager.maxBid")} value={formatPoints(me.maxBid)} tone="text-accent-text" />
        </section>
        <p className="num -mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          <span>{t("auction.squadOf", { n: me.squadCount, max: a.squadMax })}</span>
          {a.maxOverseas > 0 ? <span>{t("manager.overseas")} {me.overseasCount}/{a.maxOverseas}</span> : null}
          {a.rtmEnabled ? <span>{t("manager.cardsLeft", { label: a.rtmLabel, n: me.rtmCardsLeft })}</span> : null}
          {needs.length ? <span className="font-semibold text-accent-text">{needs.map((n) => t("manager.roleNeed", { role: roleInfo(snapshot, n.role).label, n: n.need })).join(", ")}</span> : null}
        </p>

        {p ? (
          <div aria-live="polite">
            <PlayerSpotlight snapshot={snapshot} timerLeft={left} />
            {f.leadingTeamId === me.id && f.phase === "live" ? (
              <p className="mt-3 rounded-full border border-sold bg-[color-mix(in_srgb,var(--sold)_18%,transparent)] px-4 py-2 text-center font-bold text-remaining">{t("manager.youLead")}</p>
            ) : null}
          </div>
        ) : (
          <section className="card-gold flex flex-col items-center gap-4 px-6 py-14 text-center">
            <span className="inline-flex size-20 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-3)_60%,transparent)] text-muted">
              <Radio className="size-9" aria-hidden="true" />
            </span>
            <h2 className="text-xl">{t("live.waitingTitle")}</h2>
            <p className="text-sm text-muted">{t("manager.noPlayer")}</p>
          </section>
        )}

        <RtmPanel snapshot={snapshot} meId={me.id} busy={pending !== null} onAction={rtm} />

        <p aria-live="polite" className={`min-h-6 text-center text-sm font-semibold ${feedback?.kind === "error" ? "text-danger" : "text-remaining"}`}>
          {feedback?.text}
        </p>

        <details className="card group">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="display text-base font-bold">
              {t("manager.mySquad")} <span className="num text-muted">({snapshot.me.squad.length})</span>
            </span>
            <ChevronDown className="size-5 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          {snapshot.me.squad.length === 0 ? (
            <p className="border-t border-line p-4 text-sm text-muted">{t("manager.squadEmpty")}</p>
          ) : (
            <ul className="flex flex-col gap-2 border-t border-line p-3">
              {snapshot.me.squad.map((s) => (
                <li key={s.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)] p-2.5">
                  <PlayerAvatar name={s.fullName} photoPath={s.photoPath} size={52} className="rounded-[var(--radius-sm)]" />
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
        </details>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <Link href={`/auctions/${a.slug}`} className="link inline-flex items-center gap-2 text-sm text-muted hover:text-text" target="_blank">
            <Tv className="size-4" aria-hidden="true" />
            {t("manager.viewLive")}
          </Link>
          <LanguageSwitcher />
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_srgb,var(--surface)_94%,transparent)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={placeBid}
            disabled={block.kind !== "ok" || pending !== null}
            aria-describedby={reason ? "bid-reason" : undefined}
            className="num flex min-h-20 w-full items-center justify-center gap-3 rounded-[var(--radius-md)] bg-[linear-gradient(90deg,var(--accent),var(--gold-dark))] px-4 text-2xl font-bold uppercase text-accent-ink shadow-[0_8px_30px_var(--glow-gold)] transition-transform active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-none disabled:bg-surface-3 disabled:text-muted disabled:shadow-none sm:text-3xl"
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
    <div className="card px-4 py-3 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className={`display mt-1 text-2xl font-bold sm:text-3xl ${tone}`}>{value}</p>
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
