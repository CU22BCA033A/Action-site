"use client";

import { AlertTriangle, Check, Gavel, Hand, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Shuffle, Timer, Undo2, UserCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { ConnectionBanner, ConnectionIndicator, PhaseBadge, Price, teamById } from "@/components/live/bits";
import { useCountdown, useLiveAuction } from "@/components/live/use-live-auction";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormStatus, Input, Select, SelectWrap } from "@/components/ui/field";
import { floorAction, type FloorInput } from "@/lib/admin/actions/floor";
import type { ConsoleSnapshot, PoolEntry } from "@/lib/admin/console-data";
import { formatPoints } from "@/lib/format";
import type { EngineResult } from "@/lib/live/types";
import { incrementFor } from "@/lib/rules/slabs";

type Pending = { title: string; consequences: string[]; confirmLabel: string; danger?: boolean; requireReason?: boolean; input: (reason: string) => FloorInput; extra?: ReactNode } | null;


export function AuctionConsole({ initial, auctionId }: { initial: ConsoleSnapshot; auctionId: string }) {
  const router = useRouter();
  const live = useLiveAuction<ConsoleSnapshot>(initial, `/api/admin/auctions/${auctionId}/console`, { onUnauthorized: () => router.replace("/admin/login") });
  const { snapshot, connection, serverNow, applyFloor, refetch } = live;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [raise, setRaise] = useState("");

  // Presence changes without floor events; refresh it gently.
  useEffect(() => {
    const id = setInterval(() => void refetch(), 10_000);
    return () => clearInterval(id);
  }, [refetch]);

  const f = snapshot.floor;
  const a = snapshot.auction;
  const p = snapshot.currentPlayer;
  const unit = a.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const rtmTeam = teamById(snapshot, f.rtmTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);
  const auctionRunning = f.auctionStatus === "live";
  const floorBusy = f.phase === "live" || f.phase === "paused" || f.phase === "rtm_pending";
  const unsoldCount = snapshot.counts.unsold;
  const v = f.version;

  async function run(input: FloorInput, okText?: string) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    let res: EngineResult;
    try {
      res = await floorAction(input);
    } catch {
      res = { ok: false, code: "NETWORK", message: "Could not reach the server. Check the connection; nothing was changed unless the screen updates.", floor: null };
    }
    if (res.floor) applyFloor(res.floor);
    setFeedback({ ok: res.ok, text: res.ok ? (okText ?? res.message) : res.message });
    setBusy(false);
    setPending(null);
    void refetch();
  }

  const auctionPlayer = (entry: PoolEntry) => {
    if (entry.consentMissing) {
      setFeedback({ ok: false, text: `${entry.fullName} is under 18 without recorded guardian consent. Record consent on the Players tab first.` });
      return;
    }
    void run({ action: "auction_player", auctionId, auctionPlayerId: entry.auctionPlayerId, expectedVersion: v }, `${entry.fullName} is up. Bidding is open.`);
  };

  const confirm = (x: NonNullable<Pending>) => setPending(x);
  const nextBid = f.nextBidAmount;
  const canOfferRtm = a.rtmEnabled && p?.previousTeamId && leader && p.previousTeamId !== leader.id && (f.phase === "live" || f.phase === "paused");
  const prevTeam = teamById(snapshot, p?.previousTeamId);
  const minRaise = f.currentPrice + (incrementFor(a.slabs, f.currentPrice) ?? 1);
  const soldTeam = teamById(snapshot, f.lastResultTeamId);
  const shownTeam = f.phase === "sold" ? soldTeam : leader;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === p?.auctionPlayerId).slice(0, 5);

  return (
    <>
      <ConnectionBanner state={connection} />
      {!auctionRunning ? (
        <p className="border-b border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-4 py-2 text-center text-sm font-semibold">
          The auction is {f.auctionStatus}. {f.auctionStatus === "paused" ? "Resume the auction (top right) to allow bidding." : "Use Go live (top right) to start, then pick a player from the list."}
        </p>
      ) : null}
      <div className="mx-auto grid max-w-[96rem] grid-cols-[minmax(0,1fr)] gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:p-6">
        <section aria-labelledby="floor-title" className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <h2 id="floor-title" className="text-xl">Auction floor</h2>
            <ConnectionIndicator state={connection} />
          </div>

          {/* Player on the floor */}
          <div className={`overflow-hidden ${f.phase === "live" ? "card-gold pulse-gold" : "card"} ${f.phase === "sold" ? "!border-sold" : ""}`}>
            {p ? (
              <>
                <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                  <PhaseBadge phase={f.phase} hasPlayer />
                  <span className="num text-sm font-bold">#{p.lotNo}</span>
                  {p.round > 1 ? <span className="text-sm text-muted">Round {p.round}</span> : null}
                  {f.phase === "live" && left !== null ? (
                    <span className={`num ml-auto inline-flex items-center gap-1.5 text-2xl font-bold ${left <= 5 ? "text-live" : left <= 10 ? "text-warning" : "text-accent-text"}`}>
                      <Timer className="size-6" aria-hidden="true" /> {left}s
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
                  <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={104} priority className="rounded-[var(--radius-md)] border border-line" />
                  <div className="min-w-0 flex-1">
                    <p className="display text-2xl font-bold">{p.fullName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <RoleChip label={a.sportConfig.roles.find((r) => r.key === p.roleKey)?.label ?? p.roleKey} index={Math.max(0, a.sportConfig.roles.findIndex((r) => r.key === p.roleKey))} subRole={p.subRole} />
                      {p.category ? <Badge>{p.category}</Badge> : null}
                      {p.nationalityGroup === "overseas" ? <Badge tone="accent">Overseas</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">
                      Base price <span className="num font-semibold text-text">{formatPoints(p.basePrice)}</span>
                      {prevTeam ? `. Previous team: ${prevTeam.name}` : null}
                    </p>
                  </div>
                </div>
                <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
                  <div className="bg-surface px-4 py-4 text-center sm:px-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{f.phase === "sold" ? "Sold for" : leader ? "Current bid" : "Starts at"}</p>
                    <Price value={f.phase === "sold" ? f.lastResultPrice : f.currentPrice} className={`text-5xl font-bold ${f.phase === "sold" ? "text-remaining" : "text-gold"}`} />
                    {floorBusy && nextBid !== null && f.phase !== "rtm_pending" ? <p className="mt-1 text-sm text-muted">Next bid <span className="num font-semibold text-text">{formatPoints(nextBid)}</span></p> : null}
                  </div>
                  <div className="flex flex-col items-center justify-center bg-surface px-4 py-4 sm:px-5">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">{f.phase === "sold" ? "Bought by" : "Leading"}</p>
                    {shownTeam ? (
                      <p className="mt-2 flex items-center gap-3">
                        <TeamMark team={shownTeam} size={44} className="rounded-[var(--radius-sm)]" />
                        <span className="display text-xl font-bold uppercase">{shownTeam.name}</span>
                      </p>
                    ) : (
                      <p className="mt-2 text-muted">{f.phase === "unsold" ? "Nobody. Marked unsold." : "No bids yet"}</p>
                    )}
                  </div>
                </div>
                {bids.length ? (
                  <ol aria-label="Latest bids" className="flex flex-wrap gap-2 border-t border-line px-4 py-3">
                    {bids.map((b, i) => {
                      const t = teamById(snapshot, b.teamId);
                      return (
                        <li key={b.id} className={`num inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${i === 0 ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)] text-accent-text" : "border-line text-muted"}`}>
                          {t?.shortName} {formatPoints(b.amount)}
                          {b.source === "admin_on_behalf" ? <span className="font-normal">(admin)</span> : null}
                        </li>
                      );
                    })}
                  </ol>
                ) : null}
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <span className="inline-flex size-20 items-center justify-center rounded-full bg-surface-3 text-muted">
                  <Gavel className="size-9" aria-hidden="true" />
                </span>
                <p className="display text-xl font-bold">No player on the floor</p>
                <p className="max-w-sm text-sm text-muted">Pick any player from the list and press Auction. You choose who comes next; there is no fixed order.</p>
              </div>
            )}
          </div>

          <p aria-live="polite" className={`-my-2 min-h-5 text-sm font-semibold ${feedback ? (feedback.ok ? "text-remaining" : "text-danger") : ""}`}>
            {feedback?.text}
          </p>

          {/* Controls */}
          <div className="card flex flex-col gap-5 p-4 sm:p-5">
            <h3 className="flex items-center gap-2 text-lg"><Gavel className="size-5 text-accent-text" aria-hidden="true" /> Auction controls</h3>

            {p && f.phase === "idle" ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="lg" loading={busy} disabled={!auctionRunning} icon={<Play className="size-5" aria-hidden="true" />} onClick={() => run({ action: "start_bidding", auctionId, expectedVersion: v }, "Bidding is open.")}>
                  Start bidding
                </Button>
                <Button size="lg" disabled={busy} onClick={() => confirm({ title: `Mark ${p.fullName} unsold?`, consequences: ["Nobody has bid. The player goes to the unsold list and can be auctioned again later."], confirmLabel: "Mark unsold", input: () => ({ action: "mark_unsold", auctionId, expectedVersion: v }) })}>
                  Mark unsold
                </Button>
              </div>
            ) : null}

            {p && (f.phase === "live" || f.phase === "paused") ? (
              <>
                <div>
                  <p className="text-sm font-semibold text-muted">
                    Bid for a team{nextBid !== null ? <> at <span className="num text-text">{formatPoints(nextBid)}</span></> : null}. One tap places the bid.
                  </p>
                  <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                    {snapshot.teams.map((t) => {
                      const isLeader = t.id === f.leadingTeamId;
                      const canAfford = nextBid !== null && t.maxBid >= nextBid;
                      const online = snapshot.presence[t.id] ?? 0;
                      const disabled = busy || isLeader || !canAfford || f.phase !== "live" || !auctionRunning;
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            disabled={disabled}
                            onClick={() => run({ action: "bid_on_behalf", auctionId, teamId: t.id, idempotencyKey: crypto.randomUUID(), expectedVersion: v }, `${t.name} bids ${formatPoints(nextBid)}.`)}
                            aria-label={isLeader ? `${t.name} is leading` : canAfford ? `Bid ${formatPoints(nextBid)} for ${t.name}` : `${t.name} cannot afford ${formatPoints(nextBid)}`}
                            className={`relative flex w-full flex-col items-center gap-1.5 rounded-[var(--radius-sm)] border-2 p-3 text-center transition-[border-color,box-shadow] duration-200 disabled:cursor-not-allowed ${isLeader ? "border-royal bg-[color-mix(in_srgb,var(--royal)_18%,transparent)]" : canAfford ? "border-line hover:border-[color-mix(in_srgb,var(--accent)_60%,transparent)] hover:shadow-[0_0_20px_var(--glow-gold)]" : "border-line opacity-50"}`}
                          >
                            <TeamMark team={t} size={40} className="rounded-[var(--radius-sm)]" />
                            <span className="w-full truncate text-xs font-bold uppercase">{t.name}</span>
                            <span className={`num text-xs font-bold ${canAfford ? "text-accent-text" : "text-danger"}`}>{formatPoints(t.purseLeft)} left</span>
                            {isLeader ? <span className="text-[0.7rem] font-bold uppercase text-royal-light">Leading</span> : null}
                            {!canAfford && !isLeader ? <AlertTriangle className="absolute right-1.5 top-1.5 size-3.5 text-danger" aria-hidden="true" /> : null}
                            <span aria-hidden="true" title={online ? "Owner online" : "Owner offline"} className={`absolute left-1.5 top-1.5 size-2 rounded-full ${online ? "bg-sold" : "border border-line-strong"}`} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  {f.phase === "live" ? (
                    <Button disabled={busy} icon={<Pause className="size-4" aria-hidden="true" />} onClick={() => run({ action: "pause_floor", auctionId, expectedVersion: v }, "Bidding paused.")}>Pause</Button>
                  ) : (
                    <Button variant="primary" disabled={busy || !auctionRunning} icon={<Play className="size-4" aria-hidden="true" />} onClick={() => run({ action: "resume_floor", auctionId, expectedVersion: v }, "Bidding resumed.")}>Resume</Button>
                  )}
                  {leader ? (
                    <Button disabled={busy} icon={<Undo2 className="size-4" aria-hidden="true" />} onClick={() => confirm({ title: "Undo the last bid?", consequences: [`The bid of ${formatPoints(f.currentPrice)} from ${leader.name} is voided and kept in the history as undone.`, "The price and leader go back to the bid before it."], confirmLabel: "Undo last bid", danger: true, input: () => ({ action: "undo_last_bid", auctionId, expectedVersion: v }) })}>Undo last bid</Button>
                  ) : null}
                  {a.bidTimerSeconds && f.phase === "live" ? (
                    <Button disabled={busy} icon={<RotateCcw className="size-4" aria-hidden="true" />} onClick={() => run({ action: "reset_timer", auctionId, expectedVersion: v }, "Timer reset.")}>Reset timer</Button>
                  ) : null}
                  {canOfferRtm && prevTeam ? (
                    <Button disabled={busy} icon={<Hand className="size-4" aria-hidden="true" />} onClick={() => confirm({ title: `Offer ${a.rtmLabel} to ${prevTeam.name}?`, consequences: [`Bidding stops. ${prevTeam.name} may match ${formatPoints(f.currentPrice)} ${unit}.`, `${prevTeam.name} has ${prevTeam.rtmCardsLeft} cards left. A card is used only if they end up buying the player.`, a.rtmAllowFinalRaise ? `If they match, ${leader!.name} may raise once.` : "If they match, they buy the player at this price."], confirmLabel: `Offer ${a.rtmLabel}`, input: () => ({ action: "rtm", step: "offer", auctionId, expectedVersion: v }) })}>Offer {a.rtmLabel}</Button>
                  ) : null}
                  <Button variant="ghost" disabled={busy} aria-expanded={moreOpen} icon={<MoreHorizontal className="size-4" aria-hidden="true" />} onClick={() => setMoreOpen((o) => !o)}>More</Button>
                </div>
                {moreOpen ? <MoreActions disabled={busy} onReturn={() => confirm({ title: `Take ${p.fullName} off the floor?`, consequences: ["The player goes back to the list without a result.", leader ? "All bids on this player are voided and kept in the history." : "There are no bids to void."], confirmLabel: "Take off the floor", danger: true, input: () => ({ action: "return_to_pool", auctionId, auctionPlayerId: p.auctionPlayerId, expectedVersion: v }) })} onAssign={() => setAssignOpen(true)} /> : null}

                <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
                  <Button variant="danger" size="xl" disabled={busy || Boolean(leader)} icon={<X className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: `Mark ${p.fullName} unsold?`, consequences: ["Nobody has bid. The player goes to the unsold list and can be auctioned again later."], confirmLabel: "Mark unsold", input: () => ({ action: "mark_unsold", auctionId, expectedVersion: v }) })}>
                    Unsold
                  </Button>
                  <Button variant="sold" size="xl" disabled={busy || !leader} icon={<Check className="size-5" aria-hidden="true" />} onClick={() => leader && confirm({ title: `Sell ${p.fullName} to ${leader.name}?`, consequences: [`${leader.name} buys ${p.fullName} for ${formatPoints(f.currentPrice)} ${unit}.`, `${leader.name}'s purse goes down by ${formatPoints(f.currentPrice)}.`], confirmLabel: `Sold to ${leader.shortName}`, input: () => ({ action: "mark_sold", auctionId, expectedVersion: v }) })}>
                    Sold
                  </Button>
                </div>
                {leader ? <p className="-mt-3 text-xs text-muted">Unsold is available only while nobody has bid. Use Undo last bid first if needed.</p> : null}
              </>
            ) : null}

            {!floorBusy ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-muted">{p && (f.phase === "sold" || f.phase === "unsold") ? "Done. Pick the next player from the list." : "Pick a player from the list to start bidding."}</p>
                {unsoldCount > 0 ? (
                  <div>
                    <Button disabled={busy} icon={<Shuffle className="size-4" aria-hidden="true" />} onClick={() => confirm({ title: "Start an accelerated round?", consequences: [`All ${unsoldCount} unsold players become available again.`, `This becomes round ${a.currentRound + 1}.`], confirmLabel: "Start accelerated round", input: () => ({ action: "start_accelerated_round", auctionId, expectedVersion: v }) })}>
                      Accelerated round ({unsoldCount} unsold)
                    </Button>
                  </div>
                ) : null}
                {p && f.phase === "idle" ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" disabled={busy} onClick={() => confirm({ title: `Take ${p.fullName} off the floor?`, consequences: ["The player goes back to the list without a result."], confirmLabel: "Take off the floor", input: () => ({ action: "return_to_pool", auctionId, auctionPlayerId: p.auctionPlayerId, expectedVersion: v }) })}>Take off the floor</Button>
                    <Button variant="ghost" disabled={busy} icon={<UserCheck className="size-4" aria-hidden="true" />} onClick={() => setAssignOpen(true)}>Assign directly</Button>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* RTM steps answered by the admin for teams in the room */}
            {f.phase === "rtm_pending" && rtmTeam && leader ? (
              <div className="rounded-[var(--radius-md)] border-2 border-paused bg-info-surface p-4">
                <p className="font-semibold">
                  {f.rtmStage === "offered" ? `${a.rtmLabel}: waiting for ${rtmTeam.name} to match ${formatPoints(f.currentPrice)} or decline.` : f.rtmStage === "awaiting_raise" ? `${rtmTeam.name} matched. ${leader.name} may raise once.` : `${leader.name} raised to ${formatPoints(f.currentPrice)}. ${rtmTeam.name} may match.`}
                </p>
                <p className="mt-1 text-sm text-muted">Team owners can answer from their phones. You can also answer for them here.</p>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {f.rtmStage === "offered" ? (
                    <>
                      <Button variant="primary" disabled={busy} onClick={() => confirm({ title: `${rtmTeam.name} matches?`, consequences: [a.rtmAllowFinalRaise ? `${leader.name} then gets one chance to raise.` : `${rtmTeam.name} buys the player for ${formatPoints(f.currentPrice)} and uses one card.`], confirmLabel: "Record match", input: () => ({ action: "rtm", step: "match", auctionId, expectedVersion: v }) })}>{rtmTeam.shortName} matches</Button>
                      <Button disabled={busy} onClick={() => confirm({ title: `${rtmTeam.name} declines?`, consequences: [`${leader.name} buys the player for ${formatPoints(f.currentPrice)}.`, `${rtmTeam.name} keeps its card.`], confirmLabel: "Record decline", input: () => ({ action: "rtm", step: "decline", auctionId, expectedVersion: v }) })}>{rtmTeam.shortName} declines</Button>
                    </>
                  ) : f.rtmStage === "awaiting_raise" ? (
                    <>
                      <Field name="raise" label={`Raise for ${leader.shortName} (at least ${formatPoints(minRaise)})`}>
                        <Input id="f-raise" inputMode="numeric" className="num w-40" value={raise} onChange={(e) => setRaise(e.target.value.replace(/[^\d]/g, ""))} />
                      </Field>
                      <Button variant="primary" disabled={busy || Number(raise) < minRaise} onClick={() => confirm({ title: `${leader.name} raises to ${formatPoints(Number(raise))}?`, consequences: [`${rtmTeam.name} may then match the new price.`], confirmLabel: "Record raise", input: () => ({ action: "rtm", step: "raise", amount: Number(raise), auctionId, expectedVersion: v }) })}>Raise</Button>
                      <Button disabled={busy} onClick={() => confirm({ title: `${leader.name} does not raise?`, consequences: [`${rtmTeam.name} buys the player for ${formatPoints(f.currentPrice)} and uses one card.`], confirmLabel: "Record no raise", input: () => ({ action: "rtm", step: "no_raise", auctionId, expectedVersion: v }) })}>No raise</Button>
                    </>
                  ) : (
                    <>
                      <Button variant="primary" disabled={busy} onClick={() => confirm({ title: `${rtmTeam.name} matches ${formatPoints(f.currentPrice)}?`, consequences: [`${rtmTeam.name} buys the player and uses one card.`], confirmLabel: "Record match", input: () => ({ action: "rtm", step: "match_raise", auctionId, expectedVersion: v }) })}>{rtmTeam.shortName} matches</Button>
                      <Button disabled={busy} onClick={() => confirm({ title: `${rtmTeam.name} declines?`, consequences: [`${leader.name} buys the player for ${formatPoints(f.currentPrice)}.`], confirmLabel: "Record decline", input: () => ({ action: "rtm", step: "decline_raise", auctionId, expectedVersion: v }) })}>{rtmTeam.shortName} declines</Button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <PlayerPicker snapshot={snapshot} disabled={busy || floorBusy || !auctionRunning} disabledReason={!auctionRunning ? "Go live first." : floorBusy ? "Finish the player on the floor first." : ""} onAuction={auctionPlayer} />
      </div>

      <ConfirmDialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending?.title ?? ""}
        consequences={pending?.consequences ?? []}
        confirmLabel={pending?.confirmLabel ?? "Confirm"}
        danger={pending?.danger}
        requireReason={pending?.requireReason}
        busy={busy}
        onConfirm={(reason) => pending && run(pending.input(reason))}
      >
        {pending?.extra}
      </ConfirmDialog>
      {assignOpen && p ? <AssignDialog snapshot={snapshot} playerName={p.fullName} onClose={() => setAssignOpen(false)} onAssign={(teamId, price, reason) => run({ action: "force_assign", auctionId, auctionPlayerId: p.auctionPlayerId, teamId, price, reason, expectedVersion: v }).then(() => setAssignOpen(false))} busy={busy} /> : null}
    </>
  );
}

function MoreActions({ disabled, onReturn, onAssign }: { disabled: boolean; onReturn: () => void; onAssign: () => void }) {
  return (
    <div className="flex flex-wrap gap-2 rounded-[var(--radius-sm)] border border-line p-3">
      <Button variant="ghost" disabled={disabled} icon={<X className="size-4" aria-hidden="true" />} onClick={onReturn}>Take off the floor</Button>
      <Button variant="ghost" disabled={disabled} icon={<UserCheck className="size-4" aria-hidden="true" />} onClick={onAssign}>Assign directly</Button>
    </div>
  );
}

type StatusFilter = "all" | "pool" | "unsold";

/** The admin's player list: any waiting player can be auctioned next, in any order. */
function PlayerPicker({ snapshot, disabled, disabledReason, onAuction }: { snapshot: ConsoleSnapshot; disabled: boolean; disabledReason: string; onAuction: (e: PoolEntry) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [role, setRole] = useState("");
  const [category, setCategory] = useState("");
  const roles = snapshot.auction.sportConfig.roles;
  const categories = snapshot.auction.sportConfig.categories;
  const needle = q.trim().toLowerCase().replace(/^#/, "");
  const list = useMemo(
    () =>
      snapshot.pool.filter(
        (x) =>
          (status === "all" || x.status === status) &&
          (!role || x.roleKey === role) &&
          (!category || x.category === category) &&
          (!needle || x.fullName.toLowerCase().includes(needle) || String(x.lotNo) === needle),
      ),
    [snapshot.pool, status, role, category, needle],
  );
  const available = snapshot.pool.filter((x) => x.status === "pool").length;
  const unsold = snapshot.pool.length - available;

  return (
    <section aria-labelledby="picker-title" className="card flex min-h-0 flex-col self-start lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)]">
      <div className="border-b border-line p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="picker-title" className="text-lg">Players</h2>
          <p className="num flex gap-3 text-xs font-bold">
            <span className="text-royal-light">Available {available}</span>
            <span className="text-muted">Unsold {unsold}</span>
          </p>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <div className="relative">
            <label htmlFor="pick-q" className="sr-only">Search by name or number</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="pick-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" placeholder="Search by name or number" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <SelectWrap>
              <label htmlFor="pick-status" className="sr-only">Status</label>
              <Select id="pick-status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="h-10 text-sm">
                <option value="all">All</option>
                <option value="pool">Available</option>
                <option value="unsold">Unsold</option>
              </Select>
            </SelectWrap>
            <SelectWrap>
              <label htmlFor="pick-role" className="sr-only">Role</label>
              <Select id="pick-role" value={role} onChange={(e) => setRole(e.target.value)} className="h-10 text-sm">
                <option value="">All roles</option>
                {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
              </Select>
            </SelectWrap>
            <SelectWrap>
              <label htmlFor="pick-cat" className="sr-only">Category</label>
              <Select id="pick-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 text-sm" disabled={categories.length === 0}>
                <option value="">Category</option>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </SelectWrap>
          </div>
          {disabled && disabledReason ? <p className="text-xs text-muted">{disabledReason}</p> : null}
        </div>
      </div>
      <ul className="flex max-h-[32rem] flex-col gap-2 overflow-y-auto p-3 scrollbar-thin lg:max-h-none lg:flex-1">
        {list.length === 0 ? <li className="p-2 text-sm text-muted">{snapshot.pool.length === 0 ? "Every player has a result." : "No players match these filters."}</li> : null}
        {list.map((x) => {
          const r = roles.find((y) => y.key === x.roleKey);
          return (
            <li key={x.auctionPlayerId} className="flex items-center gap-3 rounded-[var(--radius-sm)] border border-line bg-[color-mix(in_srgb,var(--surface-2)_60%,transparent)] p-2.5">
              <PlayerAvatar name={x.fullName} photoPath={x.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-semibold">{x.fullName}</span>
                  <span className="num shrink-0 rounded-[var(--radius-xs)] bg-[color-mix(in_srgb,var(--royal)_20%,transparent)] px-1.5 text-xs font-bold text-royal-light">#{x.lotNo}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {[r?.label ?? x.roleKey, x.category, `${formatPoints(x.basePrice)} base`].filter(Boolean).join(" / ")}
                </p>
                {x.consentMissing ? <p className="text-xs font-semibold text-danger">Guardian consent missing</p> : null}
              </div>
              <Button
                size="sm"
                variant={x.status === "unsold" ? "secondary" : "primary"}
                disabled={disabled}
                icon={<Plus className="size-3.5" aria-hidden="true" />}
                onClick={() => onAuction(x)}
                aria-label={`${x.status === "unsold" ? "Re-auction" : "Auction"} ${x.fullName}`}
                className="shrink-0"
              >
                {x.status === "unsold" ? "Re-auction" : "Auction"}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AssignDialog({ snapshot, playerName, onClose, onAssign, busy }: { snapshot: ConsoleSnapshot; playerName: string; onClose: () => void; onAssign: (teamId: string, price: number, reason: string) => void; busy: boolean }) {
  const [teamId, setTeamId] = useState(snapshot.teams[0]?.id ?? "");
  const [price, setPrice] = useState(String(snapshot.currentPlayer?.basePrice ?? 0));
  const team = teamById(snapshot, teamId);
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={`Assign ${playerName} directly?`}
      consequences={[
        "Skips bidding and gives the player to the chosen team at the price you enter.",
        "Any bids on this player are voided and kept in the history.",
        team ? `${team.name} has ${formatPoints(team.purseLeft)} left. The purse limit still applies.` : "",
      ].filter(Boolean)}
      confirmLabel="Assign player"
      danger
      requireReason
      busy={busy}
      onConfirm={(reason) => onAssign(teamId, Number(price), reason)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="assign-team" label="Team">
          <SelectWrap>
            <Select id="f-assign-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
              {snapshot.teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
          </SelectWrap>
        </Field>
        <Field name="assign-price" label={`Price (${snapshot.auction.pointsUnitLabel})`}>
          <Input id="f-assign-price" inputMode="numeric" className="num" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        </Field>
      </div>
      {price === "" ? <FormStatus kind="error">Enter a price.</FormStatus> : null}
    </ConfirmDialog>
  );
}
