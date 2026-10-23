import type postgres from "postgres";
import { demoPlayers, demoTeams } from "@/lib/demo/demo-data";
import { sportConfigSchema, type AuctionDefaults } from "@/lib/sports/config";
import { addPlayerToAuction, basePriceFor, insertAuction, insertPlayer, insertTeam } from "./auctions";

type Sql = postgres.Sql<Record<string, never>> | postgres.TransactionSql<Record<string, never>>;

/**
 * Creates a self-contained rehearsal auction on invented demo data. It is
 * flagged rehearsal, never listed publicly, and never mixed with real results.
 */
export async function createDemoAuction(
  sql: Sql,
  input: { sportKey: string; name: string; slug: string; teamCount?: number; playerCount?: number; defaults?: AuctionDefaults },
): Promise<string> {
  const sports = await sql<{ id: string; config: unknown }[]>`select id, config from app.sports where key = ${input.sportKey}`;
  const sport = sports[0];
  if (!sport) throw new Error(`Sport ${input.sportKey} is not set up.`);
  const config = sportConfigSchema.parse(sport.config);
  const defaults = input.defaults ?? config.defaults;

  const auctionId = await insertAuction(sql, {
    sportId: sport.id,
    name: input.name,
    slug: input.slug,
    startsAt: null,
    isPublic: false,
    rehearsal: true,
    defaults,
  });

  const teams = demoTeams.slice(0, input.teamCount ?? 8);
  const teamIds: string[] = [];
  for (const t of teams) {
    teamIds.push(
      await insertTeam(sql, {
        auctionId,
        name: t.name,
        shortName: t.shortName,
        primaryColor: t.primaryColor,
        secondaryColor: t.secondaryColor,
        ownerDisplayName: t.owner,
        purseTotal: defaults.purse,
        rtmCards: defaults.rtmEnabled ? defaults.rtmCardsPerTeam : 0,
      }),
    );
  }

  const players = demoPlayers({
    roles: config.roles.filter((r) => !r.hidden).map((r) => ({ key: r.key, subRoles: r.subRoles })),
    categories: config.categories,
    statKeys: config.statFields.map((s) => ({ key: s.key, kind: s.kind })),
    count: input.playerCount ?? 48,
    overseasShare: defaults.maxOverseas > 0 ? 0.2 : 0,
    seed: input.slug.length * 31 + 7,
  });

  let position = 1;
  for (const [i, p] of players.entries()) {
    const playerId = await insertPlayer(sql, { sportId: sport.id, ...p, nationalityGroup: p.nationalityGroup });
    const previousTeamId = defaults.rtmEnabled && i % 5 === 0 ? (teamIds[i % teamIds.length] ?? null) : null;
    await addPlayerToAuction(sql, {
      auctionId,
      playerId,
      basePrice: basePriceFor(p.category, defaults.categoryBasePrices, defaults.defaultBasePrice),
      setName: p.setName,
      setOrder: p.setOrder,
      queuePosition: position++,
      previousTeamId,
    });
  }
  return auctionId;
}
