// Simulation engine: plays a scenario's scripted segments through
// `applyEvent` (the store's single entry point) via a cancellable setTimeout
// chain. Owns run identity (runId/seq) and HITL pausing/resuming — scenario
// scripts stay pure data (see lib/simulation/types.ts).

import { irrelevantScript } from "@/lib/simulation/scenarios/irrelevant";
import { knowledgeScript } from "@/lib/simulation/scenarios/knowledge";
import { lifeSupportScript } from "@/lib/simulation/scenarios/life-support";
import { navigationScript } from "@/lib/simulation/scenarios/navigation";
import type { ScenarioScript, ScriptStep } from "@/lib/simulation/types";
import type { RunEvent, ScenarioId } from "@/lib/types/events";

const SCRIPTS: Record<ScenarioId, ScenarioScript> = {
  "life-support": lifeSupportScript,
  navigation: navigationScript,
  knowledge: knowledgeScript,
  irrelevant: irrelevantScript,
};

/** Delay before auto-continuing past a review gate that doesn't pause. */
const AUTO_CONTINUE_DELAY_MS = 900;

/**
 * Narrative HITL (D13): the manual-approval toggle is gone from the UI.
 * Instead, each scenario hardwires its own review behavior — navigation
 * always pauses for captain authorization; life-support keeps its scripted
 * auto reject/retry; knowledge and irrelevant never reach a review gate.
 */
const ALWAYS_PAUSES_FOR_REVIEW: ReadonlySet<ScenarioId> = new Set(["navigation"]);

/** Orchestrator "reason" naming which router match sent the run here. */
const ROUTING_REASON: Record<ScenarioId, string> = {
  "life-support": "Detected life-support incident keywords → routing to Life Support Specialist.",
  navigation: "Detected navigation/trajectory keywords → routing to Navigation Specialist.",
  knowledge: "Detected mission-intel keywords → routing to Knowledge Specialist.",
  irrelevant: "No life-support, navigation, or mission-intel keywords matched → declining request.",
};

export interface RunHandle {
  /** Stop playback immediately; no further events will be emitted. */
  cancel: () => void;
  /** Resume a paused HITL gate down the approve branch. No-op if not paused. */
  approve: () => void;
  /** Resume a paused HITL gate down the reject branch. No-op if not paused. */
  reject: () => void;
}

/**
 * Start playing `scenarioId`'s script into `applyEvent`. `promptText` is the
 * operator's actual typed prompt (from the command console); it overrides
 * the scripted user-request/orchestrator input/output so the graph reflects
 * what was really typed, while downstream nodes keep their scripted content.
 *
 * HITL (D13, narrative): navigation always pauses at the review gate for
 * captain authorization. life-support keeps its scripted auto reject/retry.
 * knowledge and irrelevant have no review gate at all.
 */
export function startRun(
  scenarioId: ScenarioId,
  promptText: string,
  applyEvent: (event: RunEvent) => void,
): RunHandle {
  const script = SCRIPTS[scenarioId];
  const runId = createRunId();
  let seq = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pausedForApproval = false;
  // Counts review-gate passes for scenarios with a real reject→revise→re-gate
  // loop (navigation, D13): starts at 1, incremented every time the reviewer
  // is re-authorized after a DENY. Used to tailor the approve-branch copy
  // ("revised burn solution authorized" on pass >= 2).
  let reviewPass = 1;

  function emit(rawEvent: ScriptStep["event"]) {
    seq += 1;
    // Patch user-request's output and the orchestrator's running-step input
    // so the operator's real prompt appears in the graph instead of the
    // scripted placeholder text. Downstream nodes keep their scripted
    // content untouched.
    let event = rawEvent;
    if (event.type === "node_update" && event.nodeId === "user-request") {
      event = { ...event, title: promptText, output: promptText };
    } else if (event.type === "node_update" && event.nodeId === "orchestrator") {
      if (event.status === "running") {
        event = { ...event, input: promptText };
      } else if (event.status === "completed" || event.status === "failed") {
        event = { ...event, reason: ROUTING_REASON[scenarioId] };
      }
    }
    applyEvent({
      ...event,
      runId,
      seq,
      timestamp: new Date().toISOString(),
    } as RunEvent);
  }

  function playSteps(steps: ScriptStep[], onDone: () => void) {
    let index = 0;
    const next = () => {
      if (cancelled) return;
      if (index >= steps.length) {
        onDone();
        return;
      }
      const step = steps[index];
      index += 1;
      timer = setTimeout(() => {
        if (cancelled) return;
        emit(step.event);
        next();
      }, step.afterMs);
    };
    next();
  }

  function playOutro() {
    const outro = reviewPass >= 2 && script.outroRevised ? script.outroRevised : script.outro;
    playSteps(outro, () => {
      /* run complete */
    });
  }

  function playBranch(branch: ScriptStep[] | undefined) {
    if (!branch || branch.length === 0) {
      playOutro();
      return;
    }
    playSteps(branch, playOutro);
  }

  function reachReviewGate() {
    if (!script.reviewGate || script.reviewGate.length === 0) {
      // No reviewer in this scenario's path — go straight to outro.
      playOutro();
      return;
    }
    playSteps(script.reviewGate, () => {
      if (ALWAYS_PAUSES_FOR_REVIEW.has(scenarioId)) {
        pausedForApproval = true;
        emit({
          type: "run_status",
          status: "awaiting_approval",
          activeNodeId: "safety-reviewer",
        });
        return;
      }
      // Scripted default branch, no pause. life-support demonstrates the
      // retry loop automatically (onReject); other scenarios auto-approve.
      timer = setTimeout(() => {
        if (cancelled) return;
        if (scenarioId === "life-support") {
          playRejectBranch();
        } else {
          playApproveBranch();
        }
      }, AUTO_CONTINUE_DELAY_MS);
    });
  }

  /** Play the reject branch; if the script asks for a real HITL loop, land
   * back on the (re-paused) review gate instead of falling through. */
  function playRejectBranch() {
    if (!script.onReject || script.onReject.length === 0) {
      playOutro();
      return;
    }
    if (script.onRejectLoopsToGate) {
      reviewPass += 1;
      playSteps(script.onReject, reachReviewGate);
      return;
    }
    playSteps(script.onReject, playOutro);
  }

  /** Play the approve branch, preferring the pass-2+ ("revised") copy once
   * the reviewer has looped back through the gate at least once. */
  function playApproveBranch() {
    const branch = reviewPass >= 2 && script.onApproveRevised ? script.onApproveRevised : script.onApprove;
    playBranch(branch);
  }

  // Emit run_status: started immediately, then play the intro.
  emit({ type: "run_status", status: "started" });
  playSteps(script.intro, reachReviewGate);

  return {
    cancel: () => {
      cancelled = true;
      pausedForApproval = false;
      if (timer) clearTimeout(timer);
    },
    approve: () => {
      if (!pausedForApproval || cancelled) return;
      pausedForApproval = false;
      playApproveBranch();
    },
    reject: () => {
      if (!pausedForApproval || cancelled) return;
      pausedForApproval = false;
      playRejectBranch();
    },
  };
}

function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
