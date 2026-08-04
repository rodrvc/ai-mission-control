"""Asserts the graph emits nodes in the correct order/status, including the
reject-then-retry loop and the pause at the safety-reviewer interrupt, per
the ACU-68 plan's mandated SSE sequence. Runs with no OpenAI key configured
(CI/dev default), so this exercises the same simulated path as production
without a key.
"""

import asyncio

import pytest

from app.events.emitter import RunEmitter
from app.graph.runner import GraphRunner


async def _drain_available(emitter: RunEmitter) -> list:
    """Pulls every event currently queued without blocking past a short
    grace window — used because the queue isn't closed while a run is
    parked at awaiting_approval."""
    events = []
    while True:
        try:
            event = await asyncio.wait_for(emitter.queue.get(), timeout=0.5)
        except asyncio.TimeoutError:
            break
        if event is None:
            break
        events.append(event)
    return events


@pytest.mark.asyncio
async def test_graph_pauses_at_awaiting_approval_with_correct_sequence():
    run_id = "test-run-1"
    emitter = RunEmitter(run_id)
    runner = GraphRunner(run_id, emitter)

    await runner.start("Oxygen pressure is dropping in the life support module.")
    events = await _drain_available(emitter)

    # run_status:started must be first.
    assert events[0].type == "run_status"
    assert events[0].status == "started"

    node_transitions = [(e.node_id, e.status) for e in events if e.type == "node_update"]

    assert ("user-request", "completed") in node_transitions
    assert ("orchestrator", "running") in node_transitions
    assert ("orchestrator", "completed") in node_transitions
    assert ("life-support-specialist", "running") in node_transitions
    assert ("life-support-specialist", "completed") in node_transitions
    assert ("telemetry-tool", "running") in node_transitions
    assert ("telemetry-tool", "completed") in node_transitions
    assert ("diagnostics-agent", "running") in node_transitions
    assert ("diagnostics-agent", "completed") in node_transitions

    # Repair pass 1 (running->completed), reviewer rejects, repair pass 2
    # emits "retrying" (re-billable per D17), reviewer pauses.
    assert node_transitions.count(("repair-agent", "running")) == 1
    assert node_transitions.count(("repair-agent", "completed")) == 2
    assert ("safety-reviewer", "failed") in node_transitions
    assert ("repair-agent", "retrying") in node_transitions
    assert ("safety-reviewer", "waiting_review") in node_transitions

    # Ordering: pass-1 reject strictly precedes the retry, which strictly
    # precedes pass-2's waiting_review.
    reject_idx = node_transitions.index(("safety-reviewer", "failed"))
    retry_idx = node_transitions.index(("repair-agent", "retrying"))
    wait_idx = node_transitions.index(("safety-reviewer", "waiting_review"))
    assert reject_idx < retry_idx < wait_idx

    # Terminal event for this half of the run: run_status:awaiting_approval,
    # parked on safety-reviewer, queue NOT closed (no sentinel None yet).
    last = events[-1]
    assert last.type == "run_status"
    assert last.status == "awaiting_approval"
    assert last.active_node_id == "safety-reviewer"

    # quality-check / final-response must not have run yet.
    assert not any(e.node_id == "quality-check" for e in events if e.type == "node_update")


@pytest.mark.asyncio
async def test_graph_resumes_to_completion_on_approval():
    run_id = "test-run-2"
    emitter = RunEmitter(run_id)
    runner = GraphRunner(run_id, emitter)

    await runner.start("Oxygen pressure is dropping in the life support module.")
    await _drain_available(emitter)  # discard first half, already covered above

    await runner.resume(approved=True)
    events = await _drain_available(emitter)

    node_transitions = [(e.node_id, e.status) for e in events if e.type == "node_update"]
    assert ("safety-reviewer", "completed") in node_transitions
    assert ("quality-check", "running") in node_transitions
    assert ("quality-check", "completed") in node_transitions
    assert ("final-response", "completed") in node_transitions

    run_status_events = [e for e in events if e.type == "run_status"]
    assert run_status_events[-1].status == "completed"
    assert run_status_events[-1].final_response is not None
    assert "V-227" in run_status_events[-1].final_response

    # Queue must be closed (sentinel consumed) once the run completes.
    assert emitter.queue.empty()
