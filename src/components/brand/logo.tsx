/**
 * AuctionX brand. The mark is a gavel striking its block, drawn in-house as
 * plain shapes so it stays sharp from a 16px favicon to the projector screen.
 * The wordmark echoes the owner's logo: "Auction" in silver, "X" in gold,
 * set in Orbitron with a forward slant.
 */

const GAVEL = (ink: string) =>
  `<g transform="rotate(-38 15 13)">` +
  `<rect x="7" y="6" width="14" height="8" rx="1.6" fill="${ink}"/>` +
  `<rect x="5.6" y="5" width="2.6" height="10" rx="1" fill="${ink}"/>` +
  `<rect x="19.8" y="5" width="2.6" height="10" rx="1" fill="${ink}"/>` +
  `<rect x="12.8" y="13.5" width="2.4" height="14" rx="1.2" fill="${ink}"/>` +
  `</g>` +
  `<rect x="4" y="25" width="13" height="3.2" rx="1.2" fill="${ink}"/>`;

/** Mark on a gold tile. `bg` paints a full-bleed square behind it (icons). */
export const logoSvg = (accent = "#FFBF00", ink = "#0B1220", bg?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${bg ? `<rect width="32" height="32" fill="${bg}"/>` : ""}` +
  `<rect x="1" y="1" width="30" height="30" rx="7" fill="${accent}"/>${GAVEL(ink)}</svg>`;

export function LogoMark({ className = "size-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id="ax-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--gold-from)" />
          <stop offset="1" stopColor="var(--gold-to)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="7" fill="url(#ax-gold)" />
      <g fill="var(--accent-ink)">
        <g transform="rotate(-38 15 13)">
          <rect x="7" y="6" width="14" height="8" rx="1.6" />
          <rect x="5.6" y="5" width="2.6" height="10" rx="1" />
          <rect x="19.8" y="5" width="2.6" height="10" rx="1" />
          <rect x="12.8" y="13.5" width="2.4" height="14" rx="1.2" />
        </g>
        <rect x="4" y="25" width="13" height="3.2" rx="1.2" />
      </g>
    </svg>
  );
}

/** "Auction" silver + "X" gold. Falls back to plain text when the brand is renamed. */
export function Wordmark({ brand, className = "" }: { brand: string; className?: string }) {
  const m = /^(.*?)(X)$/.exec(brand);
  return (
    <span className={`wordmark inline-block -skew-x-[8deg] font-black leading-none ${className}`}>
      {m ? (
        <>
          <span className="text-silver">{m[1]}</span>
          <span className="text-gold">{m[2]}</span>
        </>
      ) : (
        <span className="text-gold">{brand}</span>
      )}
    </span>
  );
}
