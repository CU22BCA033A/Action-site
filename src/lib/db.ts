import "server-only";
import postgres from "postgres";
import { getEnv } from "@/lib/env";

/**
 * One small connection pool per server instance. `prepare: false` keeps it
 * compatible with the Supabase connection pooler (transaction mode).
 */
type Sql = postgres.Sql<Record<string, never>>;

const globalForDb = globalThis as unknown as { __auctionSql?: Sql };

export function db(): Sql {
  if (!globalForDb.__auctionSql) {
    const { DATABASE_URL } = getEnv();
    globalForDb.__auctionSql = postgres(DATABASE_URL, {
      max: process.env.NODE_ENV === "production" ? 3 : 8,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
      transform: { undefined: null },
    }) as Sql;
  }
  return globalForDb.__auctionSql;
}

export type Tx = postgres.TransactionSql<Record<string, never>>;
