import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { hashAccessCode, hashIp, normaliseAccessCode } from "@/lib/security/crypto";
import { recentFailures, recordAttempt } from "@/lib/security/rate-limit";
import {
  clearSessionCookie,
  clientIp,
  readCookie,
  setSessionCookie,
  shortUserAgent,
  signSessionToken,
  TEAM_COOKIE,
  TEAM_SESSION_HOURS,
  verifySessionToken,
} from "./session";

export type TeamSession = {
  sessionId: string;
  teamId: string;
  auctionId: string;
  auctionSlug: string;
  teamName: string;
  actorId: string;
};

export const GENERIC_JOIN_ERROR = "That code did not work. Check it with the admin and try again.";
export const JOIN_FAILURE_LIMIT = 10;
export const JOIN_WINDOW_MINUTES = 15;

export type JoinResult = { ok: true; auctionSlug: string } | { ok: false; error: string };

export async function joinWithCode(input: string): Promise<JoinResult> {
  const ipHash = hashIp(await clientIp());
  const { fails } = await recentFailures("join", ipHash, JOIN_WINDOW_MINUTES);
  if (fails >= JOIN_FAILURE_LIMIT) {
    return { ok: false, error: `Too many attempts. Wait ${JOIN_WINDOW_MINUTES} minutes and try again.` };
  }

  const code = normaliseAccessCode(input);
  if (!code) {
    await recordAttempt("join", ipHash, false);
    return { ok: false, error: GENERIC_JOIN_ERROR };
  }

  const sql = db();
  const rows = await sql<
    { code_id: string; team_id: string; max_sessions: number; auction_id: string; slug: string; active_sessions: number }[]
  >`
    select c.id as code_id, t.id as team_id, t.max_sessions, a.id as auction_id, a.slug,
      (select count(*)::int from app.team_sessions s
        where s.team_id = t.id and s.revoked_at is null and s.expires_at > now()) as active_sessions
    from app.team_access_codes c
    join app.teams t on t.id = c.team_id and t.deleted_at is null
    join app.auctions a on a.id = t.auction_id and a.deleted_at is null and a.status <> 'archived'
    where c.code_hash = ${hashAccessCode(code)} and c.active`;
  const row = rows[0];
  if (!row) {
    await recordAttempt("join", ipHash, false);
    return { ok: false, error: GENERIC_JOIN_ERROR };
  }
  if (row.active_sessions >= row.max_sessions) {
    return {
      ok: false,
      error: `This code is already in use on ${row.active_sessions} device${row.active_sessions === 1 ? "" : "s"}. Ask the admin to end a session, then try again.`,
    };
  }

  await recordAttempt("join", ipHash, true);
  const ua = await shortUserAgent();
  const inserted = await sql<{ id: string }[]>`
    insert into app.team_sessions(team_id, access_code_id, user_agent, expires_at)
    values (${row.team_id}, ${row.code_id}, ${ua}, now() + make_interval(hours => ${TEAM_SESSION_HOURS}))
    returning id`;
  const sessionId = inserted[0]!.id;
  await sql`select app._audit(${row.auction_id}, 'team', ${sessionId}, 'team.join', 'team', ${row.team_id}, null, null, null)`;
  await setSessionCookie(TEAM_COOKIE, await signSessionToken("team", sessionId, TEAM_SESSION_HOURS), TEAM_SESSION_HOURS);
  return { ok: true, auctionSlug: row.slug };
}

/** Current team session resolved from the cookie and the database. */
export const getTeamSession = cache(async (): Promise<TeamSession | null> => {
  const id = await verifySessionToken(await readCookie(TEAM_COOKIE), "team");
  if (!id) return null;
  const rows = await db()<{ team_id: string; auction_id: string; slug: string; name: string }[]>`
    update app.team_sessions s set last_seen_at = now()
    from app.team_access_codes c, app.teams t, app.auctions a
    where s.id = ${id} and s.revoked_at is null and s.expires_at > now()
      and c.id = s.access_code_id and c.active
      and t.id = s.team_id and t.deleted_at is null
      and a.id = t.auction_id and a.deleted_at is null
    returning t.id as team_id, a.id as auction_id, a.slug, t.name`;
  const r = rows[0];
  if (!r) return null;
  return { sessionId: id, teamId: r.team_id, auctionId: r.auction_id, auctionSlug: r.slug, teamName: r.name, actorId: `team-session:${id}` };
});

export async function requireTeamPage(): Promise<TeamSession> {
  const s = await getTeamSession();
  if (!s) redirect("/join?ended=1");
  return s;
}

export async function leaveAuction() {
  const id = await verifySessionToken(await readCookie(TEAM_COOKIE), "team");
  if (id) {
    await db()`update app.team_sessions set revoked_at = now() where id = ${id} and revoked_at is null`;
  }
  await clearSessionCookie(TEAM_COOKIE);
}
