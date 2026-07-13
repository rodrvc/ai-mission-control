# Flow Walkthrough: Life Support Mission

This is a plain-English, step-by-step account of one full run of the
**life-support** mission — the richest of the four, since it's the one
that shows a reviewer rejection, a retry, and a human approval pause (in
its sibling, the navigation mission). For the other missions and the
guardrail decline, see the comparison table in the root
[README](../README.md#missions).

The run starts the same way regardless of mission: a directive lands in the
inbox, the captain reads it, and types a free-text order into VEGA's
command console. That text is the entry point below.

Order typed into the console: *"Oxygen pressure is dropping in the life
support module."*

## Step by step

0. **Mission email → console** — the directive arrives from Dr. Osei
   (Flight Surgeon) describing the anomaly in narrative terms and telling
   the captain to route it through VEGA. The captain paraphrases it (or
   pastes it) into the console. Nothing about the graph exists yet — this
   step only produces the free-text string the router will see next.

1. **User Request** — the captain's order is logged as the entry point of
   the run.

2. **Mission Orchestrator** — reads the request and decides which specialist
   should own it. In Phase 1 this is **keyword-based intent matching**
   (`frontend/src/lib/simulation/router.ts`): the prompt is scored against a
   per-mission keyword table, and the highest-scoring, non-tied mission
   wins. It routes to the **Life Support Specialist** with high confidence
   (0.95), because words like "oxygen" and "life support module" hit that
   table directly. This routing decision is itself an event with a `reason`
   field, so the graph can show *why* a path was taken, not just *that* it
   was taken. Phase 2 swaps the keyword table for a real LLM router behind
   the same function signature — the rest of the graph doesn't change.

3. **Life Support Specialist** — assesses the incident and decides it needs
   live data before diagnosing anything, so it dispatches a request to the
   telemetry tool rather than guessing.

4. **Telemetry Tool** — reads live sensor data and reports the finding: O2
   partial pressure at 18.4 kPa and dropping, with a flow anomaly on valve
   V-227. This is a tool call — a discrete, side-effecting step distinct
   from an agent's reasoning, and it's rendered with its own visual style in
   the graph.

5. **Diagnostics Agent** — takes the raw telemetry and turns it into a root
   cause: valve V-227 is stuck partially open, venting cabin O2 into a
   return line with no isolation.

6. **Repair Agent (attempt 1)** — drafts a repair plan: reseat the valve
   actuator and repressurize the cabin. Confidence is comparatively low
   (0.78) — a hint that this plan hasn't yet passed review.

7. **Safety Reviewer (pass 1)** — this is the review gate that decides
   whether a repair plan is safe to execute. It evaluates the plan and
   **rejects it**: reseating the valve while it's still connected to the
   pressurized system risks re-triggering the exact same leak. The rejection
   includes a `reason` field explaining the specific flaw, not just a
   pass/fail verdict.

   The life-support mission's reviewer is scripted to auto-reject-then-retry
   on its own — the engine advances through this rejection and the retry
   below without waiting on the captain, so the loop is always visible on
   this mission. Contrast with the **navigation** mission, where the reviewer
   instead halts at `waiting_review` and genuinely waits: the run's overall
   status becomes `awaiting_approval`, the UI surfaces Approve/Reject
   buttons, and only the captain's own click resumes it (Approve skips
   straight to quality check; Reject drives the same repair-agent retry loop
   shown here). That pause is hardwired to the navigation mission's
   correction-burn moment, not a global setting — it's part of that
   mission's story, not a toggle the captain can flip on any request.

8. **Repair Agent (attempt 2, retrying)** — takes the rejection reason as
   input and revises the plan: isolate the upstream valve V-226 first,
   reseat V-227 offline, verify the seal, *then* reopen V-226 and
   repressurize. This is the retry — the same node re-entered with new
   input, not a separate node.

9. **Safety Reviewer (pass 2)** — reviews the revised plan and **approves**
   it (confidence 0.96): the isolate-before-reseat sequence eliminates the
   re-leak risk flagged in pass 1.

10. **Quality Check** — a final gate that verifies the approved plan and
    the response text before anything reaches the operator.

11. **Final Response** — the operator receives a plain-language summary of
    the incident, the fix, and current status. The run's overall status
    moves to `completed`, and this event carries the full `finalResponse`
    text.

Total node visits for this run: 12 (repair-agent and safety-reviewer are each
visited twice — once per review pass). Nodes outside this path
(navigation-specialist, nav-computer-tool, knowledge-specialist,
knowledge-base-tool) stay `pending` and dimmed for the entire run, since the
orchestrator never routed to them.

## The guardrail: declining an irrelevant order

Not every string typed into the console maps to a mission. If the keyword
router scores every mission at zero (or ties two missions, which is treated
the same as no match), the orchestrator does not guess — it declines the
order in character. This is the shortest possible run, by design
(`frontend/src/lib/simulation/scenarios/irrelevant.ts`):

1. **User Request** — the free-text order is logged as usual.
2. **Mission Orchestrator** — runs, then immediately reports `failed` with
   `output: "No matching crew or ship system"` and a `reason` explaining the
   order is outside mission scope. No specialist, tool, diagnostics, repair,
   or reviewer node ever activates — they stay `pending` for the whole run.
3. **Run status** — goes straight to `completed` (not `failed`; declining is
   a successful, expected outcome, not an error), and VEGA's `finalResponse`
   tells the captain the request isn't relevant and lists what the crew
   actually handles.

This is the same event contract as any other run, just a much shorter path
through it — the guardrail is a routing outcome, not a special-cased UI
state.

## Event contract

All of the above is expressed as a stream of two event types, defined once in
`frontend/src/lib/types/events.ts` and treated as frozen — the Phase 1
simulator and the future backend both emit exactly this shape, so nothing in
the UI has to change when the real backend replaces the simulator.

- `node_update` — one agent/tool node transitioning between states
  (`pending → running → completed`, or `retrying`, `failed`,
  `waiting_review`).
- `run_status` — the run as a whole starting, pausing for approval,
  completing, or failing.

Example: the rejection event from step 7 above.

```json
{
  "type": "node_update",
  "runId": "run-1752345600000-a1b2c3",
  "seq": 12,
  "nodeId": "safety-reviewer",
  "status": "failed",
  "title": "Repair plan rejected",
  "output": "REJECTED",
  "reason": "Repair plan does not isolate valve V-227 before repressurization — reseating under pressure risks re-triggering the same leak.",
  "confidence": 0.91,
  "durationMs": 640,
  "timestamp": "2026-07-12T14:00:07.512Z"
}
```

Every event carries a monotonic `seq` per `runId`, so the UI (or any
consumer) can detect gaps or out-of-order delivery regardless of transport.
In Phase 2+, these events arrive over SSE (`event: message`,
`data: <json>` per line) instead of from the local script player — the event
shapes themselves don't change.
