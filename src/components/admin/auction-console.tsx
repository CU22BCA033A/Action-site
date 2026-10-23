"use client";

import { DndContext, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRightToLine, Gavel, GripVertical, Hand, Pause, Play, RotateCcw, Search, Shuffle, Timer, Undo2, UserCheck, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { ConnectionBanner, ConnectionIndicator, PhaseBadge, Price, teamById } from "@/components/live/bits";
import { useCountdown, useLiveAuction } from "@/components/live/use-live-auction";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormStatus, Input, Select, SelectWrap } from "@/components/ui/field";
import { floorAction, type FloorInput } from "@/lib/admin/actions/floor";
import type { ConsoleSnapshot, PoolEntry } from "@/lib/admin/console-data";
import { formatPoints, formatTime } from "@/lib/format";
import type { EngineResult, PublicTeam } from "@/lib/live/types";
import { incrementFor } from "@/lib/rules/slabs";

type Pending = { title: string; consequences: string[]; confirmLabel: string; danger?: boolean; requireReason?: boolean; input: (reason: string) => FloorInput; extra?: ReactNode } | null;

const ACTION_LABEL: Record<string, string> = {
  "floor.move_to_floor": "Player put on the floor",
  "floor.start": "Bidding opened",
  "floor.pause": "Bidding paused",
  "floor.resume": "Bidding resumed",
  "floor.reset_timer": "Timer reset",
  "floor.sold": "Sold",
  "floor.unsold": "Marked unsold",
  "floor.return_to_pool": "Returned to pool",
  "floor.force_assign": "Assigned directly",
  "floor.accelerated_round": "Accelerated round started",
  "bid.placed": "Bid from a team owner",
  "bid.placed_on_behalf": "Bid entered by admin",
  "bid.undone": "Last bid undone",
  "auction.settings": "Rules changed",
  "auction.status": "Auction status changed",
  "queue.reorder": "Queue reordered",
  "team.join": "Team owner joined",
  "team.adjust_purse": "Purse changed",
};

