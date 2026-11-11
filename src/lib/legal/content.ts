import { siteConfig } from "@config";

/**
 * Legal texts. English only (decision recorded in docs/decisions.md); every
 * business detail comes from site.config.ts. Each statement here describes
 * what the code actually does: keep them in sync when behaviour changes.
 */
export type LegalBlock = { kind: "p"; text: string } | { kind: "list"; items: string[] } | { kind: "details" };
export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

const p = (text: string): LegalBlock => ({ kind: "p", text });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

function org(): string {
  return siteConfig.legalEntityName || "the organiser named in the business details below";
}

export function privacySections(): LegalSection[] {
  const brand = siteConfig.brandName || "this site";
  return [
    {
      id: "who",
      title: "Who is responsible",
      blocks: [p(`${brand} is run by ${org()}. They decide how the personal data described here is used and are responsible for it.`), { kind: "details" }],
    },
    {
      id: "what",
      title: "What we collect",
      blocks: [
        p("We collect only what each feature needs:"),
        list(
          "Player registration: full name, photo, playing role and speciality, whether the player is domestic or overseas, optional statistics, an optional short bio, the date of birth, and for players under 18 the confirmation of a parent or guardian.",
          "Contact form: your name, email address and message. If you allowed the campaign source cookie, the utm_source, utm_medium and utm_campaign of the link you arrived from.",
          "Data deletion request: your name, an optional email or phone number, an optional registration reference and what you want deleted.",
          "Team owners and the admin: a session record with the browser's user agent and the time it expires. Team owners give no name, email or phone.",
          "Security: a one-way hash of your IP address, kept to limit repeated sign-in attempts and form spam. The IP address itself is not stored.",
        ),
        p("We do not ask for a phone number, home address or any ID document in a registration. We use no analytics, advertising or tracking services."),
      ],
    },
    {
      id: "why",
      title: "Why we use it",
      blocks: [
        list(
          "To run the auction: player profiles with name, photo, role and statistics are shown publicly on the auction pages, the projector screen and the broadcast overlay.",
          "To reply to messages you send and to carry out deletion requests.",
          "To keep the site secure and stop abuse.",
        ),
        p("We rely on your consent, given with the checkbox on each form. You can withdraw it at any time by asking for deletion."),
      ],
    },
    {
      id: "public",
      title: "What is shown publicly",
      blocks: [
        p("For an approved player: the name, photo, role, speciality, domestic or overseas status, statistics, short bio, an age group (never the full date of birth), and the auction result. A profile for a player under 18 is shown only with a parent or guardian's agreement."),
      ],
    },
    {
      id: "children",
      title: "Players under 18",
      blocks: [p("A player under 18 can register only when a parent or guardian confirms on the form that they agree. Without that confirmation the registration is refused.")],
    },
    {
      id: "sharing",
      title: "Who we share it with",
      blocks: [
        p("We never sell personal data. It is stored with the two services that run the site:"),
        list("Vercel, which hosts the website.", "Supabase, which hosts the database and the photo storage."),
        p("Both act only on our instructions. We do not share data with anyone else unless the law requires it."),
      ],
    },
    {
      id: "retention",
      title: "How long we keep it",
      blocks: [
        list(
          "Player registrations and profiles: until the organiser deletes the auction or the player, or until you ask for deletion.",
          "Contact messages and deletion requests: as long as needed to deal with them, then deleted by the organiser.",
          "Rate limit records: deleted after one day.",
          "Session records: they stop working when they expire (12 hours for the admin, 16 hours for team owners) or when the session is ended.",
        ),
      ],
    },
    {
      id: "rights",
      title: "Your rights",
      blocks: [
        p("You can ask to see, correct or delete your personal data, and withdraw consent. Use the data deletion page, or write to the grievance officer below. We aim to act within 30 days."),
      ],
    },
    {
      id: "security",
      title: "Security",
      blocks: [p("Data is sent over HTTPS. The database cannot be read through the public database API. Team access codes are stored only as one-way hashes, and the admin password only as an Argon2 hash.")],
    },
    {
      id: "changes",
      title: "Changes to this policy",
      blocks: [p("When this policy changes, the date at the top of the page changes too.")],
    },
  ];
}

