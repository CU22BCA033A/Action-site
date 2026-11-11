import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "royal" | "glass" | "secondary" | "ghost" | "danger" | "sold" | "quiet";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 font-bold uppercase tracking-wider select-none whitespace-nowrap rounded-[var(--radius-sm)] border transition-[transform,box-shadow,border-color,background-color,color,opacity] duration-200 ease-out motion-safe:active:translate-y-0 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100 aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

/** Variants from the original CPL site: gold, royal, glass and outline. */
const variants: Record<Variant, string> = {
  primary:
    "border-[color-mix(in_srgb,var(--gold-dark)_70%,transparent)] bg-[linear-gradient(180deg,var(--gold-from),var(--gold-to))] text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_1px_2px_rgb(0_0_0/0.3)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_10px_28px_-8px_var(--glow-gold)] motion-safe:hover:-translate-y-px disabled:hover:translate-y-0 disabled:hover:shadow-none",
  royal:
    "border-[color-mix(in_srgb,var(--royal-dark)_80%,transparent)] bg-[linear-gradient(180deg,#4a70e3,#2c4fb8)] text-royal-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_1px_2px_rgb(0_0_0/0.3)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_28px_-8px_var(--glow-royal)] motion-safe:hover:-translate-y-px disabled:hover:translate-y-0",
  glass:
    "bg-surface-2 text-text border-line-strong shadow-[inset_0_1px_0_rgb(255_255_255/0.04)] hover:border-[color-mix(in_srgb,var(--accent)_55%,var(--line))] hover:bg-surface-3",
  secondary:
    "bg-transparent text-text border-line-strong hover:border-text active:bg-surface-2",
  ghost: "bg-transparent text-text border-transparent hover:border-line-strong active:bg-surface-2",
  quiet: "bg-transparent normal-case tracking-normal font-semibold text-muted border-transparent underline-offset-4 hover:text-text hover:underline",
  danger:
    "bg-transparent text-danger border-danger hover:shadow-[0_0_0_1px_var(--danger)] active:bg-danger-surface",
  sold: "border-transparent bg-[linear-gradient(180deg,#15803d,#0f6a32)] text-sold-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_28px_-8px_rgb(22_163_73/0.45)]",
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
