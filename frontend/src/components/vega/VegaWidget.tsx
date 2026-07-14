"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConsoleHint } from "@/components/inbox/ConsoleHint";
import { SHIP_AI_NAME } from "@/data/narrative";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useRunStore } from "@/lib/store/runStore";
import type { RunStatus } from "@/lib/store/runStore";

interface VegaWidgetProps {
  isRunning: boolean;
  onSubmitPrompt: (prompt: string) => void;
  onAbort: () => void;
  onApprove: () => void;
  onReject: () => void;
  /** False when tokens are depleted (D17) — input goes read-only. */
  canSubmit?: boolean;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  started: "Run in progress…",
  awaiting_approval: "Awaiting captain authorization…",
};

/** Pulls the most recent completed run's final response out of the flat
 * event log — finalResponse only ever appears on a "completed" run_status
 * event, never on individual node_update events. */
function findLastFinalResponse(events: ReturnType<typeof useRunStore.getState>["events"]) {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const event = events[i];
    if (event.type === "run_status" && event.status === "completed" && event.finalResponse) {
      return event.finalResponse;
    }
  }
  return null;
}

function standingLine(runStatus: RunStatus, finalResponse: string | null): string {
  if (runStatus === "started") return RUN_STATUS_LABEL.started;
  if (runStatus === "awaiting_approval") return RUN_STATUS_LABEL.awaiting_approval;
  if (finalResponse) return finalResponse;
  return "Standing by for your orders, Captain.";
}

/** One captain->VEGA exchange kept in the widget's local conversation
 * history (component state only — no store changes). */
interface ConversationExchange {
  id: string;
  prompt: string;
  response: string | null;
}

/** How many past exchanges to keep visible (most recent last). */
const MAX_HISTORY = 4;

/**
 * VEGA floating chat widget (D21): the primary way to delegate a task to the
 * ship's crew, replacing the old header console. A circular FAB opens a
 * chat-style window; the window's footer textarea + EXECUTE reuses the exact
 * same submit path page.tsx already wires through Header, so no routing or
 * economy logic is duplicated here.
 */
