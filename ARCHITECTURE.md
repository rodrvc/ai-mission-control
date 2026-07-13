# Architecture — Mission Control AI

Interactive portfolio app showing a LangGraph multi-agent system as a live, read-only
mission-control graph. Recruiter picks an incident → watches agents route, call tools,
retry, and pass a safety review → inspects any node.

## Structure

```
frontend/   Next.js (App Router) + TypeScript + React Flow + Tailwind (dark theme)
backend/    FastAPI + LangGraph + SSE (Phase 2+). Simulated tools, optional OpenAI.
docs/       Diagrams, flow documentation
```

Phase 1: frontend-only. A **simulation engine** (`frontend/src/lib/simulation/`) plays
scripted event sequences through the same store the SSE client will feed later.

## Graph topology (fixed)

Node IDs (kebab-case, used in events and React Flow):

- `user-request` — entry
- `orchestrator` — Mission Orchestrator, routes to one specialist
- `life-support-specialist` | `navigation-specialist` | `knowledge-specialist`
- `telemetry-tool` | `nav-computer-tool` | `knowledge-base-tool` (tool nodes, distinct visual style)
- `diagnostics-agent`
- `repair-agent`
- `safety-reviewer` — can APPROVE or REJECT (reject loops back to `repair-agent`)
- `quality-check`
- `final-response`

Scenario paths:
1. **life-support** (`"Oxygen pressure is dropping in the life support module."`):
   user-request → orchestrator → life-support-specialist → telemetry-tool →
   diagnostics-agent → repair-agent → safety-reviewer → quality-check → final-response.
   First reviewer pass **rejects** (demo of retry): safety-reviewer → repair-agent →
   safety-reviewer → approve.
2. **navigation** (`"Trajectory deviation detected on approach vector."`):
   user-request → orchestrator → navigation-specialist → nav-computer-tool →
   diagnostics-agent → repair-agent → safety-reviewer (approves) → quality-check → final-response.
3. **knowledge** (`"How long until we reach Mars orbit?"`):
   user-request → orchestrator → knowledge-specialist → knowledge-base-tool →
   quality-check → final-response. (Skips diagnostics/repair/reviewer — dynamic routing.)

Unused nodes in a run stay `pending`/dimmed.

## Event contract (FROZEN — D4)

TypeScript source of truth: `frontend/src/lib/types/events.ts`. SSE will send
`event: message`, `data: <RunEvent JSON>` per line.

```ts
type NodeStatus = "pending" | "running" | "completed" | "failed" | "retrying" | "waiting_review";

interface NodeUpdateEvent {
  type: "node_update";
  runId: string;
  seq: number;               // monotonic per run
  nodeId: string;
  status: NodeStatus;
  title: string;             // e.g. "Analyzing oxygen pressure"
  summary?: string;          // short human-readable result/progress
  input?: string;            // what the node received
  output?: string;           // what it produced (set on completed)
  confidence?: number;       // 0..1
  reason?: string;           // why this decision/route was taken
  durationMs?: number;       // set on completed/failed
  traceUrl?: string;         // LangSmith link (Phase 3)
  timestamp: string;         // ISO 8601
}

interface RunStatusEvent {
  type: "run_status";
  runId: string;
  seq: number;
  status: "started" | "awaiting_approval" | "completed" | "failed";
  activeNodeId?: string;     // node awaiting approval
  finalResponse?: string;    // set when completed
  timestamp: string;
}

type RunEvent = NodeUpdateEvent | RunStatusEvent;
```

HITL: with manual approval ON, after `safety-reviewer` emits `waiting_review` the engine
emits `run_status: awaiting_approval` and pauses. UI shows Approve/Reject buttons;
the decision resumes the run (Phase 1: resumes the script on the approve/reject branch;
Phase 2: POST `/runs/{id}/approval` → LangGraph interrupt resume).

## Backend API (Phase 2)

- `GET  /scenarios` — list of scenarios
- `POST /runs` `{scenarioId, manualApproval: bool}` → `{runId}`
- `GET  /runs/{runId}/events` — SSE stream of RunEvent
- `POST /runs/{runId}/approval` `{approved: bool}`

## Frontend layout

Header (mission name, scenario selector, manual-approval toggle, Run button) ·
left/main: React Flow canvas (read-only, dark, animated edges on active path) ·
right: side panel with node details (opens on node click) + event log feed at bottom.

## Narrative layer (Phase 1.5)

Added on top of the frozen graph/event architecture above to replace the
scenario picker with an in-world onboarding flow (D11–D14). None of the
sections above changed shape — this layer only decides *what prompt text
and HITL behavior* feed into the same engine and event contract.

**Inbox store + email delivery.** `frontend/src/data/emails.ts` holds a
fixed list of emails (`E0` welcome, `E1`–`E3` missions). `E0` arrives on
mount; closing its modal triggers `E1`–`E3` to arrive together after a
short delay (`arrivesAfter`). An unread-count badge on the inbox icon is the
only nudge — there's no forced tour. The inbox is a store, not a page: it
holds read/unread state and delivery timing, independent of any run.

**Router: prompt → ScenarioId | irrelevant.** The command console accepts
free text and passes it to `frontend/src/lib/simulation/router.ts`
(`routePrompt`). Phase 1 scores the prompt against a per-scenario keyword
table (`ROUTING_KEYWORDS`) and returns the top-scoring `ScenarioId`; a
zero-score or tied result returns `"irrelevant"` rather than guessing. The
function signature is deliberately narrow (`string → RoutableScenarioId |
"irrelevant"`) so Phase 2 can swap in a real LLM call without touching any
caller.

**Engine promptText injection.** Whatever the router resolves to, the
simulation engine loads that scenario's script (including the new
`irrelevant` script) and injects the captain's literal prompt text into the
first `user-request` event's `title`/`output`, so the graph and event log
show the operator's own words instead of a canned incident line. Everything
downstream of that first event is still the pre-scripted per-scenario
sequence — only the entry event reflects free text.

**Per-scenario hardwired HITL.** The manual-approval toggle from D2 is gone.
HITL is now a property of the scenario script itself: the `navigation`
script's `reviewGate` step always emits `waiting_review` and always pauses
for Approve/Reject (see its `onApprove`/`onReject` branches), while
`life-support` always auto-continues through its scripted reject → retry →
approve sequence with no pause. `knowledge` and `irrelevant` have no review
gate at all. This means whether a run pauses is now determined by *which
mission the router picked*, not by any run-time setting — the interrupt is
part of that mission's story, not a global mode.
