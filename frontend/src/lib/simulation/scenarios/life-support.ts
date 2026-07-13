// life-support scenario: user-request -> orchestrator -> life-support-specialist
// -> telemetry-tool -> diagnostics-agent -> repair-agent -> safety-reviewer
// (REJECTS first pass) -> repair-agent (retry) -> safety-reviewer (approves)
// -> quality-check -> final-response. See ARCHITECTURE.md scenario 1.

import type { ScenarioScript } from "@/lib/simulation/types";

export const lifeSupportScript: ScenarioScript = {
  intro: [
    {
      afterMs: 400,
      event: {
        type: "node_update",
        nodeId: "user-request",
        status: "completed",
        title: "Oxygen pressure is dropping in the life support module.",
        summary: "Operator incident report received.",
        output: "Oxygen pressure is dropping in the life support module.",
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "running",
        title: "Routing incident",
        input: "Oxygen pressure is dropping in the life support module.",
      },
    },
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "orchestrator",
        status: "completed",
        title: "Routed to Life Support Specialist",
        output: "life-support-specialist",
        confidence: 0.95,
        reason: "Keywords 'oxygen' and 'life support module' map directly to the life-support domain.",
        durationMs: 820,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "life-support-specialist",
        status: "running",
        title: "Assessing life-support incident",
        input: "Oxygen pressure is dropping in the life support module.",
      },
    },
    {
      afterMs: 1100,
      event: {
        type: "node_update",
        nodeId: "life-support-specialist",
        status: "completed",
        title: "Pulling live telemetry",
        summary: "Requesting O2 sensor and valve telemetry before diagnosing.",
        output: "Dispatched telemetry request for O2 partial pressure and valve states.",
        confidence: 0.9,
        durationMs: 980,
      },
    },
    {
      afterMs: 500,
      event: {
        type: "node_update",
        nodeId: "telemetry-tool",
        status: "running",
        title: "Reading life-support telemetry",
        input: "O2 sensors + valve bank V-2xx",
      },
    },
    {
      afterMs: 1200,
      event: {
        type: "node_update",
        nodeId: "telemetry-tool",
        status: "completed",
        title: "Telemetry read complete",
        output: "O2 partial pressure 18.4 kPa, dropping 0.3 kPa/min · valve V-227 flow anomaly",
        confidence: 0.97,
        durationMs: 1050,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "running",
        title: "Diagnosing root cause",
        input: "O2 partial pressure 18.4 kPa, dropping 0.3 kPa/min · valve V-227 flow anomaly",
      },
    },
    {
      afterMs: 1400,
      event: {
        type: "node_update",
        nodeId: "diagnostics-agent",
        status: "completed",
        title: "Root cause identified",
        output: "Valve V-227 stuck partially open, venting cabin O2 into a return line with no isolation. Requires valve reseat and line isolation before repressurization.",
        confidence: 0.88,
        durationMs: 1320,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "running",
        title: "Drafting repair plan (attempt 1)",
        input: "Valve V-227 stuck partially open, venting O2 into return line with no isolation.",
      },
    },
    {
      afterMs: 1300,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "completed",
        title: "Repair plan drafted",
        output: "Reseat valve V-227 actuator and repressurize cabin O2 to 21 kPa.",
        confidence: 0.78,
        durationMs: 1180,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "running",
        title: "Reviewing repair plan (pass 1)",
        input: "Reseat valve V-227 actuator and repressurize cabin O2 to 21 kPa.",
      },
    },
  ],

  // Reviewer pauses here. HITL ON: engine emits this + run_status
  // awaiting_approval, then waits for approve()/reject(). HITL OFF: engine
  // auto-continues onto onReject (the scripted first-pass rejection) after
  // a short delay, per architecture ("life-support still shows its scripted
  // first rejection automatically").
  reviewGate: [
    {
      afterMs: 1100,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "waiting_review",
        title: "Awaiting safety verdict (pass 1)",
        input: "Reseat valve V-227 actuator and repressurize cabin O2 to 21 kPa.",
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
        title: "Repair plan approved",
        output: "APPROVED",
        reason: "Isolation-before-reseat sequence eliminates re-leak risk.",
        confidence: 0.96,
        durationMs: 700,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "running",
        title: "Final quality pass",
        input: "Approved repair plan for valve V-227 reseat and repressurization.",
      },
    },
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "completed",
        title: "Quality check passed",
        output: "Response verified for accuracy and operator tone.",
        confidence: 0.94,
        durationMs: 880,
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
          "VEGA: Valve V-227 was stuck open aboard the Meridian, venting cabin O2 into an unisolated return line. Repair executed: reseated valve V-227 actuator and repressurized cabin O2 to 21 kPa. Safety review approved on first pass. O2 levels stable.",
        confidence: 0.95,
        durationMs: 120,
      },
    },
    {
      afterMs: 400,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse:
          "VEGA: Valve V-227 was stuck open aboard the Meridian, venting cabin O2 into an unisolated return line. Repair executed: reseated valve V-227 actuator and repressurized cabin O2 to 21 kPa. Safety review approved on first pass. O2 levels stable.",
      },
    },
  ],

  onReject: [
    {
      afterMs: 900,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "failed",
        title: "Repair plan rejected",
        output: "REJECTED",
        reason: "Repair plan does not isolate valve V-227 before repressurization — reseating under pressure risks re-triggering the same leak.",
        confidence: 0.91,
        durationMs: 640,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "retrying",
        title: "Revising repair plan (attempt 2)",
        input: "Rejection reason: isolate V-227 before repressurization.",
      },
    },
    {
      afterMs: 1400,
      event: {
        type: "node_update",
        nodeId: "repair-agent",
        status: "completed",
        title: "Revised repair plan drafted",
        output: "Close upstream isolation valve V-226, reseat V-227 actuator offline, verify seal, then reopen V-226 and repressurize cabin O2 to 21 kPa.",
        confidence: 0.93,
        durationMs: 1260,
      },
    },
    {
      afterMs: 700,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "running",
        title: "Reviewing repair plan (pass 2)",
        input: "Close upstream isolation valve V-226, reseat V-227 actuator offline, verify seal, then reopen V-226 and repressurize.",
      },
    },
    {
      afterMs: 1100,
      event: {
        type: "node_update",
        nodeId: "safety-reviewer",
        status: "completed",
        title: "Repair plan approved (pass 2)",
        output: "APPROVED",
        reason: "Isolation-before-reseat sequence eliminates the re-leak risk flagged in pass 1.",
        confidence: 0.96,
        durationMs: 700,
      },
    },
    {
      afterMs: 600,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "running",
        title: "Final quality pass",
        input: "Approved repair plan for valve V-227 isolation and reseat.",
      },
    },
    {
      afterMs: 1000,
      event: {
        type: "node_update",
        nodeId: "quality-check",
        status: "completed",
        title: "Quality check passed",
        output: "Response verified for accuracy and operator tone.",
        confidence: 0.94,
        durationMs: 880,
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
          "VEGA: Valve V-227 was stuck open aboard the Meridian, venting cabin O2 into an unisolated return line. Repair executed: isolated upstream valve V-226, reseated V-227 offline, verified seal, repressurized to 21 kPa. Safety review approved on second pass. O2 levels stable.",
        confidence: 0.95,
        durationMs: 120,
      },
    },
    {
      afterMs: 400,
      event: {
        type: "run_status",
        status: "completed",
        finalResponse:
          "VEGA: Valve V-227 was stuck open aboard the Meridian, venting cabin O2 into an unisolated return line. Repair executed: isolated upstream valve V-226, reseated V-227 offline, verified seal, repressurized to 21 kPa. Safety review approved on second pass. O2 levels stable.",
      },
    },
  ],

  outro: [],
};
