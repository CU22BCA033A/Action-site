import { loadEnvConfig } from "@next/env";

/**
 * Loads .env.local and .env the same way Next.js does, so scripts and the
 * app read identical values (including the \$ escaping in password hashes).
 */
export function loadEnv() {
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
}
