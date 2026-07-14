// Ship resource model tunables (D15/D17). All values named + commented so
// balance changes never require touching store/component logic.

/** Resource ceilings (0..max, clamped everywhere). */
export const MAX_OXYGEN = 100;
export const MAX_HULL = 100;
export const MAX_FUEL = 100;

/** Starting compute currency (D17) — spent per activated agent node. */
export const STARTING_TOKENS = 200;

/** Resource-tick cadence driving the leak/consumption simulation. */
export const TICK_INTERVAL_MS = 1000;

/**
 * Oxygen leak rate (units/second) as a function of hull integrity band
 * (D15). Hull is a stand-in for hull pressure integrity: the lower it is,
 * the faster O2 bleeds out. Timescales are tuned so the captain always has
 * room to notice and react — never instant death.
 *
 *  - hull >= 70            : sealed, no leak.
 *  - 50 <= hull < 70        : slow leak — empties a full tank in ~10 minutes.
 *  - 30 <= hull < 50        : faster leak — empties a full tank in ~5 minutes.
 *  - hull < 30              : fast leak — empties a full tank in ~100 seconds.
 */
export const HULL_BAND_THRESHOLDS = {
  sealed: 70,
  slow: 50,
  fast: 30,
} as const;

export const O2_LEAK_RATE_PER_SECOND = {
  sealed: 0,
  slow: MAX_OXYGEN / (10 * 60), // ~0.1667 O2/s -> 100 -> 0 in 10 minutes
  fast: MAX_OXYGEN / (5 * 60), // ~0.3333 O2/s -> 100 -> 0 in 5 minutes
  critical: MAX_OXYGEN / 100, // 1 O2/s -> 100 -> 0 in ~100 seconds
} as const;

/**
 * Given current hull integrity, returns the applicable O2 leak rate
 * (units/second). Pure function — unit-testable without the store.
 */
export function getO2LeakRateForHull(hull: number): number {
  if (hull >= HULL_BAND_THRESHOLDS.sealed) return O2_LEAK_RATE_PER_SECOND.sealed;
  if (hull >= HULL_BAND_THRESHOLDS.slow) return O2_LEAK_RATE_PER_SECOND.slow;
  if (hull >= HULL_BAND_THRESHOLDS.fast) return O2_LEAK_RATE_PER_SECOND.fast;
  return O2_LEAK_RATE_PER_SECOND.critical;
}

/**
 * Per-node token cost (D17): every activated node in a run deducts its own
 * cost from the shared token pool, regardless of whether the run succeeds.
 * Keyed by topology node id (see src/lib/graph/topology.ts). Cheap
 * orchestration/tooling, expensive specialist reasoning and repair work.
 */
export const NODE_TOKEN_COST: Record<string, number> = {
  "user-request": 0,
  orchestrator: 5,
  "life-support-specialist": 15,
  "navigation-specialist": 15,
  "knowledge-specialist": 15,
  "telemetry-tool": 4,
  "nav-computer-tool": 4,
  "knowledge-base-tool": 4,
  "diagnostics-agent": 10,
  "repair-agent": 25,
  "safety-reviewer": 12,
  "quality-check": 5,
  "final-response": 0,
};

/** Token rewards granted on successful mission completion (D17). */
export const MISSION_TOKEN_REWARD = {
  "life-support": 80,
  navigation: 80,
  knowledge: 40,
} as const;

/**
 * Email→indicator effects (D18). E2 (life-support incident) drops hull
 * integrity to a fixed target the moment the mission batch is delivered,
 * pushing oxygen into the slow-leak band (see HULL_BAND_THRESHOLDS.slow)
 * so the leak becomes visible without being an immediate emergency.
 * Completing the life-support mission repairs exactly this much hull back.
 */
export const LIFE_SUPPORT_INCIDENT_HULL_TARGET = 65;

/**
 * E3 (navigation deviation) drains fuel at this rate (units/second) from
 * delivery until the navigation mission completes — "off-course costs
 * propellant". Tuned slow enough to give the captain time to act.
 */
export const FUEL_DRAIN_RATE_PER_SECOND = 0.05;
