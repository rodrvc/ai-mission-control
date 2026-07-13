// Simulation step DSL. A scenario script is a plain list of segments; the
// engine plays segments in order, filling in runId/seq/timestamp for every
// event. This keeps scenario files declarative data (easy to review against
// ARCHITECTURE.md paths) with no timing/HITL logic embedded in them.

import type { NodeUpdateEvent, RunStatusEvent } from "@/lib/types/events";

/** A single scripted event, minus the fields the engine fills in. */
export type ScriptedNodeUpdate = Omit<NodeUpdateEvent, "runId" | "seq" | "timestamp">;
export type ScriptedRunStatus = Omit<RunStatusEvent, "runId" | "seq" | "timestamp">;
export type ScriptedEvent = ScriptedNodeUpdate | ScriptedRunStatus;

/** One scripted step: wait `afterMs`, then apply `event`. */
export interface ScriptStep {
  afterMs: number;
  event: ScriptedEvent;
}

/**
 * A scenario script split into segments so the engine can pause for HITL
 * approval and resume down the correct branch:
 *  - intro: everything up to (and not including) the safety-reviewer gate.
 *  - reviewGate: the safety-reviewer `waiting_review` step (present only for
 *    scenarios that have a reviewer in their path).
 *  - onApprove: steps to play when the reviewer approves (pass 1 copy).
 *  - onReject: steps to play when the reviewer rejects (retry loop).
 *  - outro: quality-check → final-response → run_status completed. Shared
 *    tail played after either branch reaches an approved state.
 *
 * Scenarios with no reviewer (e.g. knowledge) omit reviewGate/onApprove/
 * onReject and put everything in `intro` + `outro`.
 *
 * `onRejectLoopsToGate` (D13 real HITL loop, navigation): when true, after
 * `onReject`'s steps finish playing, the engine re-plays `reviewGate` and
 * pauses for captain authorization again instead of falling through to
 * `onApprove`/outro. This models a genuine reject → revise → re-authorize
 * loop instead of a silent auto-approve after one DENY.
 *
 * `onApproveRevised`: approve-branch steps used instead of `onApprove` when
 * the captain authorizes on pass 2+ (i.e. after at least one DENY looped
 * back through the gate), so the copy can say "revised ... authorized"
 * rather than implying first-pass approval. Falls back to `onApprove` if
 * omitted.
 *
 * `outroRevised`: outro steps (quality-check → final-response → run_status)
 * used instead of `outro` once pass 2+ is reached, so the final response
 * describes the revised plan instead of the original rejected one. Falls
 * back to `outro` if omitted.
 */
export interface ScenarioScript {
  intro: ScriptStep[];
  reviewGate?: ScriptStep[];
  onApprove?: ScriptStep[];
  onApproveRevised?: ScriptStep[];
  onReject?: ScriptStep[];
  onRejectLoopsToGate?: boolean;
  outro: ScriptStep[];
  outroRevised?: ScriptStep[];
}