export function VegaWidget({
  isRunning,
  onSubmitPrompt,
  onAbort,
  onApprove,
  onReject,
  canSubmit = true,
}: VegaWidgetProps) {
  const runStatus = useRunStore((state) => state.runStatus);
  const events = useRunStore((state) => state.events);
  const runId = useRunStore((state) => state.runId);
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<ConversationExchange[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dismissConsoleHint = useInboxStore((state) => state.dismissConsoleHint);

  const finalResponse = useMemo(() => findLastFinalResponse(events), [events]);
  const isAwaitingApproval = runStatus === "awaiting_approval";

  // Derive the history to render from committed state during render itself
  // (React's documented "adjusting state during render" pattern, using
  // useState — not useRef — to track the last-seen values) rather than a
  // useEffect, so a run reset or a fresh final response is reflected in the
  // very same render instead of causing an extra cascading render.
  const [lastSeenRunId, setLastSeenRunId] = useState(runId);
  const [lastSeenFinalResponse, setLastSeenFinalResponse] = useState(finalResponse);
  let renderedHistory = history;
  if (runId !== lastSeenRunId) {
    setLastSeenRunId(runId);
    if (runId === null) {
      renderedHistory = [];
      setHistory([]);
    }
  }
  if (finalResponse !== lastSeenFinalResponse) {
    setLastSeenFinalResponse(finalResponse);
    if (finalResponse && renderedHistory.length > 0) {
      const last = renderedHistory[renderedHistory.length - 1];
      if (last.response !== finalResponse) {
        renderedHistory = [...renderedHistory.slice(0, -1), { ...last, response: finalResponse }];
        setHistory(renderedHistory);
      }
    }
  }

  useEffect(() => {
    if (isOpen) textareaRef.current?.focus();
  }, [isOpen]);

  // Esc closes regardless of which control inside the widget has focus
  // (textarea, AUTHORIZE/DENY, etc.) — matching InboxModal's document-level
  // listener rather than relying on a single element's onKeyDown.
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const open = () => {
    setIsOpen(true);
    dismissConsoleHint();
  };
  const close = () => setIsOpen(false);

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning || !canSubmit) return;
    setHistory((previous) =>
      [
        ...previous,
        { id: `${Date.now()}-${previous.length}`, prompt: trimmed, response: null },
      ].slice(-MAX_HISTORY),
    );
    onSubmitPrompt(trimmed);
    setPrompt("");
  };

  return (
    <div className="pointer-events-none fixed right-6 bottom-44 z-30 flex max-h-[calc(100vh-2rem)] flex-col items-end justify-end gap-3 lg:right-[24.5rem]">
      {isOpen && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={`${SHIP_AI_NAME} chat`}
          className="pointer-events-auto flex h-[30rem] max-h-[calc(100vh-11rem)] w-[26rem] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-lg border border-panel-border bg-panel shadow-2xl"
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-panel-border bg-panel-raised px-4 py-3">
            <span className="font-mono text-xs font-semibold tracking-widest text-accent uppercase">
              {SHIP_AI_NAME} — Ship Intelligence
            </span>
            <button
              type="button"
              onClick={close}
              aria-label="Close VEGA console"
              className="shrink-0 rounded-md border border-panel-border px-2 py-1 font-mono text-xs text-text-muted hover:border-accent hover:text-accent"
            >
              Close
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {renderedHistory.length > 0 && (
              <div className="mb-4 flex flex-col gap-2">
                {renderedHistory.map((exchange) => (
                  <div key={exchange.id} className="flex flex-col gap-1">
                    <p className="self-end rounded-md bg-panel-raised px-2.5 py-1.5 text-right font-mono text-xs text-text-muted">
                      {exchange.prompt}
                    </p>
                    {exchange.response && (
                      <p className="font-mono text-xs whitespace-pre-wrap text-foreground/90">
                        {exchange.response}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!(
              renderedHistory.length > 0 &&
              renderedHistory[renderedHistory.length - 1].response === finalResponse &&
              finalResponse
            ) && (
              <p className="font-mono text-xs whitespace-pre-wrap text-foreground/90">
                {standingLine(runStatus, finalResponse)}
              </p>
            )}

            {isAwaitingApproval && (
              <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3">
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
          </div>

          {/* Footer: input */}
          <div className="shrink-0 border-t border-panel-border p-3">
            {isRunning ? (
              <div className="flex items-center justify-between gap-3 rounded-md border border-panel-border bg-panel-raised px-3 py-2">
                <span className="truncate font-mono text-xs text-text-muted">
                  {RUN_STATUS_LABEL[runStatus] ?? "Run in progress…"}
                </span>
                <button
                  type="button"
                  onClick={onAbort}
                  className="shrink-0 rounded-md border border-danger bg-danger/15 px-3 py-1 font-mono text-xs font-semibold tracking-wide text-danger uppercase hover:bg-danger/25"
                >
                  Abort
                </button>
              </div>
            ) : !canSubmit ? (
              <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 font-mono text-xs text-danger">
                INSUFFICIENT COMPUTE — agents offline
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <textarea
                  ref={textareaRef}
                  aria-label="Command input to VEGA"
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  rows={3}
                  placeholder="Delegate a task to the ship's crew…"
                  className="w-full resize-none rounded-md border border-panel-border bg-panel-raised px-3 py-2 font-mono text-sm text-foreground outline-none placeholder:text-text-muted focus:border-accent"
                />
                <button
                  type="button"
                  disabled={!prompt.trim()}
                  onClick={submit}
                  className="self-end rounded-md border border-accent bg-accent/15 px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-accent uppercase hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Execute
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating action button */}
      <div className="pointer-events-auto relative">
        <ConsoleHint />
        <button
          type="button"
          onClick={open}
          aria-label={`Open ${SHIP_AI_NAME} console`}
          aria-expanded={isOpen}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full border-2 bg-panel shadow-lg transition-colors ${
            isAwaitingApproval
              ? "animate-mc-pulse border-warning text-warning"
              : "border-accent text-accent hover:bg-accent/10"
          }`}
        >
          <VegaMark />
          {isRunning && !isAwaitingApproval && (
            <span
              aria-hidden="true"
              className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-accent"
            />
          )}
        </button>
      </div>
    </div>
  );
}

/** Simple concentric-circles / lens mark for VEGA — distinctive at 64px,
 * legible as a favicon-scale glyph, no external assets. */
function VegaMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      className="h-7 w-7"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
