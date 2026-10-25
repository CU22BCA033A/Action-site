# Launch on Vercel and Supabase (free plans)

The site runs on Vercel (web app) with Supabase (database, photo storage and live updates). Both have free plans that are enough for a club or college auction.

## 1. Supabase
1. Create a project at supabase.com (Free plan). Pick the region closest to your viewers (Mumbai for Karnataka).
2. Project Settings > Data API: copy the **Project URL**, the **anon** key and the **service_role** key.
3. Connect > Connection string > **Transaction pooler**: copy the URL (port 6543) and put your database password in it.

## 2. Set up the database (once, from your computer)
```
git clone https://github.com/CU22BCA033A/Action-site.git
cd Action-site
npm install
cp .env.example .env.local      # then fill in every value
npm run hash-password           # pick the admin password; paste the .env.local line it prints
npm run db:migrate              # creates the tables and the public "media" bucket for photos
npm run db:seed                 # adds Cricket, Kabaddi, Football and Volleyball
```
Optional: `npm run db:seed:demo` adds rehearsal auctions with invented data.

Run `npm run db:migrate` again after every update that adds a file to `supabase/migrations`.

## 3. Vercel
1. At vercel.com, Add New > Project > import `CU22BCA033A/Action-site`. Framework: Next.js. Leave the build settings as they are.
2. Before the first deploy, add these Environment Variables (Production):

| Name | Value |
| --- | --- |
| `ADMIN_USERNAME` | the admin name you chose |
| `ADMIN_PASSWORD_HASH` | the second line `npm run hash-password` printed ("for the Vercel dashboard"), with no backslashes |
| `SESSION_SECRET` | same value as in `.env.local` |
| `CODE_PEPPER` | same value as in `.env.local`. Never change it after teams get codes, or every code stops working |
| `DATABASE_URL` | the Transaction pooler URL |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (keep it secret) |
| `SITE_URL` | your site address, for example `https://action-site.vercel.app` |

3. Deploy. Open `/admin/login` and sign in.
4. In Vercel > Settings > Functions, set the region to Mumbai (`bom1`) so it sits next to the database.

## Things to know
- Vercel's free Hobby plan is for non-commercial use. If you charge money for the auction or the site, use the Pro plan.
- A free Supabase project that gets no traffic for about a week is paused. Open the site a day or two before an auction; if it is paused, press Restore in the Supabase dashboard.
- Every push to the `main` branch redeploys the site automatically.
- Business details (name, address, contact email) come from `site.config.ts`. Fill them in before you share the site publicly.
