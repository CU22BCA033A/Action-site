import { listAudit } from "@/lib/admin/audit";
import { getAdminSession } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";

export async function GET(req: Request) {
  if (!(await getAdminSession())) return new Response("Sign in first.", { status: 401 });
  const url = new URL(req.url);
  const auctionId = url.searchParams.get("auctionId") ?? undefined;
  if (auctionId && !/^[0-9a-f-]{36}$/i.test(auctionId)) return new Response("Not found", { status: 404 });
  const rows = await listAudit({ auctionId, prefix: url.searchParams.get("group") ?? "", limit: 5000 });
  const csv = toCsv(
    ["id", "time", "auction", "actor_type", "actor_id", "action", "entity", "entity_id", "before", "after", "reason"],
    rows.map((r) => [r.id, new Date(r.createdAt).toISOString(), r.auctionName ?? "", r.actorType, r.actorId, r.action, r.entity, r.entityId, JSON.stringify(r.before ?? null), JSON.stringify(r.after ?? null), r.reason ?? ""]),
  );
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="audit-log.csv"', "Cache-Control": "no-store" } });
}
