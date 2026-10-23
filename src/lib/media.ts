/**
 * Public URL for an uploaded file key such as "players/abc.webp".
 * Supabase Storage in production; a local folder in development.
 */
export const MEDIA_BUCKET = "media";

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/${path}`;
  return `/media/${path}`;
}

/** Relative luminance per WCAG. */
function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const rgb = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Black or white text, whichever reads better on the given colour. */
export function readableOn(hex: string): "#000000" | "#FFFFFF" {
  return contrastRatio(hex, "#000000") >= contrastRatio(hex, "#FFFFFF") ? "#000000" : "#FFFFFF";
}
