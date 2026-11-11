"use client";

import { useSyncExternalStore } from "react";

/**
 * The gavel hit from the original CPL site (src/hooks/useSounds.ts there),
 * synthesised with Web Audio so no sound file is shipped or licensed:
 * a low-passed sawtooth thud plus a short noise burst for the wooden crack.
 * One AudioContext is reused; browsers only let it start after a tap, which
 * the sound switch provides.
 */
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function playGavel() {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;

  const osc = ac.createOscillator();
  const filter = ac.createBiquadFilter();
  const gain = ac.createGain();
  osc.connect(filter).connect(gain).connect(ac.destination);
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(800, t);
  filter.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
  gain.gain.setValueAtTime(0.5, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
  osc.start(t);
  osc.stop(t + 0.3);

  const size = Math.floor(ac.sampleRate * 0.1);
  const buffer = ac.createBuffer(1, size, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (size * 0.1));
  const noise = ac.createBufferSource();
  const noiseFilter = ac.createBiquadFilter();
  const noiseGain = ac.createGain();
  noise.buffer = buffer;
  noise.connect(noiseFilter).connect(noiseGain).connect(ac.destination);
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 500;
  noiseGain.gain.setValueAtTime(0.4, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
  noise.start(t);
}

/** Two quick knocks, as an auctioneer does before the final strike. */
export function playSold() {
  playGavel();
  window.setTimeout(playGavel, 170);
}

const SOUND_KEY = "screen-sound";
const SOUND_EVENT = "screen-sound-change";
/** Fallback when browser storage is blocked: the choice lasts for this page. */
let soundInMemory = false;

export function readSound(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "on";
  } catch {
    return soundInMemory;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(SOUND_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SOUND_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Sale sound switch shared by the live page and the projector, remembered per browser. */
export function useSaleSound(): [boolean, () => void] {
  const on = useSyncExternalStore(subscribe, readSound, () => false);
  const toggle = () => {
    const next = !on;
    soundInMemory = next;
    try {
      localStorage.setItem(SOUND_KEY, next ? "on" : "off");
    } catch {
      /* storage blocked: kept in memory */
    }
    // The tap that switches sound on also unlocks audio; play one knock as confirmation.
    if (next) playGavel();
    window.dispatchEvent(new Event(SOUND_EVENT));
  };
  return [on, toggle];
}
