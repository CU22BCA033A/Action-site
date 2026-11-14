# Decisions

Non-obvious choices, newest first.

## No demo data in the product
The owner wants the site ready for real use with no demo data. The home page no longer shows demo screenshots (with no public auction it says so plainly), the screenshot files are gone, `db:seed` adds only the sports and their presets, and the admin's "Rehearsal on demo data" option is removed: every auction starts empty. To practise, the admin creates a private test auction and deletes it. The demo-data module (`src/lib/demo`, `src/lib/domain/demo.ts`) stays only for the end-to-end tests, which create their own private auctions and hide them afterwards.

## Admin inbox and deletion requests
`/admin/inbox` lists contact messages (mark read, archive, delete) and `/admin/deletion-requests` lists data deletion requests with the matching player registration and a status and note that the requester sees on `/data-deletion/status`. Both list everything by default with open items first, so a card stays on screen after a change and shows its confirmation. Every change is written to the audit log.

## Console keyboard shortcuts
In the admin console S opens the Sold confirmation, U the Unsold confirmation and P pauses or resumes. They are ignored while typing, with a modifier key held, or while a dialog is open, and the keys are shown on the buttons and exposed through `aria-keyshortcuts`.

## Scroll areas contain absolutely positioned children
A global `:where(.overflow-x-auto, .overflow-auto)` rule makes scroll areas `position: relative`. Without it, screen-reader-only labels inside wide tables were laid out against the page and widened it on phones.

## Live page is an auction room on one screen
From 1280 px wide the live page is three full-height columns under one shared header row, modelled on the owner's crickauction.in screenshots: auction teams on the left (rank, logo, name, owner name, purse left, squad count), the player in the middle (base price and bidder in the header row; a card with a timer line along its top edge, portrait photo, role pills, large name, a four-stat strip, current bid with the bidding team's badge, a round countdown, and a read-only spectator bar), and live activity on the right (bids on this player, then each recent sale as a card with team, photo, name, role and price). Each column scrolls on its own, so purses stay visible. Viewers never bid here; the bar says so and links to the results. On phones the order is player, teams, activity, and base price and bidder move into the card.

## Unsold waits for the timer; sold and unsold are always the admin's call
Nothing sells or unsells a player automatically. `mark_unsold` (migration 0006) refuses with TIMER_RUNNING while the bid timer still has time left, live or paused, so a player is never dropped while owners may still bid. With no timer set, the admin decides. The console disables Unsold and shows the seconds left.

## Sale sound is the CPL gavel, off until switched on
The gavel hit is the Web Audio synth from the owner's CPL site (a low-passed thud plus a short noise burst), played twice on each sale. No sound file is shipped. Browsers refuse to play sound before a tap, so it is off until the viewer presses "Sale sound"; the choice is remembered in the browser and shared by the live page and the projector screen.

## Public pages show only the sport being auctioned
The organiser creates an auction for one sport (almost always cricket). The header, footer, home page and sitemap no longer list every sport; the home page names only the sports of published auctions, and `/sports` redirects to `/auctions`. The other sports still exist for the admin.

