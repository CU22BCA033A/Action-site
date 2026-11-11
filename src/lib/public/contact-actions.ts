"use server";

import { z } from "zod";
import { clientIp } from "@/lib/auth/session";
import { sanitizeUtmValue } from "@/lib/consent";
import { db } from "@/lib/db";
import { hashIp, referenceId } from "@/lib/security/crypto";
import { checkFormToken } from "@/lib/security/form-token";
import { rateLimit } from "@/lib/security/rate-limit";

type Bad = "tooFast" | "rateLimited" | "generic";

export type ContactErrorKey = "name" | "email" | "message" | "consent";
export type ContactState =
  | { status: "idle" }
  | { status: "error"; fields: Partial<Record<"name" | "email" | "message" | "consent", ContactErrorKey>>; form?: Bad }
  | { status: "done"; reference: string };

const contactSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().max(254).email(),
  message: z.string().trim().min(1).max(4000),
});

async function guard(formData: FormData, bucket: string, limit: number): Promise<Bad | null> {
  const token = checkFormToken(String(formData.get("formToken") ?? ""));
  if (token !== "ok") return "tooFast";
  if (!(await rateLimit(`${bucket}:${hashIp(await clientIp())}`, limit, 3600))) return "rateLimited";
  return null;
}

export async function sendContactAction(_prev: ContactState, formData: FormData): Promise<ContactState> {
  if (String(formData.get("website") ?? "")) return { status: "done", reference: referenceId("MSG") };
  const input = { name: String(formData.get("name") ?? ""), email: String(formData.get("email") ?? ""), message: String(formData.get("message") ?? "") };
  const fields: Extract<ContactState, { status: "error" }>["fields"] = {};
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) for (const i of parsed.error.issues) fields[i.path[0] as "name" | "email" | "message"] = i.path[0] as ContactErrorKey;
  if (formData.get("consent") !== "on") fields.consent = "consent";
  if (Object.keys(fields).length || !parsed.success) return { status: "error", fields };

  const bad = await guard(formData, "contact", 5);
  if (bad) return { status: "error", fields: {}, form: bad };

  const reference = referenceId("MSG");
  try {
    await db()`
      insert into app.contact_messages(reference_id, name, email, message, consent_given, utm_source, utm_medium, utm_campaign)
      values (${reference}, ${parsed.data.name}, ${parsed.data.email}, ${parsed.data.message}, true,
        ${sanitizeUtmValue(String(formData.get("utm_source") ?? "")) ?? null},
        ${sanitizeUtmValue(String(formData.get("utm_medium") ?? "")) ?? null},
        ${sanitizeUtmValue(String(formData.get("utm_campaign") ?? "")) ?? null})`;
  } catch {
    return { status: "error", fields: {}, form: "generic" };
  }
  return { status: "done", reference };
}

export type DeletionErrorKey = "name" | "details";
export type DeletionState =
  | { status: "idle" }
  | { status: "error"; fields: Partial<Record<"name" | "details", DeletionErrorKey>>; form?: Bad }
  | { status: "done"; reference: string };

const deletionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  contact: z.string().trim().max(254),
  registrationRef: z.string().trim().toUpperCase().max(20),
  details: z.string().trim().min(1).max(2000),
});

export async function requestDeletionAction(_prev: DeletionState, formData: FormData): Promise<DeletionState> {
  if (String(formData.get("website") ?? "")) return { status: "done", reference: referenceId("DEL") };
  const parsed = deletionSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    contact: String(formData.get("contact") ?? ""),
    registrationRef: String(formData.get("registrationRef") ?? ""),
    details: String(formData.get("details") ?? ""),
  });
  if (!parsed.success) {
    const fields: Extract<DeletionState, { status: "error" }>["fields"] = {};
    for (const i of parsed.error.issues) {
      if (i.path[0] === "name") fields.name = "name";
      else fields.details = "details";
    }
    return { status: "error", fields };
  }
  const bad = await guard(formData, "deletion", 5);
  if (bad) return { status: "error", fields: {}, form: bad };

  const reference = referenceId("DEL");
  const v = parsed.data;
  try {
    await db()`
      insert into app.deletion_requests(reference_id, requester_name, requester_contact, registration_reference_id, details)
      values (${reference}, ${v.name}, ${v.contact}, ${v.registrationRef || null}, ${v.details})`;
  } catch {
    return { status: "error", fields: {}, form: "generic" };
  }
  return { status: "done", reference };
}
