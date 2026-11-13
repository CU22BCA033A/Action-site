import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { clearLoginAttempts, connect, createRoom, dropRoom, type Sql } from "./support/db";

/** Every admin page loads for a signed-in admin, passes axe and does not scroll sideways at 320px. */
const username = process.env.E2E_ADMIN_USERNAME;
const password = process.env.E2E_ADMIN_PASSWORD;

let sql: Sql;
let room: Awaited<ReturnType<typeof createRoom>>;

test.beforeAll(async () => {
  sql = connect();
  room = await createRoom(sql);
});
test.afterAll(async () => {
  await dropRoom(sql, room.auctionId);
  await clearLoginAttempts(sql);
  await sql.end();
});

test("all admin pages work for a signed-in admin", async ({ page }) => {
  test.skip(!username || !password, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run the admin tests.");
  await clearLoginAttempts(sql);
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  const id = room.auctionId;
  const paths = [
    "/admin",
    "/admin/auctions/new",
    "/admin/audit",
    "/admin/inbox",
    "/admin/deletion-requests",
    "/admin/sports",
    "/admin/sports/cricket",
    ...["", "/console", "/settings", "/teams", "/players", "/registrations", "/queue", "/results", "/results/print", "/audit"].map((s) => `/admin/auctions/${id}${s}`),
  ];

  for (const path of paths) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(axe.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(" ")}`), path).toEqual([]);
  }

  await page.setViewportSize({ width: 320, height: 720 });
  for (const path of paths) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});
