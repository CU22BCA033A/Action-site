# Third-party services, fonts and libraries

Everything AuctionX depends on, with its licence and, for services, the free-plan limits that matter. Free-plan limits change: check the linked pricing pages before a big event.

## Services

| Service | Used for | Plan | What to know |
| --- | --- | --- | --- |
| [Vercel](https://vercel.com/pricing) | Hosting the website and its server code | Hobby (free) | Hobby is for non-commercial use. If the auction or site earns money, use Pro. |
| [Supabase](https://supabase.com/pricing) | Postgres database, photo storage (public `media` bucket), live updates (Realtime broadcast) | Free | A free project is paused after about a week without traffic; open the site a day or two before an auction, or press Restore in the dashboard. Database size, file storage, bandwidth and Realtime connections are capped on the free plan. A club or college auction stays well inside them. |
| GitHub | Source code; every push to `main` redeploys on Vercel | Free | |

No other service is contacted. There is no analytics, advertising, email, SMS, CAPTCHA or third-party sign-in.

## Fonts (self-hosted, never loaded from Google)

| Font | Used for | Licence |
| --- | --- | --- |
| Plus Jakarta Sans | All Latin text, prices and timers | SIL Open Font License 1.1 (`public/licenses/plus-jakarta-sans-OFL.txt`) |
| Noto Sans Kannada | Kannada text | SIL Open Font License 1.1 (`public/licenses/noto-sans-kannada-OFL.txt`) |
| Noto Sans Devanagari | Hindi text | SIL Open Font License 1.1 (`public/licenses/noto-sans-devanagari-OFL.txt`) |

The font files were copied from the `@fontsource` packages and live in `src/fonts` (site) and `src/assets/card` (player card images). The public `/licenses` page links each licence.

## Icons and images
- **Lucide** icons, ISC License (`public/licenses/lucide-ISC.txt`).
- The AuctionX gavel mark, wordmark, favicon set, player silhouettes and share image are drawn in code for this site (`src/components/brand/logo.tsx`, `scripts/generate-icons.ts`, `src/app/opengraph-image.tsx`). No stock or AI images are used.
- Player photos and team logos belong to whoever uploaded them.

## Libraries (main runtime dependencies)

| Package | Licence |
| --- | --- |
| next, react, react-dom | MIT |
| tailwindcss | MIT |
| postgres (database client) | Unlicense |
| zod | MIT |
| jose (session tokens) | MIT |
| @node-rs/argon2 (admin password hash) | MIT |
| sharp (photo resizing) | Apache-2.0 |
| @dnd-kit (drag and drop with keyboard support) | MIT |
| react-hook-form | MIT |
| lucide-react | ISC |
| @supabase/supabase-js (live updates in the browser) | MIT |
| server-only | MIT |

Development tools (TypeScript, ESLint, Vitest, Playwright, axe-core, tsx, dotenv) are used only to build and test, and are not part of the deployed site's behaviour. Run `npm ls --all` for the full tree.
