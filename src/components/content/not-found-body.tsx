import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";

export async function NotFoundBody() {
  const { t } = await getT();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-20 text-center">
      <p className="num text-6xl font-bold text-accent-text">404</p>
      <Compass className="mt-6 size-10 text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-3xl uppercase">{t("errors.notFoundTitle")}</h1>
      <p className="mt-3 text-muted">{t("errors.notFoundBody")}</p>
      <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
        <ButtonLink href="/" variant="primary" size="lg">
          {t("errors.goHome")}
        </ButtonLink>
        <ButtonLink href="/auctions" variant="secondary" size="lg">
          {t("errors.goAuctions")}
        </ButtonLink>
        <ButtonLink href="/search" variant="ghost" size="lg">
          {t("nav.search")}
        </ButtonLink>
      </div>
    </div>
  );
}
