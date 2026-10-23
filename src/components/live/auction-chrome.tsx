"use client";

import { Projector } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Badge, statusTone } from "@/components/ui/badges";
import { formatDate, formatTime } from "@/lib/format";
import { ConnectionBanner, ConnectionIndicator, Price } from "./bits";
import { useLive } from "./live-provider";

/** Auction header: name, totals in the style of a broadcast scoreboard, status. */
export function AuctionTopBar() {
  const { snapshot, connection } = useLive();
  const { t, locale } = useI18n();
  const a = snapshot.auction;
  return (
    <>
      <ConnectionBanner state={connection} />
      {a.rehearsal ? (
        <p className="border-b border-paused bg-info-surface px-4 py-2 text-center text-sm font-semibold text-text">{t("common.rehearsalNote")}</p>
      ) : null}
      <div className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-5 sm:px-6 lg:grid-cols-[1fr_auto_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted">
              {a.sportName}
              {a.startsAt ? <span className="text-faint">{` / ${formatDate(a.startsAt, locale)}`}</span> : null}
            </p>
            <h1 className="mt-1 text-2xl text-accent-text sm:text-3xl">{a.name}</h1>
          </div>
          <dl className="grid grid-cols-2 divide-x divide-line rounded-[var(--radius-md)] border border-line bg-bg-sunken">
            <div className="px-4 py-2.5 text-center sm:px-6">
              <dt className="text-xs font-semibold text-muted">{t("live.totalSpent")}</dt>
              <dd className="mt-0.5 text-2xl font-bold text-spent sm:text-3xl">
                <Price value={snapshot.totals.spent} />
              </dd>
            </div>
            <div className="px-4 py-2.5 text-center sm:px-6">
              <dt className="text-xs font-semibold text-muted">{t("live.remaining")}</dt>
              <dd className="mt-0.5 text-2xl font-bold text-remaining sm:text-3xl">
                <Price value={snapshot.totals.remaining} />
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Badge tone={statusTone(a.status)} className="h-8 px-3 text-sm">
              {t(`status.${a.status}`)}
            </Badge>
            <ConnectionIndicator state={connection} compact />
          </div>
        </div>
        {snapshot.floor.rulesChangedAt && (a.status === "live" || a.status === "paused") ? (
          <p className="border-t border-line px-4 py-2 text-center text-sm text-muted">
            {t("live.rulesChanged", { time: formatTime(snapshot.floor.rulesChangedAt, locale) })}
          </p>
        ) : null}
      </div>
    </>
  );
}

const tabs = [
  { seg: "", key: "live" },
  { seg: "/teams", key: "teams" },
  { seg: "/players", key: "players" },
  { seg: "/queue", key: "queue" },
  { seg: "/results", key: "results" },
  { seg: "/stats", key: "stats" },
] as const;

export function AuctionTabs({ slug }: { slug: string }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const base = `/auctions/${slug}`;
  return (
    <div className="border-b border-line bg-bg">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 sm:px-6">
        <nav aria-label={t("live.tabsLabel")} className="scrollbar-thin -mb-px min-w-0 flex-1 overflow-x-auto">
          <ul className="flex">
            {tabs.map((tab) => {
              const href = `${base}${tab.seg}`;
              const active = pathname === href;
              return (
                <li key={tab.key}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className="inline-flex h-12 items-center whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-bold text-muted hover:border-line-strong hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text sm:px-4"
                  >
                    {t(`live.tab.${tab.key}`)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href={`${base}/screen`}
          className="hidden h-9 shrink-0 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold text-muted hover:border-text hover:text-text md:inline-flex"
        >
          <Projector className="size-4" aria-hidden="true" />
          {t("live.projector")}
        </Link>
      </div>
    </div>
  );
}
