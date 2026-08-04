"""HTTP API: the 4 endpoints the frontend's SSE client depends on.

POST /runs                       -> classify prompt, create+start a run (or report unsupported)
GET  /runs/{runId}/events        -> SSE stream of RunEvent JSON, drains until terminal
POST /runs/{runId}/approval      -> resume a run parked at the safety-reviewer interrupt
GET  /healthz                    -> {ok, llm: "openai" | "simulated"}
"""

from collections.abc import AsyncIterator

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from sse_starlette.sse import EventSourceResponse

from app.api.schemas import ApprovalRequest, HealthResponse, RunCreate, RunCreated
from app.llm.client import is_llm_available
from app.router.classify import classify_prompt
from app.runs.registry import registry

router = APIRouter()

# Sent periodically by EventSourceResponse to keep idle connections (e.g.
# while a run is parked at awaiting_approval) alive through proxies/load
# balancers that would otherwise time out an inactive stream.
_SSE_PING_SECONDS = 15


@router.post("/runs")
async def create_run(body: RunCreate) -> JSONResponse:
    scenario = classify_prompt(body.prompt)
    if scenario != "life-support":
        # Plan: unsupported prompts return `{scenario:"unsupported"}` with NO
        # runId key at all (not even null) — omit rather than null it out.
        return JSONResponse(RunCreated(scenario="unsupported").model_dump(by_alias=True, exclude_none=True))

    session = registry.create()
    session.start(body.prompt)
    created = RunCreated(run_id=session.run_id, scenario="life-support")
    return JSONResponse(created.model_dump(by_alias=True, exclude_none=True))


@router.get("/runs/{run_id}/events")
async def stream_events(run_id: str) -> EventSourceResponse:
    session = registry.get(run_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator() -> AsyncIterator[dict]:
        queue = session.emitter.queue
        while True:
            event = await queue.get()
            if event is None:
                break
            # by_alias=True is what makes this a byte-for-byte match against
            # events.ts's camelCase field names on the wire.
            yield {"event": "message", "data": event.model_dump_json(by_alias=True)}

    return EventSourceResponse(event_generator(), ping=_SSE_PING_SECONDS)


@router.post("/runs/{run_id}/approval")
async def submit_approval(run_id: str, body: ApprovalRequest) -> dict:
    session = registry.get(run_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Run not found")

    session.resume(body.approved)
    return {"ok": True}


@router.get("/healthz", response_model=HealthResponse)
async def healthz() -> HealthResponse:
    return HealthResponse(ok=True, llm="openai" if is_llm_available() else "simulated")
