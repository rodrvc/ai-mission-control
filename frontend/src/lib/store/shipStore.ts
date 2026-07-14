import { create } from "zustand";
import {
  getO2LeakRateForHull,
  MAX_FUEL,
  MAX_HULL,
  MAX_OXYGEN,
  STARTING_TOKENS,
  TICK_INTERVAL_MS,
} from "@/lib/game/constants";

/** Clamp a value to the 0..max range shared by every ship resource. */
export function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

/** Named hull sections (D20). Order here is the canonical bow->stern display
 * order used by the HUD ship silhouette. */
export const HULL_SECTION_IDS = [
  "command-deck",
  "aft-module",
  "engineering",
  "drive",
] as const;

export type HullSectionId = (typeof HULL_SECTION_IDS)[number];

export type HullSections = Record<HullSectionId, number>;

const initialHullSections: HullSections = {
  "command-deck": MAX_HULL,
  "aft-module": MAX_HULL,
  engineering: MAX_HULL,
  drive: MAX_HULL,
};

/** Global hull integrity = mean of the 4 sections (D20). This is what the
 * O2-leak band logic (tick) reads — the leak physics are unchanged, only the
 * source of the hull number changes from a scalar to a derived mean. */
function meanHull(sections: HullSections): number {
  const total = HULL_SECTION_IDS.reduce((sum, id) => sum + sections[id], 0);
  return total / HULL_SECTION_IDS.length;
}

/** Picks the weakest section — used when damage/repair is applied without a
 * specific sectionId (e.g. an untargeted debug action). Ties broken by
 * canonical order. */
function weakestSection(sections: HullSections): HullSectionId {
  return HULL_SECTION_IDS.reduce((weakest, id) =>
    sections[id] < sections[weakest] ? id : weakest,
  );
}

export interface ShipState {
  oxygen: number;
  hullSections: HullSections;
  fuel: number;
  tokens: number;
  isGameOver: boolean;
  /** Sound mute flag (T17 wires actual sounds; only the flag lives here now). */
  muted: boolean;
  /** Most recent hull damage cause, surfaced by the HUD/log (optional narrative hook). */
  lastDamageCause?: string;
}

export interface ShipActions {
  /** Advances the simulation by one tick: applies the hull-band O2 leak. */
  tick: () => void;
  /** Damages a specific section when sectionId is given; otherwise damages
   * whichever section currently has the lowest integrity (concentrating
   * damage reads better on the ship silhouette than spreading it thin). */
  damageHull: (amount: number, cause?: string, sectionId?: HullSectionId) => void;
  /** Repairs a specific section when sectionId is given; otherwise repairs
   * whichever section currently has the highest integrity deficit (i.e. the
   * weakest section) so repairs visibly target the worst damage first. */
  repairHull: (amount: number, sectionId?: HullSectionId) => void;
  restoreOxygen: (amount: number) => void;
  consumeFuel: (amount: number) => void;
  refuel: (amount: number) => void;
  /** Deducts min(amount, current balance), clamping to 0 — never goes
   * negative and never silently no-ops (D17: balance must be able to reach
   * 0). Returns the amount actually spent. */
  spendTokens: (amount: number) => number;
  earnTokens: (amount: number) => void;
  toggleMuted: () => void;
  /** Resets ship resources only. Run/inbox stores are reset separately by
   * the component layer (see restartCampaign usage in page.tsx) to avoid
   * coupling this store to unrelated ones. */
  reset: () => void;
}

const initialState: ShipState = {
  oxygen: MAX_OXYGEN,
  hullSections: initialHullSections,
  fuel: MAX_FUEL,
  tokens: STARTING_TOKENS,
  isGameOver: false,
  muted: false,
  lastDamageCause: undefined,
};

export const useShipStore = create<ShipState & ShipActions>((set, get) => ({
  ...initialState,

  tick: () => {
    const { hullSections, oxygen, isGameOver } = get();
    if (isGameOver) return;

    const hull = meanHull(hullSections);
    const leakRate = getO2LeakRateForHull(hull);
    const secondsPerTick = TICK_INTERVAL_MS / 1000;
    const nextOxygen = clamp(oxygen - leakRate * secondsPerTick, MAX_OXYGEN);

    set({
      oxygen: nextOxygen,
      isGameOver: nextOxygen <= 0,
    });
  },

  damageHull: (amount, cause, sectionId) =>
    set((state) => {
      const target = sectionId ?? weakestSection(state.hullSections);
      return {
        hullSections: {
          ...state.hullSections,
          [target]: clamp(state.hullSections[target] - amount, MAX_HULL),
        },
        lastDamageCause: cause ?? state.lastDamageCause,
      };
    }),

  repairHull: (amount, sectionId) =>
    set((state) => {
      const target = sectionId ?? weakestSection(state.hullSections);
      return {
        hullSections: {
          ...state.hullSections,
          [target]: clamp(state.hullSections[target] + amount, MAX_HULL),
        },
      };
    }),

  restoreOxygen: (amount) =>
    set((state) => ({ oxygen: clamp(state.oxygen + amount, MAX_OXYGEN) })),

  consumeFuel: (amount) => set((state) => ({ fuel: clamp(state.fuel - amount, MAX_FUEL) })),

  refuel: (amount) => set((state) => ({ fuel: clamp(state.fuel + amount, MAX_FUEL) })),

  spendTokens: (amount) => {
    const { tokens } = get();
    const spent = Math.min(amount, tokens);
    set({ tokens: tokens - spent });
    return spent;
  },

  earnTokens: (amount) => set((state) => ({ tokens: state.tokens + amount })),

  toggleMuted: () => set((state) => ({ muted: !state.muted })),

  reset: () => set({ ...initialState, hullSections: { ...initialHullSections } }),
}));

/** Public selector for global hull integrity (D20: mean of the 4 named
 * sections). Prefer this over reading hullSections directly when only the
 * aggregate is needed (e.g. severity bands, leak logic, sound thresholds). */
export function getHull(state: ShipState): number {
  return meanHull(state.hullSections);
}

/** Convenience hook: subscribes to just the derived global hull number. */
export function useHull(): number {
  return useShipStore(getHull);
}
