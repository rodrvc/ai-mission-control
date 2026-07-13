"use client";

import { TOPOLOGY_NODES } from "@/lib/graph/topology";
import { useRunStore } from "@/lib/store/runStore";
import type { NodeStatus } from "@/lib/types/events";

const STATUS_CHIP_CLASSES: Record<NodeStatus, string> = {
  pending: "bg-panel-raised text-text-muted",
  running: "bg-accent/15 text-accent",
  completed: "bg-success/15 text-success",
  failed: "bg-danger/15 text-danger",
  retrying: "bg-warning/15 text-warning",
  waiting_review: "bg-warning/20 text-warning",
};

const STATUS_LABEL: Record<NodeStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  retrying: "Retrying",
  waiting_review: "Awaiting review",
};

const EMPTY = "—";

interface SidePanelProps {
  onApprove: () => void;
  onReject: () => void;
}

/**
 * Right-hand inspector panel. Shows details for the selected node, sourced
 * from the fixed topology (label/role) and the live run store (status/
 * input/output/confidence/etc). Empty state when nothing is selected.
 * Shows Approve/Reject controls when the run is paused for HITL approval
 * on the safety-reviewer node, and the final response prominently when
 * final-response is selected and completed.
 */
export function SidePanel({ onApprove, onReject }: SidePanelProps) {
  const selectedNodeId = useRunStore((state) => state.selectedNodeId);
  const nodeStates = useRunStore((state) => state.nodeStates);
  const runStatus = useRunStore((state) => state.runStatus);

  const topoNode = TOPOLOGY_NODES.find((node) => node.id === selectedNodeId);
  const nodeState = selectedNodeId ? nodeStates[selectedNodeId] : undefined;

  const showApproval =
    runStatus === "awaiting_approval" && selectedNodeId === "safety-reviewer";

  return (
    <aside className="flex w-full shrink-0 flex-col border-t border-panel-border bg-panel px-5 py-4 lg:h-full lg:w-[360px] lg:overflow-y-auto lg:border-t-0 lg:border-l">
      <h2 className="font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
        Node Inspector
      </h2>

      {!topoNode || !nodeState ? (
        <div className="flex flex-1 items-center justify-center py-10">
          <p className="text-center text-sm text-text-muted">
            Select a node to inspect
          </p>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="font-mono text-sm font-semibold text-foreground">
              {topoNode.label}
            </p>
            <p className="mt-1 text-xs text-text-muted">{topoNode.role}</p>
          </div>

          <span
            className={`inline-block w-fit rounded px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide uppercase ${STATUS_CHIP_CLASSES[nodeState.status]}`}
          >
            {STATUS_LABEL[nodeState.status]}
          </span>

          {showApproval && (
            <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
              <p className="font-mono text-[10px] tracking-widest text-warning uppercase">
                Awaiting captain authorization
              </p>
              <p className="mt-1 text-sm text-foreground">
                The correction burn requires command sign-off before execution.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onApprove}
                  className="flex-1 rounded-md border border-success bg-success/15 px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-success uppercase hover:bg-success/25"
                >
                  Authorize
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  className="flex-1 rounded-md border border-danger bg-danger/15 px-3 py-1.5 font-mono text-xs font-semibold tracking-wide text-danger uppercase hover:bg-danger/25"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {topoNode.id === "final-response" &&
            nodeState.status === "completed" &&
            nodeState.output && (
              <div className="rounded-md border border-success/40 bg-success/10 p-3">
                <p className="font-mono text-[10px] tracking-widest text-success uppercase">
                  Final response
                </p>
                <p className="mt-1 text-sm whitespace-pre-wrap text-foreground">
                  {nodeState.output}
                </p>
              </div>
            )}

          <Field label="Title" value={nodeState.title} />
          <Field label="Input" value={nodeState.input} multiline />
          <Field label="Output" value={nodeState.output} multiline />
          <Field label="Summary" value={nodeState.summary} multiline />

          <div>
            <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
              Confidence
            </p>
            {typeof nodeState.confidence === "number" ? (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-raised">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${Math.round(nodeState.confidence * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs text-foreground">
                  {Math.round(nodeState.confidence * 100)}%
                </span>
              </div>
            ) : (
              <p className="mt-1 text-sm text-foreground">{EMPTY}</p>
            )}
          </div>

          <Field label="Reason" value={nodeState.reason} multiline />

          <Field
            label="Duration"
            value={
              typeof nodeState.durationMs === "number"
                ? `${nodeState.durationMs} ms`
                : undefined
            }
          />

          <div>
            <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
              Trace
            </p>
            {nodeState.traceUrl ? (
              <a
                href={nodeState.traceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block truncate text-sm text-accent underline underline-offset-2"
              >
                {nodeState.traceUrl}
              </a>
            ) : (
              <p className="mt-1 text-sm text-foreground">{EMPTY}</p>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function Field({
  label,
  value,
  multiline,
}: {
  label: string;
  value?: string;
  multiline?: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
        {label}
      </p>
      <p
        className={`mt-1 text-sm text-foreground ${multiline ? "whitespace-pre-wrap" : "truncate"}`}
      >
        {value ?? EMPTY}
      </p>
    </div>
  );
}
