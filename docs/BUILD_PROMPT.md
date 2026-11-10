# Build prompt: Multi-sport live player auction platform

Paste this whole file into Claude Code in an empty folder, or in a clone of the target repository. It describes the finished product, the stack, the data model, the bid engine, every screen, the visual design, security, deployment and the tests. It was written from a working build. Build exactly this. Where it says "decision", the choice was already made for a reason; keep it.

---

## 0. How to work

- Build in the phases in section 16, in order. Commit after each phase and push to the target repository's `main` branch.
- Before saying any phase is done, run `npm run typecheck`, `npm run lint` and `npm test`. Fix everything they report.
- Look at every screen you build in a real browser (Playwright with Chromium) at 320 px, 390 px and 1440 px wide. No horizontal scroll at any width from 320 px up.
- Record non-obvious choices in `docs/decisions.md` as you go.
- Never invent business details (organiser name, address, email, phone). They live in `site.config.ts` and stay empty until the owner fills them in.
- Never write admin credentials, secrets or keys into code, tests, docs or commits. They come only from environment variables.
- Write the project rules from section 15 into `CLAUDE.md` at the start, so every later session follows them.

---

## 1. What the product is

A website for running a live player auction for local sports leagues (college, club, village, corporate). One admin runs the auction. Each team has an owner who bids from their phone. Anyone can watch live. A projector screen shows the auction to the room, and an OBS overlay can stream it.

Sports: **Cricket, Kabaddi, Football, Volleyball.** Sports are data, not code, so the admin can edit roles and rules without a developer.

Languages for viewers and team owners: **English, Kannada (ಕನ್ನಡ), Hindi (हिन्दी)**, switchable at any time. The admin panel is English only.

Cost: **zero.** Vercel Hobby (free) for the app, Supabase Free for Postgres, photo storage and realtime. No paid services, no email or SMS, no third-party login, no analytics, no CAPTCHA.

### Three kinds of user

| Who | How they get in | What they can do |
| --- | --- | --- |
| Admin | `/admin/login`, username and password from environment variables | Everything: create auctions, sports, teams, players, codes, run the floor, correct results, delete anything |
| Team owner | `/join`, enters an access code the admin gave them (format `XXXXX-XXXXX`). No account, no email | Bid for their own team only, use RTM, see their purse and squad |
| Viewer | Nothing, just opens the site | Watch live, see squads, players, stats and results |

---

## 2. Stack (use these versions or newer)

- **Next.js 16** App Router with Turbopack, **React 19**, **TypeScript** strict with `noUncheckedIndexedAccess`.
- **Tailwind CSS v4**, with design tokens as CSS variables in `src/app/globals.css` mapped through `@theme inline`.
- **Postgres** (Supabase) reached from the server with the `postgres` npm package: `postgres(DATABASE_URL, { prepare: false, max: 5 })`. `prepare: false` is required because the Supabase transaction pooler does not support prepared statements.
- **zod 4** for every input, **jose** for signed session cookies (HS256), **@node-rs/argon2** for the admin password hash, **sharp** for image processing, **@dnd-kit** for drag and drop, **lucide-react** for icons, **react-hook-form** where forms are large.
- Supabase **Storage** (public bucket `media`) for photos and logos, Supabase **Realtime broadcast** for live updates. Use the REST endpoints with the service-role key from the server; the browser only subscribes.
- **Vitest** (two projects: `unit`, and `db` against a real Postgres), **Playwright** + **@axe-core/playwright** for end-to-end and accessibility.
- Self-hosted fonts (OFL) from `@fontsource`: **Orbitron** 500/700/800/900 (display), **Rajdhani** 400/500/600/700 (body, Latin and Devanagari), **Oxanium** 600/700 (all numbers, tabular), **Noto Sans Kannada**. Load them with `next/font/local`. Put the licences in `public/licenses/`.

