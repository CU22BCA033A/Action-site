"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { Input, Select, SelectWrap } from "@/components/ui/field";
import { formatPoints } from "@/lib/format";
import type { SportConfig } from "@/lib/sports/config";
import { PlayerAvatar, RoleChip, TeamMark } from "./identity";

export type BrowserPlayer = {
  id: string;
  lotNo: number;
  fullName: string;
  photoPath: string | null;
  roleKey: string;
  subRole: string | null;
  category: string | null;
  nationalityGroup: "domestic" | "overseas";
  status: string;
  basePrice: number;
  soldPrice: number | null;
  soldToTeamId: string | null;
  setName: string;
};

type Team = { id: string; name: string; shortName: string; logoPath: string | null; primaryColor: string };

/**
 * Filterable player list grouped by the sport's roles. The filters come from
 * the sport configuration, never from code.
 */
export function PlayersBrowser({ players, config, teams }: { players: BrowserPlayer[]; config: SportConfig; teams: Team[] }) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const ids = { q: useId(), role: useId(), status: useId(), category: useId() };
  const teamMap = useMemo(() => new Map(teams.map((tm) => [tm.id, tm])), [teams]);
  const roles = config.roles.filter((r) => !r.hidden);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter(
      (p) =>
        (!needle || p.fullName.toLowerCase().includes(needle) || String(p.lotNo).includes(needle)) &&
        (!role || p.roleKey === role) &&
        (!status || p.status === status) &&
        (!category || p.category === category),
    );
  }, [players, q, role, status, category]);

  const groups = roles
    .map((r, index) => ({ role: r, index, items: filtered.filter((p) => p.roleKey === r.key) }))
    .filter((g) => g.items.length > 0);

  return (
    <div>
      <div className="grid gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.q} className="text-sm font-semibold">
            {t("auction.searchPlayers")}
          </label>
          <Input id={ids.q} type="search" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.role} className="text-sm font-semibold">
            {t("auction.filterRole")}
          </label>
          <SelectWrap>
            <Select id={ids.role} value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="">{t("auction.anyRole")}</option>
              {roles.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.status} className="text-sm font-semibold">
            {t("auction.filterStatus")}
          </label>
          <SelectWrap>
            <Select id={ids.status} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">{t("auction.anyStatus")}</option>
              {(["pool", "on_floor", "sold", "unsold", "retained"] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`playerStatus.${s}`)}
                </option>
              ))}
            </Select>
          </SelectWrap>
        </div>
        {config.categories.length ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={ids.category} className="text-sm font-semibold">
              {t("auction.filterCategory")}
            </label>
            <SelectWrap>
              <Select id={ids.category} value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">{t("auction.anyCategory")}</option>
                {config.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </SelectWrap>
          </div>
        ) : null}
      </div>

      <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
        {t("auction.showing", { n: filtered.length })}
      </p>

      {groups.length === 0 ? (
        <p className="mt-6 rounded-[var(--radius-md)] border border-dashed border-line-strong p-8 text-center text-muted">{t("auction.noMatches")}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.role.key} aria-labelledby={`role-${g.role.key}`}>
              <h3 id={`role-${g.role.key}`} className="mb-3 flex items-center gap-3 text-lg">
                <RoleChip label={g.role.label} index={g.index} />
                <span className="num text-sm text-muted">({g.items.length})</span>
              </h3>
              <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {g.items.map((p) => {
                  const team = p.soldToTeamId ? teamMap.get(p.soldToTeamId) : undefined;
                  const done = p.status === "sold" || p.status === "retained";
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-line bg-surface p-3">
                      <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={52} className="rounded-[var(--radius-sm)]" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <Link href={`/players/${p.id}`} className="truncate font-bold hover:underline">
                            {p.fullName}
                          </Link>
                          <span className="num shrink-0 text-xs font-bold text-info">#{String(p.lotNo).padStart(3, "0")}</span>
                        </p>
                        <p className="truncate text-xs text-muted">
                          {[p.subRole, p.category, t(`nationality.${p.nationalityGroup}`), p.setName].filter(Boolean).join(", ")}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold">
                          {team ? <TeamMark team={team} size={18} className="rounded-[2px]" /> : null}
                          <span className={done ? "text-sold" : p.status === "unsold" ? "text-unsold" : "text-muted"}>
                            {team ? team.name : t(`playerStatus.${p.status as "pool"}`)}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="num text-base font-bold text-accent-text">{formatPoints(done ? (p.soldPrice ?? 0) : p.basePrice)}</p>
                        <p className="text-xs text-muted">{done ? t("auction.soldPrice") : t("auction.base")}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
