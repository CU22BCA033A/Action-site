"use client";

import { Archive, Mail, MailOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, FormStatus, Select, SelectWrap, Textarea, describedBy } from "@/components/ui/field";
import { deleteRegistrationAction } from "@/lib/admin/actions/registrations";
import { deleteMessageAction, setMessageStatusAction, updateDeletionRequestAction } from "@/lib/admin/actions/inbox";
import { formatDateTime } from "@/lib/format";
import { useAdminAction } from "./use-admin-action";

export type InboxMessage = {
  id: string;
  reference: string;
  name: string;
  email: string;
  message: string;
  status: "new" | "read" | "archived";
  utm: string;
  createdAt: string;
};

/** One contact message with read, archive and delete. */
export function MessageCard({ m }: { m: InboxMessage }) {
  const status = useAdminAction(setMessageStatusAction);
  const del = useAdminAction(deleteMessageAction);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const result = del.result ?? status.result;
  return (
    <li className={`card p-5 ${m.status === "new" ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">
            {m.name}{" "}
            <a className="link font-normal text-muted" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: your message ${m.reference}`)}`}>
              {m.email}
            </a>
          </p>
          <p className="num mt-0.5 text-xs text-faint">
            {m.reference} / {formatDateTime(m.createdAt)}
            {m.utm ? ` / ${m.utm}` : ""}
          </p>
        </div>
        <Badge tone={m.status === "new" ? "accent" : m.status === "archived" ? "unsold" : "neutral"}>{m.status}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-line">{m.message}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {m.status === "new" ? (
          <Button size="sm" disabled={status.pending} icon={<MailOpen className="size-4" aria-hidden="true" />} onClick={() => status.run({ id: m.id, status: "read" })}>
            Mark read
          </Button>
        ) : (
          <Button size="sm" disabled={status.pending} icon={<Mail className="size-4" aria-hidden="true" />} onClick={() => status.run({ id: m.id, status: "new" })}>
            Mark new
          </Button>
        )}
        {m.status !== "archived" ? (
          <Button size="sm" disabled={status.pending} icon={<Archive className="size-4" aria-hidden="true" />} onClick={() => status.run({ id: m.id, status: "archived" })}>
            Archive
          </Button>
        ) : null}
        <Button size="sm" variant="danger" disabled={del.pending} icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
      </div>
      {result ? <div className="mt-3"><FormStatus kind={result.ok ? "success" : "error"}>{result.ok ? result.message : result.error}</FormStatus></div> : null}
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => del.run({ id: m.id }, () => setConfirmDelete(false))}
        title={`Delete the message from ${m.name}?`}
        consequences={["The name, email and message are removed for good.", "The deletion is written to the audit log (without the message text)."]}
        confirmLabel="Delete message"
        danger
        busy={del.pending}
      />
    </li>
  );
}

export type DeletionRequest = {
  id: string;
  reference: string;
  name: string;
  contact: string;
  registrationRef: string | null;
  details: string;
  status: "received" | "verified" | "completed" | "rejected";
  note: string;
  createdAt: string;
  match: { registrationId: string; auctionId: string; auctionName: string; fullName: string; status: string } | null;
};

const STATUS_LABEL: Record<DeletionRequest["status"], string> = {
  received: "Received",
  verified: "Checked, in progress",
  completed: "Done",
  rejected: "Not carried out",
};

/** One deletion request: the matching registration (if any), and a status the requester can see. */
export function DeletionCard({ r }: { r: DeletionRequest }) {
  const update = useAdminAction(updateDeletionRequestAction);
  const delReg = useAdminAction(deleteRegistrationAction);
  const [status, setStatus] = useState(r.status);
  const [note, setNote] = useState(r.note);
  const [confirmReg, setConfirmReg] = useState(false);
  const noteError = update.fieldErrors.note;
  const fid = `req-${r.id}`;
  return (
    <li className={`card p-5 ${r.status === "received" ? "border-[color-mix(in_srgb,var(--accent)_45%,var(--line))]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{r.name}</p>
          <p className="num mt-0.5 text-xs text-faint">
            {r.reference} / {formatDateTime(r.createdAt)}
            {r.contact ? ` / ${r.contact}` : ""}
            {r.registrationRef ? ` / registration ${r.registrationRef}` : ""}
          </p>
        </div>
        <Badge tone={r.status === "completed" ? "sold" : r.status === "rejected" ? "danger" : r.status === "verified" ? "paused" : "accent"}>{STATUS_LABEL[r.status]}</Badge>
      </div>
      <p className="mt-3 whitespace-pre-line">{r.details}</p>

      {r.registrationRef ? (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-line bg-surface-2 p-3 text-sm">
          {r.match ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p>
                Registration found: <span className="font-bold">{r.match.fullName}</span> in {r.match.auctionName} ({r.match.status}).
                {r.match.status === "approved" ? " It is already a player: delete the player from that auction's Players tab as well." : ""}
              </p>
              <Button size="sm" variant="danger" disabled={delReg.pending} icon={<Trash2 className="size-4" aria-hidden="true" />} onClick={() => setConfirmReg(true)}>
                Delete registration
              </Button>
            </div>
          ) : (
            <p className="text-muted">No registration has this reference. It may have been deleted already, or the number is wrong.</p>
          )}
          {delReg.result ? <div className="mt-2"><FormStatus kind={delReg.result.ok ? "success" : "error"}>{delReg.result.ok ? delReg.result.message : delReg.result.error}</FormStatus></div> : null}
        </div>
      ) : null}

      <form
        className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[14rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          update.run({ id: r.id, status, note });
        }}
      >
        <Field name={`${fid}-status`} label="Status">
          <SelectWrap>
            <Select id={`f-${fid}-status`} value={status} onChange={(e) => setStatus(e.target.value as DeletionRequest["status"])}>
              {(Object.keys(STATUS_LABEL) as DeletionRequest["status"][]).map((k) => (
                <option key={k} value={k}>{STATUS_LABEL[k]}</option>
              ))}
            </Select>
          </SelectWrap>
        </Field>
        <Field name={`${fid}-note`} label="Note for the requester" optional={status !== "rejected"} error={noteError}>
          <Textarea id={`f-${fid}-note`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={1} className="min-h-11" aria-invalid={noteError ? true : undefined} aria-describedby={describedBy(`${fid}-note`, false, Boolean(noteError))} />
        </Field>
        <Button type="submit" variant="primary" disabled={update.pending}>Save</Button>
      </form>
      {update.result ? <div className="mt-3"><FormStatus kind={update.result.ok ? "success" : "error"}>{update.result.ok ? update.result.message : update.result.error}</FormStatus></div> : null}

      {r.match ? (
        <ConfirmDialog
          open={confirmReg}
          onClose={() => setConfirmReg(false)}
          onConfirm={() => delReg.run({ auctionId: r.match!.auctionId, registrationId: r.match!.registrationId }, () => setConfirmReg(false))}
          title={`Delete the registration of ${r.match.fullName}?`}
          consequences={["The registration and its photo are removed for good.", r.match.status === "approved" ? "The player made from it stays until you delete it from the auction's Players tab." : "Nothing else changes.", "Then set this request to Done."]}
          confirmLabel="Delete registration"
          danger
          busy={delReg.pending}
        />
      ) : null}
    </li>
  );
}
