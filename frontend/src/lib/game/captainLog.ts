// Captain's log narrative layer (ACU-62). Translates the same RunEvent
// stream EventLogStrip already renders technically (nodeId · status · title)
// into short in-fiction lines, so the player gets a "why" alongside the
// "what". Pure and read-only — never writes to runStore/shipStore, and the
// event contract in lib/types/events.ts stays untouched (FROZEN).

import type { RunEvent } from "@/lib/types/events";

const NODE_LOG_LINES: Partial<Record<string, Partial<Record<string, string>>>> = {
  orchestrator: {
    running: "Routing incoming distress call to the right crew.",
  },
  "life-support-specialist": {
    running: "Engineering is tracing the pressure breach.",
  },
  "navigation-specialist": {
    running: "Nav computer re-plotting our course.",
  },
  "knowledge-specialist": {
    running: "Consulting the ship's archive for answers.",
  },
  "diagnostics-agent": {
    running: "Running full diagnostics on the affected system.",
    completed: "Root cause located. Repair crew dispatched.",
    failed: "Diagnostic inconclusive — fault still open.",
  },
  "repair-agent": {
    running: "Damage control team on site, beginning repairs.",
    completed: "Repairs complete. Systems reporting nominal.",
    retrying: "Repair rejected by review — crew re-attempting the fix.",
  },
  "safety-reviewer": {
    running: "Safety officer reviewing the repair before sign-off.",
    waiting_review: "Repair holding for captain's sign-off.",
  },
  "quality-check": {
    running: "Final quality pass before closing the ticket.",
  },
  "final-response": {
    completed: "Mission logged. Crew stands down from alert status.",
  },
};

/**
 * Returns a short captain's-log line for a run event, or null when this
 * event/status pair has no narrative beat worth surfacing (most node
 * updates — e.g. "pending" — are UI bookkeeping, not story moments).
 */
export function captainLogLineForEvent(event: RunEvent): string | null {
  if (event.type === "node_update") {
    return NODE_LOG_LINES[event.nodeId]?.[event.status] ?? null;
  }
  if (event.type === "run_status" && event.status === "awaiting_approval") {
    return "Captain's sign-off requested before proceeding.";
  }
  return null;
}

/** Wraps a raw `lastDamageCause` string (e.g. "life-support incident: aft
 * pressure breach") in captain's-log framing for display alongside the
 * technical log. */
export function captainLogLineForDamageCause(cause: string): string {
  return `Ship's log: ${cause}.`;
}
