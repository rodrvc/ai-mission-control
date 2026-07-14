// Email→indicator effects (D18). Each incident has an explicit start/stop
// pair, called from the mission-batch delivery point (start) and the
// matching mission's run_status:completed handler (stop). Kept separate
// from runStore/shipStore so those stay single-purpose (SRP) — this module
// is the narrative glue between "an email arrived" / "a mission finished"
// and the resource simulation.

import {
  FUEL_DRAIN_RATE_PER_SECOND,
  LIFE_SUPPORT_INCIDENT_HULL_TARGET,
  MAX_OXYGEN,
  TICK_INTERVAL_MS,
} from "@/lib/game/constants";
import { useShipStore } from "@/lib/store/shipStore";

// ---- E2: life-support incident (hull damage -> O2 leak) ------------------

/** Damage actually applied by the incident, so completion can undo exactly
 * this much (D18: "repair the damage amount the incident caused"), not just
 * jump hull to a fixed value that could clobber unrelated damage. */
let lastIncidentHullDamage = 0;

/**
 * Applies the E2 hull hit the moment the mission batch is delivered. Only
 * drops hull toward the target — never raises it — and never re-applies
 * twice for the same delivery (guarded by the caller, which only calls this
 * once per campaign per delivery).
 */
export function applyLifeSupportIncident(): void {
  const { hull, damageHull } = useShipStore.getState();
  const damage = Math.max(0, hull - LIFE_SUPPORT_INCIDENT_HULL_TARGET);
  if (damage <= 0) return;
  lastIncidentHullDamage = damage;
  damageHull(damage, "life-support incident: aft pressure breach");
}

/**
 * Repairs exactly the damage the incident caused and tops oxygen back to
 * full (D18: "life-support completion -> restoreOxygen to full AND stop the
 * leak"). Sealing the breach is what lets a full refill make sense; the
 * repair happens even if lastIncidentHullDamage is 0, since a captain who
 * lets the leak run for a while still expects a full tank back on success.
 */
export function resolveLifeSupportIncident(): void {
  const { restoreOxygen, repairHull } = useShipStore.getState();
  if (lastIncidentHullDamage > 0) {
    repairHull(lastIncidentHullDamage);
    lastIncidentHullDamage = 0;
  }
  restoreOxygen(MAX_OXYGEN);
}

// ---- E3: navigation deviation (slow fuel drain) ---------------------------

let fuelDrainTimer: ReturnType<typeof setInterval> | null = null;

/** Starts the slow fuel drain the moment the mission batch is delivered.
 * Idempotent — calling it while already running is a no-op. */
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
  lastIncidentHullDamage = 0;
  stopFuelDrain();
}
