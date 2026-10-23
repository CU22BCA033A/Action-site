import localFont from "next/font/local";

/** Self-hosted, SIL Open Font License faces. Licences: /licenses */

export const displayFace = localFont({
  variable: "--font-display-face",
  display: "swap",
  src: [
    { path: "../fonts/big-shoulders-display-latin-800-normal.woff2", weight: "800", style: "normal" },
    { path: "../fonts/big-shoulders-display-latin-900-normal.woff2", weight: "900", style: "normal" },
  ],
  fallback: ["Arial Narrow", "system-ui", "sans-serif"],
});

export const bodyFace = localFont({
  variable: "--font-body-face",
  display: "swap",
  src: [
    { path: "../fonts/barlow-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../fonts/barlow-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../fonts/barlow-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/barlow-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  fallback: ["system-ui", "Segoe UI", "Roboto", "sans-serif"],
});

export const numFace = localFont({
  variable: "--font-num-face",
  display: "swap",
  preload: false,
  src: [
    { path: "../fonts/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "../fonts/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../fonts/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
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

export const fontVariables = [displayFace, bodyFace, numFace, kannadaFace, devanagariFace].map((f) => f.variable).join(" ");
