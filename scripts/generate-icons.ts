/**
 * Builds the favicon set from the in-house logo mark (src/components/brand/logo.tsx).
 * Run with `npm run icons` after changing the mark. Output is committed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { logoSvg } from "../src/components/brand/logo";

const ACCENT = "#FFBF00";
const INK = "#0B1220";
const BG = "#080C16";
const pub = join(process.cwd(), "public");
mkdirSync(join(pub, "brand"), { recursive: true });

/** Logo centred on a navy square with padding, as SVG. */
function padded(size: number, padRatio: number) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const off = Math.round((size - inner) / 2);
  const mark = logoSvg(ACCENT, INK).replace("<svg ", `<svg x="${off}" y="${off}" width="${inner}" height="${inner}" `);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${Math.round(size * 0.18)}" fill="${BG}"/>${mark}</svg>`);
}

/** The gold tile fills the icon; small sizes stay legible. */
async function png(size: number) {
  return sharp(Buffer.from(logoSvg(ACCENT, INK)), { density: 72 * (size / 32) * 2 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
}

/** Opaque square for platforms that add their own mask (Android, iOS). */
async function opaque(size: number, padRatio: number) {
  const svg = padded(size, padRatio).toString().replace(/rx="\d+"/, 'rx="0"');
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

/** ICO container holding PNG images (supported by every current browser). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach((img, i) => {
    const o = i * 16;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o);
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, o + 1);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(img.data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += img.data.length;
  });
  return Buffer.concat([header, dir, ...images.map((i) => i.data)]);
}

async function main() {
  writeFileSync(join(pub, "icon.svg"), logoSvg(ACCENT, INK));
  for (const s of [32, 192, 512]) writeFileSync(join(pub, "brand", `icon-${s}.png`), await png(s));
  writeFileSync(join(pub, "brand", "icon-maskable-512.png"), await opaque(512, 0.2));
  writeFileSync(join(pub, "apple-icon.png"), await opaque(180, 0.08));
  writeFileSync(join(pub, "favicon.ico"), ico([{ size: 16, data: await png(16) }, { size: 32, data: await png(32) }, { size: 48, data: await png(48) }]));
  console.log("icons written to public/");
}

void main();
