"use client";

import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus, Save, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerAvatar } from "@/components/auction/identity";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { FormStatus, Input, Select, SelectWrap } from "@/components/ui/field";
import { saveQueueAction } from "@/lib/admin/actions/queue";
import type { AdminPlayer } from "@/lib/admin/queries";
import { formatPoints } from "@/lib/format";
import type { SportConfig } from "@/lib/sports/config";
import { useAdminAction } from "./use-admin-action";

type Item = Pick<AdminPlayer, "auctionPlayerId" | "lotNo" | "fullName" | "photoPath" | "roleKey" | "basePrice" | "status">;
type SetDraft = { key: string; name: string; items: Item[] };

function initialSets(players: AdminPlayer[]): SetDraft[] {
  const waiting = players.filter((p) => p.status === "pool" || p.status === "unsold");
  const order = [...new Set([...waiting].sort((a, b) => a.setOrder - b.setOrder || a.queuePosition - b.queuePosition).map((p) => p.setName))];
  return order.map((name, i) => ({
    key: `s${i}`,
    name,
    items: waiting.filter((p) => p.setName === name).sort((a, b) => a.queuePosition - b.queuePosition),
  }));
}

export function QueueBuilder({ players, ctx }: { players: AdminPlayer[]; ctx: { auctionId: string; config: SportConfig; unit: string } }) {
  const router = useRouter();
  const [sets, setSets] = useState<SetDraft[]>(() => initialSets(players));
  const [dirty, setDirty] = useState(false);
  const [announce, setAnnounce] = useState("");
  const save = useAdminAction(saveQueueAction);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const roleLabel = (k: string) => ctx.config.roles.find((r) => r.key === k)?.label ?? k;
  const done = players.filter((p) => p.status === "sold" || p.status === "retained" || p.status === "on_floor");

  const update = (next: SetDraft[], message?: string) => {
    setSets(next);
    setDirty(true);
    if (message) setAnnounce(message);
  };
  const moveItem = (si: number, from: number, to: number) => {
    const s = sets[si]!;
    if (to < 0 || to >= s.items.length) return;
    update(sets.map((x, i) => (i === si ? { ...x, items: arrayMove(x.items, from, to) } : x)), `${s.items[from]!.fullName} moved to position ${to + 1} in ${s.name}.`);
  };
  const moveToSet = (si: number, idx: number, target: number) => {
    const item = sets[si]!.items[idx]!;
    update(
      sets.map((x, i) => (i === si ? { ...x, items: x.items.filter((_, j) => j !== idx) } : i === target ? { ...x, items: [...x.items, item] } : x)),
      `${item.fullName} moved to ${sets[target]!.name}.`,
    );
  };
  const moveSet = (si: number, d: -1 | 1) => {
    const j = si + d;
    if (j < 0 || j >= sets.length) return;
    update(arrayMove(sets, si, j), `${sets[si]!.name} is now set ${j + 1}.`);
  };
  const shuffle = (si: number) => {
    const items = [...sets[si]!.items];
    for (let i = items.length - 1; i > 0; i--) {
      const r = crypto.getRandomValues(new Uint32Array(1))[0]! % (i + 1);
      [items[i], items[r]] = [items[r]!, items[i]!];
    }
    update(sets.map((x, i) => (i === si ? { ...x, items } : x)), `${sets[si]!.name} shuffled.`);
  };
  const onDragEnd = (si: number) => (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const items = sets[si]!.items;
    const from = items.findIndex((x) => x.auctionPlayerId === e.active.id);
    const to = items.findIndex((x) => x.auctionPlayerId === e.over!.id);
    if (from >= 0 && to >= 0) moveItem(si, from, to);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-28 sm:px-6">
      <p className="text-muted">
        Players come up set by set, top to bottom. Drag a row by its handle, or use the arrow buttons. With a keyboard, focus a handle, press Space, move with the arrow keys and press Space again. Sold players keep their place and are listed at the end.
      </p>
      <p className="sr-only" aria-live="polite">{announce}</p>
      {save.result?.ok ? <div className="mt-4"><FormStatus kind="success">{save.result.message}</FormStatus></div> : null}
      {save.result && !save.result.ok ? <div className="mt-4"><FormStatus kind="error">{save.result.error}</FormStatus></div> : null}

      <ol className="mt-5 flex flex-col gap-5">
        {sets.map((s, si) => (
          <li key={s.key} className="rounded-[var(--radius-md)] border border-line bg-surface">
            <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
              <span className="num inline-flex size-8 items-center justify-center rounded-full bg-accent font-bold text-accent-ink" aria-hidden="true">{si + 1}</span>
              <label htmlFor={`set-name-${s.key}`} className="sr-only">Name of set {si + 1}</label>
              <Input id={`set-name-${s.key}`} value={s.name} maxLength={40} onChange={(e) => update(sets.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)))} className="h-10 max-w-60 font-semibold" />
              <span className="num text-sm text-muted">{s.items.length} players</span>
              <div className="ml-auto flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => moveSet(si, -1)} disabled={si === 0} icon={<ArrowUp className="size-4" aria-hidden="true" />} aria-label={`Move set ${s.name} earlier`}><span className="sr-only">Earlier</span></Button>
                <Button size="sm" variant="ghost" onClick={() => moveSet(si, 1)} disabled={si === sets.length - 1} icon={<ArrowDown className="size-4" aria-hidden="true" />} aria-label={`Move set ${s.name} later`}><span className="sr-only">Later</span></Button>
                <Button size="sm" onClick={() => shuffle(si)} disabled={s.items.length < 2} icon={<Shuffle className="size-4" aria-hidden="true" />}>Shuffle</Button>
              </div>
            </div>
            {s.items.length === 0 ? (
              <p className="p-3 text-sm text-muted">Empty set. Move players here, or it is dropped when you save.</p>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd(si)} accessibility={{ announcements: {
                onDragStart: ({ active }) => `Picked up ${s.items.find((x) => x.auctionPlayerId === active.id)?.fullName}.`,
                onDragOver: ({ over }) => (over ? `Over position ${s.items.findIndex((x) => x.auctionPlayerId === over.id) + 1}.` : ""),
                onDragEnd: ({ over }) => (over ? `Dropped at position ${s.items.findIndex((x) => x.auctionPlayerId === over.id) + 1}.` : "Dropped."),
                onDragCancel: () => "Move cancelled.",
              } }}>
                <SortableContext items={s.items.map((x) => x.auctionPlayerId)} strategy={verticalListSortingStrategy}>
                  <ul className="divide-y divide-line">
                    {s.items.map((item, idx) => (
                      <QueueRow
                        key={item.auctionPlayerId}
                        item={item}
                        index={idx}
                        count={s.items.length}
                        role={roleLabel(item.roleKey)}
                        unit={ctx.unit}
                        sets={sets.map((x) => x.name)}
                        setIndex={si}
                        onMove={(to) => moveItem(si, idx, to)}
                        onMoveToSet={(target) => moveToSet(si, idx, target)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-4">
        <Button onClick={() => update([...sets, { key: `n${Date.now()}`, name: `Set ${sets.length + 1}`, items: [] }], "New set added at the end.")} icon={<Plus className="size-4" aria-hidden="true" />}>
          Add set
        </Button>
      </div>

      {done.length ? (
        <section className="mt-8">
          <h2 className="text-xl">Already done <span className="num text-muted">({done.length})</span></h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {done.map((p) => (
              <li key={p.auctionPlayerId}><Badge tone={p.status === "on_floor" ? "accent" : "sold"}>#{p.lotNo} {p.fullName}</Badge></li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line-strong bg-bg lg:left-64">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="primary"
            disabled={!dirty}
            loading={save.pending}
            icon={<Save className="size-4" aria-hidden="true" />}
            onClick={() =>
              save.run({ auctionId: ctx.auctionId, sets: sets.filter((s) => s.items.length).map((s) => ({ name: s.name, ids: s.items.map((x) => x.auctionPlayerId) })) }, (r) => {
                if (r.ok) {
                  setDirty(false);
                  router.refresh();
                }
              })
            }
          >
            Save queue
          </Button>
          <span className="text-sm text-muted" aria-live="polite">{dirty ? "Unsaved changes" : "Saved"}</span>
        </div>
      </div>
    </div>
  );
}

function QueueRow(props: { item: Item; index: number; count: number; role: string; unit: string; sets: string[]; setIndex: number; onMove: (to: number) => void; onMoveToSet: (target: number) => void }) {
  const { item, index, count } = props;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.auctionPlayerId });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`flex flex-wrap items-center gap-3 bg-surface p-2.5 ${isDragging ? "relative z-10 outline outline-2 outline-accent-edge" : ""}`}>
      <button ref={setActivatorNodeRef} type="button" {...attributes} {...listeners} aria-label={`Drag ${item.fullName}, position ${index + 1} of ${count}`} className="inline-flex size-10 cursor-grab touch-none items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong active:cursor-grabbing">
        <GripVertical className="size-5" aria-hidden="true" />
      </button>
      <span className="num w-8 text-sm text-muted">{index + 1}</span>
      <PlayerAvatar name={item.fullName} photoPath={item.photoPath} size={36} className="rounded-[var(--radius-xs)]" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold"><span className="num mr-2 text-xs text-info">#{String(item.lotNo).padStart(3, "0")}</span>{item.fullName}</p>
        <p className="text-xs text-muted">{props.role} / base <span className="num">{formatPoints(item.basePrice)}</span> {item.status === "unsold" ? "/ unsold earlier" : ""}</p>
      </div>
      <div className="flex items-center gap-1">
        <Button size="sm" variant="ghost" onClick={() => props.onMove(index - 1)} disabled={index === 0} aria-label={`Move ${item.fullName} up`} icon={<ArrowUp className="size-4" aria-hidden="true" />}><span className="sr-only">Up</span></Button>
        <Button size="sm" variant="ghost" onClick={() => props.onMove(index + 1)} disabled={index === count - 1} aria-label={`Move ${item.fullName} down`} icon={<ArrowDown className="size-4" aria-hidden="true" />}><span className="sr-only">Down</span></Button>
        {props.sets.length > 1 ? (
          <SelectWrap>
            <label htmlFor={`mv-${item.auctionPlayerId}`} className="sr-only">Move {item.fullName} to another set</label>
            <Select id={`mv-${item.auctionPlayerId}`} value="" onChange={(e) => e.target.value !== "" && props.onMoveToSet(Number(e.target.value))} className="h-9 w-36 text-sm">
              <option value="">Move to set</option>
              {props.sets.map((n, i) => (i === props.setIndex ? null : <option key={i} value={i}>{n}</option>))}
            </Select>
          </SelectWrap>
        ) : null}
      </div>
    </li>
  );
}
