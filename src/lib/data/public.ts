import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getSnapshot } from "@/lib/live/engine";
import type { PublicPlayer, Snapshot } from "@/lib/live/types";
import { sportConfigSchema, type SportConfig } from "@/lib/sports/config";

/**
 * Public read queries. Only public-safe columns ever leave these functions.
 * Rehearsal and private auctions are never listed, but rehearsal auctions
 * open by direct link so a practice run can be watched.
 */

export type AuctionListItem = {
  id: string;
  slug: string;
  name: string;
  status: string;
  startsAt: string | null;
  sportKey: string;
  sportName: string;
  teamCount: number;
  playerCount: number;
  soldCount: number;
  updatedAt: string;
};

export async function listPublicAuctions(): Promise<AuctionListItem[]> {
  return db()<AuctionListItem[]>`
    select a.id, a.slug, a.name, a.status, a.starts_at as "startsAt", s.key as "sportKey", s.name as "sportName",
      (select count(*)::int from app.teams t where t.auction_id = a.id and t.deleted_at is null) as "teamCount",
      (select count(*)::int from app.auction_players ap where ap.auction_id = a.id) as "playerCount",
      (select count(*)::int from app.auction_players ap where ap.auction_id = a.id and ap.status = 'sold') as "soldCount",
      a.updated_at as "updatedAt"
    from app.auctions a join app.sports s on s.id = a.sport_id
    where a.deleted_at is null and a.public and not a.rehearsal and a.status in ('scheduled','live','paused','completed')
    order by case a.status when 'live' then 0 when 'paused' then 1 when 'scheduled' then 2 else 3 end,
      a.starts_at desc nulls last, a.created_at desc`;
}

export const getAuctionIdBySlug = cache(async (slug: string) => {
  const rows = await db()<{ id: string; public: boolean; rehearsal: boolean; status: string }[]>`
    select id, public, rehearsal, status from app.auctions where slug = ${slug} and deleted_at is null`;
  const r = rows[0];
  // Drafts are not public. Private auctions open only by direct link once scheduled.
  if (!r || r.status === "draft") return null;
  return r;
});

export const getPublicSnapshot = cache(async (slug: string): Promise<Snapshot | null> => {
  const a = await getAuctionIdBySlug(slug);
  if (!a) return null;
  return getSnapshot(a.id);
});

export type PlayerRow = PublicPlayer & {
  auctionPlayerId: string;
  lotNo: number;
  status: string;
  basePrice: number;
  setName: string;
  setOrder: number;
  queuePosition: number;
  soldToTeamId: string | null;
  soldPrice: number | null;
};

export async function listAuctionPlayers(auctionId: string): Promise<PlayerRow[]> {
  return db()<PlayerRow[]>`
    select p.id, p.full_name as "fullName", p.photo_path as "photoPath", p.role_key as "roleKey", p.sub_role as "subRole",
      p.category, p.tags, p.nationality_group as "nationalityGroup", p.stats, p.bio_short as "bioShort",
      app.age_group(p.date_of_birth) as "ageGroup",
      ap.id as "auctionPlayerId", ap.lot_no as "lotNo", ap.status, ap.base_price as "basePrice", ap.set_name as "setName", ap.set_order as "setOrder",
      ap.queue_position as "queuePosition", ap.sold_to_team_id as "soldToTeamId", ap.sold_price as "soldPrice"
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.auction_id = ${auctionId} and p.deleted_at is null and app.player_is_public(p.date_of_birth, p.guardian_consent)
    order by ap.set_order, ap.queue_position, p.full_name`;
}

