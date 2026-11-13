import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test } from "@playwright/test";
import { call, clearLoginAttempts, connect, createRoom, dropRoom, floorVersion, openPlayer, type Sql } from "./support/db";

let sql: Sql;
let room: Awaited<ReturnType<typeof createRoom>>;

test.beforeAll(async () => {
  sql = connect();
  room = await createRoom(sql);
  await openPlayer(sql, room.auctionId, room.players[0]!.id);
});
test.afterAll(async () => {
  await dropRoom(sql, room.auctionId);
  await sql`update app.team_sessions set revoked_at = now() where team_id = ${room.teams[0]!.id} and revoked_at is null`;
  await sql.end();
});

// Phone settings without the WebKit default, so the same Chromium runs everything.
const { defaultBrowserType: _ignored, ...iphone } = devices["iPhone 13"];
void _ignored;

test("owner bids from a phone, the room updates, the admin sells, the room shows the sale", async ({ browser, page }) => {
  const player = room.players[0]!;
  const team = room.teams[0]!;

  // 1. The team owner joins with the access code on a phone.
  const phone = await browser.newContext({ ...iphone });
  const owner = await phone.newPage();
  await owner.goto("/join");
  await owner.getByLabel("Team access code").fill(room.code);
  await owner.getByRole("button", { name: /open my team console/i }).click();
  await expect(owner).toHaveURL(/\/manager$/);
  await expect(owner.getByText(team.name).first()).toBeVisible();

  // The phone console has no sideways scroll and passes axe.
  const overflow = await owner.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const axe = await new AxeBuilder({ page: owner }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);

  // 2. One tap places exactly the next valid bid: the base price.
  const bid = owner.getByRole("button", { name: new RegExp(`Bid ${player.basePrice}\\b`) });
  await expect(bid).toBeEnabled();
  await bid.click();
  await expect(owner.getByText(new RegExp(`Your bid of ${player.basePrice}`))).toBeVisible();

  // 3. The live room shows the player, the bidder and the price.
  await page.goto(`/auctions/${room.slug}`);
  await expect(page.getByRole("heading", { name: player.fullName })).toBeVisible();
  await expect(page.getByText(team.name).first()).toBeVisible();
  await expect(page.getByText(new RegExp(`${team.name} bid ${player.basePrice}`))).toBeVisible();

  // 4. The admin marks the player sold: through the console when credentials are given, otherwise through the engine.
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (username && password) {
    await clearLoginAttempts(sql);
    const adminCtx = await browser.newContext();
    const admin = await adminCtx.newPage();
    await admin.goto("/admin/login");
    await admin.getByLabel("Username").fill(username);
    await admin.getByLabel("Password", { exact: true }).fill(password);
    await admin.getByRole("button", { name: "Sign in" }).click();
    await expect(admin).toHaveURL(/\/admin$/);
    await admin.goto(`/admin/auctions/${room.auctionId}/console`);
    // The S key opens the same confirmation as the Sold button.
    await expect(admin.getByRole("button", { name: /^Sold/ })).toBeEnabled();
    await admin.keyboard.press("s");
    await admin.getByRole("button", { name: `Sold to ${team.shortName}` }).click();
    // Wait for the server to record the sale before closing the admin browser.
    await expect
      .poll(async () => (await sql<{ phase: string }[]>`select phase from app.floor_state where auction_id = ${room.auctionId}`)[0]?.phase, { timeout: 20_000 })
      .toBe("sold");
    await adminCtx.close();
  } else {
    const r = await call(sql, "mark_sold", [room.auctionId, await floorVersion(sql, room.auctionId), "e2e"]);
    expect(r.ok).toBe(true);
  }

  // 5. The room shows the sale: price, buyer and a sale card in live activity.
  await expect(page.getByText("Sold for")).toBeVisible();
  await expect(page.getByRole("heading", { level: 4, name: player.fullName })).toBeVisible();

  // 6. The phone console stops offering a bid on the finished lot.
  await expect(owner.getByRole("button", { name: /waiting for the next player/i })).toBeDisabled();
  await phone.close();
});

test("the live room fits one screen on desktop and stacks on a phone", async ({ browser, page }) => {
  await page.goto(`/auctions/${room.slug}`);
  await expect(page.getByRole("heading", { name: "Auction teams" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live activity" })).toBeVisible();
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(desktopOverflow).toBeLessThanOrEqual(0);

  const ctx = await browser.newContext({ viewport: { width: 320, height: 720 } });
  const small = await ctx.newPage();
  await small.goto(`/auctions/${room.slug}`);
  const overflow = await small.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
