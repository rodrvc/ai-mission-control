import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { NodeStatus } from "@/lib/types/events";
import type { NodeKind } from "@/lib/graph/topology";

export interface MissionNodeData {
  label: string;
  kind: NodeKind;
  status: NodeStatus;
  /** Sub-agents render smaller with a "SUB-AGENT" micro-tag. */
  variant?: "sub-agent";
  [key: string]: unknown;
}

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

/** Simple geometric robot head — used for agent / reviewer kinds. */
function RobotIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="3" width="4" height="4" rx="1" />
      <rect x="16" y="3" width="4" height="4" rx="1" />
      <line x1="6" y1="7" x2="6" y2="9" />
      <line x1="18" y1="7" x2="18" y2="9" />
      <rect x="4" y="9" width="16" height="12" rx="2.5" />
      <circle cx="9" cy="15" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1.4" fill="currentColor" stroke="none" />
      <line x1="9" y1="18.5" x2="15" y2="18.5" />
    </svg>
  );
}

/** Minimal wrench glyph — used for tool kind. */
function WrenchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 4.7L4 16.3V20h3.7l5.3-5.3a4 4 0 0 0 4.7-5.4l-2.6 2.6-2-2 2.6-2.6Z" />
    </svg>
  );
}

/** Input glyph — an incoming signal arrow, for the user-request node. */
function InputIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9 12h6" />
      <path d="M13 8.5 16.5 12 13 15.5" />
    </svg>
  );
}

/** Output glyph — a checked signal, for the final-response node. */
function OutputIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M8 12.5 10.8 15.3 16 9.5" />
    </svg>
  );
}

const KIND_ICON: Record<NodeKind, () => React.JSX.Element> = {
  input: InputIcon,
  agent: RobotIcon,
  tool: WrenchIcon,
  reviewer: RobotIcon,
  output: OutputIcon,
};

/**
 * Read-only mission graph node card. Not connectable/draggable/deletable —
 * the graph topology is fixed (see GraphCanvas wiring).
 */
export function MissionNode({ data, selected }: NodeProps) {
  const { label, kind, status, variant } = data as MissionNodeData;
  const Icon = KIND_ICON[kind];
  const isSubAgent = variant === "sub-agent";
  const size = isSubAgent ? "w-[104px] min-h-[104px]" : "w-[132px] min-h-[132px]";
  const iconSize = isSubAgent ? "h-7 w-7" : "h-9 w-9";

  return (
    <div
      className={`flex ${size} flex-col items-center justify-between rounded-xl border px-2 py-2.5 text-center transition-colors ${statusClasses(status)} ${
        selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-panel-border" />
      <Handle type="source" position={Position.Right} className="!bg-panel-border" />

      {isSubAgent && (
        <span className="mb-0.5 rounded-sm bg-accent/15 px-1 font-mono text-[8px] font-bold tracking-widest text-accent uppercase">
          Sub-agent
        </span>
      )}

      <span aria-hidden className={`${iconSize} text-text-muted`}>
        <Icon />
      </span>

      <span className="mt-1 line-clamp-2 font-mono text-[10px] leading-tight font-semibold text-foreground uppercase">
        {label}
      </span>

      <span
        className={`mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide uppercase ${chipClasses(status)}`}
      >
        {status === "waiting_review" ? "Awaiting review" : STATUS_LABEL[status]}
      </span>
    </div>
  );
}
