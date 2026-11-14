/**
 * Shrinks a photo in the browser before upload, so a 6 to 12 MB phone camera
 * picture becomes a few hundred KB. Uploads then stay well under the server's
 * size limit (and Vercel's 4.5 MB request limit) and finish quickly on mobile
 * data. The server still checks and re-encodes every image.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.86;

export async function shrinkImage(file: File, maxSide = MAX_SIDE): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Small enough already and a format the server accepts: keep the original.
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && /^image\/(jpeg|png|webp)$/.test(file.type)) {
      bitmap.close();
      return file;
    }
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}

/** Replaces the file in an <input type="file"> with its shrunk version. */
export async function shrinkFileInput(input: HTMLInputElement, maxSide = MAX_SIDE): Promise<File | null> {
  const file = input.files?.[0];
  if (!file) return null;
  const small = await shrinkImage(file, maxSide);
  if (small !== file && typeof DataTransfer !== "undefined") {
    try {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
    } catch {
      /* older browsers: the original file is sent and the server decides */
    }
  }
  return small;
}
