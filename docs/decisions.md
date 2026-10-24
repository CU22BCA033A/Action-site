# Decisions

Non-obvious choices, newest first.

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
