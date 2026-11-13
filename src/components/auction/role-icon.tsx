import type { RoleIconKey } from "@/lib/sports/config";

/**
 * Small flat role icons drawn for this site (no stock art). Which icon a role
 * uses is data: `icon` on the role in the sport's config, chosen by the admin.
 * Decorative: the role's text label is always shown next to it.
 */
export function RoleIcon({ icon, className = "size-4" }: { icon: RoleIconKey; className?: string }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" className={`shrink-0 ${className}`}>
      {icon === "bat" && <Bat />}
      {icon === "ball" && (
        <>
          <path d="M9.5 6.2 21.5 1.8 17.6 7.4 22.4 6.6 13.6 17.8z" fill="#f97316" stroke="#facc15" strokeWidth="1.1" strokeLinejoin="round" />
          <Ball cx={9.2} cy={14.6} r={7} />
        </>
      )}
      {icon === "all_rounder" && (
        <>
          <Bat />
          <Ball cx={16.6} cy={17.4} r={4.6} />
        </>
      )}
      {icon === "gloves" && (
        <>
          <Glove flip={false} />
          <Glove flip />
          <circle cx="12" cy="13.2" r="4" fill="#f5f5f5" stroke="#1f2937" strokeWidth="0.8" />
          <path d="M8.6 12.4c2.2.7 4.6.7 6.8 0M8.6 14c2.2.7 4.6.7 6.8 0" fill="none" stroke="#1f2937" strokeWidth="0.7" strokeDasharray="0.9 0.7" />
        </>
      )}
    </svg>
  );
}

function Bat() {
  return (
    <g transform="translate(12 12) rotate(45) scale(1.12) translate(-12 -12)">
      <rect x="10.9" y="-0.6" width="2.2" height="8" rx="1" fill="#475569" />
      <rect x="10.5" y="-1.2" width="3" height="2" rx="0.8" fill="#334155" />
      <path d="M8.6 7.6h6.8l.4 1.2v13.4a1.8 1.8 0 0 1-1.8 1.8H10a1.8 1.8 0 0 1-1.8-1.8V8.8z" fill="#f2c46d" stroke="#b7862f" strokeWidth="0.6" />
      <path d="M12 10v12" stroke="#d9a548" strokeWidth="0.9" strokeLinecap="round" />
    </g>
  );
}

function Ball({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#dc2626" stroke="#7f1d1d" strokeWidth="0.8" />
      <path
        d={`M${cx - r * 0.18} ${cy - r * 0.97}c${r * 0.55} ${r * 0.5} ${r * 0.55} ${r * 1.44} 0 ${r * 1.94}`}
        fill="none"
        stroke="#fef2f2"
        strokeWidth="0.75"
        strokeDasharray="1 0.8"
      />
      <circle cx={cx - r * 0.42} cy={cy - r * 0.38} r={r * 0.22} fill="#fff" opacity="0.35" />
    </g>
  );
}

function Glove({ flip }: { flip: boolean }) {
  return (
    <g transform={flip ? "matrix(-1 0 0 1 24 0)" : undefined}>
      <path
        d="M2.4 11.2V6.4a1.3 1.3 0 0 1 2.6 0V5a1.3 1.3 0 0 1 2.6 0v.2a1.3 1.3 0 0 1 2.6 0v8.6L11 16.4v3H4.6z"
        fill="#dc2626"
        stroke="#7f1d1d"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <path d="M2.4 10.4h3.5" stroke="#facc15" strokeWidth="1.2" />
      <rect x="4.2" y="19.2" width="6.8" height="3" rx="0.8" fill="#facc15" stroke="#7f1d1d" strokeWidth="0.6" />
    </g>
  );
}
