import type { MetadataRoute } from "next";
import { listPublicAuctions } from "@/lib/data/public";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const staticPaths = ["/", "/auctions", "/how-it-works", "/faq", "/contact", "/join", "/privacy", "/terms", "/refund-policy", "/cookies", "/data-deletion", "/licenses"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = staticPaths.map((p) => ({ url: absoluteUrl(p), changeFrequency: "monthly", priority: p === "/" ? 1 : 0.6 }));
  try {
    const auctions = await listPublicAuctions();
    for (const a of auctions) {
      for (const sub of ["", "/teams", "/players", "/results", "/stats"]) {
        pages.push({ url: absoluteUrl(`/auctions/${a.slug}${sub}`), changeFrequency: a.status === "live" ? "hourly" : "daily", priority: sub ? 0.5 : 0.8 });
      }
    }
  } catch {
    /* database unreachable: still serve the static pages */
  }
  return pages;
}
