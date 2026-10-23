import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { processImage, sniffImage, UploadError } from "@/lib/storage";

async function file(buf: Buffer, name = "x.jpg", type = "image/jpeg") {
  return new File([new Uint8Array(buf)], name, { type });
}

describe("uploads", () => {
  it("recognises images by their bytes, not their names", async () => {
    const png = await sharp({ create: { width: 4, height: 4, channels: 3, background: "#f00" } }).png().toBuffer();
    expect(sniffImage(png)).toBe("png");
    expect(sniffImage(new TextEncoder().encode("<svg></svg>"))).toBeNull();
    await expect(processImage(await file(Buffer.from("GIF89a....")), "player")).rejects.toBeInstanceOf(UploadError);
  });

  it("rejects files over 3 MB before decoding", async () => {
    await expect(processImage(await file(Buffer.alloc(3 * 1024 * 1024 + 1, 0xff)), "player")).rejects.toThrow(/3 MB/);
  });

  it("re-encodes to WebP within the size budget and strips metadata", async () => {
    const big = await sharp({ create: { width: 2400, height: 1600, channels: 3, background: "#3a6" } })
      .composite([{ input: Buffer.from(`<svg width="2400" height="1600"><text x="100" y="800" font-size="400">noise</text></svg>`) }])
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
      .toBuffer();
    const out = await processImage(await file(big), "player");
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(800);
    expect(meta.exif).toBeUndefined();
    expect(out.length).toBeLessThanOrEqual(120 * 1024);
    const logo = await processImage(await file(big), "logo");
    expect((await sharp(logo).metadata()).width).toBeLessThanOrEqual(400);
    expect(logo.length).toBeLessThanOrEqual(40 * 1024);
  });
});
