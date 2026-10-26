# Launch on Vercel and Supabase (free plans)

The site runs on Vercel (web app) with Supabase (database, photo storage and live updates). Both have free plans that are enough for a club or college auction.

## 1. Supabase
1. Create a project at supabase.com (Free plan). Pick the region closest to your viewers (Mumbai for Karnataka).
2. Project Settings > Data API: copy the **Project URL**, the **anon** key and the **service_role** key.
3. Connect > Connection string > **Transaction pooler**: copy the URL (port 6543) and put your database password in it.

## 2. Vercel
1. At vercel.com, Add New > Project > import `CU22BCA033A/Action-site`. Framework: Next.js. Leave the build settings as they are, and deploy.
2. Open the site. Until it has its settings, every page goes to **/setup**, which:
   - lists what is still missing,
   - turns your chosen admin password into `ADMIN_PASSWORD_HASH` (the password itself is never stored),
   - gives you fresh random values for `SESSION_SECRET` and `CODE_PEPPER`.
3. In Vercel > Settings > Environment Variables, add:

| Name | Value |
| --- | --- |
| `ADMIN_USERNAME` | any admin name you choose |
| `ADMIN_PASSWORD_HASH` | from /setup |
| `SESSION_SECRET` | from /setup |
| `CODE_PEPPER` | from /setup. Never change it after teams get codes, or every code stops working |
| `DATABASE_URL` | Supabase Transaction pooler URL (port 6543) with your database password |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (Legacy API keys tab) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (Legacy API keys tab; keep it secret) |
| `SITE_URL` | your site address, for example `https://action-site-seven.vercel.app` |

4. Deployments > the newest one > Redeploy. During the build the database tables, the photo bucket and the four sports are created automatically, so nothing has to run on your computer.
5. Open `/admin/login` and sign in. `/setup` now shows "not found", which is expected.
6. Optional: Settings > Functions, set the region to Mumbai (`bom1`) so it sits next to the database.

To set up from a computer instead: clone the repo, `npm install`, fill `.env.local` from `.env.example`, then `npm run hash-password`, `npm run db:migrate` and `npm run db:seed`.

## Things to know
- Vercel's free Hobby plan is for non-commercial use. If you charge money for the auction or the site, use the Pro plan.
- A free Supabase project that gets no traffic for about a week is paused. Open the site a day or two before an auction; if it is paused, press Restore in the Supabase dashboard.
- Every push to the `main` branch redeploys the site automatically.
- Business details (name, address, contact email) come from `site.config.ts`. Fill them in before you share the site publicly.

## If you see "Internal Server Error"
Open `https://<your-site>/api/health`. It lists, in plain words, what is missing: an environment variable, a wrong database connection string, tables not created (`npm run db:migrate`) or sports not added (`npm run db:seed`). It never shows passwords or keys. Fix what it says, then in Vercel use Deployments > Redeploy if you changed an environment variable.

The most common causes:
- Environment variables were added after the first deploy. Vercel only uses them after a redeploy.
- `DATABASE_URL` is the "Direct connection" string. Vercel cannot reach it; use the **Transaction pooler** string (port 6543).
- The build failed with "predeploy: database setup failed": `DATABASE_URL` is wrong. Copy the Transaction pooler string again and put your database password in it.
