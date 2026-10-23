import "server-only";
import { db } from "@/lib/db";
import { getSnapshot } from "@/lib/live/engine";
import type { Snapshot } from "@/lib/live/types";
import type { TeamSession } from "@/lib/auth/team";

export type ShortlistEntry = {
  auctionPlayerId: string;
  lotNo: number;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  nationalityGroup: "domestic" | "overseas";
  basePrice: number;
  status: string;
  soldToTeamId: string | null;
  soldPrice: number | null;
};

export type SquadEntry = Omit<ShortlistEntry, "status" | "soldToTeamId"> & { status: "sold" | "retained" };

export type ManagerSnapshot = Snapshot & {
  me: { teamId: string; shortlist: ShortlistEntry[]; squad: SquadEntry[] };
};

/**
 * The public snapshot plus the one team's private data. The team always
 * comes from the verified session, never from the request.
 */
export async function getManagerSnapshot(session: TeamSession): Promise<ManagerSnapshot | null> {
  const snapshot = await getSnapshot(session.auctionId);
  if (!snapshot) return null;
  const sql = db();
  const shortlist = await sql<ShortlistEntry[]>`
    select ap.id as "auctionPlayerId", ap.lot_no as "lotNo", p.full_name as "fullName", p.photo_path as "photoPath",
      p.role_key as "roleKey", p.sub_role as "subRole", p.nationality_group as "nationalityGroup",
      ap.base_price as "basePrice", ap.status, ap.sold_to_team_id as "soldToTeamId", ap.sold_price as "soldPrice"
    from app.shortlists s
    join app.auction_players ap on ap.id = s.auction_player_id
    join app.players p on p.id = ap.player_id
    where s.team_id = ${session.teamId} and ap.auction_id = ${session.auctionId} and p.deleted_at is null
    order by ap.set_order, ap.queue_position`;
  const squad = await sql<SquadEntry[]>`
    select ap.id as "auctionPlayerId", ap.lot_no as "lotNo", p.full_name as "fullName", p.photo_path as "photoPath",
      p.role_key as "roleKey", p.sub_role as "subRole", p.nationality_group as "nationalityGroup",
      ap.base_price as "basePrice", ap.status, ap.sold_price as "soldPrice"
    from app.auction_players ap join app.players p on p.id = ap.player_id
    where ap.sold_to_team_id = ${session.teamId} and ap.status in ('sold','retained')
    order by p.role_key, ap.sold_at`;
  return { ...snapshot, me: { teamId: session.teamId, shortlist, squad } };
}

export async function setShortlisted(session: TeamSession, auctionPlayerId: string, on: boolean): Promise<boolean> {
  const sql = db();
  const owned = await sql`select 1 from app.auction_players where id = ${auctionPlayerId} and auction_id = ${session.auctionId}`;
  if (owned.length === 0) return false;
  if (on) {
    await sql`insert into app.shortlists(team_id, auction_player_id) values (${session.teamId}, ${auctionPlayerId}) on conflict do nothing`;
  } else {
    await sql`delete from app.shortlists where team_id = ${session.teamId} and auction_player_id = ${auctionPlayerId}`;
  }
  return true;
}
