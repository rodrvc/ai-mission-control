// Event contract (FROZEN — see ARCHITECTURE.md "Event contract (FROZEN — D4)").
// This file is the TypeScript source of truth. Do not change shapes without
// updating ARCHITECTURE.md first.

export type NodeStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "retrying"
  | "waiting_review";

export interface NodeUpdateEvent {
  type: "node_update";
  runId: string;
  seq: number; // monotonic per run
  nodeId: string;
  status: NodeStatus;
  title: string; // e.g. "Analyzing oxygen pressure"
  summary?: string; // short human-readable result/progress
  input?: string; // what the node received
  output?: string; // what it produced (set on completed)
  confidence?: number; // 0..1
  reason?: string; // why this decision/route was taken
  durationMs?: number; // set on completed/failed
  traceUrl?: string; // LangSmith link (Phase 3)
  timestamp: string; // ISO 8601
}

export interface RunStatusEvent {
  type: "run_status";
  runId: string;
  seq: number;
  status: "started" | "awaiting_approval" | "completed" | "failed";
  activeNodeId?: string; // node awaiting approval
  finalResponse?: string; // set when completed
  timestamp: string;
}

export type RunEvent = NodeUpdateEvent | RunStatusEvent;

// Scenario metadata (frontend-only concept, not part of the SSE contract).
// "irrelevant" is the guardrail path for prompts no crew/system can service.
export type ScenarioId = "life-support" | "navigation" | "knowledge" | "irrelevant";

export interface Scenario {
  id: ScenarioId;
  label: string;
  request: string;
  description: string;
}
