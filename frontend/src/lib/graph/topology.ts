// Fixed graph topology — node list, positions, and edges.
// Source of truth for node IDs: ARCHITECTURE.md "Graph topology (fixed)".
// No auto-layout library: positions are hand-placed for a hub layout per
// PROJECT_DECISIONS.md D19 — orchestrator fans out directly to every agent
// (specialists + diagnostics), tools are side-attachments of their agent
// (never continue the flow), and repair-agent is a visually subordinate
// sub-agent of diagnostics-agent.
//
// Layout model: a single horizontal "spine" carries the main request/response
// path (user-request -> orchestrator -> diagnostics-agent -> safety-reviewer
// -> quality-check -> final-response) all at SPINE_Y, so the primary flow
// reads as a straight left-to-right line. The three specialists fan out
// vertically between the orchestrator and diagnostics-agent, each with its
// tool stub directly below. repair-agent sits below the spine as a visually
// subordinate sub-agent of diagnostics-agent.

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
  /** React Flow handle ids — see MissionNode.tsx for the handles each kind exposes. */
  sourceHandle?: string;
  targetHandle?: string;
  /** Marks the safety-reviewer -> repair-agent reject loop for distinct styling. */
  isRejectLoop?: boolean;
  /** Marks a tool-attachment edge: dashed/muted, never continues the flow. */
  kind?: "uses";
}

// The main path lives on one shared y so it reads as a straight spine.
const SPINE_Y = 700;

// Agent cards are 132px tall (see MissionNode.tsx `min-h-[132px]`). Tools sit
// a full card-height plus a 60px breathing-room gap below their agent's top,
// so the stub edge reads as a real connector instead of touching the card.
const AGENT_CARD_HEIGHT = 132;
const TOOL_GAP = 60;
const TOOL_OFFSET = AGENT_CARD_HEIGHT + TOOL_GAP;

// Vertical fan for the three specialists, placed between orchestrator and
// diagnostics-agent. Knowledge is pulled further down-left (its own x, not
// the shared specialist column) so its outgoing edge to quality-check has a
// clear, wide corridor away from repair-agent.
const LANE_LIFE_SUPPORT = 150;
const LANE_NAVIGATION = 430;
const LANE_KNOWLEDGE = 950;

export const TOPOLOGY_NODES: TopologyNode[] = [
  {
    id: "user-request",
    label: "User Request",
    role: "Entry point — the incoming operator request that starts a mission run.",
    kind: "input",
    x: 0,
    y: SPINE_Y,
  },
  {
    id: "orchestrator",
    label: "Mission Orchestrator",
    role: "Routes the request to the correct specialist agent based on its content.",
    kind: "agent",
    x: 240,
    y: SPINE_Y,
  },

  // Specialists (fanned vertically between orchestrator and diagnostics-agent)
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
    // Pulled further down and slightly left of the shared specialist column
    // so its long edge to quality-check has a wide, clear corridor that
    // passes well below repair-agent instead of hugging it.
    x: 380,
    y: LANE_KNOWLEDGE,
  },

  // Tools — compact circular badges (48px) centered horizontally under their
  // agent (agent is 132px wide, so tool.x = agent.x + (132 - 48) / 2 = agent.x
  // + 42) and positioned a full card-height + 60px gap below for a visibly
  // separated stub edge.
  {
    id: "telemetry-tool",
    label: "Telemetry",
    role: "Reads live telemetry sensor data for the life-support system.",
    kind: "tool",
    x: 460 + 42,
    y: LANE_LIFE_SUPPORT + TOOL_OFFSET,
  },
  {
    id: "nav-computer-tool",
    label: "Nav Computer",
    role: "Queries the navigation computer for trajectory data.",
    kind: "tool",
    x: 460 + 42,
    y: LANE_NAVIGATION + TOOL_OFFSET,
  },
  {
    id: "knowledge-base-tool",
    label: "Knowledge Base",
    role: "Looks up mission facts in the knowledge base.",
    kind: "tool",
    x: 380 + 42,
    y: LANE_KNOWLEDGE + TOOL_OFFSET,
  },

  // Shared diagnostics hub (life-support & navigation specialists both hand
  // off here) sits back on the spine, with repair-agent as its visually
  // subordinate sub-agent placed just below it. Shifted right, roughly under
  // safety-reviewer, so the knowledge -> quality-check corridor stays clear.
  {
    id: "diagnostics-agent",
    label: "Diagnostics Agent",
    role: "Analyzes specialist findings to determine root cause and required repair.",
    kind: "agent",
    x: 780,
    y: SPINE_Y,
  },
  {
    id: "repair-agent",
    label: "Repair Agent",
    role: "Executes the repair plan produced by diagnostics.",
    kind: "agent",
    variant: "sub-agent",
    x: 1080,
    y: 1020,
  },

  {
    id: "safety-reviewer",
    label: "Safety Reviewer",
    role: "Reviews the repair for safety; approves or rejects (rejects loop back to repair).",
    kind: "reviewer",
    x: 1220,
    y: SPINE_Y,
  },

  {
    id: "quality-check",
    label: "Quality Check",
    role: "Final quality gate before the response is returned to the operator.",
    kind: "agent",
    x: 1460,
    y: SPINE_Y,
  },
  {
    id: "final-response",
    label: "Final Response",
    role: "Terminal node — the response delivered back to the operator.",
    kind: "output",
    x: 1680,
    y: SPINE_Y,
  },
];

