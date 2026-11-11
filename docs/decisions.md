# Decisions

Non-obvious choices, newest first.

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
