import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { getEnv } from "@/lib/env";

/**
 * Signed, httpOnly cookies. The cookie only carries a session id; every
 * protected request re-checks that id against the database, so ending a
 * session takes effect immediately.
 */

export const ADMIN_COOKIE = "pa_admin";
export const TEAM_COOKIE = "pa_team";
export const ADMIN_SESSION_HOURS = 12;
export const TEAM_SESSION_HOURS = 16;

type Kind = "admin" | "team";

function secretKey() {
  return new TextEncoder().encode(getEnv().SESSION_SECRET);
}

export async function signSessionToken(kind: Kind, sessionId: string, hours: number): Promise<string> {
  return new SignJWT({ kind })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sessionId)
    .setIssuedAt()
    .setExpirationTime(`${hours}h`)
    .sign(secretKey());
}

export async function verifySessionToken(token: string | undefined, kind: Kind): Promise<string | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.kind !== kind || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export async function setSessionCookie(name: string, token: string, hours: number) {
  const jar = await cookies();
  jar.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: name === ADMIN_COOKIE ? "strict" : "lax",
    path: "/",
    maxAge: hours * 3600,
    priority: "high",
  });
}

export async function clearSessionCookie(name: string) {
  const jar = await cookies();
  jar.set(name, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
}

export async function readCookie(name: string): Promise<string | undefined> {
  return (await cookies()).get(name)?.value;
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || h.get("x-real-ip") || "unknown";
}

export async function shortUserAgent(): Promise<string> {
  const ua = (await headers()).get("user-agent") ?? "";
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Other";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
  return `${browser} on ${os}`;
}
