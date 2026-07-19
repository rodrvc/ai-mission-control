// Run <-> resource economy bridge (D17/D18). runStore.applyEvent stays a
// pure reducer (frozen contract) — this module sits in front of it as the
// single place that reacts to run events with side effects on shipStore:
// per-node token costs, mission rewards, incident resolution, and sounds.
// Call `createEconomyBridge` once per run start (page.tsx) and feed every
// event through the returned `applyEvent` before/instead of the raw store
// action.

import { MISSION_TOKEN_REWARD, NODE_TOKEN_COST } from "@/lib/game/constants";
import { resolveLifeSupportIncident, stopFuelDrain } from "@/lib/game/incidents";
import { playSound } from "@/lib/sound/sounds";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useMissionStore } from "@/lib/store/missionStore";
import { useShipStore } from "@/lib/store/shipStore";
import type { RunEvent, ScenarioId } from "@/lib/types/events";

/** Scenarios that grant a token reward + resource restoration on completion.
 * "irrelevant" runs never reach this bridge with a real scenarioId (page.tsx
 * passes null), but the guard stays defensive. */
function isMissionScenario(scenarioId: ScenarioId | null): scenarioId is Exclude<ScenarioId, "irrelevant"> {
  return scenarioId === "life-support" || scenarioId === "navigation" || scenarioId === "knowledge";
}

/**
 * Wraps a run's applyEvent with the token/reward/incident/sound side effects.
 * `scenarioId` is fixed for the lifetime of one run (page.tsx resolves it via
 * the router before calling startRun).
 */
export function createEconomyBridge(
  scenarioId: ScenarioId | null,
  applyToStore: (event: RunEvent) => void,
) {
  // Captured from the first event this bridge sees, then used to ignore any
  // event carrying a different runId — mirrors runStore.ts's own stale-run
  // guard (a cancelled/reset run's straggling timers must not bill tokens
  // into whatever run/campaign is active now).
  let boundRunId: string | null = null;

  return function applyEvent(event: RunEvent): void {
    if (boundRunId === null) {
      boundRunId = event.runId;
    } else if (event.runId !== boundRunId) {
      return;
    }

    // Charge on every transition into "running" (first activation) or
    // "retrying" (repair-agent re-running after a reviewer rejection) — each
    // is a fresh activation of that node and bills its cost again (D17:
    // retries cost real money, that's the lesson).
    if (event.type === "node_update" && (event.status === "running" || event.status === "retrying")) {
      const cost = NODE_TOKEN_COST[event.nodeId] ?? 0;
      if (cost > 0) {
        useShipStore.getState().spendTokens(cost);
      }
    }

    if (event.type === "run_status" && event.status === "awaiting_approval") {
      playSound("authorizationRequired");
    }

    if (event.type === "run_status" && event.status === "completed" && isMissionScenario(scenarioId)) {
      useShipStore.getState().earnTokens(MISSION_TOKEN_REWARD[scenarioId]);
      if (scenarioId === "life-support") {
        resolveLifeSupportIncident();
      } else if (scenarioId === "navigation") {
        stopFuelDrain();
      }
      playSound("missionComplete");

      // ACU-60: mark the linked mission completed and release the next one
      // in the queue — delivery is driven by mission-complete, not a timer.
      const mission = useMissionStore.getState().findMissionByScenario(scenarioId);
      if (mission) {
        useMissionStore.getState().completeMission(mission.id);
        useInboxStore.getState().deliverNextMission();
      }
    }

    applyToStore(event);
  };
}
