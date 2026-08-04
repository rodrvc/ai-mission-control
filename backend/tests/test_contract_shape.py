"""Asserts the Pydantic event models serialize with the exact camelCase keys
frontend/src/lib/types/events.ts expects. This is the contract test the
ACU-68 plan calls for — a shape drift here would silently break the
frontend's runStore reducer and economy bridge.
"""

from app.events.contract import NodeUpdateEvent, RunStatusEvent


def test_node_update_event_shape_matches_events_ts():
    event = NodeUpdateEvent(
        run_id="run-1",
        seq=1,
        node_id="orchestrator",
        status="completed",
        title="Routed to Life Support Specialist",
        summary=None,
        input="prompt",
        output="life-support-specialist",
        confidence=0.95,
        reason="Detected life-support incident keywords → routing to Life Support Specialist.",
        duration_ms=820,
        trace_url=None,
        timestamp="2026-08-03T00:00:00Z",
    )
    payload = event.model_dump(by_alias=True, exclude_none=True)

    assert payload["type"] == "node_update"
    assert payload["runId"] == "run-1"
    assert payload["seq"] == 1
    assert payload["nodeId"] == "orchestrator"
    assert payload["status"] == "completed"
    assert payload["title"] == "Routed to Life Support Specialist"
    assert payload["input"] == "prompt"
    assert payload["output"] == "life-support-specialist"
    assert payload["confidence"] == 0.95
    assert payload["reason"].startswith("Detected life-support incident keywords")
    assert payload["durationMs"] == 820
    assert payload["timestamp"] == "2026-08-03T00:00:00Z"

    # Snake_case aliases must NOT leak onto the wire.
    for forbidden in ("run_id", "node_id", "duration_ms", "trace_url"):
        assert forbidden not in payload


def test_run_status_event_shape_matches_events_ts():
    event = RunStatusEvent(
        run_id="run-1",
        seq=42,
        status="awaiting_approval",
        active_node_id="safety-reviewer",
        final_response=None,
        timestamp="2026-08-03T00:00:01Z",
    )
    payload = event.model_dump(by_alias=True, exclude_none=True)

    assert payload["type"] == "run_status"
    assert payload["runId"] == "run-1"
    assert payload["seq"] == 42
    assert payload["status"] == "awaiting_approval"
    assert payload["activeNodeId"] == "safety-reviewer"
    assert "run_id" not in payload
    assert "active_node_id" not in payload


def test_populate_by_name_allows_python_style_construction():
    # populate_by_name=True (required by the plan) — constructing via the
    # Python field names, not just the camelCase aliases, must work.
    event = NodeUpdateEvent.model_validate(
        {"runId": "r", "seq": 1, "nodeId": "n", "status": "pending", "title": "t", "timestamp": "ts"}
    )
    assert event.run_id == "r"
    assert event.node_id == "n"
