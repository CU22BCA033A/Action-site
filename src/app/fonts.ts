import localFont from "next/font/local";

/**
 * Self-hosted, SIL Open Font License faces. Licences: /licenses
 * Inter for everything Latin (the font of the owner's reference): heavy weights for headings, regular for text,
 * tabular figures for prices and timers (same files, so they load once).
 * Noto Sans Devanagari for Hindi and Noto Sans Kannada for Kannada load only
 * when those characters appear.
 */

export const displayFace = localFont({
  variable: "--font-display-face",
  display: "swap",
  src: [
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/inter-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "../fonts/inter-latin-900-normal.woff2", weight: "900", style: "normal" },
  ],
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

export const numFace = localFont({
  variable: "--font-num-face",
  display: "swap",
  src: [
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/inter-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  fallback: ["system-ui", "sans-serif"],
});

export const bodyFace = localFont({
  variable: "--font-body-face",
  display: "swap",
  src: [
    { path: "../fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

/** Loaded only when Devanagari characters appear on the page. */
export const devanagariFace = localFont({
  variable: "--font-devanagari-face",
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/noto-sans-devanagari-devanagari-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-devanagari-devanagari-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/noto-sans-devanagari-devanagari-700-normal.woff2", weight: "700", style: "normal" },
  ],
  declarations: [{ prop: "unicode-range", value: "U+0900-097F, U+1CD0-1CFF, U+200C-200D, U+20A8, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF" }],
  fallback: ["system-ui", "sans-serif"],
});

/** Loaded only when Kannada characters appear on the page. */
export const kannadaFace = localFont({
  variable: "--font-kannada-face",
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/noto-sans-kannada-kannada-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/noto-sans-kannada-kannada-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/noto-sans-kannada-kannada-700-normal.woff2", weight: "700", style: "normal" },
  ],
  declarations: [{ prop: "unicode-range", value: "U+0C80-0CFF, U+200C-200D, U+25CC" }],
  fallback: ["system-ui", "sans-serif"],
});

export const fontVariables = [displayFace, numFace, bodyFace, devanagariFace, kannadaFace].map((f) => f.variable).join(" ");
