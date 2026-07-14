// Fixed graph topology — node list, positions, and edges.
// Source of truth for node IDs: ARCHITECTURE.md "Graph topology (fixed)".
// No auto-layout library: positions are hand-placed for a hub layout per
// PROJECT_DECISIONS.md D19 — orchestrator fans out directly to every agent
// (specialists + diagnostics), tools are side-attachments of their agent
// (never continue the flow), and repair-agent is a visually subordinate
// sub-agent of diagnostics-agent.

export type NodeKind = "input" | "agent" | "tool" | "reviewer" | "output";

export interface TopologyNode {
  id: string;
  label: string;
  /** Role / responsibility description shown in the inspector. */
  role: string;
  kind: NodeKind;
  x: number;
  y: number;
  /** Sub-agents render smaller and visually subordinate to their parent. */
  variant?: "sub-agent";
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  /** Marks the safety-reviewer -> repair-agent reject loop for distinct styling. */
  isRejectLoop?: boolean;
  /** Marks a tool-attachment edge: dashed/muted, never continues the flow. */
  kind?: "uses";
}

// Vertical lanes for the three specialists (hub layout: fanned right of the
// orchestrator, each with its tool attached directly below). Lanes are
// spaced 300px apart — wide enough that an agent node (~132px) stacked with
// its tool (offset diagonally below-right, see tool x/y below) never
// intersects the next lane's agent or tool bounding box.
const LANE_LIFE_SUPPORT = 0;
const LANE_NAVIGATION = 300;
const LANE_KNOWLEDGE = 600;

export const TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: "user-request",
    label: "User Request",
    role: "Entry point — the incoming operator request that starts a mission run.",
    kind: "input",
    x: 0,
    y: 220,
  },
  {
    id: "orchestrator",
    label: "Mission Orchestrator",
    role: "Routes the request to the correct specialist agent based on its content.",
    kind: "agent",
    x: 240,
    y: 220,
  },

  // Specialists (fanned vertically to the right of the orchestrator, hub style)
  {
    id: "life-support-specialist",
    label: "Life Support Specialist",
    role: "Handles life-support system faults such as oxygen/pressure anomalies.",
    kind: "agent",
    x: 520,
    y: LANE_LIFE_SUPPORT,
  },
  {
    id: "navigation-specialist",
    label: "Navigation Specialist",
    role: "Handles trajectory and navigation deviations.",
    kind: "agent",
    x: 520,
    y: LANE_NAVIGATION,
  },
  {
    id: "knowledge-specialist",
    label: "Knowledge Specialist",
    role: "Answers informational queries using the knowledge base.",
    kind: "agent",
    x: 520,
    y: LANE_KNOWLEDGE,
  },

  // Tools — side-attachments offset diagonally below-right of their agent
  // (x + 40, y + 170) so the tool's bounding box (~104px sub-agent-sized)
  // never overlaps the next lane's agent/tool at LANE spacing of 300.
  {
    id: "telemetry-tool",
    label: "Telemetry Tool",
    role: "Reads live telemetry sensor data for the life-support system.",
    kind: "tool",
    x: 520 + 40,
    y: LANE_LIFE_SUPPORT + 170,
  },
  {
    id: "nav-computer-tool",
    label: "Nav Computer Tool",
    role: "Queries the navigation computer for trajectory data.",
    kind: "tool",
    x: 520 + 40,
    y: LANE_NAVIGATION + 170,
  },
  {
    id: "knowledge-base-tool",
    label: "Knowledge Base Tool",
    role: "Looks up mission facts in the knowledge base.",
    kind: "tool",
    x: 520 + 40,
    y: LANE_KNOWLEDGE + 170,
  },

  // Shared diagnostics hub (life-support & navigation specialists both hand
  // off here) with repair-agent as its visually subordinate sub-agent.
  {
    id: "diagnostics-agent",
    label: "Diagnostics Agent",
    role: "Analyzes specialist findings to determine root cause and required repair.",
    kind: "agent",
    x: 860,
    y: 110,
  },
  {
    id: "repair-agent",
    label: "Repair Agent",
    role: "Executes the repair plan produced by diagnostics.",
    kind: "agent",
    variant: "sub-agent",
    x: 1050,
    y: 210,
  },

  {
    id: "safety-reviewer",
    label: "Safety Reviewer",
    role: "Reviews the repair for safety; approves or rejects (rejects loop back to repair).",
    kind: "reviewer",
    x: 1280,
    y: 110,
  },

  {
    id: "quality-check",
    label: "Quality Check",
    role: "Final quality gate before the response is returned to the operator.",
    kind: "agent",
    x: 1520,
    y: 220,
  },
  {
    id: "final-response",
    label: "Final Response",
    role: "Terminal node — the response delivered back to the operator.",
    kind: "output",
    x: 1760,
    y: 220,
  },
];

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  { id: "e-user-orchestrator", source: "user-request", target: "orchestrator" },

  // Hub: orchestrator connects directly to every agent (specialists + diagnostics).
  { id: "e-orch-life", source: "orchestrator", target: "life-support-specialist" },
  { id: "e-orch-nav", source: "orchestrator", target: "navigation-specialist" },
  { id: "e-orch-knowledge", source: "orchestrator", target: "knowledge-specialist" },

  // Tool attachments — side branches, dashed/muted, never continue the flow.
  { id: "e-life-telemetry", source: "life-support-specialist", target: "telemetry-tool", kind: "uses" },
  { id: "e-nav-navcomputer", source: "navigation-specialist", target: "nav-computer-tool", kind: "uses" },
  { id: "e-knowledge-kb", source: "knowledge-specialist", target: "knowledge-base-tool", kind: "uses" },

  // Delegation: specialists hand off to the shared diagnostics agent directly
  // (not through their tools).
  { id: "e-life-diagnostics", source: "life-support-specialist", target: "diagnostics-agent" },
  { id: "e-nav-diagnostics", source: "navigation-specialist", target: "diagnostics-agent" },

  // Sub-agent: diagnostics delegates to repair-agent.
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

  // Knowledge path bypasses diagnostics/repair/review straight to quality-check.
  { id: "e-knowledge-quality", source: "knowledge-specialist", target: "quality-check" },

  { id: "e-quality-final", source: "quality-check", target: "final-response" },
];
