"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/admin";
import { db } from "@/lib/db";
import { invalid, type ActionResult } from "../result";

const messageStatus = z.object({ id: z.uuid(), status: z.enum(["new", "read", "archived"]) });

/** Contact inbox: mark a message new, read or archived. */
export async function setMessageStatusAction(input: z.input<typeof messageStatus>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = messageStatus.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, status } = parsed.data;
  const sql = db();
  const row = (await sql<{ before: string }[]>`
    update app.contact_messages m set status = ${status}, version = m.version + 1
    from (select status from app.contact_messages where id = ${id}) old
    where m.id = ${id} returning old.status as before`)[0];
  if (!row) return { ok: false, error: "That message no longer exists." };
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'contact.status', 'contact_message', ${id},
    ${sql.json({ status: row.before })}, ${sql.json({ status })}, null)`;
  revalidatePath("/admin/inbox");
  return { ok: true, message: status === "archived" ? "Message archived." : status === "read" ? "Marked as read." : "Marked as new." };
}

/** Contact inbox: delete a message for good (for example after a deletion request). */
export async function deleteMessageAction(input: { id: string }): Promise<ActionResult> {
  const admin = await requireAdmin();
  const id = z.uuid().safeParse(input.id);
  if (!id.success) return { ok: false, error: "That message no longer exists." };
  const sql = db();
  const row = (await sql<{ ref: string }[]>`delete from app.contact_messages where id = ${id.data} returning reference_id as ref`)[0];
  if (!row) return { ok: false, error: "That message no longer exists." };
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'contact.delete', 'contact_message', ${id.data}, ${sql.json({ reference: row.ref })}, null, null)`;
  revalidatePath("/admin/inbox");
  return { ok: true, message: "Message deleted." };
}

const deletionUpdate = z
  .object({
    id: z.uuid(),
    status: z.enum(["received", "verified", "completed", "rejected"]),
    note: z.string().trim().max(500, "Keep the note under 500 characters."),
  })
  .refine((d) => d.status !== "rejected" || d.note.length > 0, { path: ["note"], message: "Say why the request was not carried out. The requester sees this note." });

/**
 * Deletion requests: move a request along. The status and note appear on the
 * public status page for whoever has the reference number.
 */
export async function updateDeletionRequestAction(input: z.input<typeof deletionUpdate>): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = deletionUpdate.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { id, status, note } = parsed.data;
  const sql = db();
  const row = (await sql<{ before: string }[]>`
    update app.deletion_requests d set status = ${status}, status_note = ${note},
      completed_at = case when ${status} = 'completed' then now() else null end, version = d.version + 1
    from (select status from app.deletion_requests where id = ${id}) old
    where d.id = ${id} returning old.status as before`)[0];
  if (!row) return { ok: false, error: "That request no longer exists." };
  await sql`select app._audit(null, 'admin', ${admin.actorId}, 'deletion.status', 'deletion_request', ${id},
    ${sql.json({ status: row.before })}, ${sql.json({ status })}, ${note || null})`;
  revalidatePath("/admin/deletion-requests");
  return { ok: true, message: "Request updated. The requester sees the new status on the status page." };
}
