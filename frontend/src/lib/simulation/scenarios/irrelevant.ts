// irrelevant scenario (D12 guardrail demo): user-request -> orchestrator
// only. No specialist, tool, diagnostics, repair, or reviewer activates.
// The orchestrator itself declines the request as outside mission scope.
// Kept short (~4 steps, ~3s) since there's nothing to route.

import type { ScenarioScript } from "@/lib/simulation/types";

export const irrelevantScript: ScenarioScript = {
  intro: [
    {
      afterMs: 400,
      event: {
        type: "node_update",
        nodeId: "user-request",
        status: "completed",
        title: "Request received",
        summary: "Operator request received.",
        output: "",
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "running",
        title: "Routing request",
        input: "",
      },
    },
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "failed",
        title: "Request declined",
        output: "No matching crew or ship system",
        reason: "Outside mission scope — no crew or ship system is relevant to this request.",
        confidence: 0.98,
        durationMs: 780,
      },
    },
  ],

  outro: [
    {
      afterMs: 500,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse:
          "VEGA: That request is not relevant to the current mission. The Meridian's crew handles life support, navigation, and mission intelligence tasks.",
      },
    },
  ],
};
