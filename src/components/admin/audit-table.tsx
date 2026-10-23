import Link from "next/link";
import type { AuditRow } from "@/lib/admin/audit";
import { AUDIT_GROUPS } from "@/lib/admin/audit";
import { formatDateTime } from "@/lib/format";

function short(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = JSON.stringify(v);
  return s.length > 160 ? `${s.slice(0, 157)}...` : s;
}

/** Server-rendered audit list with a group filter and paging by id. */
export function AuditTable({ rows, basePath, prefix, showAuction, exportHref }: { rows: AuditRow[]; basePath: string; prefix: string; showAuction: boolean; exportHref: string }) {
  const last = rows.at(-1);
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <form method="get" action={basePath} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Show
            <select name="group" defaultValue={prefix} className="h-11 rounded-[var(--radius-sm)] border border-line bg-bg-sunken px-3">
              {AUDIT_GROUPS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>
          <button type="submit" className="h-11 rounded-[var(--radius-sm)] border border-line-strong px-4 font-semibold hover:border-text">Filter</button>
        </form>
        <a href={exportHref} className="inline-flex h-11 items-center rounded-[var(--radius-sm)] border border-line-strong px-4 font-semibold hover:border-text">Export CSV</a>
      </div>
      <p className="mt-3 text-sm text-muted">The audit log is append-only: entries cannot be edited or deleted, even by the admin.</p>
      <div className="mt-4 overflow-x-auto rounded-[var(--radius-md)] border border-line bg-surface scrollbar-thin">
        <table className="w-full min-w-[48rem] text-sm">
          <caption className="sr-only">Audit log entries, newest first</caption>
          <thead className="bg-surface-2 text-left">
            <tr>
              <th scope="col" className="p-2">When</th>
              {showAuction ? <th scope="col" className="p-2">Auction</th> : null}
              <th scope="col" className="p-2">Who</th>
              <th scope="col" className="p-2">Action</th>
              <th scope="col" className="p-2">Change</th>
              <th scope="col" className="p-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={6} className="p-3 text-muted">No entries.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <td className="num whitespace-nowrap p-2 text-muted">{formatDateTime(r.createdAt)}</td>
                {showAuction ? <td className="max-w-40 truncate p-2">{r.auctionName ?? ""}</td> : null}
                <td className="p-2">{r.actorType}</td>
                <td className="p-2 font-semibold">{r.action}</td>
                <td className="max-w-md break-all p-2 font-mono text-xs text-muted">{short(r.before)}{r.before && r.after ? " to " : ""}{short(r.after)}</td>
                <td className="p-2">{r.reason ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 100 && last ? (
        <p className="mt-4">
          <Link className="link font-semibold" href={`${basePath}?group=${encodeURIComponent(prefix)}&before=${last.id}`}>Older entries</Link>
        </p>
      ) : null}
    </div>
  );
}
