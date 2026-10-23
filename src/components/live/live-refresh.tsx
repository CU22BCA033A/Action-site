"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useLiveOptional } from "./live-provider";

/**
 * Re-renders a server page when the auction changes, so every tab stays
 * current without its own subscription. Debounced to one refresh per burst.
 */
export function LiveRefresh({ delayMs = 1200 }: { delayMs?: number }) {
  const live = useLiveOptional();
  const router = useRouter();
  const seq = live?.snapshot.floor.eventSeq;
  const first = useRef(seq);
  useEffect(() => {
    if (seq === undefined || seq === first.current) return;
    const id = setTimeout(() => router.refresh(), delayMs);
    return () => clearTimeout(id);
  }, [seq, router, delayMs]);
  return null;
}
