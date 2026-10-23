"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useT } from "@/components/i18n/i18n-provider";
import { buttonClass } from "./button";

export function CopyButton({ value, label, size = "sm", className = "" }: { value: string; label?: string; size?: "sm" | "md"; className?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 2200);
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copy} className={buttonClass("secondary", size, className)}>
        {state === "copied" ? <Check className="size-4 text-sold" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
        <span>{state === "copied" ? t("common.copied") : (label ?? t("common.copy"))}</span>
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {state === "copied" ? t("common.copied") : ""}
      </span>
      {state === "failed" ? <span className="text-sm text-danger">{t("common.copyFailed")}</span> : null}
    </span>
  );
}
