import "server-only";
import { getEnv } from "@/lib/env";
import type { LiveEvent } from "./types";

export function channelName(auctionId: string) {
  return `auction:${auctionId}`;
}

/**
 * Sends one event on the auction's public broadcast channel through the
 * Supabase Realtime REST endpoint. Never throws: clients also poll, so a
 * dropped event only delays an update by a few seconds.
 */
export async function broadcast(auctionId: string, event: LiveEvent): Promise<void> {
  const env = getEnv();
  if (!env.realtimeEnabled) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY!}`,
      },
      body: JSON.stringify({ messages: [{ topic: channelName(auctionId), event: "update", payload: event, private: false }] }),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // Polling covers a missed broadcast.
  } finally {
    clearTimeout(timer);
  }
}
