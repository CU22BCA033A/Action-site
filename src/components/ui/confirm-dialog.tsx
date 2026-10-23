"use client";

import { useState, type ReactNode } from "react";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { Field, Textarea } from "./field";

/**
 * Confirmation for destructive or irreversible actions. Spells out exactly
 * what will happen. Optionally requires a reason, which goes to the audit log.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  consequences,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  requireReason = false,
  reasonLabel = "Reason (saved in the audit log)",
  reasonError,
  error,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: ReactNode;
  consequences: ReactNode[];
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonError?: string;
  error?: string | null;
  children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const missingReason = requireReason && reason.trim().length === 0;

  return (
    <Dialog open={open} onClose={busy ? () => {} : onClose} title={title} closeLabel={cancelLabel}>
      <ul className="flex flex-col gap-2 border-l-2 border-line-strong pl-4 text-sm text-muted">
        {consequences.map((c, i) => (
          <li key={i}>{c}</li>
        ))}
      </ul>
      {children}
      {requireReason ? (
        <Field name="confirm-reason" label={reasonLabel} error={touched && missingReason ? (reasonError ?? "Enter a reason.") : undefined}>
          <Textarea
            id="f-confirm-reason"
            rows={2}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={touched && missingReason ? true : undefined}
            aria-describedby={touched && missingReason ? "f-confirm-reason-error" : undefined}
          />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-[var(--radius-sm)] border border-danger bg-danger-surface p-3 text-sm text-text">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={() => {
            setTouched(true);
            if (missingReason) return;
            onConfirm(reason.trim());
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
