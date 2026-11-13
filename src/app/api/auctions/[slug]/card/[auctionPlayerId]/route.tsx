import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import sharp from "sharp";
import { siteConfig } from "@config";
import { getAuctionIdBySlug, listAuctionPlayers } from "@/lib/data/public";
import { formatPoints } from "@/lib/format";
import { getSnapshot } from "@/lib/live/engine";
import { mediaUrl } from "@/lib/media";

/**
 * "Save player card": a 1080x1350 PNG of a sold player in the style of the
 * sale cards on the live page. Public data only; 404 for unsold players.
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string; auctionPlayerId: string }> }) {
  const { slug, auctionPlayerId } = await params;
  const a = await getAuctionIdBySlug(slug);
  if (!a) return new Response("Not found", { status: 404 });
  const s = await getSnapshot(a.id);
  if (!s) return new Response("Not found", { status: 404 });
  const p = (await listAuctionPlayers(a.id)).find((x) => x.auctionPlayerId === auctionPlayerId);
  if (!p || (p.status !== "sold" && p.status !== "retained") || !p.soldToTeamId) return new Response("Not found", { status: 404 });
  const team = s.teams.find((t) => t.id === p.soldToTeamId);
  const role = s.auction.sportConfig.roles.find((r) => r.key === p.roleKey)?.label ?? p.roleKey;

  const fonts = join(process.cwd(), "src", "assets", "card");
  const [black, semi] = await Promise.all([readFile(join(fonts, "plus-jakarta-sans-latin-800-normal.woff")), readFile(join(fonts, "plus-jakarta-sans-latin-600-normal.woff"))]);

  // Photos are stored as WebP; the renderer needs PNG, so convert here.
  let photo: string | null = null;
  const url = mediaUrl(p.photoPath);
  if (url) {
    try {
      const raw = url.startsWith("/") ? await readFile(join(process.cwd(), "public", url)) : Buffer.from(await (await fetch(url)).arrayBuffer());
      const png = await sharp(raw).resize(600, 800, { fit: "cover", position: "top" }).png().toBuffer();
      photo = `data:image/png;base64,${png.toString("base64")}`;
    } catch {
      photo = null;
    }
  }
  const initials = p.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const unit = s.auction.pointsUnitLabel;

  const image = new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", background: "radial-gradient(120% 60% at 50% 100%, rgba(255,191,0,0.22), rgba(10,10,10,0) 70%), #0a0a0a", color: "#fafafa", fontFamily: "Jakarta", padding: "64px 72px" }}>
        <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ width: 110, height: 110, borderRadius: 28, background: team?.primaryColor ?? "#1f1f1f", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, fontWeight: 800, color: "#ffffff" }}>{team?.shortName ?? ""}</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right" }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 8, color: "#60a5fa", textTransform: "uppercase" }}>{s.auction.name}</div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 600, letterSpacing: 8, color: "#a3a3a3", textTransform: "uppercase" }}>Bought by</div>
            <div style={{ marginTop: 6, fontSize: 34, fontWeight: 800, letterSpacing: 5, textTransform: "uppercase" }}>{team?.name ?? ""}</div>
          </div>
        </div>
        <div style={{ marginTop: 40, width: 420, height: 560, borderRadius: 40, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#1a1a1a", border: "2px solid #2f2f2f" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} width={420} height={560} alt="" style={{ objectFit: "cover" }} />
          ) : (
            <div style={{ fontSize: 140, fontWeight: 800, color: "#3a3a3a" }}>{initials}</div>
          )}
        </div>
        <div style={{ marginTop: 44, fontSize: 92, fontWeight: 800, letterSpacing: -3, textTransform: "uppercase", textAlign: "center", lineHeight: 1 }}>{p.fullName}</div>
        <div style={{ marginTop: 18, fontSize: 26, fontWeight: 600, letterSpacing: 10, color: "#a3a3a3", textTransform: "uppercase" }}>{role}</div>
        <div style={{ marginTop: "auto", display: "flex", alignItems: "baseline", justifyContent: "center", gap: 16, padding: "26px 80px", borderRadius: 36, border: "2px solid #2f2f2f", background: "#111111" }}>
          <div style={{ fontSize: 76, fontWeight: 800 }}>{formatPoints(p.soldPrice)}</div>
          <div style={{ fontSize: 32, fontWeight: 600, color: "#a3a3a3" }}>{unit}</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 22, fontWeight: 600, letterSpacing: 6, color: "#8a8a8a", textTransform: "uppercase" }}>{siteConfig.brandName || ""}</div>
      </div>
    ),
    {
      width: 1080,
      height: 1350,
      fonts: [
        { name: "Jakarta", data: black, weight: 800, style: "normal" },
        { name: "Jakarta", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
  const safe = p.fullName.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "player";
  const headers = new Headers(image.headers);
  headers.set("Content-Disposition", `attachment; filename="${safe}-card.png"`);
  headers.set("Cache-Control", "public, max-age=60");
  void req;
  return new Response(image.body, { status: 200, headers });
}
