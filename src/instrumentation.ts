/**
 * Runs once when the server starts. Logs a clear message when the environment
 * is not configured. It does not stop the server, so /api/health can still
 * say what is missing.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { envProblems } = await import("./lib/env");
    const problems = envProblems();
    if (problems.length) console.error(`Environment is not configured correctly:\n  - ${problems.join("\n  - ")}\nSee docs/launch.md and open /api/health.`);
  }
}
