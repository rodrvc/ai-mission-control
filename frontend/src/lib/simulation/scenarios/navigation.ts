// navigation scenario: user-request -> orchestrator -> navigation-specialist
// -> nav-computer-tool -> diagnostics-agent -> repair-agent -> safety-reviewer
// (approves first pass) -> quality-check -> final-response. See
// ARCHITECTURE.md scenario 2.

import type { ScenarioScript } from "@/lib/simulation/types";

export const navigationScript: ScenarioScript = {
  intro: [
    {
      afterMs: 400,
      event: {
        type: "node_update",
        nodeId: "user-request",
        status: "completed",
        title: "Trajectory deviation detected on approach vector.",
        summary: "Operator incident report received.",
        output: "Trajectory deviation detected on approach vector.",
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "running",
        title: "Routing incident",
        input: "Trajectory deviation detected on approach vector.",
      },
    },
    {
      afterMs: 850,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "completed",
        title: "Routed to Navigation Specialist",
        output: "navigation-specialist",
        confidence: 0.93,
        reason: "'Trajectory' and 'approach vector' map directly to the navigation domain.",
        durationMs: 760,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "navigation-specialist",
        status: "running",
        title: "Assessing trajectory deviation",
        input: "Trajectory deviation detected on approach vector.",
      },
    },
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "navigation-specialist",
        status: "completed",
        title: "Pulling nav computer solution",
        summary: "Requesting the Meridian's current trajectory solution and burn history.",
        output: "Dispatched query to nav computer for approach vector deltas.",
        confidence: 0.89,
        durationMs: 900,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "nav-computer-tool",
        status: "running",
        title: "Querying nav computer",
        input: "Approach vector, last 3 course-correction burns",
      },
    },
    {
      afterMs: 1200,
      event: {
        type: "node_update",
        nodeId: "nav-computer-tool",
        status: "completed",
        title: "Nav computer query complete",
        output: "Approach vector off nominal by 0.42 degrees · RCS thruster cluster C3 under-firing by 6%",
        confidence: 0.96,
        durationMs: 1080,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "running",
        title: "Diagnosing root cause",
        input: "Approach vector off nominal by 0.42 degrees · RCS cluster C3 under-firing by 6%",
      },
    },
    {
      afterMs: 1300,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "completed",
        title: "Root cause identified",
        output: "RCS thruster cluster C3 under-firing due to a partially clogged propellant feed line, accumulating trajectory drift over the last two burns.",
        confidence: 0.86,
        durationMs: 1240,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "running",
        title: "Drafting correction plan",
        input: "RCS cluster C3 under-firing 6% from partially clogged feed line.",
      },
    },
    {
      afterMs: 1200,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "completed",
        title: "Correction plan drafted",
        output: "Schedule a compensating 0.42-degree trim burn on cluster C1/C2, then purge cluster C3 feed line at next scheduled maintenance window.",
        confidence: 0.9,
        durationMs: 1100,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "running",
        title: "Reviewing correction plan",
        input: "Compensating 0.42-degree trim burn on C1/C2, then purge C3 feed line at next maintenance window.",
      },
    },
  ],

  reviewGate: [
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "waiting_review",
        title: "Awaiting captain authorization",
        summary: "Correction burn plan requires command sign-off before execution.",
        input: "Compensating 0.42-degree trim burn on C1/C2, then purge C3 feed line at next maintenance window.",
      },
    },
  ],

  onApprove: [
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "completed",
        title: "Correction plan approved",
        output: "APPROVED",
        reason: "Trim burn uses undamaged clusters and stays within nominal delta-v budget; feed-line purge is deferred safely to maintenance.",
        confidence: 0.94,
        durationMs: 760,
      },
    },
  ],

  // Pass-2+ approve copy (D13): used once the captain authorizes after at
  // least one DENY looped back through the review gate, so the graph and
  // final response accurately describe the revised (not original) plan.
  onApproveRevised: [
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "completed",
        title: "Revised correction plan approved",
        output: "APPROVED",
        reason: "Split burns stay within the delta-v margin per burn.",
        confidence: 0.95,
        durationMs: 700,
      },
    },
  ],

  // D13 real HITL loop: a DENY does not auto-approve a revised plan. The
  // revision (diagnostics/repair recompute) plays out here, then the engine
  // (onRejectLoopsToGate) re-enters reviewGate and pauses for captain
  // authorization again — a genuine reject → revise → re-authorize loop.
  // Repeated DENYs simply repeat this loop.
  onReject: [
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "failed",
        title: "Correction plan rejected",
        output: "REJECTED",
        reason: "Trim burn magnitude exceeds the reviewer's preferred single-burn delta-v margin; split into two smaller burns.",
        confidence: 0.85,
        durationMs: 640,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "retrying",
        title: "Re-checking diagnostics against rejection",
        input: "Rejection reason: split trim burn to stay within delta-v margin.",
      },
    },
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "completed",
        title: "Diagnostics reconfirmed",
        output: "RCS cluster C3 under-firing 6% from partially clogged feed line — root cause unchanged; only the burn plan needs revision.",
        confidence: 0.88,
        durationMs: 900,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "retrying",
        title: "Revising correction plan",
        input: "Rejection reason: split trim burn to stay within delta-v margin.",
      },
    },
    {
      afterMs: 1300,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "completed",
        title: "Revised correction plan drafted",
        output: "Split into two 0.21-degree trim burns on C1/C2 spaced one orbit apart, then purge C3 feed line at next maintenance window.",
        confidence: 0.92,
        durationMs: 1180,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "running",
        title: "Reviewing revised correction plan",
        input: "Two 0.21-degree trim burns spaced one orbit apart, then purge C3 feed line.",
      },
    },
  ],
  onRejectLoopsToGate: true,

  outro: [
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "running",
        title: "Final quality pass",
        input: "Approved trajectory correction plan.",
      },
    },
    {
      afterMs: 950,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "completed",
        title: "Quality check passed",
        output: "Response verified for accuracy and operator tone.",
        confidence: 0.93,
        durationMs: 860,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "final-response",
        status: "completed",
        title: "Response delivered",
        output:
          "VEGA: Approach vector to XJS-7 was off nominal by 0.42 degrees due to RCS cluster C3 under-firing from a partially clogged feed line. A compensating trim burn on C1/C2 has been scheduled, with C3 feed-line purge planned for the next maintenance window. Correction burn authorized by the captain.",
        confidence: 0.94,
        durationMs: 110,
      },
    },
    {
      afterMs: 400,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse:
          "VEGA: Approach vector to XJS-7 was off nominal by 0.42 degrees due to RCS cluster C3 under-firing from a partially clogged feed line. A compensating trim burn on C1/C2 has been scheduled, with C3 feed-line purge planned for the next maintenance window. Correction burn authorized by the captain.",
      },
    },
  ],

  // Pass-2+ outro (D13): reflects the revised, split-burn plan that the
  // captain actually authorized after a DENY, instead of restating the
  // original single-burn plan that was rejected.
  outroRevised: [
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "running",
        title: "Final quality pass",
        input: "Approved revised trajectory correction plan.",
      },
    },
    {
      afterMs: 950,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "completed",
        title: "Quality check passed",
        output: "Response verified for accuracy and operator tone.",
        confidence: 0.93,
        durationMs: 860,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "final-response",
        status: "completed",
        title: "Response delivered",
        output:
          "VEGA: Approach vector to XJS-7 was off nominal by 0.42 degrees due to RCS cluster C3 under-firing from a partially clogged feed line. The initial single trim burn was rejected on review; the revised burn solution splits the correction into two 0.21-degree trim burns on C1/C2 spaced one orbit apart, with C3 feed-line purge planned for the next maintenance window. Revised burn solution authorized by the captain.",
        confidence: 0.94,
        durationMs: 110,
      },
    },
    {
      afterMs: 400,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse:
          "VEGA: Approach vector to XJS-7 was off nominal by 0.42 degrees due to RCS cluster C3 under-firing from a partially clogged feed line. The initial single trim burn was rejected on review; the revised burn solution splits the correction into two 0.21-degree trim burns on C1/C2 spaced one orbit apart, with C3 feed-line purge planned for the next maintenance window. Revised burn solution authorized by the captain.",
      },
    },
  ],
};
