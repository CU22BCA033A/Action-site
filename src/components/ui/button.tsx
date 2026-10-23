import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "sold" | "quiet";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold select-none whitespace-nowrap rounded-[var(--radius-sm)] border transition-colors duration-100 disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink border-accent-edge hover:bg-accent-hover active:bg-accent-press disabled:hover:bg-accent",
  secondary:
    "bg-surface text-text border-line-strong hover:border-text active:bg-surface-2",
  ghost: "bg-transparent text-text border-transparent hover:border-line-strong active:bg-surface-2",
  quiet: "bg-transparent text-muted border-transparent underline-offset-4 hover:text-text hover:underline",
  danger:
    "bg-surface text-danger border-danger hover:bg-danger-surface active:bg-danger-surface",
  sold: "bg-sold text-sold-ink border-sold hover:opacity-90",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-[0.95rem]",
  lg: "h-12 px-5 text-base",
  xl: "min-h-16 px-6 text-lg",
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
