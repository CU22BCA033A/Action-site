import "server-only";
import { db } from "@/lib/db";

export type AuditRow = {
  id: number;
  auctionId: string | null;
  auctionName: string | null;
  actorType: string;
  actorId: string;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  reason: string | null;
  createdAt: string;
};

export async function listAudit(opts: { auctionId?: string; prefix?: string; beforeId?: number; limit?: number }): Promise<AuditRow[]> {
  const sql = db();
  const limit = Math.min(opts.limit ?? 100, 5000);
  return sql<AuditRow[]>`
    select l.id::int as id, l.auction_id as "auctionId", a.name as "auctionName", l.actor_type as "actorType", l.actor_id as "actorId",
      l.action, l.entity, l.entity_id as "entityId", l.before, l.after, l.reason, l.created_at as "createdAt"
    from app.audit_log l left join app.auctions a on a.id = l.auction_id
    where true
      ${opts.auctionId ? sql`and l.auction_id = ${opts.auctionId}` : sql``}
      ${opts.prefix ? sql`and l.action like ${`${opts.prefix.replace(/[%_]/g, "")}%`}` : sql``}
      ${opts.beforeId ? sql`and l.id < ${opts.beforeId}` : sql``}
    order by l.id desc limit ${limit}`;
}

export const AUDIT_GROUPS = [
  { value: "", label: "Everything" },
  { value: "bid.", label: "Bids" },
  { value: "floor.", label: "Floor" },
  { value: "rtm.", label: "Match cards" },
  { value: "result.", label: "Result corrections" },
  { value: "auction.", label: "Auction and rules" },
  { value: "team.", label: "Teams, codes and sessions" },
  { value: "player.", label: "Players" },
  { value: "registration.", label: "Registrations" },
  { value: "admin.", label: "Admin sign-ins" },
  { value: "sport.", label: "Sports" },
  { value: "privacy.", label: "Privacy and deletion" },
] as const;
