import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Same settings the app uses locally. Admin credentials for the admin tests
// come only from E2E_ADMIN_USERNAME / E2E_ADMIN_PASSWORD in the environment.
loadEnv({ path: ".env.local", quiet: true });

const port = Number(process.env.E2E_PORT ?? 3100);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;

export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "off",
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next dev -p ${port}`, url: `${baseURL}/how-it-works`, reuseExistingServer: true, timeout: 240_000 },
});
