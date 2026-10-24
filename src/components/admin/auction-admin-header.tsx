"use client";

import { Archive, CheckCheck, Pause, Play, Radio, RotateCcw, Send, Undo2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, statusTone } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormStatus } from "@/components/ui/field";
import { setAuctionStatusAction } from "@/lib/admin/actions/auctions";
import { useAdminAction } from "./use-admin-action";

type Status = "draft" | "scheduled" | "live" | "paused" | "completed" | "archived";

const moves: Record<Status, { to: Status; label: string; icon: typeof Play; primary?: boolean; consequences: string[]; reason?: boolean }[]> = {
  draft: [
    { to: "scheduled", label: "Publish", icon: Send, consequences: ["The public page, teams and players become visible to anyone with the link.", "Team owners can join with their codes.", "Bidding does not start until you go live."] },
    { to: "live", label: "Go live", icon: Radio, primary: true, consequences: ["The auction becomes visible and opens for bidding.", "You then put players on the floor from the console."] },
  ],
  scheduled: [
    { to: "live", label: "Go live", icon: Radio, primary: true, consequences: ["Bidding can start. You put players on the floor from the console.", "Rule changes from now on apply only to later bids and need a reason."] },
    { to: "draft", label: "Unpublish", icon: Undo2, consequences: ["The public page stops showing this auction.", "Team owners who already joined stay signed in."] },
  ],
  live: [
    { to: "paused", label: "Pause auction", icon: Pause, consequences: ["Nobody can bid until you resume.", "If a player is being bid on, the timer stops and keeps its remaining time."] },
    { to: "completed", label: "Complete", icon: CheckCheck, consequences: ["Bidding ends for good. Results become final.", "After this, results change only through audited corrections."] },
  ],
  paused: [
    { to: "live", label: "Resume auction", icon: Play, primary: true, consequences: ["Bidding is allowed again. If the floor was paused, resume it from the console."] },
    { to: "completed", label: "Complete", icon: CheckCheck, consequences: ["Bidding ends for good. Results become final."] },
  ],
  completed: [
    { to: "archived", label: "Archive", icon: Archive, consequences: ["The auction leaves the public list but its pages keep working by link.", "Team codes stop working."] },
    { to: "live", label: "Reopen", icon: RotateCcw, reason: true, consequences: ["Bidding becomes possible again. Use this only to fix a mistake."] },
  ],
  archived: [{ to: "completed", label: "Restore", icon: RotateCcw, consequences: ["The auction appears again as completed."] }],
};

export function AuctionAdminHeader({
  auction,
}: {
  auction: { id: string; name: string; slug: string; status: Status; sportName: string; rehearsal: boolean; isPublic: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [confirm, setConfirm] = useState<(typeof moves)[Status][number] | null>(null);
  const { run, pending, result, reset } = useAdminAction(setAuctionStatusAction);
  const base = `/admin/auctions/${auction.id}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/console`, label: "Console" },
    { href: `${base}/settings`, label: "Rules" },
    { href: `${base}/teams`, label: "Teams" },
    { href: `${base}/players`, label: "Players" },
    { href: `${base}/registrations`, label: "Registrations" },
    { href: `${base}/queue`, label: "Sets" },
    { href: `${base}/results`, label: "Results" },
    { href: `${base}/audit`, label: "Audit" },
  ];

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
        <Link href="/admin" className="link text-sm text-muted hover:text-text">
          All auctions
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(auction.status)}>{auction.status}</Badge>
              {auction.rehearsal ? <Badge tone="accent">Rehearsal</Badge> : null}
              {!auction.isPublic ? <Badge>Private</Badge> : null}
              <span className="text-sm text-muted">{auction.sportName}</span>
            </div>
            <h1 className="mt-2 text-2xl uppercase sm:text-3xl">{auction.name}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {moves[auction.status].map((m) => (
              <Button key={m.to} variant={m.primary ? "primary" : "secondary"} icon={<m.icon className="size-4" aria-hidden="true" />} onClick={() => { reset(); setConfirm(m); }}>
                {m.label}
              </Button>
            ))}
          </div>
        </div>
        {result && result.ok ? <div className="mt-3"><FormStatus kind="success">{result.message}</FormStatus></div> : null}
        <nav aria-label="Auction admin sections" className="-mb-px mt-4 overflow-x-auto scrollbar-thin">
          <ul className="flex min-w-max">
            {tabs.map((t) => (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={pathname === t.href ? "page" : undefined}
                  className="inline-flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-semibold text-muted hover:border-line-strong hover:text-text aria-[current=page]:border-accent aria-[current=page]:text-text"
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm ? `${confirm.label}?` : ""}
        consequences={confirm?.consequences ?? []}
        confirmLabel={confirm?.label ?? "Confirm"}
        busy={pending}
        requireReason={confirm?.reason}
        error={result && !result.ok ? result.error : null}
        danger={confirm?.to === "completed" || confirm?.to === "archived"}
        onConfirm={(reason) =>
          confirm &&
          run({ auctionId: auction.id, to: confirm.to, reason: reason || undefined }, (r) => {
            if (r.ok) {
              setConfirm(null);
              router.refresh();
            }
          })
        }
      />
    </div>
  );
}
