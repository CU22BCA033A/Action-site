import "server-only";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Slab } from "@/lib/rules/slabs";
import { sportConfigSchema, type AuctionDefaults, type SportConfig } from "@/lib/sports/config";

export type AdminAuctionRow = {
  id: string;
  slug: string;
  name: string;
  status: "draft" | "scheduled" | "live" | "paused" | "completed" | "archived";
  sportName: string;
  sportKey: string;
  startsAt: string | null;
  rehearsal: boolean;
  public: boolean;
  teamCount: number;
  playerCount: number;
  soldCount: number;
  pendingRegistrations: number;
  updatedAt: string;
};

export async function listAdminAuctions(): Promise<AdminAuctionRow[]> {
  return db()<AdminAuctionRow[]>`
    select a.id, a.slug, a.name, a.status, s.name as "sportName", s.key as "sportKey", a.starts_at as "startsAt",
      a.rehearsal, a.public, a.updated_at as "updatedAt",
      (select count(*)::int from app.teams t where t.auction_id = a.id and t.deleted_at is null) as "teamCount",
      (select count(*)::int from app.auction_players ap where ap.auction_id = a.id) as "playerCount",
      (select count(*)::int from app.auction_players ap where ap.auction_id = a.id and ap.status = 'sold') as "soldCount",
      (select count(*)::int from app.player_registrations r where r.auction_id = a.id and r.status = 'pending') as "pendingRegistrations"
    from app.auctions a join app.sports s on s.id = a.sport_id
    where a.deleted_at is null
    order by case a.status when 'live' then 0 when 'paused' then 1 when 'scheduled' then 2 when 'draft' then 3 when 'completed' then 4 else 5 end,
      a.created_at desc`;
}

export type AdminAuction = {
  id: string;
  slug: string;
  name: string;
  status: AdminAuctionRow["status"];
  sportId: string;
  sportKey: string;
  sportName: string;
  sportConfig: SportConfig;
  startsAt: string | null;
  pointsUnitLabel: string;
  purse: number;
  squadMin: number;
  squadMax: number;
  maxOverseas: number;
  roleMinimums: Record<string, number>;
  roleMaximums: Record<string, number>;
  defaultBasePrice: number;
  categoryBasePrices: Record<string, number>;
  reserveRuleEnabled: boolean;
  bidTimerSeconds: number | null;
  timerExtensionSeconds: number | null;
  rtmEnabled: boolean;
  rtmLabel: "RTM" | "FBM";
  rtmAllowFinalRaise: boolean;
  rtmCardsPerTeam: number;
  retentionsEnabled: boolean;
  maxRetentions: number;
  isPublic: boolean;
  registrationOpen: boolean;
  rehearsal: boolean;
  settingsVersion: number;
  rulesChangedAt: string | null;
  currentRound: number;
  slabs: Slab[];
};

export async function getAdminAuction(id: string): Promise<AdminAuction> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const rows = await db()<(Omit<AdminAuction, "slabs" | "sportConfig"> & { sportConfig: unknown })[]>`
    select a.id, a.slug, a.name, a.status, a.sport_id as "sportId", s.key as "sportKey", s.name as "sportName", s.config as "sportConfig",
      a.starts_at as "startsAt", a.points_unit_label as "pointsUnitLabel", a.purse_per_team as purse,
      a.squad_min as "squadMin", a.squad_max as "squadMax", a.max_overseas as "maxOverseas",
      a.role_minimums as "roleMinimums", a.role_maximums as "roleMaximums",
      a.default_base_price as "defaultBasePrice", a.category_base_prices as "categoryBasePrices",
      a.reserve_rule_enabled as "reserveRuleEnabled", a.bid_timer_seconds as "bidTimerSeconds",
      a.timer_extension_seconds as "timerExtensionSeconds", a.rtm_enabled as "rtmEnabled", a.rtm_label as "rtmLabel",
      a.rtm_allow_final_raise as "rtmAllowFinalRaise", a.rtm_cards_per_team as "rtmCardsPerTeam",
      a.retentions_enabled as "retentionsEnabled", a.max_retentions as "maxRetentions",
      a.public as "isPublic", a.registration_open as "registrationOpen", a.rehearsal,
      a.settings_version::int as "settingsVersion", a.rules_changed_at as "rulesChangedAt", a.current_round as "currentRound"
    from app.auctions a join app.sports s on s.id = a.sport_id
    where a.id = ${id} and a.deleted_at is null`;
  const a = rows[0];
  if (!a) notFound();
  const slabs = await db()<Slab[]>`
    select from_points as "from", to_points as "to", increment_points as increment
    from app.bid_slabs where auction_id = ${id} order by from_points`;
  return { ...a, sportConfig: sportConfigSchema.parse(a.sportConfig), slabs };
}

