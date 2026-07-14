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

## Game layer (Phase 1.6)

Adds a resource simulation on top of the narrative layer (D15–D18). The
frozen event contract and `runStore` reducer above are untouched — this
layer only *reacts* to events and email delivery from the outside.

**shipStore + 1s tick.** `frontend/src/lib/store/shipStore.ts` holds O2,
hull, fuel, tokens, and `muted`, each clamped to its max. A `setInterval`
at `TICK_INTERVAL_MS` (1000ms) drives the oxygen leak every tick; all other
resource changes (token spend/earn, fuel drain, hull damage/repair) are
one-shot store actions called from elsewhere, not tick-driven.

**Hull-band leak function.** `getO2LeakRateForHull(hull)`
(`frontend/src/lib/game/constants.ts`) is a pure, unit-testable function
mapping hull integrity to a leak rate: ≥70 sealed (no leak), ≥50 slow
(~10 min to empty), ≥30 fast (~5 min), <30 critical (~100s). Bands are
tuned so the captain always has time to notice and react — never instant
death. The tick calls this function against current hull on every beat, so
a hull repair mid-leak immediately slows or stops it on the next tick.

**Incidents module (start/stop anchored to narrative events).**
`frontend/src/lib/game/incidents.ts` pairs each mission's resource effect
with its trigger, deliberately kept outside `runStore`/`shipStore` (SRP —
"an email arrived" and "a mission finished" are narrative events, not run
or resource state): `applyLifeSupportIncident()` fires once when the E2
mission batch is delivered (drops hull toward a fixed target, never raises
it, never double-applies) and `resolveLifeSupportIncident()` undoes exactly
that damage plus refills O2 on mission completion. `startFuelDrain()` /
`stopFuelDrain()` bracket the E3 navigation deviation the same way, via a
plain interval. `resetIncidents()` clears in-memory tracking on campaign
restart.

**Economy bridge decorates `applyEvent`, doesn't replace it.**
`frontend/src/lib/game/economy.ts`'s `createEconomyBridge(scenarioId,
applyToStore)` returns a wrapped `applyEvent` that: charges
`NODE_TOKEN_COST[nodeId]` on every transition to `running` **or**
`retrying` (a retry is a fresh activation and bills again — the intended
lesson, not a bug), pays `MISSION_TOKEN_REWARD[scenarioId]` and calls the
matching incident-resolve/stop function on `run_status: completed`, and
triggers sounds on `awaiting_approval`/`completed` — then always forwards
the untouched event to the real store reducer. `runStore.applyEvent` itself
stays a pure function of the frozen contract; call sites (`page.tsx`)
create one bridge per run and feed every event through it instead of the
raw store action.

**Sound module.** `frontend/src/lib/sound/sounds.ts` generates all cues
with Web Audio oscillators (no audio files) and creates its `AudioContext`
lazily on the first `pointerdown`/`keydown` (browser autoplay policy);
calls before that are queued and flushed on unlock. Sounds are triggered
at state-transition edges (mail arrival, approval-required, mission
complete, game over), not on level/threshold checks each tick, so they
fire once per event rather than once per tick while a condition holds.
Respects `shipStore.muted`.