## Look follows the owner's crickauction.in reference exactly
The owner asked for the exact look of their crickauction.in room screenshots: colours, fonts, sizes and backgrounds. So: Inter for all Latin text (the font that site uses; this overrides the owner's earlier ban on Inter, by their newer instruction), neutral near-black #0a0a0a background with #111/#171717 panels and #222 borders, rounded panels (up to 32 px), 64 px player names, 28 px stat values in white, green, cyan and amber, blue and purple tag pills, a solid green countdown ring and a green timer line. The live page is a full-screen room (no site header or footer) with a slim top bar. Gold stays the brand accent; the silver and gold AuctionX wordmark stays elsewhere on the site.

## Save player card
Each sale card on the live page can be downloaded as a 1080x1350 PNG from `/api/auctions/[slug]/card/[auctionPlayerId]`, rendered on the server with public data only (404 for unsold players or private profiles). Uploaded WebP photos are converted to PNG first, and the route ships its own two Inter WOFF files (`src/assets/card`).

## The owner's logo file is still needed
The owner shared an AuctionX logo image in chat, but no file reached the repository. Until it is added (for example as `public/brand/auctionx-logo.png`), the site uses an in-house gavel mark and a typeset AuctionX wordmark.

## Brand name is AuctionX
The owner named the product AuctionX. It is set once in `site.config.ts` (`brandName`) and flows into the header, footer, page titles, the share image and the web manifest.

## The owner's design guidelines tighten the CPL look
The owner's own list bans radial orbs, liquid glass, soft corner radius, drop shadows on everything and three feature cards in a row. So: the glow orbs behind the hero and the SOLD card are gone, the sticky headers are solid instead of blurred, corners are 4/6/8 px instead of 6/8/12 px, plain `.card` panels have no shadow (only `.card-gold`, the live spotlight, keeps its shadow and glow), and "how an auction runs" is a numbered list instead of three cards.

## Home page borrows the workflow of crickauction.in, not its look
That site (an IPL auction game) pairs its hero with a live panel of recent signings and a numbered "create, invite, bid" strip, and has a rulebook page with an "On this page" list. Those ideas are used here. Its look (Inter, orange, emoji, glow orbs) is not, because the owner banned all of those.

## Legal pages are in English only
Privacy, terms, refund and cookie pages are written in English, with a translated note at the top for Kannada and Hindi readers saying the English text applies. Legal wording that changes meaning in translation is a risk, and every statement in them is checked against what the code does (`src/lib/legal/content.ts`). Empty business details read "To be filled in by the organiser" and `npm run launch-check` fails until they are filled.

## Launch gate
`npm run launch-check` fails until the business details in `site.config.ts` are filled and a custom domain is connected (`useCustomDomain: true`). It also checks env names against `.env.example`, committed secrets, required pages and icons, page titles and descriptions, em dashes, emoji and "made with" builder tags.

## Visual style matches the original CPL site
The owner asked for the look of their earlier auction site (cpl-2megaaction): deep navy background with a vertical fade, gold (#FFBF00) as the main accent, royal blue (#4169E1) as the second, warm off-white text, Orbitron headings, Rajdhani body text, 12px corners, translucent cards with a soft shadow, gold glows on the live player and the leading team, gold gradient wordmarks and gold/royal gradient buttons. This overrides the original spec's ban on gradients and glows, but only in those places.

Kept from the spec, on purpose:
- The team stats carousel pages only when the viewer asks. The old site rotated every 4 seconds; autoplay moves content nobody asked to move (WCAG 2.2.2).
- Prices and timers use Oxanium for equal-width digits, so a ticking price never shifts sideways. Orbitron is used everywhere else.
- Every animation stops under `prefers-reduced-motion`.
- Dark is the default theme, as on the old site. A light theme stays available from the toggle.
- Gradient text falls back to a solid colour in the light theme and in forced-colours mode, so it never loses contrast.
- Role and status are shown with text and shapes, not emoji.

## The SOLD card plays on the live page too
The old live page showed a SOLD overlay with a gavel for about two seconds after each sale. The live page now does the same (2.3 s, click to dismiss); the projector screen holds it for 7 s and can add a gavel sound. A sale that was already on the floor when the page opened does not replay.

## Admin screens are English only
Viewer and team-manager screens are translated into English, Kannada and Hindi. The admin panel is English only: it is used by one person, and dense rule editors are easier to support in one language.

## Team owner screen keeps only what a bidder needs
The owner screen shows the team's purse and largest allowed bid, one line of squad counts and role needs, the player on the floor as a big photo card, and the bid button. The squad is folded away under "My squad". The bid history, shortlist and upcoming-player list were removed: the admin picks players in any order, so an "upcoming" list was misleading, and the extra panels made the phone screen hard to read.

## Theme is stored in a cookie, not set by a script
The root layout reads a `theme` cookie and sets `data-theme` on the server. An inline theme script caused a React warning on every page in development and was not needed once the server knows the choice. Dark is the default.

## The admin can delete anything, at any time
The owner asked for full admin control. Deletes are no longer refused to protect history; instead each delete cleans up after itself and is written to the audit log:
- **Player:** works in any state. A sold player's points go back to the team that bought them; a player on the floor is taken off it; bids on that player are removed with it. The audit entry keeps the names, the points refunded and the bid count.
- **Team:** works in any state. Its players go back to the pool so they can be auctioned again, its bids stay in the history marked void, its code and sessions stop working. If it is leading the player on the floor, that player goes back to the pool.
- **Auction:** works even while live (typed name to confirm). Bidding stops, codes are revoked, and the auction is hidden everywhere.
- Finished auctions can still be edited: teams, players and registrations stay editable after completion. Completing an auction with a player still on the floor returns that player to the pool instead of refusing.
These run as database functions (`admin_delete_players`, `admin_delete_team`) under the floor lock, so they never race a bid.

## First-run setup in the browser, database set up during the Vercel build
The owner deploys from Vercel without a terminal. Until the required settings exist, every page redirects to `/setup`, which lists what is missing, hashes the chosen admin password (only while `ADMIN_PASSWORD_HASH` is unset) and offers fresh random secrets. Once configured, `/setup` returns 404. On Vercel the build runs `scripts/predeploy.ts` first, which applies migrations and adds the sports when `DATABASE_URL` is set, so the database always matches the deployed code.

## Plus Jakarta Sans and a compact type scale
The owner found the text too big next to other auction sites and asked for a different font. Latin text now uses Plus Jakarta Sans (SIL OFL, self-hosted, has tabular figures for prices and timers) in place of Inter. The type scale is set once in `globals.css`: body text is 15px and every `text-*` size is smaller (for example `text-5xl` is 2.5rem instead of 3rem), so all pages shrink evenly without editing each component. Headings use weight 700, and the heaviest weight is 800 (the family has no 900). The projector screen, stream overlay and sold moment add `.screen-type`, which restores the larger scale, because they are read from across a hall. The player card PNG and share image use the same family.

## Role icons are data on the role
The owner asked for icons next to Batter, Bowler, All-rounder and Wicketkeeper. Each role in a sport's config has an optional `icon` (`bat`, `ball`, `all_rounder`, `gloves`), chosen by the admin in Admin > Sports; components never decide an icon from a role's name. A role without an icon keeps the plain shape marker. The icons are small flat SVGs drawn for this site in `src/components/auction/role-icon.tsx`, not the clip art the owner sent as a reference, because stock images are banned. Migration 0007 gives the built-in cricket roles their icons on databases set up before this change.

## Royal black, gold-orange and royal blue (premium look)
The owner asked for a premium, luxurious look in "royal black and orange, royal blue and gold", and found the buttons and fonts too ordinary. Within the existing rules (flat panels, no glows, gradients only for the page fade and the gold, royal and sold buttons):
- **Colours:** near-black surfaces with a faint cool tint, ivory text, a gold-to-orange accent (`#f5a524`, gradient `#ffdc85` to `#ee7a14`) and royal blue (`#2f5be0`). The page fade adds a faint orange light at the top right and a royal one at the top left.
- **Fonts:** headings use Sora (SIL OFL, self-hosted). Unbounded was tried first and the owner found it too wide and heavy in the hero. Body text stays Plus Jakarta Sans for readability. Prices and timers keep tabular figures.
- **Buttons:** pill-shaped and polished: gold-to-orange with a top highlight and bottom shade, royal blue with a gold edge, and dark glass with a gold hairline. Large buttons use small spaced capitals.
- **Detail:** thin gold rules under page titles (`.rule-gold`), a second inset gold hairline on featured panels (`.frame-gold`), a translucent header with a 1px gold edge.
The light theme uses ivory and warm greys with a darker orange for text. All text colours were rechecked for WCAG AA by the axe tests.

## Motion and the 3D hero
The owner asked for animations, including 3D. Everything is CSS, with no animation library and no WebGL, so it costs no extra JavaScript and works on low-end phones:
- **Hero:** text and buttons rise in on page load (staggered), the headline gold slowly shifts, two blurred lights (royal and orange) drift behind it, and the right side shows a 3D gold medallion (gavel on one face, trophy on the other, real edge thickness from stacked layers) spinning inside two tilted orbit rings, one carrying the role icons. When a public auction exists, that column shows the auction's live numbers instead.
- **Buttons:** gold, royal and sold buttons get a light sweep on hover and keyboard focus; the large gold call to action repeats a slow gleam; icons tip like a gavel on hover.
- **Limits kept:** nothing runs on scroll and nothing follows the pointer (both still banned). The global prefers-reduced-motion rule stops every animation and leaves the final state.

## Player numbers
The owner asked for a player number on each profile, with lists in that order. The existing per-auction lot number is that number: it is unique in an auction and assigned automatically (next free number). The admin can now set or change it in the player form; a duplicate is refused with the name of the player who has it, and changes are audited. The public Players list and the admin Players page show one list sorted by number, with each player's role on the card, instead of separate groups per role. The number appears as a gold badge on player cards and before the name on the player page.

## Registration link, window and photos
The owner reported that the player registration link did not work. Two likely causes were fixed:
- **Big phone photos.** The server refuses images over 3.5 MB and Vercel refuses requests over 4.5 MB, but phone cameras produce 5 to 12 MB pictures. Every photo and logo picker now shrinks the image in the browser first (longest side 1600 px, JPEG), so a 10 MB photo uploads as a few hundred KB. The server still checks and re-encodes every file. A test uploads a 10 MB photo through the public form.
- **Wrong site address in shared links.** Links the admin copies (registration, join, live room) were built from `SITE_URL`, so a missing `https://`, a typo or a preview address broke them. They are now built from the address the admin is actually using; `SITE_URL` is also normalised.
Registration now has an opening and closing date and time, editable at any time on the Registrations tab (with the switch, player types and the domestic/overseas option). The check runs in the database (`app.registration_is_open`) on page load and again on submit, so a form left open past the closing time is refused. Times are entered in the admin's own time zone and shown in Indian time.

## Player types instead of domestic/overseas
Most leagues using the site are local (colleges, offices, clubs), where domestic/overseas means nothing but groups such as Student, Teacher or Faculty do. Each auction now has its own optional list of player types; the player picks one when registering and it shows on cards in place of "Domestic". Domestic/overseas is off by default for new auctions and only asked when the admin turns it on (needed for an overseas limit). Existing auctions keep it on so their overseas rule keeps working.

## Erasing an auction
Delete (hide, revoke codes, stop bidding) stays as it was. Erase permanently also removes the auction's rows and every photo and logo from storage, after the admin types the auction name. Players who also appear in another auction are kept. The audit log is append-only by design, so its earlier entries for the auction remain and one final "auction.erase" entry records the counts.

## Home page without template sections
To look less like a generated template, the home page dropped the duplicated 1-2-3 strip under the hero buttons and the "Costs nothing to run" panel (it spoke to the organiser, not to visitors). The three steps became one plain row: organisers, team owners and viewers, each with a link to what they would do next.

## The site's own address comes from Vercel
A registration link opened with Vercel's "404 DEPLOYMENT_NOT_FOUND": the link's host was not one of the project's deployments. Shared links had been built from `SITE_URL`, a value typed by hand (and the setup guide's example address could be copied as is). On Vercel the site now uses `VERCEL_PROJECT_PRODUCTION_URL`, which Vercel sets itself to the project's production address (its custom domain when there is one), for share links, canonical URLs and the sitemap. `SITE_URL` is only a fallback off Vercel. The admin dashboard warns when `SITE_URL` is set to a different address.
