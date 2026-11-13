import { expect, test } from "@playwright/test";
import { clearLoginAttempts, connect, type Sql } from "./support/db";

let sql: Sql;
test.beforeAll(() => {
  sql = connect();
});
test.afterAll(async () => {
  await clearLoginAttempts(sql);
  await sql.end();
});

test("a wrong team code is refused with a clear message", async ({ page }) => {
  await page.goto("/join");
  await page.getByLabel("Team access code").fill("ABCDE-FGHJK");
  await page.getByRole("button", { name: /open my team console/i }).click();
  await expect(page.getByText("That code did not work. Check it with the admin and try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/join$/);
});

test("the contact form shows field errors, then a success message with a reference", async ({ page }) => {
  await page.goto("/contact");
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(page.getByText("Enter your name, up to 80 characters.").first()).toBeVisible();

  // The form refuses submissions sent within three seconds of loading (anti-spam).
  await page.waitForTimeout(3500);
  await page.getByLabel("Your name").fill("Test Visitor");
  await page.getByLabel("Email", { exact: true }).fill("visitor@example.com");
  await page.getByLabel("Message", { exact: true }).fill("When does the next auction start?");
  await page.getByLabel(/I agree that my name, email and message/).check();
  await page.getByRole("button", { name: /send message/i }).click();
  await expect(page.getByRole("heading", { name: "Message sent" })).toBeVisible();
  await expect(page.getByText(/^MSG-[A-Z0-9]{8}$/)).toBeVisible();
});

test("admin sign-in refuses a wrong password with one generic message", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill("someone");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Incorrect username or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("admin can sign in", async ({ page }) => {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!username || !password, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run the admin sign-in test.");
  await clearLoginAttempts(sql);
  await page.goto("/admin/login");
  await page.getByLabel("Username").fill(username!);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("a deletion request goes from the public form to the admin and back to the status page", async ({ page, browser }) => {
  const username = process.env.E2E_ADMIN_USERNAME;
  const password = process.env.E2E_ADMIN_PASSWORD;
  test.skip(!username || !password, "Set E2E_ADMIN_USERNAME and E2E_ADMIN_PASSWORD to run the admin tests.");

  // 1. Someone asks for their data to be deleted.
  await page.goto("/data-deletion");
  await page.waitForTimeout(3500);
  const requester = `Requester ${Date.now().toString(36)}`;
  await page.getByLabel("Your name").fill(requester);
  await page.getByLabel("What should be deleted?").fill("Please remove my contact message.");
  await page.getByRole("button", { name: /send request/i }).click();
  await expect(page.getByRole("heading", { name: "Request received" })).toBeVisible();
  const reference = (await page.getByText(/^DEL-[A-Z0-9]{8}$/).innerText()).trim();

  // 2. The admin finds it and marks it done with a note.
  await clearLoginAttempts(sql);
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await admin.goto("/admin/login");
  await admin.getByLabel("Username").fill(username!);
  await admin.getByLabel("Password", { exact: true }).fill(password!);
  await admin.getByRole("button", { name: "Sign in" }).click();
  await expect(admin).toHaveURL(/\/admin$/);
  await admin.goto("/admin/deletion-requests");
  const card = admin.getByRole("listitem").filter({ hasText: requester });
  await card.getByLabel("Status").selectOption("completed");
  await card.getByLabel(/Note for the requester/).fill("Your message has been deleted.");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByText(/Request updated/)).toBeVisible();

  // The contact message from the earlier test is in the inbox.
  await admin.goto("/admin/inbox?show=all");
  await expect(admin.getByText("When does the next auction start?").first()).toBeVisible();
  await ctx.close();

  // 3. The requester sees the result.
  await page.goto(`/data-deletion/status?ref=${reference}`);
  await expect(page.getByText("Done. The details have been deleted.")).toBeVisible();
  await expect(page.getByText("Your message has been deleted.")).toBeVisible();
});
