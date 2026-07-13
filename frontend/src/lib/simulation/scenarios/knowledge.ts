// knowledge scenario: user-request -> orchestrator -> knowledge-specialist
// -> knowledge-base-tool -> quality-check -> final-response. No reviewer —
// dynamic routing skips diagnostics/repair/review entirely. Reframed as a
// mission-intel query about the Meridian's transit to XJS-7. See
// ARCHITECTURE.md scenario 3.

import type { ScenarioScript } from "@/lib/simulation/types";

export const knowledgeScript: ScenarioScript = {
  intro: [
    {
      afterMs: 400,
      event: {
        type: "node_update",
        nodeId: "user-request",
        status: "completed",
        title: "What's our ETA to XJS-7?",
        summary: "Operator query received.",
        output: "What's our ETA to XJS-7?",
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "running",
        title: "Routing query",
        input: "What's our ETA to XJS-7?",
      },
    },
    {
      afterMs: 800,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "completed",
        title: "Routed to Knowledge Specialist",
        output: "knowledge-specialist",
        confidence: 0.97,
        reason: "Informational question with no fault symptoms — routed to the knowledge domain, bypassing diagnostics/repair.",
        durationMs: 700,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "knowledge-specialist",
        status: "running",
        title: "Interpreting query",
        input: "What's our ETA to XJS-7?",
      },
    },
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "knowledge-specialist",
        status: "completed",
        title: "Looking up mission timeline",
        summary: "Querying the knowledge base for current trajectory ETA and long-range survey data.",
        output: "Dispatched query for XJS-7 orbital insertion ETA.",
        confidence: 0.92,
        durationMs: 820,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "knowledge-base-tool",
        status: "running",
        title: "Querying knowledge base",
        input: "XJS-7 orbital insertion ETA, current trajectory, long-range survey",
      },
    },
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "knowledge-base-tool",
        status: "completed",
        title: "Knowledge base lookup complete",
        output: "XJS-7 orbital insertion burn scheduled in 14 days, 6 hours at current trajectory · nominal delta-v budget · long-range survey shows stable approach corridor",
        confidence: 0.98,
        durationMs: 900,
      },
    },
  ],

  outro: [
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "running",
        title: "Final quality pass",
        input: "XJS-7 orbital insertion burn scheduled in 14 days, 6 hours.",
      },
    },
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "completed",
        title: "Quality check passed",
        output: "Response verified for accuracy and operator tone.",
        confidence: 0.95,
        durationMs: 800,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "final-response",
        status: "completed",
        title: "Response delivered",
        output: "VEGA: At the current trajectory, the Meridian's XJS-7 orbital insertion burn is scheduled in 14 days, 6 hours, within the nominal delta-v budget. Long-range survey shows a stable approach corridor.",
        confidence: 0.96,
        durationMs: 100,
      },
    },
    {
      afterMs: 400,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse: "VEGA: At the current trajectory, the Meridian's XJS-7 orbital insertion burn is scheduled in 14 days, 6 hours, within the nominal delta-v budget. Long-range survey shows a stable approach corridor.",
      },
    },
  ],
};
