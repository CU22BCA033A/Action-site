import type { MetadataRoute } from "next";
import { siteConfig } from "@config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteConfig.brandName || "Player auction",
    short_name: siteConfig.brandName || "Auction",
    description: "Live player auctions for local leagues.",
    start_url: "/",
    display: "standalone",
    background_color: "#080c16",
    theme_color: "#080c16",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
