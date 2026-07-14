// Generated Web Audio sounds (D18) — no audio assets, short/subtle beeps.
// AudioContext must not be created before a user gesture (browser autoplay
// policy creates it in a "suspended" state with a frozen currentTime, which
// bursts every queued tone together the moment it's finally resumed). So:
// before unlock, sound requests are only queued (never created/played);
// the first gesture creates the context, resume()s it, then flushes the
// queue. If the context already exists but is suspended for some other
// reason, resume() before playing.

import { useShipStore } from "@/lib/store/shipStore";

type SoundName =
  | "mailArrive"
  | "alert"
  | "authorizationRequired"
  | "missionComplete"
  | "gameOver";

/** Cap on the pre-gesture queue so a flurry of early sound requests can't
 * grow unbounded before the user ever interacts. */
const MAX_PENDING_QUEUE = 8;

let audioContext: AudioContext | null = null;
let unlockAttached = false;
let unlocked = false;
const pendingQueue: SoundName[] = [];

/** Attaches one-shot listeners on common gesture events to unlock audio the
 * moment the browser allows it, then flushes anything queued meanwhile. */
function ensureUnlockListener(): void {
  if (unlockAttached || typeof window === "undefined") return;
  unlockAttached = true;
  const unlock = () => {
    unlocked = true;
    const ctx = getOrCreateContext();
    if (ctx && ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    flushQueue();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

function getOrCreateContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

/** Queues a sound before unlock, deduping consecutive identical requests and
 * capping total size so pre-gesture spam can't build up indefinitely. */
function enqueue(name: SoundName): void {
  if (pendingQueue[pendingQueue.length - 1] === name) return;
  pendingQueue.push(name);
  if (pendingQueue.length > MAX_PENDING_QUEUE) {
    pendingQueue.shift();
  }
}

function flushQueue(): void {
  while (pendingQueue.length > 0) {
    const name = pendingQueue.shift();
    if (name) playNow(name);
  }
}

interface Tone {
  freq: number;
  startOffset: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

const SOUND_TONES: Record<SoundName, Tone[]> = {
  // Soft two-tone chime: gentle rising interval.
  mailArrive: [
    { freq: 660, startOffset: 0, duration: 0.12, type: "sine", gain: 0.08 },
    { freq: 880, startOffset: 0.1, duration: 0.16, type: "sine", gain: 0.08 },
  ],
  // Low warning blip.
  alert: [{ freq: 220, startOffset: 0, duration: 0.18, type: "square", gain: 0.06 }],
  // Distinct ping, higher and short.
  authorizationRequired: [
    { freq: 990, startOffset: 0, duration: 0.09, type: "triangle", gain: 0.09 },
  ],
  // Brief resolved chord (major-ish triad, staggered).
  missionComplete: [
    { freq: 523.25, startOffset: 0, duration: 0.2, type: "sine", gain: 0.07 },
    { freq: 659.25, startOffset: 0.03, duration: 0.2, type: "sine", gain: 0.07 },
    { freq: 783.99, startOffset: 0.06, duration: 0.24, type: "sine", gain: 0.07 },
  ],
  // Low descending tone.
  gameOver: [
    { freq: 220, startOffset: 0, duration: 0.35, type: "sawtooth", gain: 0.07 },
    { freq: 140, startOffset: 0.3, duration: 0.5, type: "sawtooth", gain: 0.07 },
  ],
};

function playNow(name: SoundName): void {
  const ctx = audioContext;
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const tone of SOUND_TONES[name]) {
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = tone.type ?? "sine";
    oscillator.frequency.value = tone.freq;
    const start = now + tone.startOffset;
    const end = start + tone.duration;
    const peakGain = tone.gain ?? 0.08;
    gainNode.gain.setValueAtTime(0, start);
    gainNode.gain.linearRampToValueAtTime(peakGain, start + 0.015);
    gainNode.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }
}

/** Plays a named sound, respecting shipStore.muted. Safe to call before the
 * first user gesture — the request is queued and flushed once audio unlocks;
 * safe to call server-side (no-ops). */
export function playSound(name: SoundName): void {
  if (typeof window === "undefined") return;
  if (useShipStore.getState().muted) return;
  ensureUnlockListener();

  if (!unlocked) {
    // No context yet (browser autoplay policy) — queue instead of creating
    // one, so we never end up with a suspended context whose currentTime is
    // frozen until the first gesture.
    enqueue(name);
    return;
  }

  const ctx = getOrCreateContext();
  if (!ctx) {
    enqueue(name);
    return;
  }
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  playNow(name);
}
