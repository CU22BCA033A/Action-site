import type postgres from "postgres";
import type { AuctionDefaults } from "@/lib/sports/config";

type Sql = postgres.Sql<Record<string, never>> | postgres.TransactionSql<Record<string, never>>;

export type CreateAuctionInput = {
  sportId: string;
  name: string;
  slug: string;
  startsAt: Date | null;
  isPublic: boolean;
  rehearsal: boolean;
  defaults: AuctionDefaults;
};

/** Inserts an auction with its rules and bid slabs. The floor row is created by a trigger. */
export async function insertAuction(sql: Sql, input: CreateAuctionInput): Promise<string> {
  const d = input.defaults;
  const rows = await sql<{ id: string }[]>`
    insert into app.auctions(
      slug, name, sport_id, status, starts_at, points_unit_label, purse_per_team,
      squad_min, squad_max, max_overseas, role_minimums, role_maximums,
      default_base_price, category_base_prices, reserve_rule_enabled,
      bid_timer_seconds, timer_extension_seconds, rtm_enabled, rtm_label, rtm_allow_final_raise,
      rtm_cards_per_team, retentions_enabled, max_retentions, public, rehearsal)
    values (
      ${input.slug}, ${input.name}, ${input.sportId}, 'draft', ${input.startsAt}, ${d.pointsUnitLabel}, ${d.purse},
      ${d.squadMin}, ${d.squadMax}, ${d.maxOverseas}, ${sql.json(d.roleMinimums)}, ${sql.json(d.roleMaximums)},
      ${d.defaultBasePrice}, ${sql.json(d.categoryBasePrices)}, ${d.reserveRuleEnabled},
      ${d.bidTimerSeconds}, ${d.timerExtensionSeconds}, ${d.rtmEnabled}, ${d.rtmLabel}, ${d.rtmAllowFinalRaise},
      ${d.rtmCardsPerTeam}, ${d.retentionsEnabled}, ${d.maxRetentions}, ${input.isPublic}, ${input.rehearsal})
    returning id`;
  const id = rows[0]!.id;
  for (const s of d.slabs) {
    await sql`insert into app.bid_slabs(auction_id, from_points, to_points, increment_points)
      values (${id}, ${s.from}, ${s.to}, ${s.increment})`;
  }
  return id;
}

export type InsertTeamInput = {
  auctionId: string;
  name: string;
  shortName: string;
  primaryColor: string;
  secondaryColor: string;
  ownerDisplayName: string;
  purseTotal: number;
  rtmCards: number;
  logoPath?: string | null;
};

export async function insertTeam(sql: Sql, t: InsertTeamInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into app.teams(auction_id, name, short_name, primary_color, secondary_color, owner_display_name,
      purse_total, rtm_cards_left, logo_path)
    values (${t.auctionId}, ${t.name}, ${t.shortName.toUpperCase()}, ${t.primaryColor}, ${t.secondaryColor},
      ${t.ownerDisplayName}, ${t.purseTotal}, ${t.rtmCards}, ${t.logoPath ?? null})
    returning id`;
  return rows[0]!.id;
}

export type InsertPlayerInput = {
  sportId: string;
  fullName: string;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  tags: string[];
  nationalityGroup: "domestic" | "overseas";
  stats: Record<string, number>;
  bioShort: string;
  photoPath?: string | null;
  dateOfBirth?: string | null;
  guardianConsent?: boolean | null;
  sourceRegistrationId?: string | null;
};

export async function insertPlayer(sql: Sql, p: InsertPlayerInput): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into app.players(sport_id, full_name, role_key, sub_role, category, tags, nationality_group, stats,
      bio_short, photo_path, date_of_birth, guardian_consent, guardian_consent_at, source_registration_id)
    values (${p.sportId}, ${p.fullName}, ${p.roleKey}, ${p.subRole}, ${p.category}, ${p.tags}, ${p.nationalityGroup},
      ${sql.json(p.stats)}, ${p.bioShort}, ${p.photoPath ?? null}, ${p.dateOfBirth ?? null}, ${p.guardianConsent ?? null},
      ${p.guardianConsent ? new Date() : null}, ${p.sourceRegistrationId ?? null})
    returning id`;
  return rows[0]!.id;
}

export async function addPlayerToAuction(
  sql: Sql,
  input: { auctionId: string; playerId: string; basePrice: number; setName: string; setOrder: number; queuePosition?: number; previousTeamId?: string | null },
): Promise<string> {
  const rows = await sql<{ id: string }[]>`
    insert into app.auction_players(auction_id, player_id, base_price, set_name, set_order, queue_position, previous_team_id)
    values (${input.auctionId}, ${input.playerId}, ${input.basePrice}, ${input.setName}, ${input.setOrder},
      coalesce(${input.queuePosition ?? null}::int,
        (select coalesce(max(queue_position), 0) + 1 from app.auction_players where auction_id = ${input.auctionId})),
      ${input.previousTeamId ?? null})
    returning id`;
  return rows[0]!.id;
}

/** Base price for a player from the auction's category prices, else the default. */
export function basePriceFor(category: string | null, categoryPrices: Record<string, number>, defaultPrice: number) {
  if (category && categoryPrices[category] !== undefined) return categoryPrices[category]!;
  return defaultPrice;
}
