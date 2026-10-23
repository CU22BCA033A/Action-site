"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Modal built on the native <dialog> element: the browser traps focus,
 * makes the page behind it inert, and closes it on Escape. Focus returns to
 * the element that opened it.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  closeLabel = "Close",
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      returnTo.current = document.activeElement as HTMLElement | null;
      el.showModal();
    } else if (!open && el.open) {
      el.close();
      returnTo.current?.focus?.();
    }
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", onCancel);
    return () => el.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const width = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-3xl" : "max-w-xl";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      className={`m-auto w-[calc(100%-2rem)] ${width} max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--radius-md)] border border-line-strong bg-surface p-0 text-text backdrop:bg-[var(--overlay)]`}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open ? (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id={titleId} className="text-2xl sm:text-3xl">
                {title}
              </h2>
              {description ? (
                <div id={descId} className="mt-2 text-sm text-muted">
                  {description}
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-muted hover:border-line-strong hover:text-text"
              aria-label={closeLabel}
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
