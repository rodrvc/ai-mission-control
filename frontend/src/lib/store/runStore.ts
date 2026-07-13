import { create } from "zustand";
import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "@/lib/graph/topology";
import type { NodeStatus, RunEvent, ScenarioId } from "@/lib/types/events";

export interface NodeState {
  status: NodeStatus;
  title?: string;
  summary?: string;
  input?: string;
  output?: string;
  confidence?: number;
  reason?: string;
  durationMs?: number;
  traceUrl?: string;
  lastUpdated?: string;
  /** True once this node has passed through "retrying" at least once. */
  hasRetried?: boolean;
}

export type RunStatus = "idle" | "started" | "awaiting_approval" | "completed" | "failed";

export interface RunState {
  runId: string | null;
  runStatus: RunStatus;
  selectedNodeId: string | null;
  scenarioId: ScenarioId | null;
  nodeStates: Record<string, NodeState>;
  events: RunEvent[];
  activeEdgeIds: string[];
}

export interface RunActions {
  applyEvent: (event: RunEvent) => void;
  selectNode: (nodeId: string | null) => void;
  setScenario: (scenarioId: ScenarioId | null) => void;
  resetRun: () => void;
}

// ---- Pure helpers (unit-testable, no store dependency) ----------------

/** All nodes start pending — the initial/reset nodeStates map. */
export function createInitialNodeStates(): Record<string, NodeState> {
  return Object.fromEntries(
    TOPOLOGY_NODES.map((node) => [node.id, { status: "pending" as NodeStatus }]),
  );
}

/** Merge a node_update event into the previous per-node state. */
export function reduceNodeState(previous: NodeState | undefined, event: RunEvent): NodeState {
  if (event.type !== "node_update") {
    return previous ?? { status: "pending" };
  }
  return {
    status: event.status,
    title: event.title,
    summary: event.summary ?? previous?.summary,
    input: event.input ?? previous?.input,
    output: event.output ?? previous?.output,
    confidence: event.confidence ?? previous?.confidence,
    reason: event.reason ?? previous?.reason,
    durationMs: event.durationMs ?? previous?.durationMs,
    traceUrl: event.traceUrl ?? previous?.traceUrl,
    lastUpdated: event.timestamp,
    hasRetried: previous?.hasRetried || event.status === "retrying",
  };
}

/** An edge is active once both its source and target have left "pending". */
export function computeActiveEdgeIds(nodeStates: Record<string, NodeState>): string[] {
  return TOPOLOGY_EDGES.filter((edge) => {
    const sourceStatus = nodeStates[edge.source]?.status;
    const targetStatus = nodeStates[edge.target]?.status;
    return (
      sourceStatus !== undefined &&
      sourceStatus !== "pending" &&
      targetStatus !== undefined &&
      targetStatus !== "pending"
    );
  }).map((edge) => edge.id);
}

/** Derive the overall run status from a run_status event, else keep previous. */
export function reduceRunStatus(previous: RunStatus, event: RunEvent): RunStatus {
  if (event.type !== "run_status") return previous;
  return event.status;
}

// ---- Store --------------------------------------------------------------

const initialState: RunState = {
  runId: null,
  runStatus: "idle",
  selectedNodeId: null,
  scenarioId: null,
  nodeStates: createInitialNodeStates(),
  events: [],
  activeEdgeIds: [],
};

export const useRunStore = create<RunState & RunActions>((set) => ({
  ...initialState,

  applyEvent: (event) =>
    set((state) => {
      // Ignore stray events from a different run (e.g. a stale timer from a
      // cancelled/reset run). First event after a reset still defines runId.
      if (state.runId !== null && event.runId !== state.runId) {
        return state;
      }

      const events = [...state.events, event];

      if (event.type === "node_update") {
        const nodeStates = {
          ...state.nodeStates,
          [event.nodeId]: reduceNodeState(state.nodeStates[event.nodeId], event),
        };
        return {
          events,
          nodeStates,
          activeEdgeIds: computeActiveEdgeIds(nodeStates),
          runId: state.runId ?? event.runId,
        };
      }

      return {
        events,
        runStatus: reduceRunStatus(state.runStatus, event),
        runId: state.runId ?? event.runId,
      };
    }),

  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  setScenario: (scenarioId) => set({ scenarioId }),

  resetRun: () =>
    set({
      runId: null,
      runStatus: "idle",
      nodeStates: createInitialNodeStates(),
      events: [],
      activeEdgeIds: [],
    }),
}));
