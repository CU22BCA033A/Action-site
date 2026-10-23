/**
 * Runs once when the server starts. Fails fast with a clear message when the
 * environment is not configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("./lib/env");
    getEnv();
  }
}
