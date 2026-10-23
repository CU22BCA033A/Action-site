import type { ComponentProps, ReactNode } from "react";

/**
 * Form fields with labels, hints and errors tied to the input through
 * aria-describedby. Errors are announced and shown next to the field.
 */

const control =
  "w-full min-w-0 rounded-[var(--radius-sm)] border bg-bg-sunken px-3 text-text placeholder:text-faint transition-colors duration-100 hover:border-line-strong focus-visible:border-focus aria-invalid:border-danger disabled:opacity-60";

export function fieldIds(name: string) {
  return { input: `f-${name}`, hint: `f-${name}-hint`, error: `f-${name}-error` };
}

export function describedBy(name: string, hasHint: boolean, hasError: boolean) {
  const ids = fieldIds(name);
  return [hasHint ? ids.hint : null, hasError ? ids.error : null].filter(Boolean).join(" ") || undefined;
}

type FieldProps = {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  optionalLabel?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ name, label, hint, error, optional, optionalLabel = "Optional", children, className = "" }: FieldProps) {
  const ids = fieldIds(name);
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={ids.input} className="text-sm font-semibold text-text">
        {label}
        {optional ? <span className="ml-2 font-normal text-faint">{optionalLabel}</span> : null}
      </label>
      {hint ? (
        <p id={ids.hint} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={ids.error} className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <span aria-hidden="true" className="mt-[0.35rem] inline-block size-2 shrink-0 rotate-45 bg-danger" />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...rest }: ComponentProps<"input">) {
  return <input className={`${control} h-11 border-line ${className}`} {...rest} />;
}

export function Textarea({ className = "", ...rest }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-28 border-line py-2.5 ${className}`} {...rest} />;
}

export function Select({ className = "", children, ...rest }: ComponentProps<"select">) {
  return (
    <select className={`${control} h-11 appearance-none border-line bg-[length:12px] pr-9 ${className}`} {...rest}>
      {children}
    </select>
  );
}

export function SelectWrap({ children }: { children: ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg aria-hidden="true" viewBox="0 0 12 8" className="pointer-events-none absolute right-3 top-1/2 h-2 w-3 -translate-y-1/2 text-muted">
        <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      </svg>
    </div>
  );
}

type CheckboxProps = ComponentProps<"input"> & { label: ReactNode; error?: string; hint?: ReactNode };

export function Checkbox({ id, name, label, error, hint, className = "", ...rest }: CheckboxProps) {
  const ids = fieldIds(name ?? id ?? "check");
  const inputId = id ?? ids.input;
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          name={name}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-[var(--accent)]"
          aria-invalid={error ? true : undefined}
          aria-describedby={[hint ? ids.hint : null, error ? ids.error : null].filter(Boolean).join(" ") || undefined}
          {...rest}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-snug text-text">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={ids.hint} className="pl-8 text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={ids.error} className="pl-8 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function FormErrorSummary({ title, errors }: { title: string; errors: { name: string; message: string }[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" tabIndex={-1} className="rounded-[var(--radius-sm)] border border-danger bg-danger-surface p-4" id="form-error-summary">
      <p className="font-semibold text-text">{title}</p>
      <ul className="mt-2 list-none space-y-1">
        {errors.map((e) => (
          <li key={e.name}>
            <a className="link text-sm text-danger" href={`#${fieldIds(e.name).input}`}>
              {e.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormStatus({ kind, children }: { kind: "success" | "error" | "info"; children: ReactNode }) {
  const styles =
    kind === "success"
      ? "border-sold bg-success-surface"
      : kind === "error"
        ? "border-danger bg-danger-surface"
        : "border-line-strong bg-surface-2";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-[var(--radius-sm)] border p-4 text-sm text-text ${styles}`}>
      {children}
    </div>
  );
}
