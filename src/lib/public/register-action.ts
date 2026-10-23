"use server";

import { isUnder18, playerInputSchema, sportProblems } from "@/lib/admin/player-input";
import { clientIp } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { hashIp, referenceId } from "@/lib/security/crypto";
import { checkFormToken } from "@/lib/security/form-token";
import { rateLimit } from "@/lib/security/rate-limit";
import { sportConfigSchema } from "@/lib/sports/config";
import { deleteImage, MAX_UPLOAD_BYTES, sniffImage, storeImage, UploadError } from "@/lib/storage";

export type RegisterErrorKey = "name" | "role" | "photo" | "photoType" | "consent" | "guardian" | "dob" | "tooFast" | "rateLimited" | "closed";
export type RegisterState =
  | { status: "idle" }
  | { status: "error"; fields: Partial<Record<"fullName" | "roleKey" | "photo" | "consent" | "guardianConsent" | "dateOfBirth", RegisterErrorKey>>; form?: RegisterErrorKey }
  | { status: "done"; reference: string };

/** Public player registration. Lands as "pending" for the admin to review. */
export async function registerPlayerAction(slug: string, _prev: RegisterState, formData: FormData): Promise<RegisterState> {
  // Honeypot: real people never see or fill this field. Pretend success.
  if (String(formData.get("website") ?? "").length > 0) return { status: "done", reference: referenceId("REG") };

  const token = checkFormToken(String(formData.get("formToken") ?? ""));
  if (token === "too_fast" || token === "invalid") return { status: "error", fields: {}, form: "tooFast" };

  const sql = db();
  const auction = (await sql<{ id: string; open: boolean; config: unknown }[]>`
    select a.id, a.registration_open as open, s.config from app.auctions a join app.sports s on s.id = a.sport_id
    where a.slug = ${slug} and a.deleted_at is null`)[0];
  if (!auction || !auction.open) return { status: "error", fields: {}, form: "closed" };

  const ipHash = hashIp(await clientIp());
  if (!(await rateLimit(`register:${ipHash}`, 5, 3600))) return { status: "error", fields: {}, form: "rateLimited" };

  const config = sportConfigSchema.parse(auction.config);
  const statsRaw: Record<string, number> = {};
  for (const s of config.statFields) {
    const v = String(formData.get(`stat_${s.key}`) ?? "").trim();
    if (v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0) statsRaw[s.key] = Number(v);
  }
  const input = {
    fullName: String(formData.get("fullName") ?? ""),
    roleKey: String(formData.get("roleKey") ?? ""),
    subRole: String(formData.get("subRole") ?? "") || undefined,
    nationalityGroup: formData.get("nationalityGroup") === "overseas" ? "overseas" : "domestic",
    stats: statsRaw,
    bioShort: String(formData.get("bioShort") ?? "").slice(0, 160),
    dateOfBirth: String(formData.get("dateOfBirth") ?? "") || undefined,
    guardianConsent: formData.get("guardianConsent") === "on" ? true : null,
  };
  const fields: Extract<RegisterState, { status: "error" }>["fields"] = {};
  const parsed = playerInputSchema.safeParse(input);
  if (!parsed.success) {
    for (const i of parsed.error.issues) {
      const k = i.path[0];
      if (k === "fullName") fields.fullName = "name";
      else if (k === "roleKey") fields.roleKey = "role";
      else if (k === "dateOfBirth") fields.dateOfBirth = "dob";
    }
  } else {
    const sp = sportProblems(config, parsed.data);
    if (sp.roleKey || sp.subRole) fields.roleKey = "role";
    if (isUnder18(parsed.data.dateOfBirth) && !parsed.data.guardianConsent) fields.guardianConsent = "guardian";
  }
  if (formData.get("consent") !== "on") fields.consent = "consent";
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) fields.photo = "photo";
  else if (photo.size > MAX_UPLOAD_BYTES || !sniffImage(new Uint8Array(await photo.slice(0, 16).arrayBuffer()))) fields.photo = "photoType";
  if (Object.keys(fields).length || !parsed.success) return { status: "error", fields };

  let photoPath: string;
  try {
    photoPath = await storeImage(photo as File, "player");
  } catch (e) {
    return { status: "error", fields: { photo: e instanceof UploadError ? "photoType" : "photo" } };
  }
  const v = parsed.data;
  const reference = referenceId("REG");
  try {
    await sql`
      insert into app.player_registrations(auction_id, reference_id, full_name, role_key, sub_role, nationality_group, photo_path, stats,
        bio_short, date_of_birth, guardian_consent, consent_given, ip_hash)
      values (${auction.id}, ${reference}, ${v.fullName}, ${v.roleKey}, ${v.subRole}, ${v.nationalityGroup}, ${photoPath}, ${sql.json(v.stats)},
        ${v.bioShort}, ${v.dateOfBirth}, ${v.guardianConsent}, true, ${ipHash})`;
  } catch {
    await deleteImage(photoPath);
    return { status: "error", fields: {}, form: "closed" };
  }
  return { status: "done", reference };
}