export const TOPOLOGY_EDGES: TopologyEdge[] = [
  {
    id: "e-user-orchestrator",
    source: "user-request",
    target: "orchestrator",
    sourceHandle: "out",
    targetHandle: "in",
  },

  // Hub: orchestrator connects directly to every agent (specialists + diagnostics).
  {
    id: "e-orch-life",
    source: "orchestrator",
    target: "life-support-specialist",
    sourceHandle: "out",
    targetHandle: "in",
  },
  {
    id: "e-orch-nav",
    source: "orchestrator",
    target: "navigation-specialist",
    sourceHandle: "out",
    targetHandle: "in",
  },
  {
    id: "e-orch-knowledge",
    source: "orchestrator",
    target: "knowledge-specialist",
    sourceHandle: "out",
    targetHandle: "in",
  },

  // Tool attachments — short vertical stubs, dashed/muted, never continue the flow.
  {
    id: "e-life-telemetry",
    source: "life-support-specialist",
    target: "telemetry-tool",
    sourceHandle: "tool",
    kind: "uses",
  },
  {
    id: "e-nav-navcomputer",
    source: "navigation-specialist",
    target: "nav-computer-tool",
    sourceHandle: "tool",
    kind: "uses",
  },
  {
    id: "e-knowledge-kb",
    source: "knowledge-specialist",
    target: "knowledge-base-tool",
    sourceHandle: "tool",
    kind: "uses",
  },

  // Delegation: specialists hand off to the shared diagnostics agent directly
  // (not through their tools).
  {
    id: "e-life-diagnostics",
    source: "life-support-specialist",
    target: "diagnostics-agent",
    sourceHandle: "out",
    targetHandle: "in",
  },
  {
    id: "e-nav-diagnostics",
    source: "navigation-specialist",
    target: "diagnostics-agent",
    sourceHandle: "out",
    targetHandle: "in",
  },

  // Sub-agent: diagnostics delegates to repair-agent.
  {
    id: "e-diagnostics-repair",
    source: "diagnostics-agent",
    target: "repair-agent",
    sourceHandle: "out",
    targetHandle: "in",
  },

  {
    id: "e-repair-safety",
    source: "repair-agent",
    target: "safety-reviewer",
    sourceHandle: "out",
    targetHandle: "in",
  },

  // Reject loop: safety-reviewer -> repair-agent (short curved bezier from
  // reviewer's bottom back down to repair-agent, rendered as type "default").
  {
    id: "e-safety-repair-reject",
    source: "safety-reviewer",
    target: "repair-agent",
    sourceHandle: "reject",
    targetHandle: "in",
    isRejectLoop: true,
  },

  {
    id: "e-safety-quality",
    source: "safety-reviewer",
    target: "quality-check",
    sourceHandle: "out",
    targetHandle: "in",
  },

  // Knowledge path bypasses diagnostics/repair/review straight to
  // quality-check. Enters from the bottom (not the left "in" handle) so the
  // long bypass curve approaches from underneath and never crosses through
  // repair-agent or safety-reviewer, which sit between the two on the spine.
  {
    id: "e-knowledge-quality",
    source: "knowledge-specialist",
    target: "quality-check",
    sourceHandle: "out",
    targetHandle: "in-bottom",
  },

  {
    id: "e-quality-final",
    source: "quality-check",
    target: "final-response",
    sourceHandle: "out",
    targetHandle: "in",
  },
];
