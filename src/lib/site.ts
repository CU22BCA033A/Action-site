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
  const explicit = process.env.SITE_URL?.replace(/\/$/, "");
  if (explicit) return explicit;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
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
