"use client";

import { Gavel, Maximize, Minimize, Volume2, VolumeX } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { PlayerAvatar, RoleChip, TeamMark } from "@/components/auction/identity";
import { formatPoints, formatStat } from "@/lib/format";
import { ConnectionIndicator, PhaseBadge, Price, roleInfo, teamById } from "./bits";
import { useLive } from "./live-provider";
import { useCountdown } from "./use-live-auction";

const SOLD_MOMENT_MS = 7000;

/** A short gavel knock made with Web Audio. Only plays when switched on. */
function knock() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.16].forEach((offset) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, ctx.currentTime + offset);
      osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + offset + 0.12);
      gain.gain.setValueAtTime(0.5, ctx.currentTime + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.14);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + offset);
      osc.stop(ctx.currentTime + offset + 0.15);
    });
    setTimeout(() => void ctx.close(), 600);
  } catch {
    /* audio not available */
  }
}

const SOUND_KEY = "screen-sound";
const SOUND_EVENT = "screen-sound-change";
/** Fallback when browser storage is blocked: the choice lasts for this page. */
let soundInMemory = false;

function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return soundInMemory;
  }
}

function subscribeSound(onChange: () => void) {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function ProjectorScreen() {
  const { snapshot, connection, serverNow } = useLive();
  const { t } = useI18n();
  const f = snapshot.floor;
  const p = snapshot.currentPlayer;
  const a = snapshot.auction;
  const unit = a.pointsUnitLabel;
  const leader = teamById(snapshot, f.leadingTeamId);
  const left = useCountdown(f.phase === "live" ? f.timerEndsAt : null, serverNow);
  const sound = useSyncExternalStore(subscribeSound, readSound, () => false);
  const [full, setFull] = useState(false);
  // A sale already on screen when the page opened does not replay.
  const [initialKey] = useState(`${f.currentAuctionPlayerId}:${f.phase}`);
  const [finished, setFinished] = useState<string | null>(null);
  const saleKey = f.phase === "sold" && f.currentAuctionPlayerId ? `${f.currentAuctionPlayerId}:sold` : null;
  const moment = saleKey && saleKey !== initialKey && saleKey !== finished ? f.currentAuctionPlayerId : null;

  // The sold moment plays once per sale, then settles into the sold card.
  useEffect(() => {
    if (!moment || !saleKey) return;
    if (sound) knock();
    const id = setTimeout(() => setFinished(saleKey), SOLD_MOMENT_MS);
    return () => clearTimeout(id);
    // Sound is read when the sale lands; toggling it later must not replay.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moment, saleKey]);

  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleSound = () => {
    const next = !sound;
    soundInMemory = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      /* storage blocked: kept in memory */
    }
    window.dispatchEvent(new Event(SOUND_EVENT));
  };

  const buyer = teamById(snapshot, f.lastResultTeamId);
  const standings = [...snapshot.teams].sort((x, y) => y.purseLeft - x.purseLeft);

  return (
    <div className="relative flex min-h-dvh flex-col bg-bg text-text">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-line bg-surface px-6 py-4 xl:px-10">
        <div className="min-w-0">
          <p className="text-lg font-semibold text-muted">{a.sportName}</p>
          <h1 className="truncate text-3xl text-accent-text xl:text-4xl">{a.name}</h1>
        </div>
        <dl className="flex divide-x divide-line rounded-[var(--radius-md)] border border-line bg-bg-sunken">
          <div className="px-6 py-2 text-center">
            <dt className="text-sm font-semibold text-muted">{t("live.totalSpent")}</dt>
            <dd className="text-4xl font-bold text-spent">
              <Price value={snapshot.totals.spent} />
            </dd>
          </div>
          <div className="px-6 py-2 text-center">
            <dt className="text-sm font-semibold text-muted">{t("live.remaining")}</dt>
            <dd className="text-4xl font-bold text-remaining">
              <Price value={snapshot.totals.remaining} />
            </dd>
          </div>
        </dl>
        <div className="no-print flex items-center gap-2">
          <ConnectionIndicator state={connection} />
          <button type="button" onClick={toggleSound} aria-pressed={sound} className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold hover:border-text">
            {sound ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            {sound ? t("screen.soundOn") : t("screen.soundOff")}
          </button>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.())}
            className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] border border-line-strong px-3 text-sm font-semibold hover:border-text"
          >
            {full ? <Minimize className="size-4" aria-hidden="true" /> : <Maximize className="size-4" aria-hidden="true" />}
            {full ? t("screen.exitFullscreen") : t("screen.fullscreen")}
          </button>
        </div>
      </header>

      <main className="grid flex-1 gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:p-10">
        {p ? (
          <section className={`flex flex-col rounded-[var(--radius-md)] border-2 bg-surface ${f.phase === "sold" ? "border-sold" : f.phase === "live" ? "border-accent-edge" : "border-line"}`} aria-live="polite">
            <div className="flex items-center justify-between border-b border-line px-8 py-4">
              <div className="flex items-center gap-3">
                <PhaseBadge phase={f.phase} hasPlayer />
                <span className="num text-xl font-bold text-info">{t("live.lot", { n: p.lotNo })}</span>
                <span className="text-lg text-muted">{p.setName}</span>
              </div>
              {f.phase === "live" && left !== null ? (
                <span className={`num text-5xl font-bold ${left <= 5 ? "text-live" : "text-text"}`}>{left === 0 ? t("time.timeUp") : `${left}s`}</span>
              ) : null}
            </div>
            <div className="grid flex-1 items-center gap-8 p-8 lg:grid-cols-[auto_1fr]">
              <PlayerAvatar name={p.fullName} photoPath={p.photoPath} size={300} priority className="rounded-[var(--radius-md)] border border-line" />
              <div className="min-w-0">
                <h2 className="text-5xl leading-tight xl:text-6xl">{p.fullName}</h2>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-lg">
                  <RoleChip label={roleInfo(snapshot, p.roleKey).label} index={roleInfo(snapshot, p.roleKey).index} subRole={p.subRole} />
                  {p.category ? <span className="font-semibold">{t("live.category", { c: p.category })}</span> : null}
                  <span className="text-muted">{t(`nationality.${p.nationalityGroup}`)}</span>
                </div>
                <dl className="mt-6 flex flex-wrap gap-3">
                  {a.sportConfig.statFields
                    .filter((s) => s.showOnCard)
                    .map((s) => (
                      <div key={s.key} className="min-w-28 rounded-[var(--radius-sm)] bg-surface-2 px-4 py-2">
                        <dt className="text-sm text-muted">{s.label}</dt>
                        <dd className="num text-3xl font-bold">{formatStat(p.stats[s.key]) || "0"}</dd>
                      </div>
                    ))}
                </dl>
              </div>
            </div>
            <div className="grid gap-px border-t border-line bg-line lg:grid-cols-2">
              <div className="bg-surface px-8 py-6">
                <p className="text-xl font-semibold text-muted">{f.phase === "sold" ? t("live.soldFor") : leader ? t("live.currentBid") : t("live.basePrice")}</p>
                <p className="flex items-baseline gap-3">
                  <Price value={f.phase === "sold" ? f.lastResultPrice : f.currentPrice} className={`text-[clamp(5rem,9vw,9rem)] font-extrabold leading-none ${f.phase === "sold" ? "text-sold" : "text-accent-text"}`} />
                  <span className="text-2xl text-muted">{unit}</span>
                </p>
              </div>
              <div className="flex flex-col justify-center bg-surface px-8 py-6">
                <p className="text-xl font-semibold text-muted">{f.phase === "sold" ? t("live.boughtBy") : t("live.leadingTeam")}</p>
                {(f.phase === "sold" ? buyer : leader) ? (
                  <div className="mt-3 flex items-center gap-4">
                    <TeamMark team={(f.phase === "sold" ? buyer : leader)!} size={88} className="rounded-[var(--radius-md)]" />
                    <span className="display text-4xl font-bold uppercase">{(f.phase === "sold" ? buyer : leader)!.name}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-2xl text-muted">{f.phase === "unsold" ? t("live.noBuyer") : t("live.noBidsYet")}</p>
                )}
              </div>
            </div>
          </section>
        ) : (
          <section className="flex flex-col items-center justify-center gap-6 rounded-[var(--radius-md)] border border-line bg-surface p-10 text-center">
            <Gavel className="size-24 text-accent-text" aria-hidden="true" />
            <h2 className="text-5xl">{t("live.waitingTitle")}</h2>
            <p className="text-2xl text-muted">{t("live.waitingBody")}</p>
          </section>
        )}

        <aside aria-label={t("live.standings")} className="rounded-[var(--radius-md)] border border-line bg-surface">
          <h2 className="border-b border-line px-5 py-4 text-2xl">{t("live.standings")}</h2>
          <ol className="divide-y divide-line">
            {standings.map((team, i) => (
              <li key={team.id} className="flex items-center gap-3 px-5 py-3">
                <span className="num w-7 text-xl font-bold text-muted">{i + 1}</span>
                <TeamMark team={team} size={44} className="rounded-[var(--radius-sm)]" />
                <div className="min-w-0 flex-1">
                  <p className="display truncate text-base font-bold uppercase">{team.name}</p>
                  <p className="text-sm text-muted">{t("live.squadLine", { n: team.squadCount, max: a.squadMax, o: team.overseasCount })}</p>
                </div>
                <Price value={team.purseLeft} tick={false} className="text-2xl font-bold text-accent-text" />
              </li>
            ))}
          </ol>
        </aside>
      </main>

      {moment && p && buyer ? (
        <div role="alert" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
          <Gavel className="stamp-land size-28 text-accent-text" aria-hidden="true" />
          <p className="stamp-land floor-shake display text-[clamp(6rem,16vw,14rem)] font-extrabold leading-none text-accent-text">{t("screen.sold")}</p>
          <p className="display text-5xl font-bold">{p.fullName}</p>
          <p className="text-2xl text-muted">{roleInfo(snapshot, p.roleKey).label}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-8">
            <div className="flex items-center gap-4">
              <TeamMark team={buyer} size={104} className="rounded-[var(--radius-md)] border-2 border-accent-edge" />
              <div className="text-left">
                <p className="text-lg font-semibold text-muted">{t("live.boughtBy")}</p>
                <p className="display text-4xl font-bold uppercase">{buyer.name}</p>
              </div>
            </div>
            <div className="h-24 w-px bg-line-strong" aria-hidden="true" />
            <div>
              <p className="text-lg font-semibold text-muted">{t("screen.for")}</p>
              <p className="num text-7xl font-extrabold text-accent-text">{formatPoints(f.lastResultPrice)}</p>
              <p className="text-lg text-muted">{unit}</p>
            </div>
          </div>
          <div className="bar-sweep mt-6 h-1.5 w-64 bg-accent" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );
}
