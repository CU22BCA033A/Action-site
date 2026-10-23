import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { Badge, statusTone } from "@/components/ui/badges";
import { getPublicPlayer } from "@/lib/data/public";
import { formatPoints, formatStat } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { pageMeta } from "@/lib/site";

type Props = { params: Promise<{ id: string }> };
const uuid = /^[0-9a-f-]{36}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!uuid.test(id)) return {};
  const data = await getPublicPlayer(id);
  const { t } = await getT();
  if (!data) return {};
  const role = data.player.sportConfig.roles.find((r) => r.key === data.player.roleKey)?.label ?? data.player.roleKey;
  return pageMeta({ title: data.player.fullName, description: t("meta.player", { name: data.player.fullName, role, sport: data.player.sportName }), path: `/players/${id}` });
}

export default async function PlayerPage({ params }: Props) {
  const { id } = await params;
  if (!uuid.test(id)) notFound();
  const data = await getPublicPlayer(id);
  if (!data) notFound();
  const { t } = await getT();
  const p = data.player;
  const config = p.sportConfig;
  const ri = Math.max(0, config.roles.findIndex((r) => r.key === p.roleKey));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
        <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={200} priority className="rounded-[var(--radius-md)] border border-line" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-muted">{p.sportName}</p>
          <h1 className="mt-1 text-3xl sm:text-4xl">{p.fullName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <RoleChip label={config.roles[ri]?.label ?? p.roleKey} index={ri} subRole={p.subRole} />
            {p.category ? <Badge>{t("live.category", { c: p.category })}</Badge> : null}
            <Badge>{t(`nationality.${p.nationalityGroup}`)}</Badge>
            {p.ageGroup ? <Badge>{t(`ageGroup.${p.ageGroup as "18_23"}`)}</Badge> : null}
            {p.tags.map((tag) => (
              <Badge key={tag}>{tag}</Badge>
            ))}
          </div>
          {p.bioShort ? <p className="mt-4 max-w-prose text-muted">{p.bioShort}</p> : null}
          {config.statFields.length ? (
            <dl className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {config.statFields.map((s) => (
                <div key={s.key} className="rounded-[var(--radius-sm)] border border-line bg-surface px-3 py-2">
                  <dt className="text-xs text-muted">{s.label}</dt>
                  <dd className="num text-xl font-bold">{formatStat(p.stats[s.key]) || "0"}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>

      <section className="mt-10" aria-labelledby="pa-heading">
        <h2 id="pa-heading" className="text-xl">
          {t("playerPage.auctions")}
        </h2>
        {data.auctions.length === 0 ? (
          <p className="mt-3 text-muted">{t("playerPage.none")}</p>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-[var(--radius-md)] border border-line bg-surface">
            {data.auctions.map((a) => (
              <li key={a.slug} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Link href={`/auctions/${a.slug}`} className="min-w-0 flex-1 font-bold hover:underline">
                  {a.name}
                </Link>
                {a.teamId && a.teamName ? (
                  <Link href={`/teams/${a.teamId}`} className="flex items-center gap-2 text-sm font-semibold hover:underline">
                    <TeamMark team={{ name: a.teamName, shortName: a.teamShort ?? "", logoPath: a.teamLogo, primaryColor: a.teamColor ?? "#34425f" }} size={24} className="rounded-[2px]" />
                    {a.teamName}
                  </Link>
                ) : null}
                <Badge tone={statusTone(a.playerStatus)}>{t(`playerStatus.${a.playerStatus as "pool"}`)}</Badge>
                <span className="num font-bold text-accent-text">
                  {t("common.points", { amount: formatPoints(a.soldPrice ?? a.basePrice), unit: a.pointsUnitLabel })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
