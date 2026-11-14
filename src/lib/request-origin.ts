import "server-only";
import { headers } from "next/headers";
import { siteUrl } from "@/lib/site";

/**
 * The origin the current visitor is using, for links an admin copies and
 * shares (registration, join, live room). Using the request's own host means
 * the link works even when SITE_URL is missing, mistyped or points at a preview
 * deployment. Falls back to the configured site URL.
 */
export async function requestOrigin(): Promise<string> {
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
