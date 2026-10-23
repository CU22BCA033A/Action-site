import "server-only";
import { db } from "@/lib/db";

/**
 * Fixed-window rate limit stored in Postgres (no paid service). Returns
 * true while the caller is under the limit.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const sql = db();
  const rows = await sql<{ count: number }[]>`
    insert into app.rate_limits(key, window_start, count) values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when app.rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then 1
                   else app.rate_limits.count + 1 end,
      window_start = case when app.rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) then now()
                   else app.rate_limits.window_start end
    returning count`;
  if (Math.random() < 0.01) {
    await sql`delete from app.rate_limits where window_start < now() - interval '1 day'`;
  }
  return (rows[0]?.count ?? 0) <= limit;
}

/** Failed login attempts for an IP hash in the last `minutes`. */
export async function recentFailures(kind: "admin" | "join", ipHash: string, minutes: number) {
  const rows = await db()<{ fails: number; last: Date | null }[]>`
    select count(*)::int as fails, max(created_at) as last
    from app.login_attempts
    where kind = ${kind} and ip_hash = ${ipHash} and not succeeded
      and created_at > now() - make_interval(mins => ${minutes})`;
  return rows[0] ?? { fails: 0, last: null };
}

export async function recordAttempt(kind: "admin" | "join", ipHash: string, succeeded: boolean) {
  await db()`insert into app.login_attempts(kind, ip_hash, succeeded) values (${kind}, ${ipHash}, ${succeeded})`;
}