export function termsSections(): LegalSection[] {
  const brand = siteConfig.brandName || "this site";
  return [
    { id: "about", title: "About these terms", blocks: [p(`These terms apply to everyone who uses ${brand}: the organiser, team owners, players and viewers. ${brand} is run by ${org()}. Using the site means you accept these terms.`), { kind: "details" }] },
    {
      id: "service",
      title: "What the service is",
      blocks: [p("The site runs live player auctions for sports leagues. Teams bid for players with points. Points are virtual: they have no money value, cannot be bought, sold or exchanged, and no real money is wagered, held or paid out on this site.")],
    },
    {
      id: "organiser",
      title: "The organiser",
      blocks: [p("The organiser sets the rules of each auction, adds the teams and players, and runs the auction floor. The organiser may correct a sale, change a rule or remove a player, team or auction. Every such change is recorded with a reason.")],
    },
    {
      id: "owners",
      title: "Team owners",
      blocks: [list("Keep your team access code private. Anyone with the code can bid for your team.", "Bids placed with your code count as your team's bids.", "Tell the organiser at once if you think your code was shared. They can issue a new code, which ends every old session.")],
    },
    {
      id: "players",
      title: "Players and content",
      blocks: [p("When you register you confirm that the details are true and that you may share the photo. You allow the organiser to show the name, photo, role and statistics on the auction pages for as long as the profile exists. You can ask for removal at any time on the data deletion page.")],
    },
    {
      id: "conduct",
      title: "Acceptable use",
      blocks: [list("Do not try to break, overload or get around the security of the site.", "Do not upload photos or text that are unlawful, offensive or belong to someone else.", "Do not pretend to be another person or team.")],
    },
    {
      id: "availability",
      title: "Availability",
      blocks: [p("The site runs on free hosting plans and may sometimes be slow or unavailable. It is provided as it is. The organiser decides how to handle a network failure during an auction, including pausing it or correcting a result.")],
    },
    {
      id: "liability",
      title: "Liability",
      blocks: [p("As far as the law allows, the organiser is not liable for indirect loss arising from use of the site. Nothing in these terms limits rights that cannot be limited by law.")],
    },
    {
      id: "law",
      title: "Governing law",
      blocks: [p(siteConfig.primaryJurisdiction ? `These terms are governed by the laws that apply in ${siteConfig.primaryJurisdiction}, and disputes go to the courts there.` : "The governing law and place of jurisdiction are to be filled in by the organiser.")],
    },
    { id: "changes", title: "Changes", blocks: [p("When these terms change, the date at the top of the page changes too.")] },
  ];
}

export function refundSections(): LegalSection[] {
  return [
    {
      id: "payments",
      title: "No payments on this site",
      blocks: [p("This site does not take any payment. There is no subscription, no fee and no in-site purchase, so there is nothing to refund. Points used in auctions are virtual and cannot be bought or cashed out.")],
    },
    {
      id: "fees",
      title: "League fees",
      blocks: [p("If your league collects an entry or registration fee, it does so outside this site. Ask the league directly about refunds for that fee.")],
    },
    { id: "contact", title: "Questions", blocks: [p("Use the contact page or the details below if anything here is unclear."), { kind: "details" }] },
  ];
}

export type CookieRow = { name: string; purpose: string; duration: string; kind: string };

export function cookieRows(): CookieRow[] {
  return [
    { name: "pa_admin", purpose: "Keeps the organiser signed in to the admin panel.", duration: "12 hours", kind: "Essential" },
    { name: "pa_team", purpose: "Keeps a team owner signed in to the team console.", duration: "16 hours", kind: "Essential" },
    { name: "theme", purpose: "Remembers dark or light theme.", duration: "1 year", kind: "Essential" },
    { name: "lang", purpose: "Remembers your language.", duration: "1 year", kind: "Essential" },
    { name: "consent", purpose: "Remembers your cookie choice.", duration: "180 days", kind: "Essential" },
    { name: "utm (browser storage)", purpose: "Remembers the campaign source of the link you arrived from. Set only if you allow it.", duration: "Until you clear it or change your choice", kind: "Optional" },
    { name: "screen-sound (browser storage)", purpose: "Remembers whether the projector screen plays the sale sound.", duration: "Until you clear it", kind: "Essential" },
  ];
}

export function cookieSections(): LegalSection[] {
  return [
    { id: "what", title: "What cookies are", blocks: [p("Cookies are small files a website stores in your browser. Browser storage works the same way but is read only by the page itself.")] },
    { id: "list", title: "Cookies we use", blocks: [] },
    { id: "third", title: "No third-party cookies", blocks: [p("No advertising, analytics or social media services are loaded, so no third party sets cookies through this site.")] },
    { id: "control", title: "Your choice", blocks: [p("Essential cookies are needed for sign-in, theme and language and are always on. The campaign source is optional; change your choice any time with Cookie settings in the footer. You can also delete cookies in your browser settings.")] },
  ];
}
