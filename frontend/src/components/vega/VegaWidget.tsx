"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ConsoleHint } from "@/components/inbox/ConsoleHint";
import { VegaAvatar, type VegaState } from "@/components/vega/VegaAvatar";
import { SHIP_AI_NAME } from "@/data/narrative";
import { DEFAULT_CONSOLE_PLACEHOLDER, SCENARIO_HINTS } from "@/data/scenarios";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useMissionStore } from "@/lib/store/missionStore";
import { useRunStore } from "@/lib/store/runStore";
import type { RunStatus } from "@/lib/store/runStore";
import type { ScenarioId } from "@/lib/types/events";

/** Console placeholder: while a mission is active, show that domain's partial
 * example instead of the generic prompt — guides tone/shape without handing
 * over the winning keyword (see SCENARIO_HINTS, lib/simulation/router.ts). */
function consolePlaceholder(scenarioId: Exclude<ScenarioId, "irrelevant"> | null): string {
  if (scenarioId === null) return DEFAULT_CONSOLE_PLACEHOLDER;
  return SCENARIO_HINTS[scenarioId].placeholder;
}

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

/** Delay before VEGA's proactive boot line appears (D-ACU59): long enough
 * to read as a deliberate greeting, short enough to catch the captain before
 * they go looking for the FAB themselves. */
const BOOT_LINE_APPEAR_DELAY_MS = 1500;
/** How long the boot line stays up before it self-dismisses. */
const BOOT_LINE_VISIBLE_MS = 5000;
const BOOT_LINE = "Captain on the bridge. Standing by — you will want to check your mail first.";

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

/**
 * Derives VEGA's avatar mood from the widget's real, currently-available
 * signals. Priority order (first match wins) — highest-stakes / most
 * time-sensitive condition first, so it can never be masked by a lower one:
 *
 *   1. offline  — canSubmit is false (compute depleted). Overrides
 *                 everything: there's no point looking busy or happy if the
 *                 crew can't act at all.
 *   2. alert    — awaiting captain authorization. Second-highest: a live
 *                 decision is blocked on the captain right now.
 *   3. thinking — a run is in progress (runStatus === "started").
 *   4. decline  — the last routed run was "irrelevant" (out of scope) AND
 *                 its response is still the one on screen. Signal: page.tsx
 *                 computes `missionScenario = routedScenario === "irrelevant"
 *                 ? null : routedScenario` and calls `setScenario(...)`
 *                 *before* starting the run (see page.tsx handleSubmitPrompt)
 *                 — so `scenarioId === null` in runStore, combined with a
 *                 finalResponse actually present, is the router's own
 *                 classification, not an inference from response text. A
 *                 mission's own scenarioId is never "irrelevant"/null by
 *                 construction (see MISSION_DEFINITIONS in missionStore.ts
 *                 and the comment on activeMissionScenarioId below), so this
 *                 can't misfire on an active mission's completed run.
 *                 Checked before speaking/success so a decline never reads
 *                 as a normal happy response.
 *   5. speaking — a run just completed WITH a response (not a decline) and
 *                 that response is still the one on screen. Chosen over a
 *                 timed transient (setTimeout back to "success"/"idle")
 *                 because the widget already has a natural "still showing
 *                 the response" window for free: as soon as the captain
 *                 submits a new prompt, finalResponse is superseded by the
 *                 next run and this falls through to thinking/idle on its
 *                 own — no extra timer/state needed, and no risk of the
 *                 avatar flipping expression mid-read.
 *   6. listening — the command textarea currently has focus (captain is
 *                  composing a prompt).
 *   7. idle     — default / at rest.
 *
 * Not wired (no natural trigger in this widget today, documented rather than
 * invented):
 *   - warning: no condition in this widget is distinct from `alert` but
 *     lower-urgency. runStatus "failed" is the closest candidate but isn't
 *     rendered anywhere in the widget today (RUN_STATUS_LABEL has no
 *     "failed" entry), so treating it as `warning` would be inventing UI
 *     behavior beyond what's asked. Left out rather than forced.
 *   - success: intentionally folded into `speaking` per the "keep it
 *     natural" guidance above rather than split into a separate transient
 *     state — see point 5.
 */
