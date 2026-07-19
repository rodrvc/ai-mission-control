// Email→indicator effects (D18, ACU-60). Each incident has an explicit
// start/stop pair, called when the player activates a mission (reads/selects
// that mission's email — lib/store/missionStore.ts) and when that mission's
// run_status:completed handler fires (economy.ts). Kept separate from
// runStore/shipStore so those stay single-purpose (SRP) — this module is the
// narrative glue between "the captain read a mission" / "a mission finished"
// and the resource simulation.

import { FUEL_DRAIN_RATE_PER_SECOND, MAX_OXYGEN, TICK_INTERVAL_MS } from "@/lib/game/constants";
import { useShipStore } from "@/lib/store/shipStore";

// ---- E2: life-support incident (hull damage -> O2 leak) ------------------

/**
 * E2 damage split across the two sections in the aft half of the ship
 * (D20): "aft-module" takes the full breach, "engineering" (adjoining the
 * breach) takes a secondary hit. With all sections starting at 100, this
 * lands the GLOBAL hull (mean of 4 sections) at exactly 65:
 *   (100 [command-deck] + 0 [aft-module] + 60 [engineering] + 100 [drive]) / 4 = 65
 * which pushes oxygen into the slow-leak band (see HULL_BAND_THRESHOLDS.slow)
 * without being an immediate emergency. Only applied once per delivery
 * (guarded by the caller) and only if those sections aren't already at/below
 * this damage (never raises integrity).
 */
const AFT_MODULE_DAMAGE = 100;
const ENGINEERING_DAMAGE = 40;

/** Damage actually applied by the incident per section, so completion can
 * undo exactly this much (D18: "repair the damage amount the incident
 * caused"), not just jump hull to a fixed value that could clobber unrelated
 * damage. */
let lastIncidentDamage: { "aft-module": number; engineering: number } = {
  "aft-module": 0,
  engineering: 0,
};

/**
 * Applies the E2 hull hit the moment the captain activates that mission
 * (D20 — "the E2 incident damages the Aft Module specifically", extended
 * here to a secondary engineering hit so the arithmetic lands on the
 * documented global target). Never re-applies twice per campaign (guarded by
 * the caller, missionStore.activateMission, which only calls this once per
 * mission).
 */
export function applyLifeSupportIncident(): void {
  const { hullSections, damageHull } = useShipStore.getState();
  const aftDamage = Math.min(AFT_MODULE_DAMAGE, hullSections["aft-module"]);
  const engineeringDamage = Math.min(ENGINEERING_DAMAGE, hullSections.engineering);
  if (aftDamage <= 0 && engineeringDamage <= 0) return;
  lastIncidentDamage = { "aft-module": aftDamage, engineering: engineeringDamage };
  if (aftDamage > 0) {
    damageHull(aftDamage, "life-support incident: aft pressure breach", "aft-module");
  }
  if (engineeringDamage > 0) {
    damageHull(engineeringDamage, "life-support incident: aft pressure breach", "engineering");
  }
}

/**
 * Repairs exactly the damage the incident caused (both sections) and tops
 * oxygen back to full (D18: "life-support completion -> restoreOxygen to
 * full AND stop the leak"). Sealing the breach is what lets a full refill
 * make sense; the repair happens even if no damage is tracked, since a
 * captain who lets the leak run for a while still expects a full tank back
 * on success.
 */
export function resolveLifeSupportIncident(): void {
  const { restoreOxygen, repairHull } = useShipStore.getState();
  if (lastIncidentDamage["aft-module"] > 0) {
    repairHull(lastIncidentDamage["aft-module"], "aft-module");
  }
  if (lastIncidentDamage.engineering > 0) {
    repairHull(lastIncidentDamage.engineering, "engineering");
  }
  lastIncidentDamage = { "aft-module": 0, engineering: 0 };
  restoreOxygen(MAX_OXYGEN);
}

// ---- E3: navigation deviation (slow fuel drain) ---------------------------

let fuelDrainTimer: ReturnType<typeof setInterval> | null = null;

/** Starts the slow fuel drain the moment the captain activates the
 * navigation mission. Idempotent — calling it while already running is a
 * no-op. */
export function startFuelDrain(): void {
  if (fuelDrainTimer !== null) return;
  const drainPerTick = FUEL_DRAIN_RATE_PER_SECOND * (TICK_INTERVAL_MS / 1000);
  fuelDrainTimer = setInterval(() => {
    useShipStore.getState().consumeFuel(drainPerTick);
  }, TICK_INTERVAL_MS);
}

/** Stops the fuel drain once the navigation mission completes. Idempotent. */
export function stopFuelDrain(): void {
  if (fuelDrainTimer === null) return;
  clearInterval(fuelDrainTimer);
  fuelDrainTimer = null;
}

/** Resets in-memory incident tracking (restart-campaign hook). Does not
 * touch shipStore — callers reset that separately. */
export function resetIncidents(): void {
  lastIncidentDamage = { "aft-module": 0, engineering: 0 };
  stopFuelDrain();
}
