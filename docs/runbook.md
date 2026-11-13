# Auction day runbook

How to prepare and run a live auction with AuctionX, and what to do when something goes wrong. Everything below is done in the browser; nothing needs a computer set up for development.

## A week before
1. **Open the site.** A free Supabase project that gets no traffic for about a week is paused. If `/api/health` says the database cannot be reached, open the Supabase dashboard and press Restore. Open the site again a day before the auction.
2. **Create the auction** in Admin > Auctions > New auction. Pick the sport and a preset, then set the rules in the auction's **Rules** tab: bid slabs, squad size, role minimums and maximums, overseas limit, base prices, timer, reserve rule and RTM.
3. **Add teams** in **Teams**: name, short name (up to 6 characters), colours, logo and each team's own purse.
4. **Add players** in **Players**: one by one, from a CSV file (download the template there), or by opening registration and approving entries in **Registrations**.
5. **Generate the team codes** in **Teams**. Each code is shown once: copy it or use the share link and send it privately to that team's owner. If a code leaks, press **Regenerate code**: the old code and every device signed in with it stop working at once.

## Practice run (strongly recommended)
1. Create a second auction, leave **List on the public auctions page** unticked, and add two or three teams and a handful of players (your own names are fine).
2. Give the owners their codes for this test auction and run five or six players end to end: owners bid from their phones, you sell, unsell and undo from the console.
3. Open the projector screen (`/auctions/<slug>/screen`) on the hall computer and check the sound, if you want the gavel. Sound stays off until someone presses the sound button, because browsers block sound before a tap.
4. Delete the test auction afterwards (Overview > **Delete auction**, then type its name to confirm).

## On the day
1. In the auction's header press **Go live**.
2. Open the **Console**. Pick any player from the list and press **Auction**; bidding opens at the base price. The order is yours.
3. Owners bid from their phones. You can also bid for a team with its tile (for an owner without a phone).
4. When bidding stops, press **Sold** (key **S**) or, if nobody bid and the timer has run out, **Unsold** (key **U**). Every step asks for confirmation. **Pause** / **Resume** is key **P**.
5. Unsold players can come back later with **Accelerated round**.
6. When everyone is done, press **Complete**. Results stay editable through audited corrections.

Screens to open:
- **Live room** for viewers: `/auctions/<slug>`
- **Projector** for the hall: `/auctions/<slug>/screen`
- **Stream overlay** for OBS (browser source, transparent): `/auctions/<slug>/overlay`

## If something goes wrong
- **A wrong bid:** in the console press **Undo last bid**. The bid is kept in the history as undone and the price and leader go back one step.
- **A wrong sale:** open **Results**, choose the sale, then change the team or the price, or send the player back to the pool. A reason is required; both teams' purses and squads are recalculated and the change is written to the audit log.
- **A team's purse is wrong:** **Teams** > edit the team and change its purse. Once the auction has started a reason is required, and the purse cannot go below what the team has already spent.
- **A rule is wrong mid-auction:** change it in **Rules**. You will see any team that would break the new rule before it is saved, and a reason is required while live. The change applies to the next bid only.
- **The internet drops:** pages reconnect on their own and check every few seconds; owners cannot bid while their phone is offline, so nobody bids on an old price. If the hall connection is down for long, press **Pause auction** and resume when it is back. As a last resort, run the floor from the console and bid for teams with their tiles.
- **An owner's phone is lost or the code leaked:** **Regenerate code** for that team.
- **The site shows "Internal Server Error":** open `/api/health`; it says what is missing in plain words. See `docs/launch.md`.

## After the auction
- **Results** > **Results CSV**, and on the public Squads page **Download squads (CSV)**, for your records.
- **Results** > **Print or save as PDF**.
- Answer messages in Admin > **Contact inbox** (reply by email; the address is a link).
- Handle deletion requests in Admin > **Deletion requests**: if the requester gave a registration reference, the matching registration is shown with a **Delete registration** button. Then set the status to Done, or Not carried out with a note. The requester sees the status and note on `/data-deletion/status`. The privacy policy promises action within 30 days.
