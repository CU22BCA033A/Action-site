import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "royal" | "glass" | "secondary" | "ghost" | "danger" | "sold" | "quiet";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "group inline-flex items-center justify-center gap-2 font-semibold tracking-[0.01em] select-none whitespace-nowrap border transition-[transform,box-shadow,border-color,background-color,color,opacity,filter] duration-200 ease-out motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

/**
 * Premium buttons: polished gold-to-orange, royal blue with a gold edge, and
 * dark glass with a gold hairline. Each has a top highlight and a bottom shade
 * so it reads as a solid, pressable object.
 */
const variants: Record<Variant, string> = {
  primary:
    "border-[color-mix(in_srgb,var(--gold-from)_60%,transparent)] bg-[linear-gradient(180deg,var(--gold-from)_0%,var(--accent)_48%,var(--gold-to)_100%)] text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(120_50_0/0.28),0_10px_24px_-12px_rgb(238_122_20/0.7)] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.7),inset_0_-2px_0_rgb(120_50_0/0.28),0_14px_30px_-12px_rgb(238_122_20/0.8)] motion-safe:hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:brightness-100 btn-shine",
  royal:
    "border-[color-mix(in_srgb,var(--accent-edge)_70%,transparent)] bg-[linear-gradient(180deg,#4a74f0_0%,var(--royal)_45%,var(--royal-dark)_100%)] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(5_15_60/0.35),0_10px_24px_-12px_rgb(47_91_224/0.75)] hover:brightness-110 hover:border-accent-edge motion-safe:hover:-translate-y-0.5 disabled:hover:translate-y-0 btn-shine",
  glass:
    "bg-[color-mix(in_srgb,var(--surface-2)_80%,transparent)] text-text border-line-strong shadow-[inset_0_1px_0_var(--edge-light)] hover:border-[color-mix(in_srgb,var(--accent-edge)_70%,var(--line))] hover:bg-surface-3",
  secondary:
    "bg-[color-mix(in_srgb,var(--accent)_4%,transparent)] text-text border-[color-mix(in_srgb,var(--accent-edge)_45%,var(--line-strong))] shadow-[inset_0_1px_0_var(--edge-light)] hover:border-accent-edge hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] hover:text-accent-text active:bg-surface-2",
  ghost: "bg-transparent text-text border-transparent hover:border-line-strong active:bg-surface-2",
  quiet: "bg-transparent font-semibold text-muted border-transparent underline-offset-4 hover:text-text hover:underline",
  danger:
    "bg-transparent text-danger border-danger hover:shadow-[0_0_0_1px_var(--danger)] active:bg-danger-surface",
  sold: "border-transparent bg-[linear-gradient(180deg,#22a35a,#15803d_55%,#0f6a32)] text-sold-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-2px_0_rgb(0_40_15/0.3)] hover:brightness-110 btn-shine",
};

const sizes: Record<Size, string> = {
  sm: "h-9 rounded-[var(--radius-xs)] px-3 text-sm",
  md: "h-11 rounded-full px-5 text-sm",
  lg: "h-12 rounded-full px-6 text-base",
  xl: "min-h-[3.25rem] rounded-full px-7 text-sm font-bold uppercase tracking-[0.12em] sm:px-8",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  const gleam = variant === "primary" && size === "xl" ? " btn-gleam" : "";
  return `${base} ${variants[variant]} ${sizes[size]}${gleam} ${extra}`.trim();
}

/** Icons tip slightly on hover, like a gavel about to strike. */
const ICON = "inline-flex shrink-0 transition-transform duration-300 ease-out motion-safe:group-hover:-rotate-12 motion-safe:group-hover:scale-110";

type ButtonProps = ComponentProps<"button"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
};

export function Button({ variant = "secondary", size = "md", loading, loadingLabel, icon, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner /> : icon ? <span className={ICON}>{icon}</span> : null}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant = "secondary", size = "md", icon, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon ? <span className={ICON}>{icon}</span> : null}
      <span>{children}</span>
    </Link>
  );
}
