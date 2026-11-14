import { afterEach, describe, expect, it, vi } from "vitest";
import { normaliseOrigin, siteUrl, siteUrlMismatch } from "@/lib/site";

describe("site address", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("normalises hand-typed addresses", () => {
    expect(normaliseOrigin("my-site.vercel.app")).toBe("https://my-site.vercel.app");
    expect(normaliseOrigin("https://my-site.vercel.app/")).toBe("https://my-site.vercel.app");
    expect(normaliseOrigin(" https://my-site.vercel.app/admin ")).toBe("https://my-site.vercel.app");
    expect(normaliseOrigin("")).toBeNull();
    expect(normaliseOrigin(undefined)).toBeNull();
  });

  it("prefers Vercel's own production address over a mistyped SITE_URL", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "real-project.vercel.app");
    vi.stubEnv("SITE_URL", "https://wrong-name.vercel.app");
    expect(siteUrl()).toBe("https://real-project.vercel.app");
    expect(siteUrlMismatch()).toEqual({ configured: "https://wrong-name.vercel.app", actual: "https://real-project.vercel.app" });
  });

  it("uses SITE_URL off Vercel and reports no mismatch when they agree", () => {
    vi.stubEnv("VERCEL_PROJECT_PRODUCTION_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("SITE_URL", "example.org");
    expect(siteUrl()).toBe("https://example.org");
    expect(siteUrlMismatch()).toBeNull();
  });
});
