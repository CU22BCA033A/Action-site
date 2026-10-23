import type { ReactNode } from "react";

/**
 * Status chips. Each state has its own glyph and text, so meaning never
 * depends on colour alone.
 */
type Tone = "live" | "sold" | "paused" | "unsold" | "accent" | "neutral" | "danger";

const toneClass: Record<Tone, string> = {
  live: "border-[color-mix(in_srgb,var(--live)_50%,transparent)] bg-[color-mix(in_srgb,var(--live)_20%,transparent)] text-live",
  sold: "border-[color-mix(in_srgb,var(--sold)_50%,transparent)] bg-[color-mix(in_srgb,var(--sold)_18%,transparent)] text-remaining",
  paused: "border-[color-mix(in_srgb,var(--paused)_50%,transparent)] bg-[color-mix(in_srgb,var(--paused)_16%,transparent)] text-paused",
  unsold: "border-line-strong bg-surface-3 text-unsold",
  accent: "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-accent-text",
  neutral: "border-line-strong text-muted",
  danger: "border-[color-mix(in_srgb,var(--danger)_50%,transparent)] bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger",
};

function Glyph({ tone }: { tone: Tone }) {
  switch (tone) {
    case "live":
      return <span aria-hidden="true" className="live-dot inline-block size-2 rounded-full bg-live" />;
    case "sold":
      return (
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
          <path d="M1.5 5.2l2.2 2.2L8.5 2.6" stroke="currentColor" strokeWidth="1.8" fill="none" />
        </svg>
      );
    case "paused":
      return (
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
          <rect x="1.5" y="1.5" width="2.4" height="7" fill="currentColor" />
          <rect x="6.1" y="1.5" width="2.4" height="7" fill="currentColor" />
        </svg>
      );
    case "unsold":
      return (
        <svg aria-hidden="true" viewBox="0 0 10 10" className="size-2.5">
          <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case "danger":
      return <span aria-hidden="true" className="inline-block size-2 rotate-45 bg-danger" />;
    case "accent":
      return <span aria-hidden="true" className="inline-block size-2 bg-accent" />;
    default:
      return <span aria-hidden="true" className="inline-block size-2 border border-current" />;
  }
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold uppercase tracking-wider leading-none ${toneClass[tone]} ${className}`}
    >
      <Glyph tone={tone} />
      <span>{children}</span>
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "live":
      return "live";
    case "paused":
    case "rtm_pending":
      return "paused";
    case "sold":
    case "completed":
    case "retained":
      return "sold";
    case "unsold":
    case "archived":
      return "unsold";
    case "scheduled":
    case "on_floor":
      return "accent";
    default:
      return "neutral";
  }
}
