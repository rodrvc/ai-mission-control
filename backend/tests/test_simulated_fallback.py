"""Asserts the no-OpenAI-key path (the priority path per the ACU-68 plan)
reproduces life-support.ts's `onReject` copy byte-for-byte, including the
engine.ts routing-reason override.
"""

import asyncio

import pytest

from app.events.emitter import RunEmitter
from app.graph.runner import GraphRunner
from app.llm import simulated as sim
from app.llm.client import get_llm


async def _drain_available(emitter: RunEmitter) -> list:
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


def test_no_key_means_no_llm_client(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()
    assert get_llm() is None


@pytest.mark.asyncio
async def test_simulated_copy_matches_life_support_ts_onreject_path(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    from app.config import get_settings

    get_settings.cache_clear()

    run_id = "test-run-sim"
    emitter = RunEmitter(run_id)
    runner = GraphRunner(run_id, emitter)

    await runner.start("Oxygen pressure is dropping in the life support module.")
    first_half = await _drain_available(emitter)

    by_node_status = {(e.node_id, e.status): e for e in first_half if e.type == "node_update"}

    orchestrator_completed = by_node_status[("orchestrator", "completed")]
    assert orchestrator_completed.output == sim.ORCHESTRATOR_OUTPUT
    assert orchestrator_completed.confidence == sim.ORCHESTRATOR_CONFIDENCE
    # This is the critical fidelity check called out in the plan: the reason
    # must be the frontend engine.ts override, not life-support.ts's own text.
    assert orchestrator_completed.reason == sim.ORCHESTRATOR_REASON
    assert "Detected life-support incident keywords" in orchestrator_completed.reason

    telemetry_completed = by_node_status[("telemetry-tool", "completed")]
    assert telemetry_completed.output == sim.TELEMETRY_OUTPUT
    assert telemetry_completed.confidence == sim.TELEMETRY_CONFIDENCE

    diagnostics_completed = by_node_status[("diagnostics-agent", "completed")]
    assert diagnostics_completed.output == sim.DIAGNOSTICS_OUTPUT

    # Pass 1 and pass 2 both emit ("repair-agent", "completed") — a dict
    # keyed by (nodeId, status) collapses them, so pick the first occurrence
    # by scanning the ordered event list instead.
    repair_pass1 = next(
        e for e in first_half if e.type == "node_update" and e.node_id == "repair-agent" and e.status == "completed"
    )
    assert repair_pass1.output == sim.REPAIR_ATTEMPT1_OUTPUT
    assert repair_pass1.confidence == sim.REPAIR_ATTEMPT1_CONFIDENCE

    reviewer_pass1 = by_node_status[("safety-reviewer", "failed")]
    assert reviewer_pass1.output == sim.SAFETY_PASS1_OUTPUT
    assert reviewer_pass1.reason == sim.SAFETY_PASS1_REASON
    assert reviewer_pass1.confidence == sim.SAFETY_PASS1_CONFIDENCE

    # repair-agent's revised plan (attempt 2) completes BEFORE the interrupt
    # (safety-reviewer pass 2 is what actually pauses) — so it's in the first
    # half, not after resume().
    repair_pass2 = next(
        e
        for e in first_half
        if e.type == "node_update" and e.node_id == "repair-agent" and e.status == "completed" and e is not repair_pass1
    )
    assert repair_pass2.output == sim.REPAIR_ATTEMPT2_OUTPUT
    assert repair_pass2.confidence == sim.REPAIR_ATTEMPT2_CONFIDENCE

    await runner.resume(approved=True)
    second_half = await _drain_available(emitter)
    by_node_status_2 = {(e.node_id, e.status): e for e in second_half if e.type == "node_update"}

    reviewer_pass2 = by_node_status_2[("safety-reviewer", "completed")]
    assert reviewer_pass2.output == sim.SAFETY_PASS2_OUTPUT
    assert reviewer_pass2.reason == sim.SAFETY_PASS2_REASON
    assert reviewer_pass2.confidence == sim.SAFETY_PASS2_CONFIDENCE

    quality = by_node_status_2[("quality-check", "completed")]
    assert quality.output == sim.QUALITY_OUTPUT
    assert quality.confidence == sim.QUALITY_CONFIDENCE

    final = by_node_status_2[("final-response", "completed")]
    assert final.output == sim.FINAL_RESPONSE_OUTPUT

    run_status_completed = next(e for e in second_half if e.type == "run_status" and e.status == "completed")
    assert run_status_completed.final_response == sim.FINAL_RESPONSE_OUTPUT
