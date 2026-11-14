import type { Metadata } from "next";
import { siteConfig } from "@config";

/**
 * Canonical base URL. A custom domain is used only when switched on in
 * site.config.ts; otherwise the free hosting domain from the platform.
 */
export function siteUrl(): string {
  if (siteConfig.useCustomDomain && siteConfig.productionDomain) {
    return `https://${siteConfig.productionDomain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  }
  // On Vercel this is set automatically to the project's real production
  // address (its custom domain when there is one), so it is always right.
  // It wins over SITE_URL, which is typed by hand and can be wrong.
  const production = normaliseOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (production) return production;
  const explicit = normaliseOrigin(process.env.SITE_URL);
  if (explicit) return explicit;
  const vercel = normaliseOrigin(process.env.VERCEL_URL);
  if (vercel) return vercel;
  return "http://localhost:3000";
}

/** SITE_URL when it is set but points somewhere other than the real production address. */
export function siteUrlMismatch(): { configured: string; actual: string } | null {
  const configured = normaliseOrigin(process.env.SITE_URL);
  const actual = normaliseOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (!configured || !actual || configured === actual) return null;
  if (siteConfig.useCustomDomain && siteConfig.productionDomain) return null;
  return { configured, actual };
}

/** Accepts "example.com", "https://example.com/" or "https://example.com/x" and returns "https://example.com". */
export function normaliseOrigin(raw: string | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return u.origin;
  } catch {
    return null;
  }
}

export function absoluteUrl(path: string): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

export function brandName(): string {
  return siteConfig.brandName.trim();
}

/** "Page | Brand", kept under 60 characters. */
export function pageTitle(title: string): string {
  const brand = brandName();
  const full = brand ? `${title} | ${brand}` : title;
  if (full.length <= 60) return full;
  return title.length <= 60 ? title : `${title.slice(0, 57).trimEnd()}...`;
}

export function pageMeta(input: { title: string; description: string; path: string; noIndex?: boolean; ogImage?: string }): Metadata {
  const title = pageTitle(input.title);
  const url = absoluteUrl(input.path);
  const image = input.ogImage ?? "/opengraph-image";
  return {
    title,
    description: input.description,
    alternates: { canonical: url },
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url,
      title,
      description: input.description,
      siteName: brandName() || undefined,
      images: [{ url: image, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description: input.description, images: [image] },
  };
}