/** The current settings as the defaults shape, for "reset" and presets. */
export function auctionToDefaults(a: AdminAuction): AuctionDefaults {
  return {
    pointsUnitLabel: a.pointsUnitLabel,
    purse: a.purse,
    squadMin: a.squadMin,
    squadMax: a.squadMax,
    maxOverseas: a.maxOverseas,
    roleMinimums: a.roleMinimums,
    roleMaximums: a.roleMaximums,
    defaultBasePrice: a.defaultBasePrice,
    categoryBasePrices: a.categoryBasePrices,
    slabs: a.slabs,
    bidTimerSeconds: a.bidTimerSeconds,
    timerExtensionSeconds: a.timerExtensionSeconds,
    reserveRuleEnabled: a.reserveRuleEnabled,
    rtmEnabled: a.rtmEnabled,
    rtmLabel: a.rtmLabel,
    rtmAllowFinalRaise: a.rtmAllowFinalRaise,
    rtmCardsPerTeam: a.rtmCardsPerTeam,
    retentionsEnabled: a.retentionsEnabled,
    maxRetentions: a.maxRetentions,
  };
}

export type AdminTeam = {
  id: string;
  name: string;
  shortName: string;
  logoPath: string | null;
  primaryColor: string;
  secondaryColor: string;
  ownerDisplayName: string;
  purseTotal: number;
  purseSpent: number;
  rtmCardsLeft: number;
  maxSessions: number;
  version: number;
  squadCount: number;
  codeActive: boolean;
  codeHint: string | null;
  codeCreatedAt: string | null;
  sessions: { id: string; userAgent: string; createdAt: string; lastSeenAt: string }[];
};

export async function listAdminTeams(auctionId: string): Promise<AdminTeam[]> {
  const teams = await db()<Omit<AdminTeam, "sessions">[]>`
    select t.id, t.name, t.short_name as "shortName", t.logo_path as "logoPath", t.primary_color as "primaryColor",
      t.secondary_color as "secondaryColor", t.owner_display_name as "ownerDisplayName", t.purse_total as "purseTotal",
      t.purse_spent as "purseSpent", t.rtm_cards_left as "rtmCardsLeft", t.max_sessions as "maxSessions", t.version::int as version,
      (select count(*)::int from app.auction_players ap where ap.sold_to_team_id = t.id and ap.status in ('sold','retained')) as "squadCount",
      c.id is not null as "codeActive", c.code_hint as "codeHint", c.created_at as "codeCreatedAt"
    from app.teams t
    left join app.team_access_codes c on c.team_id = t.id and c.active
    where t.auction_id = ${auctionId} and t.deleted_at is null
    order by t.name`;
  const sessions = await db()<{ id: string; teamId: string; userAgent: string; createdAt: string; lastSeenAt: string }[]>`
    select s.id, s.team_id as "teamId", s.user_agent as "userAgent", s.created_at as "createdAt", s.last_seen_at as "lastSeenAt"
    from app.team_sessions s join app.teams t on t.id = s.team_id
    where t.auction_id = ${auctionId} and s.revoked_at is null and s.expires_at > now()
    order by s.last_seen_at desc`;
  return teams.map((t) => ({ ...t, sessions: sessions.filter((s) => s.teamId === t.id) }));
}

