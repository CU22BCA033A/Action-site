"use client";

import { useEffect } from "react";

/** Broadcast views always use the dark scheme, whatever the viewer chose. */
export function ForceDark() {
  useEffect(() => {
    const el = document.documentElement;
    const before = el.getAttribute("data-theme");
    el.setAttribute("data-theme", "dark");
    return () => {
      if (before) el.setAttribute("data-theme", before);
    };
  }, []);
  return null;
}
