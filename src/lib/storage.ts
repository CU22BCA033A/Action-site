import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp, { type Sharp } from "sharp";
import { getEnv } from "@/lib/env";
import { MEDIA_BUCKET } from "@/lib/media";

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

export type ImageKind = "player" | "logo";

/** Width cap and byte budget per kind (free storage limits). */
const SPEC: Record<ImageKind, { size: number; budget: number; folder: string; fit: "cover" | "inside" }> = {
  player: { size: 800, budget: 120 * 1024, folder: "players", fit: "cover" },
  logo: { size: 400, budget: 40 * 1024, folder: "logos", fit: "inside" },
};

export class UploadError extends Error {}

/** JPEG, PNG or WebP only, judged by the file's first bytes, never its name. */
export function sniffImage(buf: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return "png";
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  )
    return "webp";
  return null;
}

/**
 * Validates and re-encodes an upload. Metadata (including EXIF location) is
 * dropped because sharp writes none unless asked. Quality steps down until
 * the file fits its budget.
 */
export async function processImage(file: File, kind: ImageKind): Promise<Buffer> {
  if (file.size === 0) throw new UploadError("The file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("The file is larger than 3 MB. Choose a smaller photo.");
  const input = new Uint8Array(await file.arrayBuffer());
  if (!sniffImage(input)) throw new UploadError("Use a JPEG, PNG or WebP image.");
  const spec = SPEC[kind];
  let pipeline: Sharp;
  try {
    pipeline = sharp(input, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const meta = await pipeline.metadata();
    if (!meta.width || !meta.height) throw new Error("no size");
  } catch {
    throw new UploadError("That image could not be read. Try another file.");
  }
  const resized = pipeline.resize(spec.size, spec.size, { fit: spec.fit, position: "attention", withoutEnlargement: true });
  const base = await resized.toBuffer();
  for (const quality of [80, 72, 64, 56, 48, 40]) {
    const out = await sharp(base).webp({ quality, effort: 5 }).toBuffer();
    if (out.length <= spec.budget || quality === 40) return out;
  }
  throw new UploadError("That image could not be compressed.");
}

function newKey(kind: ImageKind) {
  return `${SPEC[kind].folder}/${randomBytes(12).toString("hex")}.webp`;
}

/** Stores a processed image and returns its storage key, such as players/abc.webp. */
export async function storeImage(file: File, kind: ImageKind): Promise<string> {
  const body = await processImage(file, kind);
  const key = newKey(kind);
  const env = getEnv();
  if (env.storageDriver === "supabase") {
    const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/${MEDIA_BUCKET}/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
        "x-upsert": "false",
      },
      body: new Uint8Array(body),
    });
    if (!res.ok) throw new UploadError("The image could not be saved. Try again.");
  } else {
    const path = join(process.cwd(), "public", "media", key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }
  return key;
}

/** Best effort: a leftover file only costs storage, never correctness. */
export async function deleteImage(key: string | null | undefined): Promise<void> {
  if (!key || !/^(players|logos)\/[a-f0-9]{24}\.webp$/.test(key)) return;
  const env = getEnv();
  try {
    if (env.storageDriver === "supabase") {
      await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/storage/v1/object/${MEDIA_BUCKET}/${key}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY! },
      });
    } else {
      await unlink(join(process.cwd(), "public", "media", key));
    }
  } catch {
    /* already gone */
  }
}