export function AuctionConsole({ initial, auctionId }: { initial: ConsoleSnapshot; auctionId: string }) {
  const router = useRouter();
  const live = useLiveAuction<ConsoleSnapshot>(initial, `/api/admin/auctions/${auctionId}/console`, { onUnauthorized: () => router.replace("/admin/login") });
  const { snapshot, connection, serverNow, applyFloor, refetch } = live;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [behalfTeam, setBehalfTeam] = useState("");
  const [raise, setRaise] = useState("");
  // Stable id keeps the drag library's generated attributes identical on server and client.
  const dndId = useId();

  // Presence and the audit feed change without floor events; refresh them gently.
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
  const nextUp = snapshot.pool.find((x) => x.status === "pool") ?? snapshot.pool[0];
  const unsoldCount = snapshot.counts.unsold;

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

  const v = f.version;
  const sendToFloor = (entry: PoolEntry) => {
    if (entry.consentMissing) {
      setFeedback({ ok: false, text: `${entry.fullName} is under 18 without recorded guardian consent. Record consent on the Players tab first.` });
      return;
    }
    void run({ action: "move_to_floor", auctionId, auctionPlayerId: entry.auctionPlayerId, expectedVersion: v }, `${entry.fullName} is on the floor.`);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over?.id !== "floor") return;
    const entry = snapshot.pool.find((x) => x.auctionPlayerId === e.active.id);
    if (entry) sendToFloor(entry);
  };

  const confirm = (x: NonNullable<Pending>) => setPending(x);
  const nextBid = f.nextBidAmount;
  const behalf = teamById(snapshot, behalfTeam);
  const canOfferRtm = a.rtmEnabled && p?.previousTeamId && leader && p.previousTeamId !== leader.id && (f.phase === "live" || f.phase === "paused");
  const prevTeam = teamById(snapshot, p?.previousTeamId);
  const minRaise = f.currentPrice + (incrementFor(a.slabs, f.currentPrice) ?? 1);

  return (
    <DndContext id={dndId} sensors={sensors} onDragEnd={onDragEnd}>
      <ConnectionBanner state={connection} />
      {!auctionRunning ? (
        <p className="border-b border-accent-edge bg-surface-2 px-4 py-2 text-center text-sm font-semibold">
          The auction is {f.auctionStatus}. {f.auctionStatus === "paused" ? "Resume the auction (top right) to allow bidding." : "Use Go live (top right) to start, then put players on the floor."}
        </p>
      ) : null}
      <div className="grid gap-4 p-4 xl:h-[calc(100dvh-11.5rem)] xl:grid-cols-[19rem_minmax(0,1fr)_21rem] xl:overflow-hidden">
        <PoolPane snapshot={snapshot} disabled={busy || floorBusy || !auctionRunning} onSend={sendToFloor} />

        <section aria-labelledby="floor-title" className="order-first flex min-w-0 flex-col gap-4 xl:order-none xl:overflow-y-auto xl:pr-1 scrollbar-thin">
          <div className="flex items-center justify-between gap-3">
            <h2 id="floor-title" className="text-xl">Auction floor</h2>
            <ConnectionIndicator state={connection} />
          </div>
          <p aria-live="polite" className={`min-h-5 text-sm font-semibold ${feedback ? (feedback.ok ? "text-sold" : "text-danger") : ""}`}>
            {feedback?.text}
          </p>
          <FloorDrop>
            {p ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <PhaseBadge phase={f.phase} hasPlayer />
                  <span className="num font-bold text-info">Lot {p.lotNo}</span>
                  <span className="text-sm text-muted">{p.setName}{p.round > 1 ? `, round ${p.round}` : ""}</span>
                  {f.phase === "live" && left !== null ? (
                    <span className={`num ml-auto inline-flex items-center gap-1 text-2xl font-bold ${left <= 5 ? "text-live" : ""}`}>
                      <Timer className="size-6" aria-hidden="true" /> {left}s
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={112} priority className="rounded-[var(--radius-md)] border border-line" />
                  <div className="min-w-0 flex-1">
                    <p className="display text-2xl font-bold">{p.fullName}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <RoleChip label={a.sportConfig.roles.find((r) => r.key === p.roleKey)?.label ?? p.roleKey} index={Math.max(0, a.sportConfig.roles.findIndex((r) => r.key === p.roleKey))} subRole={p.subRole} />
                      {p.category ? <Badge>Cat {p.category}</Badge> : null}
                      {p.nationalityGroup === "overseas" ? <Badge tone="accent">Overseas</Badge> : null}
                      {prevTeam ? <span className="text-sm text-muted">Previous team: {prevTeam.name}</span> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">Base price <span className="num font-semibold text-text">{formatPoints(p.basePrice)}</span></p>
                  </div>
                </div>
                <div className="grid gap-px overflow-hidden rounded-[var(--radius-md)] border border-line bg-line sm:grid-cols-2">
                  <div className="bg-surface-2 p-4">
                    <p className="text-sm font-semibold text-muted">{f.phase === "sold" ? "Sold for" : "Current price"}</p>
                    <Price value={f.phase === "sold" ? f.lastResultPrice : f.currentPrice} className="text-5xl font-extrabold text-accent-text" />
                    {floorBusy && nextBid !== null && f.phase !== "rtm_pending" ? <p className="mt-1 text-sm text-muted">Next bid: <span className="num">{formatPoints(nextBid)}</span> {unit}</p> : null}
                  </div>
                  <div className="bg-surface-2 p-4">
                    <p className="text-sm font-semibold text-muted">{f.phase === "sold" ? "Bought by" : "Leading"}</p>
                    {(f.phase === "sold" ? teamById(snapshot, f.lastResultTeamId) : leader) ? (
                      <p className="mt-1 flex items-center gap-3">
                        <TeamMark team={(f.phase === "sold" ? teamById(snapshot, f.lastResultTeamId) : leader)!} size={44} className="rounded-[var(--radius-sm)]" />
                        <span className="display text-xl font-bold uppercase">{(f.phase === "sold" ? teamById(snapshot, f.lastResultTeamId) : leader)!.name}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-muted">{f.phase === "unsold" ? "Nobody. Marked unsold." : "No bids yet"}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <ArrowRightToLine className="size-10 text-muted" aria-hidden="true" />
                <p className="text-lg font-semibold">Drop a player here</p>
                <p className="max-w-sm text-sm text-muted">Drag a card from the pool, or press Send to floor on any player. Next up: {nextUp ? `#${nextUp.lotNo} ${nextUp.fullName}` : "nobody, the pool is empty"}.</p>
              </div>
            )}
          </FloorDrop>

          {/* Controls */}
          <div className="flex flex-wrap gap-2">
            {p && f.phase === "idle" ? (
              <>
                <Button variant="primary" size="lg" loading={busy} disabled={!auctionRunning} icon={<Play className="size-5" aria-hidden="true" />} onClick={() => run({ action: "start_bidding", auctionId, expectedVersion: v }, "Bidding is open.")}>
                  Start bidding
                </Button>
                <Button size="lg" disabled={busy} onClick={() => confirm({ title: `Mark ${p.fullName} unsold?`, consequences: ["Nobody has bid. The player goes to the unsold list and can come back in an accelerated round."], confirmLabel: "Mark unsold", input: () => ({ action: "mark_unsold", auctionId, expectedVersion: v }) })}>
                  Mark unsold
                </Button>
              </>
            ) : null}
            {p && (f.phase === "live" || f.phase === "paused") ? (
              <>
                {leader ? (
                  <Button variant="sold" size="lg" disabled={busy} icon={<Gavel className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: `Sell ${p.fullName}?`, consequences: [`${leader.name} buys ${p.fullName} for ${formatPoints(f.currentPrice)} ${unit}.`, `${leader.name}'s purse goes down by ${formatPoints(f.currentPrice)} and the player joins its squad.`, "Bidding on this player closes."], confirmLabel: `Sold to ${leader.shortName}`, input: () => ({ action: "mark_sold", auctionId, expectedVersion: v }) })}>
                    Sold to {leader.shortName} for {formatPoints(f.currentPrice)}
                  </Button>
                ) : (
                  <Button size="lg" disabled={busy} onClick={() => confirm({ title: `Mark ${p.fullName} unsold?`, consequences: ["Nobody has bid. The player goes to the unsold list."], confirmLabel: "Mark unsold", input: () => ({ action: "mark_unsold", auctionId, expectedVersion: v }) })}>
                    Mark unsold
                  </Button>
                )}
                {f.phase === "live" ? (
                  <Button size="lg" disabled={busy} icon={<Pause className="size-5" aria-hidden="true" />} onClick={() => run({ action: "pause_floor", auctionId, expectedVersion: v }, "Bidding paused.")}>
                    Pause
                  </Button>
                ) : (
                  <Button variant="primary" size="lg" disabled={busy || !auctionRunning} icon={<Play className="size-5" aria-hidden="true" />} onClick={() => run({ action: "resume_floor", auctionId, expectedVersion: v }, "Bidding resumed.")}>
                    Resume
                  </Button>
                )}
                {leader ? (
                  <Button size="lg" disabled={busy} icon={<Undo2 className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: "Undo the last bid?", consequences: [`The bid of ${formatPoints(f.currentPrice)} from ${leader.name} is voided and kept in the history as undone.`, "The price and leader go back to the bid before it."], confirmLabel: "Undo last bid", danger: true, input: () => ({ action: "undo_last_bid", auctionId, expectedVersion: v }) })}>
                    Undo last bid
                  </Button>
                ) : null}
                {a.bidTimerSeconds && f.phase === "live" ? (
                  <Button size="lg" disabled={busy} icon={<RotateCcw className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: "Reset the timer?", consequences: [`The clock restarts at ${a.bidTimerSeconds} seconds for this player.`], confirmLabel: "Reset timer", input: () => ({ action: "reset_timer", auctionId, expectedVersion: v }) })}>
                    Reset timer
                  </Button>
                ) : null}
                {canOfferRtm && prevTeam ? (
                  <Button size="lg" disabled={busy} icon={<Hand className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: `Offer ${a.rtmLabel} to ${prevTeam.name}?`, consequences: [`Bidding stops. ${prevTeam.name} may match ${formatPoints(f.currentPrice)} ${unit}.`, `${prevTeam.name} has ${prevTeam.rtmCardsLeft} cards left. A card is used only if they end up buying the player.`, a.rtmAllowFinalRaise ? `If they match, ${leader!.name} may raise once.` : "If they match, they buy the player at this price."], confirmLabel: `Offer ${a.rtmLabel}`, input: () => ({ action: "rtm", step: "offer", auctionId, expectedVersion: v }) })}>
                    Offer {a.rtmLabel}
                  </Button>
                ) : null}
              </>
            ) : null}
            {!floorBusy ? (
              <>
                <Button variant="primary" size="lg" disabled={busy || !nextUp || !auctionRunning} icon={<ArrowRightToLine className="size-5" aria-hidden="true" />} onClick={() => nextUp && sendToFloor(nextUp)}>
                  Next player{nextUp ? `: #${nextUp.lotNo}` : ""}
                </Button>
                {unsoldCount > 0 ? (
                  <Button size="lg" disabled={busy} icon={<Shuffle className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: "Start an accelerated round?", consequences: [`All ${unsoldCount} unsold players go back into the queue, after everyone still waiting.`, `This becomes round ${a.currentRound + 1}.`], confirmLabel: "Start accelerated round", input: () => ({ action: "start_accelerated_round", auctionId, expectedVersion: v }) })}>
                    Accelerated round ({unsoldCount})
                  </Button>
                ) : null}
              </>
            ) : null}
            {p && (f.phase === "idle" || f.phase === "live" || f.phase === "paused") ? (
              <>
                <Button size="lg" variant="ghost" disabled={busy} icon={<X className="size-5" aria-hidden="true" />} onClick={() => confirm({ title: `Return ${p.fullName} to the pool?`, consequences: ["The player leaves the floor without a result.", leader ? "All bids on this player are voided and kept in the history." : "There are no bids to void.", "They keep their place in the queue."], confirmLabel: "Return to pool", danger: true, input: () => ({ action: "return_to_pool", auctionId, auctionPlayerId: p.auctionPlayerId, expectedVersion: v }) })}>
                  Return to pool
                </Button>
                <Button size="lg" variant="ghost" disabled={busy} icon={<UserCheck className="size-5" aria-hidden="true" />} onClick={() => setAssignOpen(true)}>
                  Assign directly
                </Button>
              </>
            ) : null}
          </div>

          {/* Bid on behalf */}
          {p && f.phase === "live" && auctionRunning ? (
            <form
              className="flex flex-wrap items-end gap-2 rounded-[var(--radius-md)] border border-line bg-surface p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!behalf || nextBid === null) return;
                confirm({
                  title: `Bid ${formatPoints(nextBid)} for ${behalf.name}?`,
                  consequences: [`Enters a bid of ${formatPoints(nextBid)} ${unit} for ${behalf.name}, as if their owner had pressed the button.`, "The bid is marked as entered by the admin in the history.", "All purse, reserve and squad rules still apply."],
                  confirmLabel: `Bid for ${behalf.shortName}`,
                  input: () => ({ action: "bid_on_behalf", auctionId, teamId: behalf.id, idempotencyKey: crypto.randomUUID(), expectedVersion: v }),
                });
              }}
            >
              <Field name="behalf" label="Bid on behalf of a team" className="min-w-52 flex-1">
                <SelectWrap>
                  <Select id="f-behalf" value={behalfTeam} onChange={(e) => setBehalfTeam(e.target.value)}>
                    <option value="">Choose team</option>
                    {snapshot.teams.map((t) => (
                      <option key={t.id} value={t.id} disabled={t.id === f.leadingTeamId}>
                        {t.name} (max {formatPoints(t.maxBid)})
                      </option>
                    ))}
                  </Select>
                </SelectWrap>
              </Field>
              <Button type="submit" disabled={!behalf || busy || nextBid === null}>
                Bid {nextBid !== null ? formatPoints(nextBid) : ""}
              </Button>
            </form>
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
        </section>

        <SidePane snapshot={snapshot} />
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
    </DndContext>
  );
}