function stateFromRun(
  canSubmit: boolean,
  runStatus: RunStatus,
  finalResponse: string | null,
  scenarioId: ScenarioId | null,
  isTextareaFocused: boolean,
): VegaState {
  if (!canSubmit) return "offline";
  if (runStatus === "awaiting_approval") return "alert";
  if (runStatus === "started") return "thinking";
  if (finalResponse && scenarioId === null) return "decline";
  if (finalResponse) return "speaking";
  if (isTextareaFocused) return "listening";
  return "idle";
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
  // The routed scenario for the current/last run, set by page.tsx before
  // starting it — null means the router classified the prompt as
  // "irrelevant" (see stateFromRun's `decline` branch below). Distinct from
  // activeMissionScenarioId just below, which describes the active MISSION,
  // not the last routed run.
  const runScenarioId = useRunStore((state) => state.scenarioId);
  // A mission's scenarioId is never "irrelevant" by construction (see
  // MISSION_DEFINITIONS in missionStore.ts).
  const activeMissionScenarioId = useMissionStore(
    (state) =>
      (Object.values(state.missions).find((mission) => mission.status === "active")?.scenarioId ?? null) as Exclude<
        ScenarioId,
        "irrelevant"
      > | null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<ConversationExchange[]>([]);
  const [isBootLineVisible, setIsBootLineVisible] = useState(false);
  const [isTextareaFocused, setIsTextareaFocused] = useState(false);
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

  // Proactive boot sequence (D-ACU59): VEGA announces itself shortly after
  // mount instead of waiting for the captain to discover the FAB on their
  // own. Auto-dismisses; cancelled if the captain opens the widget first.
  useEffect(() => {
    const appearTimer = setTimeout(() => setIsBootLineVisible(true), BOOT_LINE_APPEAR_DELAY_MS);
    return () => clearTimeout(appearTimer);
  }, []);

  useEffect(() => {
    if (!isBootLineVisible) return;
    const dismissTimer = setTimeout(() => setIsBootLineVisible(false), BOOT_LINE_VISIBLE_MS);
    return () => clearTimeout(dismissTimer);
  }, [isBootLineVisible]);

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

  const vegaState = stateFromRun(canSubmit, runStatus, finalResponse, runScenarioId, isTextareaFocused);

  const open = () => {
    setIsOpen(true);
    setIsBootLineVisible(false);
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
                  onFocus={() => setIsTextareaFocused(true)}
                  onBlur={() => setIsTextareaFocused(false)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submit();
                    }
                  }}
                  rows={3}
                  placeholder={consolePlaceholder(activeMissionScenarioId)}
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
        {isBootLineVisible && !isOpen && (
          <div
            role="status"
            className="animate-mc-pulse pointer-events-none absolute right-0 bottom-full z-10 mb-2 w-64 rounded-md border border-accent/50 bg-panel-raised px-3 py-2 font-mono text-xs text-accent shadow-lg"
          >
            <span
              aria-hidden="true"
              className="absolute -bottom-1 right-6 h-2 w-2 rotate-45 border-r border-b border-accent/50 bg-panel-raised"
            />
            {BOOT_LINE}
          </div>
        )}
        <ConsoleHint />
        <button
          type="button"
          onClick={open}
          aria-label={`Open ${SHIP_AI_NAME} console`}
          aria-expanded={isOpen}
          className={`relative flex h-28 w-28 items-center justify-center rounded-full border-2 bg-panel shadow-lg transition-colors ${
            isAwaitingApproval
              ? "animate-mc-pulse border-warning text-warning"
              : "border-accent text-accent hover:bg-accent/10"
          }`}
        >
          {/* Sized to fill the h-28 w-28 (112px) FAB with a small breathing
              margin — the old VegaMark was only 28px and left the droid
              looking lost in the circle. */}
          <VegaAvatar state={vegaState} size={96} title={`${SHIP_AI_NAME} — ${vegaState}`} />
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
