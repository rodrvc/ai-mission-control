// Mission model + delivery queue (ACU-60). Missions are the structural link
// between an inbox email and a simulation scenario — previously that link
// only existed as narrative coincidence (email body text happened to contain
// router keywords). Delivery is decoupled from mission progress: this store
// owns *when* the next mission email is released, `inboxStore` only owns the
// mailbox UI (delivered/unread/selected).

import { create } from "zustand";
import { applyLifeSupportIncident, startFuelDrain } from "@/lib/game/incidents";
import type { ScenarioId } from "@/lib/types/events";

/** Runs the resource-damage effect tied to a scenario, once, the moment its
 * mission is activated (ACU-60) — HUD damage now reads as a consequence of
 * the captain reading that mission's report, not a background event that
 * fired when the email silently arrived. */
function applyActivationEffect(scenarioId: ScenarioId): void {
  if (scenarioId === "life-support") {
    applyLifeSupportIncident();
  } else if (scenarioId === "navigation") {
    startFuelDrain();
  }
}

export type MissionStatus = "available" | "active" | "completed";

export interface Mission {
  /** Same id as the triggering email (data/emails.ts) — the structural link. */
  id: string;
  /** Scenario this mission resolves to once routed through VEGA. */
  scenarioId: ScenarioId;
  status: MissionStatus;
}

/**
 * How the mission queue is released to the player. Only "sequential-random"
 * is implemented today, but the shape exists so the delivery strategy can be
 * swapped by the dev team (config, not player-facing) without touching UI or
 * store call sites:
 *  - "sequential-random": shuffle once, delivered one at a time on completion.
 *  - "all-at-once": every mission delivered together (the old behavior).
 *  - "scripted": delivery order/timing driven by an external script/event feed.
 */
export type DeliveryMode = "sequential-random" | "all-at-once" | "scripted";

export interface DeliveryConfig {
  deliveryMode: DeliveryMode;
}

/** Dev-set, not player-set (ACU-60). Change this to switch delivery strategy. */
export const DELIVERY_CONFIG: DeliveryConfig = {
  deliveryMode: "sequential-random",
};

const MISSION_DEFINITIONS: Array<{ id: string; scenarioId: ScenarioId }> = [
  { id: "E1", scenarioId: "knowledge" },
  { id: "E2", scenarioId: "life-support" },
  { id: "E3", scenarioId: "navigation" },
];

/** Fisher-Yates shuffle. `random` is injectable for deterministic tests. */
function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Builds the delivery order for the configured mode. */
function buildDeliveryOrder(mode: DeliveryMode, random: () => number = Math.random): string[] {
  const ids = MISSION_DEFINITIONS.map((mission) => mission.id);
  if (mode === "sequential-random") return shuffle(ids, random);
  // "all-at-once" and "scripted" both currently fall back to definition
  // order — "all-at-once" delivers them together anyway (order is cosmetic),
  // "scripted" is a placeholder for a future external ordering source.
  return ids;
}

export interface MissionState {
  missions: Record<string, Mission>;
  /** Delivery order, decided once when the queue starts. Empty until then. */
  deliveryQueue: string[];
  /** Index into deliveryQueue of the next mission id to deliver. */
  queuePointer: number;
  /** True once the queue has been started (guards against re-shuffling). */
  queueStarted: boolean;
}

export interface MissionActions {
  /** Starts the delivery queue (called when E0's modal is closed). Shuffles
   * the order once per campaign; a repeat call is a no-op. */
  startDeliveryQueue: (random?: () => number) => void;
  /** Id of the next mission to hand to inboxStore for delivery, or null if
   * the queue hasn't started or is exhausted. Does not mutate state. */
  peekNextMissionId: () => string | null;
  /** Advances the queue pointer past the mission just delivered. */
  advanceQueue: () => void;
  /** Marks a mission active (player opened/read that email in the inbox). */
  activateMission: (missionId: string) => void;
  /** Marks a mission completed (its scenario's run finished). Returns the
   * completed mission, or null if missionId is unknown/already completed. */
  completeMission: (missionId: string) => Mission | null;
  /** The mission currently in progress, if any (for persistent UI feedback). */
  getActiveMission: () => Mission | null;
  /** Looks up the mission tied to a scenario (economy bridge only knows
   * scenarioId, not missionId, on run completion). */
  findMissionByScenario: (scenarioId: ScenarioId) => Mission | null;
  reset: () => void;
}

function createInitialMissions(): Record<string, Mission> {
  return Object.fromEntries(
    MISSION_DEFINITIONS.map((mission) => [
      mission.id,
      { id: mission.id, scenarioId: mission.scenarioId, status: "available" as MissionStatus },
    ]),
  );
}

const initialState: MissionState = {
  missions: createInitialMissions(),
  deliveryQueue: [],
  queuePointer: 0,
  queueStarted: false,
};

export const useMissionStore = create<MissionState & MissionActions>((set, get) => ({
  ...initialState,

  startDeliveryQueue: (random) => {
    if (get().queueStarted) return;
    set({
      deliveryQueue: buildDeliveryOrder(DELIVERY_CONFIG.deliveryMode, random),
      queuePointer: 0,
      queueStarted: true,
    });
  },

  peekNextMissionId: () => {
    const { deliveryQueue, queuePointer } = get();
    return deliveryQueue[queuePointer] ?? null;
  },

  advanceQueue: () => set((state) => ({ queuePointer: state.queuePointer + 1 })),

  activateMission: (missionId) => {
    const mission = get().missions[missionId];
    if (!mission || mission.status !== "available") return;
    set((state) => ({
      missions: { ...state.missions, [missionId]: { ...mission, status: "active" } },
    }));
    applyActivationEffect(mission.scenarioId);
  },

  completeMission: (missionId) => {
    const mission = get().missions[missionId];
    if (!mission || mission.status === "completed") return null;
    const completed: Mission = { ...mission, status: "completed" };
    set((state) => ({ missions: { ...state.missions, [missionId]: completed } }));
    return completed;
  },

  getActiveMission: () => {
    const { missions } = get();
    return Object.values(missions).find((mission) => mission.status === "active") ?? null;
  },

  findMissionByScenario: (scenarioId) => {
    const { missions } = get();
    return Object.values(missions).find((mission) => mission.scenarioId === scenarioId) ?? null;
  },

  reset: () => set({ ...initialState, missions: createInitialMissions() }),
}));
