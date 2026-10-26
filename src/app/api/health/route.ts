import postgres from "postgres";
import { envProblems } from "@/lib/env";

export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

/**
 * Setup check for a new deployment. Reports what is missing in plain words.
 * It never returns secret values, hosts or keys.
 */
export async function GET() {
  const checks: Record<string, Check> = {};

  const problems = envProblems();
  checks.environment = problems.length
    ? { ok: false, detail: `Fix these Vercel environment variables, then redeploy: ${problems.join("; ")}` }
    : { ok: true, detail: "All required environment variables are set." };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (supabaseUrl) {
    let valid = false;
    try {
      valid = new URL(supabaseUrl).protocol === "https:";
    } catch {
      valid = false;
    }
    checks.supabaseUrl = valid
      ? { ok: true, detail: "Supabase project URL looks right." }
      : { ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL must be the full Project URL, starting with https://" };
  }

  const url = process.env.DATABASE_URL ?? "";
  if (!url) {
    checks.database = { ok: false, detail: "DATABASE_URL is not set." };
  } else {
    let host = "";
    try {
      host = new URL(url).hostname;
    } catch {
      checks.database = { ok: false, detail: "DATABASE_URL is not a valid connection string. Copy it again from Supabase > Connect > Transaction pooler." };
    }
    if (host && /^db\..+\.supabase\.co$/.test(host)) {
      checks.connectionType = {
        ok: false,
        detail: "DATABASE_URL uses the direct connection, which Vercel cannot reach. Use the Transaction pooler string (host ends in pooler.supabase.com, port 6543).",
      };
    }
    if (host) {
      const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 8, idle_timeout: 2, onnotice: () => {} });
      try {
        await sql`select 1`;
        checks.database = { ok: true, detail: "Connected to the database." };
        const [m] = await sql<{ tables: boolean; latest: boolean; sports: number }[]>`
          select to_regclass('app.auctions') is not null as tables,
                 to_regprocedure('app.admin_delete_team(uuid,uuid,text)') is not null as latest,
                 case when to_regclass('app.sports') is not null then (select count(*)::int from app.sports) else 0 end as sports`;
        checks.migrations = !m?.tables
          ? { ok: false, detail: "The tables are not there. Run npm run db:migrate from your computer with this DATABASE_URL." }
          : !m.latest
            ? { ok: false, detail: "The database is behind the code. Run npm run db:migrate again." }
            : { ok: true, detail: "Database tables are up to date." };
        if (m?.tables) {
          checks.sports = m.sports > 0 ? { ok: true, detail: `${m.sports} sports set up.` } : { ok: false, detail: "No sports yet. Run npm run db:seed." };
        }
      } catch (e) {
        const code = (e as { code?: string }).code ?? "";
        const hint =
          code === "28P01" ? "The database password in DATABASE_URL is wrong." :
          code === "ENOTFOUND" || code === "EAI_AGAIN" ? "The database host in DATABASE_URL cannot be found. Copy the Transaction pooler string again." :
          code === "ETIMEDOUT" || code === "CONNECT_TIMEOUT" ? "The database did not answer. If the Supabase project is paused, press Restore in the Supabase dashboard." :
          code === "XX000" || code === "08006" ? "The pooler refused the connection. Check the user name (postgres.<project-ref>) and password in DATABASE_URL." :
          "Could not connect to the database. Check DATABASE_URL.";
        checks.database = { ok: false, detail: `${hint}${code ? ` (code ${code})` : ""}` };
      } finally {
        await sql.end({ timeout: 1 }).catch(() => {});
      }
    }
  }

  const ok = Object.values(checks).every((c) => c.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
