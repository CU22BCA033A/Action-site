"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatPoints } from "@/lib/format";
import { sortSlabs, validateSlabs, workedExamples, type Slab } from "@/lib/rules/slabs";

export type SlabDraft = { from: string; to: string; increment: string };

export function toDraft(slabs: Slab[]): SlabDraft[] {
  return sortSlabs(slabs).map((s) => ({ from: String(s.from), to: s.to === null ? "" : String(s.to), increment: String(s.increment) }));
}

export function fromDraft(rows: SlabDraft[]): Slab[] | null {
  const out: Slab[] = [];
  for (const r of rows) {
    const from = Number(r.from);
    const to = r.to.trim() === "" ? null : Number(r.to);
    const increment = Number(r.increment);
    if (!Number.isInteger(from) || (to !== null && !Number.isInteger(to)) || !Number.isInteger(increment)) return null;
    out.push({ from, to, increment });
  }
  return out;
}

/**
 * Bid slab editor. Each band covers prices from "from" up to (not including)
 * "to"; the last band has no upper limit. Problems are shown as you type.
 */
export function SlabEditor({ rows, onChange, unit, error }: { rows: SlabDraft[]; onChange: (rows: SlabDraft[]) => void; unit: string; error?: string }) {
  const parsed = fromDraft(rows);
  const problem = parsed ? validateSlabs(parsed) : { code: "BAD_RANGE", message: "Use whole numbers in every slab." };
  const examples = parsed && !problem ? workedExamples(parsed) : [];

  const set = (i: number, key: keyof SlabDraft, value: string) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: value.replace(/[^\d]/g, "") } : r));
    // Keep bands touching: a band's end becomes the next band's start.
    if (key === "to" && next[i + 1] && value !== "") next[i + 1] = { ...next[i + 1]!, from: value.replace(/[^\d]/g, "") };
    onChange(next);
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(next);
  };
  const add = () => {
    const last = rows[rows.length - 1];
    if (!last) return onChange([{ from: "0", to: "", increment: "5" }]);
    const start = last.to || String(Number(last.from || 0) + Number(last.increment || 1) * 10);
    const fixedLast = { ...last, to: start };
    onChange([...rows.slice(0, -1), fixedLast, { from: start, to: "", increment: last.increment || "5" }]);
  };
  const remove = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">Bid slabs</caption>
          <thead>
            <tr className="text-left text-muted">
              <th scope="col" className="pb-2 pr-2 font-semibold">From ({unit})</th>
              <th scope="col" className="pb-2 pr-2 font-semibold">Up to, not including</th>
              <th scope="col" className="pb-2 pr-2 font-semibold">Increment</th>
              <th scope="col" className="pb-2 font-semibold"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="py-1 pr-2">
                  <Input aria-label={`Slab ${i + 1} from`} inputMode="numeric" value={r.from} onChange={(e) => set(i, "from", e.target.value)} className="num" />
                </td>
                <td className="py-1 pr-2">
                  <Input
                    aria-label={`Slab ${i + 1} up to`}
                    inputMode="numeric"
                    value={r.to}
                    onChange={(e) => set(i, "to", e.target.value)}
                    className="num"
                    aria-describedby={i === rows.length - 1 ? "slab-open-hint" : undefined}
                  />
                </td>
                <td className="py-1 pr-2">
                  <Input aria-label={`Slab ${i + 1} increment`} inputMode="numeric" value={r.increment} onChange={(e) => set(i, "increment", e.target.value)} className="num" />
                </td>
                <td className="py-1">
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move slab ${i + 1} up`} icon={<ArrowUp className="size-4" aria-hidden="true" />}>
                      <span className="sr-only">Up</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={`Move slab ${i + 1} down`} icon={<ArrowDown className="size-4" aria-hidden="true" />}>
                      <span className="sr-only">Down</span>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(i)} disabled={rows.length === 1} aria-label={`Delete slab ${i + 1}`} icon={<Trash2 className="size-4" aria-hidden="true" />}>
                      <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p id="slab-open-hint" className="text-sm text-muted">
        Leave the last &quot;up to&quot; empty so it covers every higher price. Changing an end updates the next start.
      </p>
      <div>
        <Button size="sm" onClick={add} icon={<Plus className="size-4" aria-hidden="true" />}>
          Add slab
        </Button>
      </div>
      {problem || error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {problem?.message ?? error}
        </p>
      ) : (
        <div className="rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3 text-sm">
          <p className="font-semibold">Worked examples</p>
          <ul className="mt-1 list-none text-muted">
            {examples.map((e) => (
              <li key={e.from} className="num">
                A bid of {formatPoints(e.from)} goes to {formatPoints(e.to)}.
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
