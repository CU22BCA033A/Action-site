"use client";

import { RotateCcw } from "lucide-react";
import { useT } from "@/components/i18n/i18n-provider";
import { Button, ButtonLink } from "@/components/ui/button";

export default function SiteError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center" role="alert">
      <p className="num text-6xl font-bold text-danger">500</p>
      <h1 className="mt-6 text-3xl uppercase">{t("errors.serverTitle")}</h1>
      <p className="mt-3 text-muted">{t("errors.serverBody")}</p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <Button variant="primary" size="lg" onClick={reset} icon={<RotateCcw className="size-4" aria-hidden="true" />}>
          {t("common.tryAgain")}
        </Button>
        <ButtonLink href="/" variant="secondary" size="lg">
          {t("errors.goHome")}
        </ButtonLink>
      </div>
    </div>
  );
}