export async function getPublicPlayer(playerId: string) {
  const rows = await db()<(PublicPlayer & { sportKey: string; sportName: string; sportConfig: SportConfig })[]>`
    select p.id, p.full_name as "fullName", p.photo_path as "photoPath", p.role_key as "roleKey", p.sub_role as "subRole",
      p.category, p.tags, p.nationality_group as "nationalityGroup", p.stats, p.bio_short as "bioShort",
      app.age_group(p.date_of_birth) as "ageGroup", s.key as "sportKey", s.name as "sportName", s.config as "sportConfig"
    from app.players p join app.sports s on s.id = p.sport_id
    where p.id = ${playerId} and p.deleted_at is null and app.player_is_public(p.date_of_birth, p.guardian_consent)`;
  const player = rows[0];
  if (!player) return null;
  const auctions = await db()<
    { slug: string; name: string; status: string; basePrice: number; playerStatus: string; soldPrice: number | null; teamId: string | null; teamName: string | null; teamShort: string | null; teamColor: string | null; teamLogo: string | null; pointsUnitLabel: string }[]
  >`
    select a.slug, a.name, a.status, ap.base_price as "basePrice", ap.status as "playerStatus", ap.sold_price as "soldPrice",
      t.id as "teamId", t.name as "teamName", t.short_name as "teamShort", t.primary_color as "teamColor", t.logo_path as "teamLogo",
      a.points_unit_label as "pointsUnitLabel"
    from app.auction_players ap join app.auctions a on a.id = ap.auction_id
    left join app.teams t on t.id = ap.sold_to_team_id
    where ap.player_id = ${playerId} and a.deleted_at is null and a.public and not a.rehearsal and a.status <> 'draft'
    order by a.starts_at desc nulls last`;
  return { player: { ...player, sportConfig: sportConfigSchema.parse(player.sportConfig) }, auctions };
}

export async function getPublicTeam(teamId: string) {
  const rows = await db()<{ auctionId: string; slug: string; public: boolean; status: string }[]>`
    select a.id as "auctionId", a.slug, a.public, a.status from app.teams t join app.auctions a on a.id = t.auction_id
    where t.id = ${teamId} and t.deleted_at is null and a.deleted_at is null and a.status <> 'draft'`;
  const r = rows[0];
  if (!r) return null;
  const snapshot = await getSnapshot(r.auctionId);
  if (!snapshot) return null;
  const team = snapshot.teams.find((t) => t.id === teamId);
  if (!team) return null;
  const squad = (await listAuctionPlayers(r.auctionId)).filter((p) => p.soldToTeamId === teamId && (p.status === "sold" || p.status === "retained"));
  return { snapshot, team, squad };
}

export async function listSports() {
  const rows = await db()<{ id: string; key: string; name: string; config: unknown; auctionCount: number }[]>`
    select s.id, s.key, s.name, s.config,
      (select count(*)::int from app.auctions a where a.sport_id = s.id and a.public and not a.rehearsal and a.deleted_at is null and a.status <> 'draft') as "auctionCount"
    from app.sports s order by s.sort_order, s.name`;
  return rows.map((r) => ({ ...r, config: sportConfigSchema.parse(r.config) }));
}

export type SearchResult = { kind: "auction" | "team" | "player" | "page"; title: string; subtitle: string; href: string };

export async function searchPublic(q: string): Promise<SearchResult[]> {
  const term = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
  const auctions = await db()<{ slug: string; name: string; sport: string; status: string }[]>`
    select a.slug, a.name, s.name as sport, a.status from app.auctions a join app.sports s on s.id = a.sport_id
    where a.deleted_at is null and a.public and not a.rehearsal and a.status <> 'draft' and a.name ilike ${term}
    order by a.created_at desc limit 8`;
  const teams = await db()<{ id: string; name: string; auction: string }[]>`
    select t.id, t.name, a.name as auction from app.teams t join app.auctions a on a.id = t.auction_id
    where t.deleted_at is null and a.deleted_at is null and a.public and not a.rehearsal and a.status <> 'draft' and t.name ilike ${term}
    order by t.name limit 8`;
  const players = await db()<{ id: string; name: string; sport: string }[]>`
    select distinct on (p.id) p.id, p.full_name as name, s.name as sport
    from app.players p join app.sports s on s.id = p.sport_id
    join app.auction_players ap on ap.player_id = p.id join app.auctions a on a.id = ap.auction_id
    where p.deleted_at is null and a.deleted_at is null and a.public and not a.rehearsal and a.status <> 'draft'
      and app.player_is_public(p.date_of_birth, p.guardian_consent) and p.full_name ilike ${term}
    order by p.id limit 12`;
  return [
    ...auctions.map((a) => ({ kind: "auction" as const, title: a.name, subtitle: a.sport, href: `/auctions/${a.slug}` })),
    ...teams.map((t) => ({ kind: "team" as const, title: t.name, subtitle: t.auction, href: `/teams/${t.id}` })),
    ...players.map((p) => ({ kind: "player" as const, title: p.name, subtitle: p.sport, href: `/players/${p.id}` })),
  ];
}

export async function getAuctionStats(auctionId: string) {
  const rows = await db()<{ s: import("@/lib/live/types").AuctionStats }[]>`select app.auction_stats(${auctionId}) as s`;
  return rows[0]!.s;
}
