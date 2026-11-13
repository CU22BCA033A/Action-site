import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/** Every public page: loads, has a title and description, passes axe, no sideways scroll at 320px. */
const pages = [
  "/",
  "/auctions",
  "/how-it-works",
  "/faq",
  "/contact",
  "/search",
  "/search?q=cup",
  "/join",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/cookies",
  "/data-deletion",
  "/data-deletion/status",
  "/licenses",
  "/admin/login",
];

test.describe("public pages", () => {
  for (const path of pages) {
    test(`${path} loads with title, description and no accessibility violations`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(200);
      await expect(page).toHaveTitle(/\S/);
      const description = await page.locator('meta[name="description"]').getAttribute("content");
      expect(description?.trim().length ?? 0, `${path} description`).toBeGreaterThan(20);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), path).toEqual([]);
    });
  }

  test("no page scrolls sideways at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    for (const path of pages) {
      await page.goto(path);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("unknown pages show the custom 404", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("404")).toBeVisible();
    await expect(page.getByRole("link", { name: /home page/i })).toBeVisible();
  });

  test("the cookie banner offers equal choices and remembers the answer", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByRole("region", { name: /cookies/i });
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: /essential only/i }).click();
    await expect(banner).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: /cookies/i })).toBeHidden();
  });
});
