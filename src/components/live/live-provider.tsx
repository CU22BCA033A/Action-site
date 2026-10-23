"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Snapshot } from "@/lib/live/types";
import { useLiveAuction, type ConnectionState } from "./use-live-auction";

type LiveCtx = {
  snapshot: Snapshot;
  connection: ConnectionState;
  serverNow: () => number;
  refetch: () => Promise<void>;
};

const Ctx = createContext<LiveCtx | null>(null);

/** One live subscription per auction, shared by every tab underneath. */
export function LiveProvider({ initial, snapshotUrl, children }: { initial: Snapshot; snapshotUrl: string; children: ReactNode }) {
  const live = useLiveAuction(initial, snapshotUrl);
  return <Ctx value={{ snapshot: live.snapshot, connection: live.connection, serverNow: live.serverNow, refetch: live.refetch }}>{children}</Ctx>;
}

export function useLive(): LiveCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLive must be used inside LiveProvider");
  return c;
}

export function useLiveOptional(): LiveCtx | null {
  return useContext(Ctx);
}
