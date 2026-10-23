import "server-only";
import { db } from "@/lib/db";
import { getSnapshot } from "@/lib/live/engine";
import type { Snapshot } from "@/lib/live/types";

export type PoolEntry = {
  auctionPlayerId: string;
  lotNo: number;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  nationalityGroup: "domestic" | "overseas";
  setName: string;
  setOrder: number;
  basePrice: number;
  status: "pool" | "unsold";
  previousTeamId: string | null;
  consentMissing: boolean;
};

export type AuditEntry = { id: number; action: string; actorType: string; reason: string | null; createdAt: string; after: Record<string, unknown> | null };

export type ConsoleSnapshot = Snapshot & {
  pool: PoolEntry[];
  presence: Record<string, number>;
  audit: AuditEntry[];
};

/** Everything the admin console shows, in one request. Admin only. */
export async function getConsoleSnapshot(auctionId: string): Promise<ConsoleSnapshot | null> {
  const snapshot = await getSnapshot(auctionId);
  if (!snapshot) return null;
  const sql = db();
  const [pool, presence, audit] = await Promise.all([
    sql<PoolEntry[]>`
      select ap.id as "auctionPlayerId", ap.lot_no as "lotNo", p.full_name as "fullName", p.photo_path as "photoPath", p.role_key as "roleKey",
        p.sub_role as "subRole", p.category, p.nationality_group as "nationalityGroup", ap.set_name as "setName", ap.set_order as "setOrder",
        ap.base_price as "basePrice", ap.status, ap.previous_team_id as "previousTeamId",
        not app.player_is_public(p.date_of_birth, p.guardian_consent) as "consentMissing"
      from app.auction_players ap join app.players p on p.id = ap.player_id
      where ap.auction_id = ${auctionId} and ap.status in ('pool','unsold') and p.deleted_at is null
      order by ap.set_order, ap.queue_position, p.full_name`,
    sql<{ teamId: string; n: number }[]>`
      select s.team_id as "teamId", count(*)::int as n from app.team_sessions s join app.teams t on t.id = s.team_id
      where t.auction_id = ${auctionId} and s.revoked_at is null and s.expires_at > now() and s.last_seen_at > now() - interval '90 seconds'
      group by s.team_id`,
    sql<AuditEntry[]>`
      select id::int as id, action, actor_type as "actorType", reason, created_at as "createdAt", after
      from app.audit_log where auction_id = ${auctionId} order by id desc limit 25`,
  ]);
  return { ...snapshot, pool, presence: Object.fromEntries(presence.map((p) => [p.teamId, p.n])), audit };
}
