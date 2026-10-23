import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "royal" | "glass" | "secondary" | "ghost" | "danger" | "sold" | "quiet";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider select-none whitespace-nowrap rounded-[var(--radius-sm)] border transition-[transform,box-shadow,border-color,color,opacity] duration-300 motion-safe:active:scale-95 disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

/** Variants from the original CPL site: gold, royal, glass and outline. */
const variants: Record<Variant, string> = {
  primary:
    "border-transparent bg-[linear-gradient(90deg,var(--accent),var(--gold-dark))] text-accent-ink hover:shadow-[0_8px_24px_var(--glow-gold)] motion-safe:hover:scale-105 disabled:hover:shadow-none disabled:hover:scale-100",
  royal:
    "border-transparent bg-[linear-gradient(90deg,var(--royal),var(--royal-dark))] text-royal-ink hover:shadow-[0_8px_24px_var(--glow-royal)] motion-safe:hover:scale-105 disabled:hover:scale-100",
  glass:
    "bg-[color-mix(in_srgb,var(--surface)_55%,transparent)] text-text border-line hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]",
  secondary:
    "bg-transparent text-text border-line-strong hover:border-text active:bg-surface-2",
  ghost: "bg-transparent text-text border-transparent hover:border-line-strong active:bg-surface-2",
  quiet: "bg-transparent normal-case tracking-normal font-semibold text-muted border-transparent underline-offset-4 hover:text-text hover:underline",
  danger:
    "bg-transparent text-danger border-danger hover:shadow-[0_0_0_1px_var(--danger)] active:bg-danger-surface",
  sold: "border-transparent bg-[linear-gradient(90deg,var(--sold),#15803d)] text-sold-ink hover:shadow-[0_8px_24px_rgb(22_163_73/0.3)]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 rounded-[var(--radius-xs)] px-3 text-xs",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base",
  xl: "min-h-14 rounded-[var(--radius-md)] px-8 text-lg sm:px-10",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra = "") {
  return `${base} ${variants[variant]} ${sizes[size]} ${extra}`.trim();
}

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
      {loading ? <Spinner /> : icon}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size; icon?: ReactNode };

export function ButtonLink({ variant = "secondary", size = "md", icon, className = "", children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClass(variant, size, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
