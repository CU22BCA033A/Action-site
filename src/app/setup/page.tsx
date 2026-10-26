import { randomBytes } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogoMark } from "@/components/brand/logo";
import { CopyButton } from "@/components/ui/copy-button";
import { envProblems } from "@/lib/env";
import { HashForm } from "./hash-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Finish setting up", robots: { index: false, follow: false } };

/**
 * First-run helper. Shown only while the site is missing its settings, and
 * gone (404) once everything is configured.
 */
export default function SetupPage() {
  const problems = envProblems();
  if (problems.length === 0) notFound();
  const secrets = [
    { name: "SESSION_SECRET", value: randomBytes(32).toString("hex"), note: "Signs sign-in cookies." },
    { name: "CODE_PEPPER", value: randomBytes(32).toString("hex"), note: "Protects team access codes. Never change it after codes are handed out." },
  ];
  const hashMissing = !process.env.ADMIN_PASSWORD_HASH;

  return (
    <main id="main" className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10">
      <LogoMark className="size-10" />
      <div>
        <h1 className="text-3xl uppercase sm:text-4xl">Finish setting up</h1>
        <p className="mt-2 text-muted">The site is running but is missing its settings. Add them in Vercel under Settings, Environment Variables, then redeploy. This page disappears once everything is set.</p>
      </div>

      <section className="card p-5">
        <h2 className="text-lg">Still missing</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-danger">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      </section>

      <section className="card p-5">
        <h2 className="text-lg">1. ADMIN_USERNAME</h2>
        <p className="mt-1 text-sm text-muted">Any name you like, for example your own name. You type it on the admin sign-in page.</p>
      </section>

      {hashMissing ? (
        <section className="card p-5">
          <h2 className="text-lg">2. ADMIN_PASSWORD_HASH</h2>
          <p className="mt-1 mb-4 text-sm text-muted">Choose the admin password here. The site turns it into a hash; only the hash is stored in Vercel. The password itself is not saved anywhere.</p>
          <HashForm />
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="text-lg">3. SESSION_SECRET and CODE_PEPPER</h2>
        <p className="mt-1 text-sm text-muted">Two random values made just now. Copy each into Vercel. A new pair appears every time this page loads; use any one pair.</p>
        <dl className="mt-3 flex flex-col gap-3">
          {secrets.map((s) => (
            <div key={s.name}>
              <dt className="font-semibold">{s.name}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-2">
                <code className="num min-w-0 break-all text-sm text-muted">{s.value}</code>
                <CopyButton value={s.value} />
              </dd>
              <dd className="mt-1 text-xs text-faint">{s.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="text-lg">4. Supabase values</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm text-muted">
          <li><b className="text-text">DATABASE_URL</b>: Supabase, Connect, Transaction pooler. Port 6543. Put your database password in place of [YOUR-PASSWORD].</li>
          <li><b className="text-text">NEXT_PUBLIC_SUPABASE_URL</b>: Project Settings, Data API, Project URL.</li>
          <li><b className="text-text">NEXT_PUBLIC_SUPABASE_ANON_KEY</b> and <b className="text-text">SUPABASE_SERVICE_ROLE_KEY</b>: Project Settings, API Keys, the &quot;Legacy API keys&quot; tab (anon and service_role). Both are long values starting with eyJ.</li>
          <li><b className="text-text">SITE_URL</b>: this site&apos;s address, for example https://action-site-seven.vercel.app</li>
        </ul>
      </section>

      <section className="card-gold p-5">
        <h2 className="text-lg">5. Redeploy</h2>
        <p className="mt-1 text-sm text-muted">In Vercel, open Deployments, press the three dots on the newest one and choose Redeploy. The database tables and the four sports are created automatically during that deploy. Then open /admin/login.</p>
      </section>
    </main>
  );
}