export type AdminPlayer = {
  auctionPlayerId: string;
  playerId: string;
  lotNo: number;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  tags: string[];
  nationalityGroup: "domestic" | "overseas";
  stats: Record<string, number>;
  bioShort: string;
  dateOfBirth: string | null;
  guardianConsent: boolean | null;
  setName: string;
  setOrder: number;
  queuePosition: number;
  basePrice: number;
  status: "pool" | "on_floor" | "sold" | "unsold" | "retained";
  soldToTeamId: string | null;
  soldPrice: number | null;
  previousTeamId: string | null;
  round: number;
  version: number;
};

export async function listAdminPlayers(auctionId: string): Promise<AdminPlayer[]> {
  return db()<AdminPlayer[]>`
    select ap.id as "auctionPlayerId", p.id as "playerId", ap.lot_no as "lotNo", p.full_name as "fullName", p.photo_path as "photoPath",
      p.role_key as "roleKey", p.sub_role as "subRole", p.category, p.tags, p.nationality_group as "nationalityGroup", p.stats,
      p.bio_short as "bioShort", to_char(p.date_of_birth, 'YYYY-MM-DD') as "dateOfBirth", p.guardian_consent as "guardianConsent",
      ap.set_name as "setName", ap.set_order as "setOrder", ap.queue_position as "queuePosition", ap.base_price as "basePrice",
      ap.status, ap.sold_to_team_id as "soldToTeamId", ap.sold_price as "soldPrice", ap.previous_team_id as "previousTeamId",
      ap.round, p.version::int as version
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = ${auctionId} and p.deleted_at is null
    order by ap.set_order, ap.queue_position, p.full_name`;
}

export type AdminRegistration = {
  id: string;
  referenceId: string;
  fullName: string;
  roleKey: string;
  subRole: string | null;
  nationalityGroup: "domestic" | "overseas";
  photoPath: string | null;
  stats: Record<string, number>;
  bioShort: string;
  dateOfBirth: string | null;
  guardianConsent: boolean | null;
  status: "pending" | "approved" | "rejected";
  rejectionReason: string | null;
  createdAt: string;
  version: number;
};

export async function listRegistrations(auctionId: string): Promise<AdminRegistration[]> {
  return db()<AdminRegistration[]>`
    select id, reference_id as "referenceId", full_name as "fullName", role_key as "roleKey", sub_role as "subRole",
      nationality_group as "nationalityGroup", photo_path as "photoPath", stats, bio_short as "bioShort",
      to_char(date_of_birth, 'YYYY-MM-DD') as "dateOfBirth", guardian_consent as "guardianConsent", status,
      rejection_reason as "rejectionReason", created_at as "createdAt", version::int as version
    from app.player_registrations where auction_id = ${auctionId}
    order by case status when 'pending' then 0 when 'approved' then 1 else 2 end, created_at`;
}

export async function listSportsAdmin() {
  const rows = await db()<{ id: string; key: string; name: string; config: unknown; version: number; auctionCount: number }[]>`
    select s.id, s.key, s.name, s.config, s.version::int as version,
      (select count(*)::int from app.auctions a where a.sport_id = s.id and a.deleted_at is null) as "auctionCount"
    from app.sports s order by s.sort_order, s.name`;
  return rows.map((r) => ({ ...r, config: sportConfigSchema.parse(r.config) }));
}

export async function listPresets(sportId?: string) {
  const rows = await db()<{ id: string; sportId: string; name: string; description: string; isExample: boolean; config: AuctionDefaults; version: number }[]>`
    select id, sport_id as "sportId", name, description, is_example as "isExample", config, version::int as version
    from app.sport_presets ${sportId ? db()`where sport_id = ${sportId}` : db()``} order by is_example desc, name`;
  return rows;
}
