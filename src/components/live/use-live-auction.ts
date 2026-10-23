"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveEvent, Snapshot } from "@/lib/live/types";

export type ConnectionState = "connected" | "reconnecting" | "offline";

const POLL_MS = 3000;
const SAFETY_POLL_MS = 30000;

/**
 * Keeps an auction snapshot live. Uses the Supabase broadcast channel when
 * configured and falls back to polling every 3 seconds. Every event carries
 * a sequence number; a gap triggers a full snapshot refetch, so no update is
 * ever missed or applied twice.
 */
export function useLiveAuction<T extends Snapshot>(initial: T, snapshotUrl: string) {
  const [snapshot, setSnapshot] = useState<T>(initial);
  const [connection, setConnection] = useState<ConnectionState>("connected");
  const [clockOffset, setClockOffset] = useState(() => offsetFrom(initial.serverTime));
  const seqRef = useRef<number>(initial.floor.eventSeq);
  const realtimeUp = useRef(false);
  const inflight = useRef<Promise<void> | null>(null);
  const queued = useRef(false);
  const refetchRef = useRef<() => Promise<void>>(async () => {});
  const auctionId = initial.auction.id;

  const apply = useCallback((next: T) => {
    if (next.floor.eventSeq < seqRef.current) return;
    seqRef.current = next.floor.eventSeq;
    setClockOffset(offsetFrom(next.serverTime));
    setSnapshot(next);
  }, []);

  const refetch = useCallback(async () => {
    if (inflight.current) {
      queued.current = true;
      return inflight.current;
    }
    const run = (async () => {
      try {
        const res = await fetch(snapshotUrl, { cache: "no-store", headers: { accept: "application/json" } });
        if (!res.ok) throw new Error(String(res.status));
        apply((await res.json()) as T);
        setConnection("connected");
      } catch {
        setConnection(navigator.onLine ? "reconnecting" : "offline");
      }
    })();
    inflight.current = run;
    await run;
    inflight.current = null;
    if (queued.current) {
      queued.current = false;
      void refetchRef.current();
    }
  }, [apply, snapshotUrl]);

  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const handleEvent = useCallback(
    (e: LiveEvent) => {
      if (e.seq <= seqRef.current) return; // already applied
      if (e.seq !== seqRef.current + 1 || e.kind === "refresh") {
        void refetch();
        return;
      }
      seqRef.current = e.seq;
      setClockOffset(offsetFrom(e.floor.serverTime));
      setSnapshot((prev) => {
        const next = { ...prev, floor: e.floor };
        if (e.kind === "bid") next.bids = [e.bid, ...prev.bids.filter((b) => b.id !== e.bid.id)].slice(0, 20);
        return next;
      });
    },
    [refetch],
  );

  // Realtime channel.
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void import("@supabase/supabase-js").then(({ createClient }) => {
      if (cancelled) return;
      const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      const channel = client
        .channel(`auction:${auctionId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "update" }, (msg) => handleEvent(msg.payload as LiveEvent))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") {
            realtimeUp.current = true;
            setConnection("connected");
            void refetch();
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            realtimeUp.current = false;
            setConnection(navigator.onLine ? "reconnecting" : "offline");
          }
        });
      cleanup = () => {
        void client.removeChannel(channel);
      };
    });
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [auctionId, handleEvent, refetch]);

  // Polling: every 3 seconds without a live channel, every 30 as a safety net.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (document.visibilityState === "visible" || !realtimeUp.current) await refetch();
      timer = setTimeout(tick, realtimeUp.current ? SAFETY_POLL_MS : POLL_MS);
    };
    timer = setTimeout(tick, realtimeUp.current ? SAFETY_POLL_MS : POLL_MS);
    const online = () => {
      setConnection("reconnecting");
      void refetch();
    };
    const offline = () => setConnection("offline");
    const visible = () => {
      if (document.visibilityState === "visible") void refetch();
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visible);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refetch]);

  /** Server-corrected "now" in milliseconds. */
  const serverNow = useCallback(() => Date.now() + clockOffset, [clockOffset]);

  return { snapshot, setSnapshot: apply, connection, refetch, serverNow };
}

function offsetFrom(serverTime: string): number {
  const t = Date.parse(serverTime);
  return Number.isNaN(t) ? 0 : t - Date.now();
}

/** Seconds left on the floor timer, using the server clock. */
export function useCountdown(timerEndsAt: string | null, serverNow: () => number): number | null {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    if (!timerEndsAt) return;
    const id = setInterval(() => setNow(serverNow()), 250);
    return () => clearInterval(id);
  }, [timerEndsAt, serverNow]);
  return compute(timerEndsAt, now);
}

function compute(end: string | null, now: number): number | null {
  if (!end) return null;
  return Math.max(0, Math.ceil((Date.parse(end) - now) / 1000));
}
