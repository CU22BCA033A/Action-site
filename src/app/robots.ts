import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/manager", "/setup", "/search", "/data-deletion/status", "/*/overlay", "/*/screen"] }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
