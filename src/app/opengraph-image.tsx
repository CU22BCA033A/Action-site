import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { siteConfig } from "@config";
import { logoSvg } from "@/components/brand/logo";

export const dynamic = "force-static";
export const alt = "Live player auctions for local leagues";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Share image built at deploy time from the brand name and the in-house logo. */
export default async function OpengraphImage() {
  const files = join(process.cwd(), "node_modules", "@fontsource");
  const [display, body] = await Promise.all([
    readFile(join(files, "inter", "files", "inter-latin-900-normal.woff")),
    readFile(join(files, "inter", "files", "inter-latin-500-normal.woff")),
  ]);
  const logo = `data:image/svg+xml;base64,${Buffer.from(logoSvg("#FFBF00", "#0B1220")).toString("base64")}`;
  const brand = (siteConfig.brandName || "Player auction").toUpperCase();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "72px 88px", background: "linear-gradient(180deg, #0b111e, #05080f)", color: "#fff9e6", fontFamily: "Inter" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          <img src={logo} width={112} height={112} alt="" />
          <div style={{ fontFamily: "InterBlack", fontSize: 92, color: "#ffbf00", letterSpacing: 4 }}>{brand}</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 52, lineHeight: 1.2 }}>Live player auctions for local leagues</div>
        <div style={{ marginTop: 24, fontSize: 34, color: "#9aa5be" }}>Team owners bid from their phones. Everyone watches live.</div>
        <div style={{ marginTop: 56, height: 6, width: 220, background: "#ffbf00" }} />
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "InterBlack", data: display, weight: 900, style: "normal" },
        { name: "Inter", data: body, weight: 500, style: "normal" },
      ],
    },
  );
}