function FloorDrop({ children }: { children: ReactNode }) {
  const { isOver, setNodeRef } = useDroppable({ id: "floor" });
  return (
    <div ref={setNodeRef} className={`rounded-[var(--radius-md)] border-2 bg-surface p-4 sm:p-5 ${isOver ? "border-accent-edge border-solid" : "border-dashed border-line-strong"}`}>
      {children}
    </div>
  );
}

function PoolPane({ snapshot, disabled, onSend }: { snapshot: ConsoleSnapshot; disabled: boolean; onSend: (e: PoolEntry) => void }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const roles = snapshot.auction.sportConfig.roles;
  const list = snapshot.pool.filter((x) => (!role || x.roleKey === role) && (!q || x.fullName.toLowerCase().includes(q.toLowerCase()) || String(x.lotNo) === q.replace("#", "")));
  const sets = useMemo(() => [...new Set(list.map((x) => x.setName))], [list]);
  return (
    <section aria-labelledby="pool-title" className="flex min-h-0 flex-col rounded-[var(--radius-md)] border border-line bg-surface xl:overflow-hidden">
      <div className="border-b border-line p-3">
        <h2 id="pool-title" className="text-lg">Player pool <span className="num text-sm text-muted">({snapshot.pool.length})</span></h2>
        <div className="mt-2 flex flex-col gap-2">
          <div className="relative">
            <label htmlFor="pool-q" className="sr-only">Search the pool</label>
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
            <Input id="pool-q" type="search" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" placeholder="Name or lot" />
          </div>
          <SelectWrap>
            <label htmlFor="pool-role" className="sr-only">Filter by role</label>
            <Select id="pool-role" value={role} onChange={(e) => setRole(e.target.value)} className="h-10">
              <option value="">All roles</option>
              {roles.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
            </Select>
          </SelectWrap>
        </div>
      </div>
      <div className="max-h-[28rem] flex-1 overflow-y-auto p-2 scrollbar-thin xl:max-h-none">
        {list.length === 0 ? <p className="p-2 text-sm text-muted">No players waiting.</p> : null}
        {sets.map((s) => (
          <div key={s} className="mb-3">
            <h3 className="px-1 pb-1 font-sans text-xs font-bold uppercase tracking-wider text-muted">{s}</h3>
            <ul className="flex flex-col gap-1.5">
              {list.filter((x) => x.setName === s).map((x) => (
                <PoolCard key={x.auctionPlayerId} entry={x} roleLabel={roles.find((r) => r.key === x.roleKey)?.label ?? x.roleKey} roleIndex={Math.max(0, roles.findIndex((r) => r.key === x.roleKey))} disabled={disabled} onSend={() => onSend(x)} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function PoolCard({ entry, roleLabel, roleIndex, disabled, onSend }: { entry: PoolEntry; roleLabel: string; roleIndex: number; disabled: boolean; onSend: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: entry.auctionPlayerId, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform) }} className={`flex items-center gap-2 rounded-[var(--radius-sm)] border bg-surface-2 p-2 ${isDragging ? "relative z-30 border-accent-edge" : "border-line"}`}>
      <button type="button" {...listeners} {...attributes} disabled={disabled} aria-label={`Drag ${entry.fullName} to the floor`} className="inline-flex h-10 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted disabled:cursor-not-allowed disabled:opacity-40">
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <PlayerAvatar name={entry.fullName} photoPath={entry.photoPath} size={36} className="rounded-[var(--radius-xs)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold"><span className="num mr-1 text-xs text-info">#{entry.lotNo}</span>{entry.fullName}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          <RoleChip size="sm" label={roleLabel} index={roleIndex} />
          <span className="num text-xs text-muted">{formatPoints(entry.basePrice)}</span>
          {entry.status === "unsold" ? <Badge tone="unsold" className="h-5 px-1 text-[0.65rem]">unsold</Badge> : null}
          {entry.consentMissing ? <Badge tone="danger" className="h-5 px-1 text-[0.65rem]">consent</Badge> : null}
        </div>
      </div>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={onSend} aria-label={`Send ${entry.fullName} to the floor`} className="shrink-0 px-2">
        <ArrowRightToLine className="size-4" aria-hidden="true" />
        <span className="sr-only">Send to floor</span>
      </Button>
    </li>
  );
}

function SidePane({ snapshot }: { snapshot: ConsoleSnapshot }) {
  const current = snapshot.currentPlayer?.auctionPlayerId;
  const bids = snapshot.bids.filter((b) => b.auctionPlayerId === current).slice(0, 10);
  const a = snapshot.auction;
  return (
    <aside className="flex min-h-0 flex-col gap-4 xl:overflow-y-auto xl:pr-1 scrollbar-thin" aria-label="Bids, teams and activity">
      <section className="rounded-[var(--radius-md)] border border-line bg-surface">
        <h2 className="border-b border-line px-3 py-2 text-base">Live bids</h2>
        {bids.length === 0 ? <p className="p-3 text-sm text-muted">No bids on this player.</p> : (
          <ol className="divide-y divide-line">
            {bids.map((b, i) => {
              const t = teamById(snapshot, b.teamId);
              return (
                <li key={b.id} className={`flex items-center gap-2 px-3 py-1.5 text-sm ${i === 0 ? "bg-surface-2" : ""}`}>
                  {t ? <TeamMark team={t} size={22} className="rounded-[var(--radius-xs)]" /> : null}
                  <span className="min-w-0 flex-1 truncate font-semibold uppercase">{t?.shortName}</span>
                  {b.source === "admin_on_behalf" ? <Badge className="h-5 px-1 text-[0.65rem]">admin</Badge> : null}
                  <span className="text-xs text-faint">{formatTime(b.createdAt)}</span>
                  <span className={`num font-bold ${i === 0 ? "text-accent-text" : "text-muted"}`}>{formatPoints(b.amount)}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
      <section className="rounded-[var(--radius-md)] border border-line bg-surface">
        <h2 className="flex items-center gap-2 border-b border-line px-3 py-2 text-base"><Users className="size-4" aria-hidden="true" /> Teams</h2>
        <ul className="divide-y divide-line">
          {snapshot.teams.map((t: PublicTeam) => {
            const online = snapshot.presence[t.id] ?? 0;
            return (
              <li key={t.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <TeamMark team={t} size={28} className="rounded-[var(--radius-xs)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold uppercase">{t.name}</p>
                  <p className="num text-xs text-muted">{t.squadCount}/{a.squadMax} players, max bid {formatPoints(t.maxBid)}</p>
                </div>
                <div className="text-right">
                  <p className="num font-bold text-remaining">{formatPoints(t.purseLeft)}</p>
                  <p className={`text-xs font-semibold ${online ? "text-sold" : "text-faint"}`}>
                    <span aria-hidden="true" className={`mr-1 inline-block size-2 rounded-full ${online ? "bg-sold" : "border border-current"}`} />
                    {online ? `${online} online` : "offline"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="rounded-[var(--radius-md)] border border-line bg-surface">
        <h2 className="border-b border-line px-3 py-2 text-base">Activity</h2>
        <ol className="divide-y divide-line">
          {snapshot.audit.map((e) => (
            <li key={e.id} className="flex gap-2 px-3 py-1.5 text-xs">
              <span className="num shrink-0 text-faint">{formatTime(e.createdAt)}</span>
              <span className="min-w-0">
                {ACTION_LABEL[e.action] ?? e.action}
                {e.after && typeof e.after.price === "number" ? <span className="num text-muted">, {formatPoints(e.after.price as number)}</span> : null}
                {e.reason ? <span className="text-muted">. Reason: {e.reason}</span> : null}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
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