`next.config.ts`: `poweredByHeader: false`, `cacheComponents: false`, security headers (HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` with camera, microphone and geolocation off, `X-Frame-Options: DENY` except for `/auctions/*/overlay`), `serverActions.bodySizeLimit: "4mb"`, `images.localPatterns` for `/media/**`, `/brand/**`, `/screens/**`.

`src/proxy.ts` (Next 16's name for middleware) builds a per-request CSP with a nonce: `default-src 'self'`; scripts `'self' 'nonce-…' 'strict-dynamic'`; `img-src 'self' data: blob:` plus the Supabase host; `connect-src 'self'` plus `https://` and `wss://` on the Supabase host; `frame-ancestors 'none'` except on the overlay route. In development only, allow `'unsafe-inline'` styles and `'unsafe-eval'`. Wrap `new URL(NEXT_PUBLIC_SUPABASE_URL)` in try/catch so a bad value never crashes every page.

---

## 3. Environment variables

`src/lib/env.ts` validates these with zod and is imported only on the server (`import "server-only"`).

| Name | Required | Notes |
| --- | --- | --- |
| `ADMIN_USERNAME` | yes | Compared in constant time, trimmed |
| `ADMIN_PASSWORD_HASH` | yes | argon2id, `m=19456,t=2,p=1`. Next's env loader expands `$` even inside quotes, so in `.env.local` every `$` must be written `\$`; `env.ts` turns `\$` back into `$`. In the Vercel dashboard paste the hash unescaped |
| `SESSION_SECRET` | yes | at least 32 characters |
| `CODE_PEPPER` | yes | at least 32 characters, used for the HMAC of access codes. Changing it invalidates every code |
| `DATABASE_URL` | yes | Supabase **Transaction pooler** string, port 6543. The direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from Vercel. Copy the pooler host from the dashboard; the `aws-N-` number cannot be guessed |
| `NEXT_PUBLIC_SUPABASE_URL` | in production | Project URL, must start with `https://` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | in production | legacy anon JWT, used by the browser to subscribe to broadcasts |
| `SUPABASE_SERVICE_ROLE_KEY` | in production | legacy service_role JWT, server only, for storage uploads and broadcast |
| `SITE_URL` | recommended | absolute links, sitemap, Open Graph |

`envProblems()` returns the problems as plain messages without values. `getEnv()` throws with the same messages. `src/instrumentation.ts` only **logs** the problems at boot; it must not throw, or every request fails with a bare "Internal Server Error".

Ship a `.env.example` with every name and no values, and keep `.env.local` gitignored.

---

## 4. Database

Everything lives in a private schema `app`. Row-level security is enabled on every table with **no policies**, and all privileges are revoked from `anon` and `authenticated`, so the public Supabase API cannot read or write anything. Only the server, connecting as the database owner, touches data. (Migration 0001 creates the `anon` and `authenticated` roles if they don't exist, so the same SQL runs on plain local Postgres.)

Migrations are plain SQL files in `supabase/migrations/`, applied in order by `scripts/migrate.ts`, which records them in `app.schema_migrations`. Seed data comes from `scripts/seed.ts` (sports), plus `--demo` for rehearsal auctions with invented names. Both scripts are idempotent.

### Tables

- `sports`: `key`, `name`, `config jsonb` (validated by the zod schema in section 5), `version` for optimistic locking.
- `sport_presets`: named rule presets per sport (`is_example` for shipped examples).
- `auctions`: `slug` (kebab), `name`, `sport_id`, `status` (`draft`, `scheduled`, `live`, `paused`, `completed`, `archived`), `starts_at`, `points_unit_label`, `purse_per_team` (default for new teams), `squad_min`, `squad_max`, `max_overseas`, `role_minimums jsonb`, `role_maximums jsonb`, `default_base_price`, `category_base_prices jsonb`, `reserve_rule_enabled`, `bid_timer_seconds` (null = no timer), `timer_extension_seconds`, `rtm_enabled`, `rtm_label` (`RTM` or `FBM`), `rtm_allow_final_raise`, `rtm_cards_per_team`, `retentions_enabled`, `max_retentions`, `current_round`, `public`, `registration_open`, `rehearsal`, `settings_version`, `event_seq`, `rules_changed_at`, `completed_at`, `deleted_at`, timestamps.
- `bid_slabs`: `from_points`, `to_points` (null = open-ended, must be last), `increment_points`. Validated: no gaps, no overlaps, positive increments.
- `teams`: `name`, `short_name` (up to 6 characters), `logo_path`, `primary_color`, `secondary_color`, `purse_total` (**set per team by the admin**), `purse_spent`, `rtm_cards_used`, `version`, `deleted_at`.
- `team_access_codes`: `team_id`, `code_hash` (HMAC-SHA256 of `code:` + normalised code with `CODE_PEPPER`), `code_hint` (last 4 characters), `active`, `revoked_at`. **Never store the code itself.**
- `team_sessions`, `admin_sessions`: session ids checked on every request, `revoked_at`, `expires_at`.
- `players`: `full_name`, `photo_path`, `role_key`, `sub_role`, `category`, `is_overseas`, `date_of_birth`, `stats jsonb`, `tags`, `deleted_at`.
- `auction_players`: a player in one auction. `base_price`, `set_name`, `queue_order`, `lot_no`, `status` (`pool`, `on_floor`, `sold`, `unsold`, `retained`), `sold_to_team_id`, `sold_price`, `sold_at`, `previous_team_id` (for RTM), `version`.
- `floor_state`: one row per auction. `current_auction_player_id`, `phase` (`idle`, `ready`, `live`, `paused`, `rtm_pending`, `sold`, `unsold`), `current_price`, `leading_team_id`, `timer_ends_at`, `paused_remaining_ms`, `rtm_team_id`, `rtm_stage`, `last_result_team_id`, `last_result_price`, `version`, `server_updated_at`.
- `bids`: `auction_player_id` (on delete cascade), `team_id`, `amount`, `source` (`manager` or `admin_on_behalf`), `idempotency_key` (unique), `voided`, `voided_at`, `void_reason`, `created_at`.
- `audit_log`: append-only (a trigger refuses update and delete). `actor_type`, `actor_id`, `action`, `entity_type`, `entity_id`, `before jsonb`, `after jsonb`, `reason`.
- `player_registrations`: public sign-ups waiting for admin approval, with photo, consent, guardian name for under-18s.
- `shortlists`, `rate_limits`, `login_attempts`, `contact_messages`, `deletion_requests`.

---

## 5. Sports are data

`app.sports.config` follows this zod schema (`src/lib/sports/config.ts`):

```ts
roles: { key, label, subRoles: string[], hidden: boolean }[]   // at least one
categories: string[]        // e.g. A, B, C, D
tags: string[]
statFields: { key, label, kind: "integer" | "decimal", showOnCard: boolean }[]
defaults: {
  pointsUnitLabel, purse, squadMin, squadMax, maxOverseas,
  roleMinimums, roleMaximums, defaultBasePrice, categoryBasePrices,
  slabs: { from, to | null, increment }[],
  bidTimerSeconds | null, timerExtensionSeconds | null, reserveRuleEnabled,
  rtmEnabled, rtmLabel: "RTM" | "FBM", rtmAllowFinalRaise, rtmCardsPerTeam,
  retentionsEnabled, maxRetentions
}
```

Keys are lowercase snake case. Components never hardcode a sport's roles; they read them from the snapshot.

Seed (starting values only, all editable in Admin > Sports):

- **Cricket**: Batter; Bowler (Pace, Spin); All-rounder; Wicketkeeper. Stats: matches, runs, wickets, strike rate, economy. Squad 15 to 25.
- **Kabaddi**: Raider; Defender (Left corner, Right corner, Cover); All-rounder. Categories A to D. Stats: matches, raid points, tackle points. Squad 12 to 20.
- **Football**: Goalkeeper; Defender (Centre back, Full back); Midfielder (Defensive, Central, Attacking); Forward (Winger, Striker). Stats: matches, goals, assists, clean sheets. Squad 14 to 22.
- **Volleyball**: Setter, Outside hitter, Middle blocker, Opposite, Libero. Stats: matches, kills, blocks, aces, digs. Squad from 10.
- Default slabs: below 100 points the increment is 5; from 100 to below 200 it is 10; from 200 up it is 20. Default purse 1000.
- Two example presets shaped like real league formats, clearly marked as examples, never as official data.

The admin sports editor (Admin > Sports > a sport) edits roles, sub-roles, categories, tags, stat fields and defaults. Saving refuses, with a clear message, to remove a role, sub-role or category still used by players, pending registrations or open auctions. It uses optimistic locking (`version`), and existing auctions keep their own copy of the rules.

---

## 6. The bid engine (the heart of the product)

**All floor and bid changes go through Postgres functions.** The server never updates `floor_state`, `bids`, `teams.purse_spent` or `auction_players.status` directly. Each function:

1. Locks the floor row: `select … from app.floor_state where auction_id = $1 for update` (`app._lock_floor`).
2. Checks the caller's `expected_version` against `floor_state.version`; a mismatch returns `STALE` so the client refetches.
3. Reads the rules fresh from `auctions` and `bid_slabs` on every call (live rule edits take effect on the next bid).
4. Does the change, bumps `floor_state.version` and `auctions.event_seq` (`app._bump`), writes `audit_log` (`app._audit`).
5. Returns `app._result(ok, code, message, auction_id)`: `{ ok, code, message, floor: <floor_json> }`.

Money is **integer points** everywhere. No floats.

### Functions

- `place_bid(auction, team, expected_version, idempotency_key, source, actor)`. Refuses with a specific code and message when: the floor isn't live, the timer has expired, the team is already leading, the team is full (`squad_max`), it would break the overseas limit or a role maximum, or the amount is above `max_bid_for(team)`. The amount is always `next_bid_amount`: the base price for the first bid, then the current price plus the slab increment. A repeated idempotency key returns the first result instead of bidding twice. Each bid resets the timer to `max(remaining, timer_extension_seconds)` when a timer is on.
- `max_bid_for(team)`, the **reserve rule**: `purse_left - max(squad_min - squad_count - 1, 0) * min_base_price`, never below 0. Turned off by `reserve_rule_enabled = false`.
- `move_to_floor` (any player in the `pool` or `unsold` state, **in any order the admin chooses**), `start_bidding`, `pause_floor`, `resume_floor`, `reset_timer`, `undo_last_bid` (voids the last bid, restores the previous leader and price).
- `mark_sold`: with RTM on and a `previous_team_id` that still has cards, it goes to `rtm_pending` first; otherwise it calls `_sell` (sets the player sold, adds to `purse_spent`, records the result on the floor).
- `mark_unsold`, `return_to_pool` (no result, voids the bids on that player).
- `rtm_action(accept | decline | final_raise | match)`: the previous team can match the price; if `rtm_allow_final_raise`, the leading team gets one final raise first.
- `force_assign` (admin assigns a player to a team at a price, bypassing bidding, still checking limits), `retain_player` (pre-auction retentions, limited by `max_retentions`).
- `correct_sale`: change the buyer or the price of a finished sale, or send the player back to the pool, with purses adjusted and a required reason.
- `adjust_purse`: the admin changes a team's purse with a reason; it refuses to go below what's already spent.
- `start_accelerated_round`: puts unsold players back in the pool for a new round (`current_round + 1`).
- `reorder_queue`, `assign_lot_no`.
- `update_auction_settings(json, expected settings_version, reason)`: runs `rule_conflicts` first. If a team would already break the new rule (for example its squad is above a lowered maximum), it returns the list of conflicts and saves nothing unless the admin confirms. While live, a reason is required. Applies forward only; past sales are never changed. Validates the slabs with `validate_slabs`.
- `admin_delete_players(auction, ids[], actor)`: works on **any** player. A sold player's price is refunded to its team, a player on the floor is taken off first (`_clear_floor`), and its bids go with it. The audit entry keeps the names, the points refunded and the number of bids removed.
- `admin_delete_team(auction, team, actor)`: works at any time. The team's players return to the pool, its bids stay as `voided` with reason `team_deleted`, its codes and sessions are revoked, and if it is leading the player on the floor, that player returns to the pool.
- Read side: `public_snapshot(auction)` returns everything a viewer may see (auction, teams with purses and counts, floor, current player, last 20 bids, recent sales, totals) as one JSON object. Also `floor_json`, `team_counts`, `auction_stats`, `public_player_json`, `team_public_json`, `player_is_public`.

### Concurrency test (required)

A `db` test fires **100 parallel bids** from different teams at the same moment and asserts exactly one wins per price step, purses never go negative, and `floor_state.version` matches the number of accepted bids. Also test: stale version, idempotency, timer expiry, reserve rule, squad, role and overseas limits, RTM paths, undo, correct_sale purse arithmetic, accelerated round, both admin deletes, and that `audit_log` refuses updates.

### Realtime

After every successful engine call the server broadcasts to channel `auction:{id}` through the Supabase broadcast REST endpoint, with event `floor` and payload `{ seq: event_seq, floor }`. Clients (`useLiveAuction` hook):

- apply a `floor` event directly when `seq` is the next one, and refetch the full snapshot from `/api/auctions/[slug]/snapshot` on any gap;
- fall back to polling (every 3 seconds while live, every 30 seconds otherwise) when the socket is down, and show a small "Reconnecting" banner;
- compute the server clock offset from a `serverTime` in every response, so all timers count down in sync;
- the manager hook calls `onUnauthorized` on a 401 and sends the owner back to `/join`.

---

## 7. Authentication and security

- **Admin**: `loginAdmin` verifies the username in constant time and always runs the argon2 check, so timing does not reveal which part was wrong. One generic error message. Failed attempts are recorded per hashed IP in `login_attempts`, with exponential backoff (a wait after 5 failures in 15 minutes, growing). On success: insert an `admin_sessions` row and set cookie `pa_admin` (jose HS256 JWT holding the session id, `httpOnly`, `secure` in production, `sameSite: strict`, 12 hours). Every admin page and action calls `requireAdmin()`, which verifies the JWT **and** checks the session row is not revoked or expired.
- **Team owner**: `/join` takes the code, normalises it (uppercase, strips spaces and dashes, alphabet without 0, O, 1, I, L), computes the HMAC and looks up an active code. On success: a `team_sessions` row and cookie `pa_team` (`sameSite: lax`). Codes are generated server-side as `XXXXX-XXXXX`, shown to the admin **once** with a copy button and a share link, and stored only as hash plus hint. Regenerating a code revokes the old one and ends every session of that team at once. Rate-limit join attempts per IP.
- **Server is the source of truth.** The client never sends a price; it asks to bid and the server computes the amount. Every bid endpoint checks the session's team, the auction, the expected floor version and an idempotency key.
- Public registration form: signed form token (rejected if submitted in under 3 seconds), honeypot field, rate limit per IP, consent checkbox, guardian name required under 18.
- Uploads: check magic bytes (JPEG, PNG, WebP only), reject over 3 MB, re-encode with sharp to WebP (player photo 800 px square, about 120 KB; team logo 400 px, about 40 KB), strip metadata, random file names. Local development writes to `public/media`; production uploads to the Supabase `media` bucket.
- Every admin action is validated with zod and returns `ActionResult = { ok: true, message } | { ok: false, error, fieldErrors?, code? }`. Errors use the column or field name the admin sees, never internal keys.
- `/api/health` (no secrets, ever): reports which environment variables are missing, whether `NEXT_PUBLIC_SUPABASE_URL` is valid, whether `DATABASE_URL` is the direct host (with a hint to use the pooler), whether the database connects (mapping error codes 28P01, ENOTFOUND, timeouts and XX000 "tenant or user not found" to plain-English fixes), whether the tables and latest migration exist, and whether sports are seeded. Returns 503 until everything is ok.

---

## 8. First-run setup without a terminal (decision)

The owner deploys from the Vercel dashboard and may not have a computer set up for development.

- `proxy.ts`: while any of `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET`, `CODE_PEPPER`, `DATABASE_URL` is missing, redirect every page except `/setup` to `/setup`.
- `/setup` (dynamic, `noindex`) lists what is missing. It has a form that turns a chosen admin password into an argon2 hash through a server action; the action works **only while `ADMIN_PASSWORD_HASH` is unset** and never stores or logs the password. It shows freshly generated `SESSION_SECRET` and `CODE_PEPPER` with copy buttons, explains where each Supabase value is found, and ends with "Redeploy". Once everything is set, `/setup` returns 404.
- `npm run build` is `tsx scripts/predeploy.ts && next build`. On Vercel (`VERCEL` is set) with `DATABASE_URL` present, `predeploy` runs migrations and the sports seed, so the database always matches the deployed code. If the database step fails, it prints one clear line about `DATABASE_URL` and fails the build.
- `scripts/migrate.ts` also creates the public `media` bucket through the Storage API when the Supabase keys are present. A failure there is a warning, not a failed deploy.
- Also ship `scripts/hash-password.ts`, which prints two lines: one escaped for `.env.local`, one raw for Vercel.

---

## 9. Screens and routes

Route groups: `(site)` has the header and footer, `(bare)` is for full-screen views, and `admin/(panel)` has the admin shell. Every dynamic page is server-rendered with the data it needs; live parts hydrate with the snapshot and then follow realtime.

### Public

- `/`: hero with a floating gold trophy and soft blue and gold glows, the brand title in gold gradient text, a one-line lead, and two big buttons: Watch auctions (gold) and Join as team owner (royal blue). If an auction is live or recent: four stat cards (Points spent in gold, Points remaining in royal blue, Players sold in green, Teams), a team stats card that pages **only when the viewer presses** prev/next or the dots (no autoplay), and buttons for Live, Teams and Stats. Then three "how it works" cards and recent sales.
- `/auctions`: cards for live, upcoming and finished auctions.
- `/auctions/[slug]` (live view): the top bar shows the auction name in gold, the sport, a LIVE / PAUSED / SOLD pill, and Total spent (red) | Remaining (green). Tabs: Live, Teams, Players, Stats, Results. **Keep it uncluttered**: the main column is the player spotlight; on desktop, team standings sit on one side and recent sales on the other; on mobile, the spotlight comes first. No queue or "up next" list (the admin picks players in any order).
  - **Player spotlight**: a large card with a **big square photo** (the full card width on mobile, about 420 px on desktop), a strip with category or set and lot number, name, role chip with a shape icon, sub-role, overseas badge, up to 4 stat tiles, base price, current bid in large gold numbers, the leading team with its logo, and a circular countdown that turns amber under 10 seconds and red under 5.
  - Team standings: rank circles (1 gold, 2 silver, 3 bronze), logo, name, purse left, a remaining-purse bar (green above 60 percent, amber above 30, red below), squad count. The leading team gets a gold glow.
  - The **SOLD moment**: a full-screen overlay for about 2.3 seconds after a sale (click to dismiss): a gavel strike, "SOLD!" in huge gold text, player name and role, buyer logo and name, price, and three trophies. A sale already shown when the page opened does not replay.
- `/auctions/[slug]/teams` (squads): a grid of team cards like the old site (logo, name, purse spent/left bar, squad count, role breakdown); each opens `/teams/[id]` with the squad grouped by role, with photos and prices.
- `/auctions/[slug]/players`: a searchable, filterable grid (status, role, category) of player cards with photos and status badges; each opens `/players/[id]`.
- `/auctions/[slug]/stats`: Total spent, Players sold, Average price, Highest bid; Most expensive (top 10, ranks never wrap); spending by category and by role; a team spending table; sold / unsold / available counts.
- `/auctions/[slug]/results`: every sale in order, with CSV exports at `/api/auctions/[slug]/export/results` and `/export/squads`.
- `/auctions/[slug]/register`: public player registration (name, role, sub-role, category if the sport has categories, date of birth, guardian under 18, photo with preview, consent), in all three languages. The admin approves or rejects each one.
- `/auctions/[slug]/screen` (projector, `(bare)`, always dark): a very large spotlight, standings, the timer, a 7-second SOLD moment and an optional gavel sound (toggle stored per browser).
- `/auctions/[slug]/overlay` (OBS): a transparent background, a lower-third with the player, price and leader; may be framed.
- `/join`: one big code input with a hint. On success, go to `/manager`.
- `/setup`: section 8.
- Still to build: `/how-it-works`, `/sports`, `/faq`, `/contact` (stores a message in `contact_messages`, with rate limiting and UTM capture), `/search`, `/privacy`, `/terms`, `/refund-policy`, `/cookies`, `/data-deletion` plus a status page, `/licenses`, custom 404 and 500 pages, `sitemap.ts`, `robots.ts`, `manifest.ts`, favicon and icon set, an Open Graph image. Legal pages read everything from `site.config.ts` and show "to be filled in" where values are empty.

### Team owner (`/manager`, phone first)

Keep it **minimal** (decision: the busy version looked bad):

- A sticky header: team logo, team name, auction name, connection dot, leave button (with a confirm dialog).
- Two stat cards: **Purse left** (green) and **Largest bid allowed** (gold).
- One muted line: squad `n/max`, overseas `n/max`, RTM cards left, and roles still needed (for example "Bowler: 2 more").
- The player spotlight (the same component as the live view, with the big photo), plus a "You are leading" pill when they are.
- The RTM panel, only when it is their turn.
- A one-line feedback area (bid placed, or why it was refused).
- "My squad" as a collapsed `<details>` with photos and prices.
- A link to the live view and the language switcher.
- A **fixed bottom bid button**, full width, about 80 px tall, gold gradient: "Bid 120 points". When disabled, it is grey with the reason below it (not live, already leading, squad full, over the largest allowed bid, overseas or role limit).
- No bid history, no shortlist, no upcoming list.

### Admin (`/admin`, English only)

- `/admin/login`: username, password, generic error, backoff message.
- `/admin`: auctions list with status, and New auction.
- `/admin/auctions/new`: name, slug, sport, preset, date, purse per team.
- Per auction, with tabs:
  - **Overview**: status changes (publish, schedule, go live, pause, complete, archive), share links (live, screen, overlay, join), counts, and **Delete this auction** (type the name to confirm; works even while live: bidding stops, codes are revoked, the auction is hidden).
  - **Console** (the auction floor, built after the old CPL admin):
    - Left: the **full player list** with search, filters for status, role, category and set, and on each player an **Auction** button (pool) or **Re-auction** button (unsold) that puts that player on the floor immediately. No forced order.
    - Centre: the spotlight with Start, Pause/Resume, Reset timer, Undo last bid, and big **Sold** (green) and **Unsold** buttons. A slab hint shows the next amount.
    - Right: team tiles, each with a one-tap **Bid for this team** (admin on behalf), purse left, largest allowed bid, squad count. Disabled tiles say why.
    - Keyboard shortcuts for Sold, Unsold and Pause, shown on the buttons. Every destructive step has a confirm dialog listing its consequences.
  - **Settings**: every rule, with the slab editor (add, remove and reorder rows; shows gaps and overlaps inline), squad min/max, role min/max per role, overseas, base prices per category, timer, reserve rule, RTM/FBM, retentions, visibility, registration open. Shows a conflict dialog from `rule_conflicts`, needs a reason while live, and offers Undo of the last save.
  - **Teams**: add/edit (name, short name, colours, logo, **purse for this team**), generate or regenerate the access code (shown once, copy and share link), adjust purse with a reason, retentions, **delete team at any time**.
  - **Players**: add/edit with **name, role, sub-role, category, overseas, date of birth, stats, base price, set and photo**; CSV import with a template download and row-level errors; bulk photo upload matched by file name; bulk set, base price and delete; a delete button on every row. Delete works on any player.
  - **Registrations**: approve (creates the player and auction player) or reject, with photo preview.
  - **Queue** (optional ordering and lot numbers, drag with a keyboard path).
  - **Results**: correct a sale (change team or price, or return to pool, with a reason), print or save a PDF.
  - **Audit**: a filterable table of every change.
- `/admin/sports` and `/admin/sports/[key]`: the sport editor and presets (save as, duplicate, delete).
- `/admin/audit`: the global audit log.
- Finished auctions stay **fully editable** (decision: the owner wants full control).

---

## 10. Visual design (match the owner's original CPL site, then improve)

The look comes from the owner's earlier site (a Vite/React/shadcn app called CPL). Match its fonts, colours, sizes and backgrounds.

### Tokens (dark is the default theme)

```
--bg #080c16        page;  body background: linear-gradient(180deg, #0b111e, #05080f), fixed
--surface #0b111e   cards     --surface-2 #10192d     --surface-3 #1b2232
--line #242d42      borders   --line-strong #3a4560
--text #fff9e6      warm off-white     --text-muted #8f9bb6
--accent #ffbf00    gold      --accent-hover #ffd966  --gold-dark #b38600
--gold-from #ffcc33 --gold-to #ff9500 (gold gradient text)
--royal #4169e1     --royal-light #7b97ea --royal-dark #2c4fb8
--spent #ef4343     --remaining #22c55e   --sold #16a349  --warning #f59e0b
--live #ef4343      --paused #7b97ea      --danger #f05252 --focus #ffd966
--glow-gold rgb(255 191 0 / .18)  --glow-royal rgb(65 105 225 / .22)
--card-shadow 0 4px 30px rgb(0 0 0 / .3), inset 0 1px 0 rgb(255 255 255 / .05)
radius: 6px (xs), 8px (sm), 12px (md)
```

A light theme exists (a toggle in the header) with readable equivalents. The theme is saved in a `theme` cookie that the root layout reads on the server to set `data-theme` (decision: no inline theme script; it caused React warnings and a flash).

### Utilities

- `.card`: surface at 72 percent opacity, border, 12 px radius, card shadow. `.card-gold`: the same with a gold-tinted border and a `0 0 40px` gold glow.
- `.text-gold`: a 135-degree gold gradient clipped to text; solid gold in the light theme and in forced-colours mode.
- `.glow-gold`, `.glow-royal`, `.pulse-gold` (2-second pulse on the live spotlight), `.gavel-strike`, `.sold-reveal` (scale 0.8 to 1.05 to 1), `.float` (the trophy), `.counter-pop`.
- Custom scrollbar: 8 px, navy track, slate thumb.
- Every animation stops under `prefers-reduced-motion`.

### Type

- Headings in Orbitron, uppercase, wide tracking; the brand and auction titles weight 900 with `.text-gold`.
- Body in Rajdhani, 16 px minimum. Kannada text uses Noto Sans Kannada; Devanagari uses Rajdhani.
- **All prices, timers and counts in Oxanium with tabular numbers**, so a changing bid never shifts sideways.

### Components

- Buttons: uppercase, bold, wide tracking, 8 px radius. Variants: **primary** gold gradient (`#ffbf00` to `#b38600`, dark text), **royal** blue gradient (white text), **glass** (translucent surface, border), **secondary** outline, **ghost**, **danger** outline, **sold** green gradient. Hover lifts with a soft coloured shadow and a 1.05 scale (motion-safe only); press scales to 0.95. Sizes sm (36 px), md (44 px), lg, xl (56 px, used for hero buttons, min width 200 px).
- Badges: rounded pills, tinted background and border, uppercase (LIVE red, SOLD green, PAUSED blue, UNSOLD grey).
- The header: sticky, translucent surface with blur, logo with a soft royal glow, brand in gold gradient text, uppercase nav links, language switcher, theme toggle, Join button.
- Role chips: a different small shape per role position (circle, square, triangle, diamond, hexagon, cross, bar) plus the text label, so role never depends on colour alone.
- Team mark: the logo, or a block in the team colour with its short name (font size scaled so up to 6 characters fit on one line at any size).
- Player avatar: the photo, or an in-house silhouette with initials. **Never** stock or AI images.

### Banned

Emoji icons, em dashes in any text, cursor effects, scroll-triggered animations, autoplay carousels, stock or AI images, fake reviews, fake metrics or counters. Gradients only in the places listed above (page background, gold text, gold, royal and sold buttons).

---

## 11. Internationalisation

- Dictionaries in `src/lib/i18n/dictionaries/{en,kn,hi}.ts`; `kn` and `hi` are typed against `en` so a missing key fails the type check. Sections include common, nav, home, auctionsPage, live, phase, playerStatus, auction, join, manager, register, screen, stats, footer, cookie.
- `getT()` on the server, `useT()` / `useI18n()` on the client, the language in a `lang` cookie, `<html lang>` set accordingly, `{placeholder}` interpolation and plural forms.
- A unit test checks that all three dictionaries have the same keys and placeholders and that no string contains an em dash.
- Translate everything viewers and team owners see, including error and refusal reasons. Numbers use the Indian grouping for the locale.

---

## 12. Accessibility and quality

- WCAG 2.2 AA: text contrast at least 4.5:1 (check gold and red on navy), visible focus rings (`--focus`), a skip link, landmarks, labelled inputs with hints and errors tied through `aria-describedby`, `aria-live` for bids, results and the timer, `role="alert"` for the SOLD moment.
- Every drag-and-drop action has a keyboard path (dnd-kit keyboard sensor plus move up/down buttons). Give `DndContext` a stable `id` (from `useId`) to avoid hydration mismatches.
- Tap targets at least 44 px. The phone bid button is 80 px.
- Use `useSyncExternalStore` for browser-only state (theme, consent, sound) instead of setting state in effects.
- When a React 19 form action fails, the uncontrolled fields reset. Use `onSubmit` with `startTransition(() => action(formData))` so the values survive an error.
- Lighthouse targets: performance 90+, accessibility 100, best practices 100, SEO 100 on the public pages.
- A cookie banner offering essential cookies only (sessions, theme, language); no tracking cookies exist.

---

## 13. Tests

- **Unit** (Vitest): slab validation and increments, the reserve rule, eligibility, upload checks (magic bytes, size), CSV import validation with column-named errors, i18n parity.
- **Database** (Vitest project `db`): a global setup creates a `{db}_test` database, applies the migrations, and each test builds its own auction through helpers (`liveAuction`, `openPlayer`, `call`, `key`). Cover everything listed under "Concurrency test" in section 6.
- **End-to-end** (Playwright): admin login and backoff; create an auction, teams with purses and codes, players with photos; join with a code on a phone viewport; drag a player to the floor and run a full sale (bids from the manager and on behalf); see the live view, projector and SOLD moment update; correct a sale; delete a player and a team; Kannada registration and approval; axe scan on every public page; a 320 px overflow check on every route.
- `npm run launch-check`: fails if any env name is missing from `.env.example`, any secret-looking string is in the repo, `site.config.ts` business values are empty when `SITE_URL` is a production domain, any page lacks a title or description, or any string has an em dash.

---

## 14. Deployment (free)

1. Supabase: create a Free project in the region closest to the viewers (Mumbai for Karnataka). Copy the Project URL, the anon and service_role keys (Legacy API keys tab), and the **Transaction pooler** connection string from Connect. If you can't use the `postgres` password, create a login role (`create role auction_app login password '…'`, `grant create, connect on database postgres to auction_app`) and connect as `auction_app.<project-ref>` through the pooler.
2. Vercel: import the repository (Next.js preset) and deploy. Open the site; it redirects to `/setup`. Add the variables from section 3 in Settings > Environment Variables, then Redeploy. The build migrates and seeds the database. Sign in at `/admin/login`. Optionally set the function region to Mumbai (`bom1`).
3. If anything fails, open `/api/health`.
4. Notes for the owner: Vercel Hobby is for non-commercial use; a free Supabase project pauses after about a week without traffic (open the site a day before an auction, or press Restore); every push to `main` redeploys.

Write all of this for the owner in `docs/launch.md`, plus `docs/runbook.md` (running an auction day: rehearsal mode, backup plan if the network drops, how to correct a sale), `docs/third-party.md` (every service and font with its licence and free-tier limits) and `docs/decisions.md`.

---

## 15. Project rules for `CLAUDE.md`

```
# Project rules
- Server is the source of truth for bids, purse, timers. Never trust the client.
- All bid and floor changes go through the Postgres RPC functions in /supabase. Never update floor_state or bids directly.
- Money is integer points. No floats.
- Zero cost: no paid services, no email or SMS, no third-party auth, analytics or CAPTCHA. Free tiers only.
- Admin credentials come only from env vars (ADMIN_USERNAME, ADMIN_PASSWORD_HASH). Never write them in code, tests, docs or commits.
- Team owners have no accounts. They enter a team access code at /join. Store only the HMAC hash of codes.
- Each team has its own purse, set by the admin.
- No rule value is hardcoded. Slabs, squad sizes, role minimums and maximums, timers and base prices are editable by the admin in the UI. The bid engine reads them fresh from the database on every bid.
- Live rule edits apply forward only, run a conflict check first, and are audited.
- The admin can delete any player, team or auction at any time; every delete cleans up purses and the floor and is audited.
- The admin picks the next player in any order. Never force a serial queue.
- Sports are data in `sports.config`. Never hardcode a sport's roles in components.
- All business details come from site.config.ts. Never type them inline.
- Visual style follows the owner's original CPL site (deep navy, gold, royal blue, warm off-white, Orbitron and Rajdhani, 12px corners, soft card shadows, gold glows). Gradients only for the page background fade, gold wordmark text (.text-gold) and the gold, royal and sold buttons. Use .card and .card-gold for panels.
- Hard design bans: emoji icons, em dashes, cursor effects, scroll animations, autoplay carousels, stock or AI images, fake reviews, fake metrics, fake counters.
- Accessibility: WCAG 2.2 AA. Every drag action needs a keyboard path.
- No horizontal overflow at 320px and up.
- Before saying a task is done: run typecheck, lint, vitest, playwright, and npm run launch-check.
- Record non-obvious decisions in docs/decisions.md.
```

---

## 16. Build order

1. **Scaffold**: Next.js, TypeScript, Tailwind tokens and utilities from section 10, fonts, `CLAUDE.md`, `.env.example`, `env.ts`, `proxy.ts` with CSP, security headers, `site.config.ts` (empty values), the skip link, the header and footer shells, the theme cookie, the i18n plumbing with the three dictionaries.
2. **Database**: migrations 0001 (schema, RLS, revokes), 0002 (engine), 0003 (security and snapshot JSON), 0004 (lot numbers and stats), 0005 (admin deletes); the migrate and seed scripts; the `db` test harness and the full engine test suite, including the 100-parallel-bids test.
3. **Auth**: admin login with argon2 and backoff, sessions, `requireAdmin`; team codes, `/join`, team sessions, rate limits.
4. **Admin core**: the auctions list, new auction, overview, settings with the slab editor and conflict dialog, teams with purses and codes, players with photos, CSV import and bulk actions, registrations, sports editor and presets.
5. **Live**: the broadcast helper, `useLiveAuction`, the snapshot API, the live view, the player spotlight, standings, the SOLD moment, the projector, the overlay.
6. **Console**: the player picker (any order), floor controls, bid on behalf, keyboard shortcuts, RTM, undo, results correction, audit views, print.
7. **Manager**: the phone console from section 9, bid and RTM APIs with idempotency.
8. **Public pages**: home, auctions, squads, team page, players, player page, stats, results with CSV, registration.
9. **Deploy helpers**: `/api/health`, `/setup`, `predeploy`, the bucket creation, `hash-password`, `docs/launch.md`.
10. **Remaining pages**: how it works, sports, FAQ, contact, search, legal pages, 404 and 500, sitemap, robots, manifest, icons, OG image.
11. **Quality**: Playwright end-to-end, axe, overflow at 320 px, Lighthouse, `launch-check`, real screenshots of the demo data for the home page (taken from a production build, without the dev badge), `docs/runbook.md`, `docs/third-party.md`.
12. **Final check**: every item in sections 6, 9, 12 and 13 works; then push.

---

## 17. Pitfalls already found (avoid them)

- Next's env loader expands `$` in `.env.local` even in single quotes: escape the argon2 hash as `\$` and unescape in `env.ts`.
- An instrumentation hook that throws turns every request into a bare 500. Log instead, and serve `/setup` and `/api/health`.
- The Supabase direct host is IPv6-only; Vercel needs the transaction pooler on port 6543, with `prepare: false`. The pooler host's `aws-N` number must be copied, not guessed. The pooler user is `<role>.<project-ref>`.
- Exporting a string constant from a `"use client"` module and importing it into a server component gives a client reference, not the string. Keep shared constants in server-safe modules.
- React 19 warns about `<script>` tags rendered in components; don't inject inline scripts for theming (use the cookie).
- An implicit CSS grid column grows to its widest child on mobile; use `grid-cols-[minmax(0,1fr)]` on single-column grids so long names don't overflow at 320 px.
- `hidden` plus `inline-flex` on the same element conflict in Tailwind; wrap instead.
- Proportional digits make ticking prices jitter; use a tabular font (Oxanium).
- dnd-kit needs a stable `DndContext` id, or hydration fails.
- Access codes must use an alphabet without 0, O, 1, I, L, and tests must too.
- Clear `login_attempts` between tests that use wrong passwords, or later logins hit the backoff.
- Admin upload and form errors must name the column or field the admin sees.
- Headless Chromium in containers may need `--no-sandbox --no-zygote --single-process` and one browser per page.
