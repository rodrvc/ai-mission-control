# Mission Control Backend (ACU-68)

FastAPI + LangGraph + SSE backend for the `life-support` mission. Ships with
a 100%-functional simulated fallback (no OpenAI key required) that
reproduces the frontend's scripted `life-support.ts` copy exactly, plus a
scaffolded (inactive without a key) real-LLM path.

## Setup

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
cp .env.example .env   # optional — leave OPENAI_API_KEY empty for simulated mode
```

## Run

```bash
.venv/bin/uvicorn app.main:app --port 8000
```

`GET /healthz` reports `{"ok":true,"llm":"simulated"}` until `OPENAI_API_KEY`
is set in `.env`.

## Test

```bash
.venv/bin/pytest -q
```

## API

- `POST /runs` `{prompt, scenarioId?}` -> `{runId, scenario:"life-support"}` or `{scenario:"unsupported"}` (no `runId` key on unsupported prompts).
- `GET /runs/{runId}/events` -> SSE stream (`text/event-stream`) of `RunEvent` JSON, one per `data:` line, matching `frontend/src/lib/types/events.ts` exactly (camelCase).
- `POST /runs/{runId}/approval` `{approved}` -> resumes a run parked at the safety-reviewer HITL interrupt.
- `GET /healthz` -> `{ok, llm: "openai" | "simulated"}`.

## E2E smoke test (curl)

```bash
RUNID=$(curl -s -X POST localhost:8000/runs -H 'content-type: application/json' \
  -d '{"prompt":"Oxygen pressure is dropping"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["runId"])')

curl -sN "localhost:8000/runs/$RUNID/events"   # parks at run_status: awaiting_approval

# in another shell:
curl -X POST "localhost:8000/runs/$RUNID/approval" -H 'content-type: application/json' -d '{"approved":true}'
# the first curl's stream then resumes to run_status: completed
```

## Architecture notes

- `events/contract.py` mirrors `frontend/src/lib/types/events.ts` field-for-field (Pydantic aliases, `populate_by_name=True`).
- `events/emitter.py` is the single place that stamps `runId`/`seq`/`timestamp` — `seq` is monotonic per run, starting at 1.
- `graph/nodes.py::safety_reviewer` and `graph/nodes.py::hitl_gate` are deliberately split into two LangGraph nodes: LangGraph replays a node's full body from the top on every `interrupt()` resume, so any side-effecting emit placed before the `interrupt()` call would double-fire. `hitl_gate` contains nothing but the `interrupt()` call itself, so its (harmless) replay never re-emits events.
- `llm/simulated.py` holds the verbatim fallback copy, reproduced from `frontend/src/lib/simulation/scenarios/life-support.ts`'s `onReject` path — including the `orchestrator` routing `reason`, which is NOT life-support.ts's own scripted string but the override `frontend/src/lib/simulation/engine.ts` applies at runtime (`ROUTING_REASON["life-support"]`).
- `manualApproval` is intentionally absent from the `POST /runs` request body — derogated per decision D13 in favor of the real `interrupt()`-based HITL gate.
