import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { clearLoginAttempts, connect, createRoom, dropRoom, type Sql } from "./support/db";

/**
 * Player registration from the public link (with a full-size phone photo),
 * the admin's opening and closing times, player types, and erasing an auction.
 */
let sql: Sql;
let bigPhoto: string;

test.beforeAll(async () => {
  sql = connect();
  // A 4000 x 3000 noisy JPEG of several MB, like a phone camera picture.
  const dir = join(process.cwd(), "test-results", "fixtures");
  await mkdir(dir, { recursive: true });
  bigPhoto = join(dir, "phone-photo.jpg");
  const w = 4000;
  const h = 3000;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).jpeg({ quality: 95 }).toFile(bigPhoto);
});
test.afterAll(async () => {
  await clearLoginAttempts(sql);
  await sql.end();
});

test("a player registers from the public link with a full-size phone photo and a player type", async ({ page }) => {
  const room = await createRoom(sql);
  try {
    await sql`update app.auctions set registration_open = true, player_types = ${["Student", "Faculty"]}, use_nationality = false,
      registration_opens_at = now() - interval '1 hour', registration_closes_at = now() + interval '1 day' where id = ${room.auctionId}`;
    await page.goto(`/auctions/${room.slug}/register`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Register as a player" })).toBeVisible();
    await expect(page.getByText(/Registration closes on/)).toBeVisible();
    // Domestic or overseas is off for this auction, so it is not asked.
    await expect(page.getByText("Domestic or overseas")).toHaveCount(0);

    await page.getByLabel("Full name").fill("Kiran Test Player");
    await page.getByLabel("Playing role").selectOption({ label: "Batter" });
    await page.getByLabel("Player type").selectOption("Faculty");
    await page.locator("#f-photo").setInputFiles(bigPhoto);
    await expect(page.getByRole("img", { name: /Preview of the photo/ })).toBeVisible();
    await page.getByLabel(/I agree that the name, photo, role and details/).check();
    // The form refuses submissions sent within three seconds of loading (anti-spam).
    await page.waitForTimeout(3500);
    await page.getByRole("button", { name: "Send registration" }).click();
    await expect(page.getByRole("heading", { name: "Registration received" })).toBeVisible({ timeout: 30_000 });

    const reg = (await sql<{ playerType: string | null; photoPath: string | null }[]>`
      select player_type as "playerType", photo_path as "photoPath" from app.player_registrations
      where auction_id = ${room.auctionId} and full_name = 'Kiran Test Player'`)[0];
    expect(reg?.playerType).toBe("Faculty");
    expect(reg?.photoPath).toMatch(/^players\/[a-f0-9]{24}\.webp$/);
  } finally {
    await dropRoom(sql, room.auctionId);
  }
});

test("registration follows the admin's opening and closing times", async ({ page }) => {
  const room = await createRoom(sql);
  try {
    await sql`update app.auctions set registration_open = true, registration_opens_at = now() + interval '2 days', registration_closes_at = null where id = ${room.auctionId}`;
    await page.goto(`/auctions/${room.slug}/register`);
    await expect(page.getByRole("heading", { name: "Registration opens soon" })).toBeVisible();
    await expect(page.getByLabel("Full name")).toHaveCount(0);

    await sql`update app.auctions set registration_opens_at = now() - interval '2 days', registration_closes_at = now() - interval '1 hour' where id = ${room.auctionId}`;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Registration is closed" })).toBeVisible();
    await expect(page.getByText(/Registration closed on/)).toBeVisible();
  } finally {
    await dropRoom(sql, room.auctionId);
  }
});

test("the admin can erase an auction and all its data", async ({ page }) => {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!username || !password, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run the admin tests.");
  const room = await createRoom(sql);
  const name = (await sql<{ name: string }[]>`select name from app.auctions where id = ${room.auctionId}`)[0]!.name;
  const playerIds = (await sql<{ id: string }[]>`select player_id as id from app.auction_players where auction_id = ${room.auctionId}`).map((r) => r.id);
  await clearLoginAttempts(sql);
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto(`/admin/auctions/${room.auctionId}`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Erase permanently" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(`Type ${name} to confirm`).fill(name);
  await dialog.getByRole("button", { name: "Erase permanently" }).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });

  const left = (await sql<{ auctions: number; teams: number; players: number }[]>`
    select (select count(*)::int from app.auctions where id = ${room.auctionId}) as auctions,
      (select count(*)::int from app.teams where auction_id = ${room.auctionId}) as teams,
      (select count(*)::int from app.players where id = any(${playerIds}::uuid[])) as players`)[0]!;
  expect(left).toEqual({ auctions: 0, teams: 0, players: 0 });
});
