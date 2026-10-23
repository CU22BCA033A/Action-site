import { NextResponse } from "next/server";
import { csvTemplateExample, csvTemplateHeader } from "@/lib/admin/player-input";
import { getAdminSession } from "@/lib/auth/admin";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { sportConfigSchema } from "@/lib/sports/config";

/** CSV template built from this auction's sport: roles, categories and stat columns. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new NextResponse("Sign in first.", { status: 401 });
  const { id } = await params;
  const row = (await db()<{ config: unknown; slug: string }[]>`
    select s.config, a.slug from app.auctions a join app.sports s on s.id = a.sport_id where a.id = ${id} and a.deleted_at is null`)[0];
  if (!row) return new NextResponse("Not found.", { status: 404 });
  const config = sportConfigSchema.parse(row.config);
  const csv = toCsv(csvTemplateHeader(config), [csvTemplateExample(config)]);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${row.slug}-players-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
