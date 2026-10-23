import "server-only";
import { verify } from "@node-rs/argon2";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { constantTimeEqual, hashIp } from "@/lib/security/crypto";
import { recentFailures, recordAttempt } from "@/lib/security/rate-limit";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_HOURS,
  clearSessionCookie,
  clientIp,
  readCookie,
  setSessionCookie,
  shortUserAgent,
  signSessionToken,
  verifySessionToken,
} from "./session";

export type AdminSession = { sessionId: string; actorId: string };

export const GENERIC_LOGIN_ERROR = "Incorrect username or password.";

/** Failures allowed in 15 minutes before backoff starts. */
const FREE_ATTEMPTS = 5;

/** Seconds the caller must wait, given the number of recent failures. */
export function backoffSeconds(fails: number): number {
  if (fails < FREE_ATTEMPTS) return 0;
  return Math.min(2 ** (fails - FREE_ATTEMPTS + 1) * 15, 15 * 60);
}

export type LoginResult = { ok: true } | { ok: false; error: string; retryAfterSeconds?: number };

export async function loginAdmin(username: string, password: string): Promise<LoginResult> {
  const env = getEnv();
  const ipHash = hashIp(await clientIp());
  const { fails, last } = await recentFailures("admin", ipHash, 15);
  const wait = backoffSeconds(fails);
  if (wait > 0 && last) {
    const remaining = Math.ceil((last.getTime() + wait * 1000 - Date.now()) / 1000);
    if (remaining > 0) {
      return { ok: false, error: `Too many attempts. Try again in ${formatWait(remaining)}.`, retryAfterSeconds: remaining };
    }
  }

  // Always run the hash check so timing does not reveal which part was wrong.
  const userOk = constantTimeEqual(username.trim(), env.ADMIN_USERNAME);
  let passOk = false;
  try {
    passOk = await verify(env.ADMIN_PASSWORD_HASH, password);
  } catch {
    passOk = false;
  }

  if (!userOk || !passOk) {
    await recordAttempt("admin", ipHash, false);
    return { ok: false, error: GENERIC_LOGIN_ERROR };
  }

  await recordAttempt("admin", ipHash, true);
  const ua = await shortUserAgent();
  const rows = await db()<{ id: string }[]>`
    insert into app.admin_sessions(user_agent, expires_at)
    values (${ua}, now() + make_interval(hours => ${ADMIN_SESSION_HOURS}))
    returning id`;
  const id = rows[0]!.id;
  await db()`select app._audit(null, 'admin', ${id}, 'admin.login', 'admin_session', ${id}, null, null, null)`;
  await setSessionCookie(ADMIN_COOKIE, await signSessionToken("admin", id, ADMIN_SESSION_HOURS), ADMIN_SESSION_HOURS);
  return { ok: true };
}

function formatWait(seconds: number) {
  if (seconds < 60) return `${seconds} seconds`;
  const m = Math.ceil(seconds / 60);
  return `${m} minute${m === 1 ? "" : "s"}`;
}

/** Current admin session, or null. Cached per request. */
export const getAdminSession = cache(async (): Promise<AdminSession | null> => {
  const id = await verifySessionToken(await readCookie(ADMIN_COOKIE), "admin");
  if (!id) return null;
  const rows = await db()<{ id: string }[]>`
    update app.admin_sessions set last_seen_at = now()
    where id = ${id} and revoked_at is null and expires_at > now()
    returning id`;
  if (!rows[0]) return null;
  return { sessionId: id, actorId: `admin:${id.slice(0, 8)}` };
});

/** For pages: redirects to the login page when there is no session. */
export async function requireAdminPage(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) redirect("/admin/login");
  return s;
}

export class AuthError extends Error {
  constructor(message = "Your session has ended. Sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For server actions and route handlers: throws when there is no session. */
export async function requireAdmin(): Promise<AdminSession> {
  const s = await getAdminSession();
  if (!s) throw new AuthError();
  return s;
}

export async function logoutAdmin() {
  const id = await verifySessionToken(await readCookie(ADMIN_COOKIE), "admin");
  if (id) {
    await db()`update app.admin_sessions set revoked_at = now() where id = ${id} and revoked_at is null`;
  }
  await clearSessionCookie(ADMIN_COOKIE);
}
