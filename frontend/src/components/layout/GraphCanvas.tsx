"use client";

import { useMemo } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
} from "@xyflow/react";
import { MissionNode, type MissionNodeData } from "@/components/graph/MissionNode";
import { TOPOLOGY_EDGES, TOPOLOGY_NODES } from "@/lib/graph/topology";
import { useRunStore } from "@/lib/store/runStore";

const nodeTypes: NodeTypes = { mission: MissionNode };
const edgeTypes: EdgeTypes = {};

const EDGE_MUTED_COLOR = "#1f2a3a";
const EDGE_ACCENT_COLOR = "#2dd4bf";
const EDGE_WARNING_COLOR = "#f5a524";

interface GraphCanvasProps {
  onApprove: () => void;
  onReject: () => void;
}

/**
 * Read-only React Flow canvas rendering the fixed mission topology.
 * Node data (status) is derived live from the run store; layout/positions
 * come from the static topology (no auto-layout, no drag/connect/delete).
 * Overlays an unmissable approval banner while paused for HITL, and a
 * final-response toast once the run completes.
 */
export function GraphCanvas({ onApprove, onReject }: GraphCanvasProps) {
  const nodeStates = useRunStore((state) => state.nodeStates);
  const activeEdgeIds = useRunStore((state) => state.activeEdgeIds);
  const selectedNodeId = useRunStore((state) => state.selectedNodeId);
  const selectNode = useRunStore((state) => state.selectNode);
  const runStatus = useRunStore((state) => state.runStatus);

  const isAwaitingApproval = runStatus === "awaiting_approval";
  const finalResponse =
    runStatus === "completed" ? nodeStates["final-response"]?.output : undefined;

  const nodes: Node[] = useMemo(
    () =>
      TOPOLOGY_NODES.map((topo) => ({
        id: topo.id,
        type: "mission",
        position: { x: topo.x, y: topo.y },
        data: {
          label: topo.label,
          kind: topo.kind,
          status: nodeStates[topo.id]?.status ?? "pending",
        } satisfies MissionNodeData,
        selected: topo.id === selectedNodeId,
        draggable: false,
        connectable: false,
        deletable: false,
      })),
    [nodeStates, selectedNodeId],
  );

  const edges: Edge[] = useMemo(
    () =>
      TOPOLOGY_EDGES.map((topo) => {
        // The reject-loop edge only counts as "active" once repair-agent has
        // actually gone through a retry pass — otherwise it should render
        // muted like any other idle edge (still dashed as a topology hint).
        const isActive = topo.isRejectLoop
          ? activeEdgeIds.includes(topo.id) && Boolean(nodeStates["repair-agent"]?.hasRetried)
          : activeEdgeIds.includes(topo.id);
        const color = isActive
          ? topo.isRejectLoop
            ? EDGE_WARNING_COLOR
            : EDGE_ACCENT_COLOR
          : EDGE_MUTED_COLOR;

        return {
          id: topo.id,
          source: topo.source,
          target: topo.target,
          type: topo.isRejectLoop ? "smoothstep" : "default",
          animated: isActive,
          deletable: false,
          selectable: false,
          style: {
            stroke: color,
            strokeWidth: isActive ? 2 : 1.5,
            strokeDasharray: topo.isRejectLoop ? "6 4" : undefined,
          },
        } satisfies Edge;
      }),
    [activeEdgeIds, nodeStates],
  );

  return (
    <div
      id="mission-graph-canvas"
      className="mc-grid-bg relative flex flex-1 overflow-hidden"
    >
      {isAwaitingApproval && (
        <div className="absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-4 rounded-md border border-warning/50 bg-panel/95 px-4 py-2 shadow-lg backdrop-blur">
          <span className="font-mono text-xs font-semibold tracking-wide text-warning uppercase">
            Captain authorization required — correction burn ready
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="rounded border border-success bg-success/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-success uppercase hover:bg-success/25"
            >
              Authorize
            </button>
            <button
              type="button"
              onClick={onReject}
              className="rounded border border-danger bg-danger/15 px-3 py-1 font-mono text-[11px] font-semibold tracking-wide text-danger uppercase hover:bg-danger/25"
            >
              Deny
            </button>
          </div>
        </div>
      )}

      {finalResponse && (
        <div className="absolute bottom-3 left-1/2 z-10 w-[min(720px,90%)] -translate-x-1/2 rounded-md border border-success/50 bg-panel/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="font-mono text-[10px] font-semibold tracking-widest text-success uppercase">
            Final response
          </p>
          <p className="mt-1 text-sm text-foreground">{finalResponse}</p>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_, node) => selectNode(node.id)}
        onPaneClick={() => selectNode(null)}
      >
        <Background variant={BackgroundVariant.Dots} gap={32} size={1} color="#1f2a3a" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
