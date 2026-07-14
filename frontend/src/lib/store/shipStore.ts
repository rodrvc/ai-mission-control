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

export interface ShipState {
  oxygen: number;
  hull: number;
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
  damageHull: (amount: number, cause?: string) => void;
  repairHull: (amount: number) => void;
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
  hull: MAX_HULL,
  fuel: MAX_FUEL,
  tokens: STARTING_TOKENS,
  isGameOver: false,
  muted: false,
  lastDamageCause: undefined,
};

export const useShipStore = create<ShipState & ShipActions>((set, get) => ({
  ...initialState,

  tick: () => {
    const { hull, oxygen, isGameOver } = get();
    if (isGameOver) return;

    const leakRate = getO2LeakRateForHull(hull);
    const secondsPerTick = TICK_INTERVAL_MS / 1000;
    const nextOxygen = clamp(oxygen - leakRate * secondsPerTick, MAX_OXYGEN);

    set({
      oxygen: nextOxygen,
      isGameOver: nextOxygen <= 0,
    });
  },

  damageHull: (amount, cause) =>
    set((state) => ({
      hull: clamp(state.hull - amount, MAX_HULL),
      lastDamageCause: cause ?? state.lastDamageCause,
    })),

  repairHull: (amount) => set((state) => ({ hull: clamp(state.hull + amount, MAX_HULL) })),

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

  reset: () => set({ ...initialState }),
}));
