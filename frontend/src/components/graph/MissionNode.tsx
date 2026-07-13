import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeStatus } from "@/lib/types/events";
import type { NodeKind } from "@/lib/graph/topology";

export interface MissionNodeData {
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  [key: string]: unknown;
}

const KIND_GLYPH: Record<NodeKind, string> = {
  input: "▶",
  agent: "◆",
  tool: "⚙",
  reviewer: "◎",
  output: "■",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  retrying: "Retrying",
  waiting_review: "Awaiting review",
};

function statusClasses(status: NodeStatus): string {
  switch (status) {
    case "pending":
      return "border-panel-border bg-panel opacity-50";
    case "running":
      return "border-accent bg-panel-raised shadow-[0_0_0_1px_var(--accent)] animate-mc-pulse";
    case "completed":
      return "border-success bg-panel-raised";
    case "failed":
      return "border-danger bg-panel-raised";
    case "retrying":
      return "border-warning bg-panel-raised animate-mc-pulse";
    case "waiting_review":
      return "border-warning bg-panel-raised";
    default:
      return "border-panel-border bg-panel";
  }
}

function chipClasses(status: NodeStatus): string {
  switch (status) {
    case "completed":
      return "bg-success/15 text-success";
    case "failed":
      return "bg-danger/15 text-danger";
    case "retrying":
      return "bg-warning/15 text-warning";
    case "waiting_review":
      return "bg-warning/20 text-warning";
    case "running":
      return "bg-accent/15 text-accent";
    default:
      return "bg-panel-raised text-text-muted";
  }
}

/**
 * Read-only mission graph node card. Not connectable/draggable/deletable —
 * the graph topology is fixed (see GraphCanvas wiring).
 */
export function MissionNode({ data, selected }: NodeProps) {
  const { label, kind, status } = data as MissionNodeData;

  return (
    <div
      className={`w-[200px] rounded-lg border px-3 py-2.5 transition-colors ${statusClasses(status)} ${
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-panel-border" />
      <Handle type="source" position={Position.Right} className="!bg-panel-border" />

      <div className="flex items-center gap-2">
        <span aria-hidden className="font-mono text-sm text-text-muted">
          {KIND_GLYPH[kind]}
        </span>
        <span className="truncate font-mono text-xs font-semibold text-foreground uppercase">
          {label}
        </span>
      </div>

      <div className="mt-2">
        <span
          className={`inline-block rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase ${chipClasses(status)}`}
        >
          {status === "waiting_review" ? "Awaiting review" : STATUS_LABEL[status]}
        </span>
      </div>
    </div>
  );
}
