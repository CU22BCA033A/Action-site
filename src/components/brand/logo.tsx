/**
 * Original mark: an auction bid paddle with a raise chevron. Drawn in-house.
 */
export function LogoMark({ className = "size-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect x="5" y="2" width="22" height="19" rx="3" fill="var(--accent)" />
      <rect x="13.5" y="19" width="5" height="11" rx="1" fill="var(--accent)" />
      <path d="M10 14.5l6-5.5 6 5.5" stroke="var(--accent-ink)" strokeWidth="3" fill="none" strokeLinecap="square" />
    </svg>
  );
}

/** Same mark as a standalone SVG string, for icons and the OG image. */
export const logoSvg = (accent = "#FFB224", ink = "#1A1206", bg?: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${
  bg ? `<rect width="32" height="32" fill="${bg}"/>` : ""
}<rect x="5" y="2" width="22" height="19" rx="3" fill="${accent}"/><rect x="13.5" y="19" width="5" height="11" rx="1" fill="${accent}"/><path d="M10 14.5l6-5.5 6 5.5" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="square"/></svg>`;
