// Fixed graph topology — node list, positions, and edges.
// Source of truth for node IDs: ARCHITECTURE.md "Graph topology (fixed)".
// No auto-layout library: positions are hand-placed for a clean left-to-right
// flow with the three specialist lanes fanned vertically.

export type NodeKind = "input" | "agent" | "tool" | "reviewer" | "output";

export interface TopologyNode {
  id: string;
  label: string;
  /** Role / responsibility description shown in the inspector. */
  role: string;
  kind: NodeKind;
  x: number;
  y: number;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  /** Marks the safety-reviewer -> repair-agent reject loop for distinct styling. */
  isRejectLoop?: boolean;
}

// Vertical lanes for the three specialists + their tools.
const LANE_LIFE_SUPPORT = 60;
const LANE_NAVIGATION = 260;
const LANE_KNOWLEDGE = 460;

export const TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: "user-request",
    label: "User Request",
    role: "Entry point — the incoming operator request that starts a mission run.",
    kind: "input",
    x: 0,
    y: 260,
  },
  {
    id: "orchestrator",
    label: "Mission Orchestrator",
    role: "Routes the request to the correct specialist agent based on its content.",
    kind: "agent",
    x: 220,
    y: 260,
  },

  // Specialists (fanned vertically)
  {
    id: "life-support-specialist",
    label: "Life Support Specialist",
    role: "Handles life-support system faults such as oxygen/pressure anomalies.",
    kind: "agent",
    x: 460,
    y: LANE_LIFE_SUPPORT,
  },
  {
    id: "navigation-specialist",
    label: "Navigation Specialist",
    role: "Handles trajectory and navigation deviations.",
    kind: "agent",
    x: 460,
    y: LANE_NAVIGATION,
  },
  {
    id: "knowledge-specialist",
    label: "Knowledge Specialist",
    role: "Answers informational queries using the knowledge base.",
    kind: "agent",
    x: 460,
    y: LANE_KNOWLEDGE,
  },

  // Tools (one per specialist)
  {
    id: "telemetry-tool",
    label: "Telemetry Tool",
    role: "Reads live telemetry sensor data for the life-support system.",
    kind: "tool",
    x: 700,
    y: LANE_LIFE_SUPPORT,
  },
  {
    id: "nav-computer-tool",
    label: "Nav Computer Tool",
    role: "Queries the navigation computer for trajectory data.",
    kind: "tool",
    x: 700,
    y: LANE_NAVIGATION,
  },
  {
    id: "knowledge-base-tool",
    label: "Knowledge Base Tool",
    role: "Looks up mission facts in the knowledge base.",
    kind: "tool",
    x: 700,
    y: LANE_KNOWLEDGE,
  },

  // Shared diagnostics/repair/review pipeline (life-support & navigation paths)
  {
    id: "diagnostics-agent",
    label: "Diagnostics Agent",
    role: "Analyzes tool output to determine root cause and required repair.",
    kind: "agent",
    x: 940,
    y: 160,
  },
  {
    id: "repair-agent",
    label: "Repair Agent",
    role: "Executes the repair plan produced by diagnostics.",
    kind: "agent",
    x: 1180,
    y: 160,
  },
  {
    id: "safety-reviewer",
    label: "Safety Reviewer",
    role: "Reviews the repair for safety; approves or rejects (rejects loop back to repair).",
    kind: "reviewer",
    x: 1420,
    y: 160,
  },

  {
    id: "quality-check",
    label: "Quality Check",
    role: "Final quality gate before the response is returned to the operator.",
    kind: "agent",
    x: 1660,
    y: 260,
  },
  {
    id: "final-response",
    label: "Final Response",
    role: "Terminal node — the response delivered back to the operator.",
    kind: "output",
    x: 1900,
    y: 260,
  },
];

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  { id: "e-user-orchestrator", source: "user-request", target: "orchestrator" },

  // Orchestrator fans out to specialists
  { id: "e-orch-life", source: "orchestrator", target: "life-support-specialist" },
  { id: "e-orch-nav", source: "orchestrator", target: "navigation-specialist" },
  { id: "e-orch-knowledge", source: "orchestrator", target: "knowledge-specialist" },

  // Specialists to their tools
  { id: "e-life-telemetry", source: "life-support-specialist", target: "telemetry-tool" },
  { id: "e-nav-navcomputer", source: "navigation-specialist", target: "nav-computer-tool" },
  { id: "e-knowledge-kb", source: "knowledge-specialist", target: "knowledge-base-tool" },

  // Life-support & navigation converge on diagnostics
  { id: "e-telemetry-diagnostics", source: "telemetry-tool", target: "diagnostics-agent" },
  { id: "e-navcomputer-diagnostics", source: "nav-computer-tool", target: "diagnostics-agent" },

  { id: "e-diagnostics-repair", source: "diagnostics-agent", target: "repair-agent" },
  { id: "e-repair-safety", source: "repair-agent", target: "safety-reviewer" },

  // Reject loop: safety-reviewer -> repair-agent
  {
    id: "e-safety-repair-reject",
    source: "safety-reviewer",
    target: "repair-agent",
    isRejectLoop: true,
  },

  { id: "e-safety-quality", source: "safety-reviewer", target: "quality-check" },

  // Knowledge path bypasses diagnostics/repair/review straight to quality-check
  { id: "e-kb-quality", source: "knowledge-base-tool", target: "quality-check" },

  { id: "e-quality-final", source: "quality-check", target: "final-response" },
];
