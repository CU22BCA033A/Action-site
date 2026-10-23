"use client";

import { Download, Printer, Wrench } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PlayerAvatar, TeamMark } from "@/components/auction/identity";
import { Badge } from "@/components/ui/badges";
import { ButtonLink, Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field, Input, Select, SelectWrap } from "@/components/ui/field";
import { correctResultAction } from "@/lib/admin/actions/results";
import type { AdminPlayer, AdminTeam } from "@/lib/admin/queries";
import { formatPoints } from "@/lib/format";
import { useAdminAction } from "./use-admin-action";

type Kind = "price" | "move" | "return";

export function ResultsManager({ players, teams, ctx }: { players: AdminPlayer[]; teams: AdminTeam[]; ctx: { auctionId: string; slug: string; unit: string; status: string } }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ p: AdminPlayer; kind: Kind } | null>(null);
  const [price, setPrice] = useState("");
  const [teamId, setTeamId] = useState("");
  const run = useAdminAction(correctResultAction);
  const done = players.filter((p) => p.status === "sold" || p.status === "retained").sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));
  const unsold = players.filter((p) => p.status === "unsold");
  const team = (id: string | null) => teams.find((t) => t.id === id);

  const open = (p: AdminPlayer, kind: Kind) => {
    run.reset();
    setPrice(String(p.soldPrice ?? 0));
    setTeamId(teams.find((t) => t.id !== p.soldToTeamId)?.id ?? "");
    setTarget({ p, kind });
  };
  const t = target;
  const from = t ? team(t.p.soldToTeamId) : undefined;
  const to = team(teamId);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted">{done.length} sold or retained, {unsold.length} unsold. Corrections recalculate both teams&apos; purses and squads together and are written to the audit log.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/api/auctions/${ctx.slug}/export/results`} icon={<Download className="size-4" aria-hidden="true" />}>Results CSV</ButtonLink>
          <ButtonLink href={`/admin/auctions/${ctx.auctionId}/results/print`} target="_blank" icon={<Printer className="size-4" aria-hidden="true" />}>Print or save as PDF</ButtonLink>
        </div>
      </div>
      <ul className="mt-5 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
        {done.length === 0 ? <li className="p-4 text-muted">Nothing sold yet.</li> : null}
        {done.map((p) => {
          const tm = team(p.soldToTeamId);
          return (
            <li key={p.auctionPlayerId} className="flex flex-wrap items-center gap-3 p-3">
              <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={40} className="rounded-[var(--radius-sm)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold"><span className="num mr-2 text-xs text-info">#{p.lotNo}</span>{p.fullName}</p>
                <p className="text-xs text-muted">{p.status === "retained" ? "Retained" : "Sold"}</p>
              </div>
              {tm ? (
                <span className="flex items-center gap-2 text-sm font-semibold uppercase">
                  <TeamMark team={tm} size={28} className="rounded-[var(--radius-xs)]" /> {tm.name}
                </span>
              ) : null}
              <span className="num w-24 text-right text-lg font-bold text-accent-text">{formatPoints(p.soldPrice)}</span>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" onClick={() => open(p, "price")} icon={<Wrench className="size-4" aria-hidden="true" />}>Price</Button>
                <Button size="sm" onClick={() => open(p, "move")}>Move team</Button>
                <Button size="sm" variant="ghost" onClick={() => open(p, "return")}>Return to pool</Button>
              </div>
            </li>
          );
        })}
      </ul>
      {unsold.length ? (
        <section className="mt-6">
          <h2 className="text-xl">Unsold</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {unsold.map((p) => <li key={p.auctionPlayerId}><Badge tone="unsold">#{p.lotNo} {p.fullName}</Badge></li>)}
          </ul>
        </section>
      ) : null}

      <ConfirmDialog
        open={t !== null}
        onClose={() => setTarget(null)}
        title={t ? (t.kind === "price" ? `Change the price for ${t.p.fullName}` : t.kind === "move" ? `Move ${t.p.fullName} to another team` : `Return ${t.p.fullName} to the pool`) : ""}
        consequences={
          !t ? [] :
          t.kind === "price" ? [`${from?.name ?? "The team"}'s spent purse changes by the difference.`, "Refused if the new price would take the team over its purse."] :
          t.kind === "move" ? [`${from?.name ?? "The old team"} gets ${formatPoints(t.p.soldPrice)} back and loses the player.`, `${to?.name ?? "The new team"} pays the price below and gains the player.`, "Refused if the new team cannot afford it."] :
          [`${from?.name ?? "The team"} gets ${formatPoints(t.p.soldPrice)} back.`, "The player can be auctioned again."]
        }
        confirmLabel={t?.kind === "return" ? "Return to pool" : "Save correction"}
        danger={t?.kind === "return"}
        requireReason
        busy={run.pending}
        error={run.result && !run.result.ok ? run.result.error : null}
        onConfirm={(reason) =>
          t &&
          run.run(
            { auctionId: ctx.auctionId, auctionPlayerId: t.p.auctionPlayerId, action: t.kind, price: t.kind === "return" ? null : Number(price), teamId: t.kind === "move" ? teamId : null, reason },
            (r) => {
              if (r.ok) {
                setTarget(null);
                router.refresh();
              }
            },
          )
        }
      >
        {t && t.kind !== "return" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {t.kind === "move" ? (
              <Field name="c-team" label="New team">
                <SelectWrap>
                  <Select id="f-c-team" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
                    {teams.filter((x) => x.id !== t.p.soldToTeamId).map((x) => <option key={x.id} value={x.id}>{x.name} ({formatPoints(x.purseTotal - x.purseSpent)} left)</option>)}
                  </Select>
                </SelectWrap>
              </Field>
            ) : null}
            <Field name="c-price" label={`Price (${ctx.unit})`}>
              <Input id="f-c-price" inputMode="numeric" className="num" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
            </Field>
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
