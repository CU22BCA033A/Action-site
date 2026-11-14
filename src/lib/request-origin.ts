import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site";

/**
 * The origin for links an admin copies and shares (registration, join, live
 * room). On Vercel: the project's production address, which Vercel sets
 * itself. Elsewhere: the address the admin is using. A mistyped SITE_URL can
 * never break these links.
 */
export async function requestOrigin(): Promise<string> {
  // On Vercel, always share the stable production address, never a
  // one-off deployment address (those can be deleted or protected).
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return siteUrl();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host && /^[a-z0-9.-]+(:\d+)?$/i.test(host)) {
    const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  return siteUrl();
}

export async function shareUrl(path: string): Promise<string> {
  return `${await requestOrigin()}${path.startsWith("/") ? path : `/${path}`}`;
}
