"""LifeSupportState — the LangGraph state threaded through every node.

Kept as a flat TypedDict (LangGraph convention) rather than a class hierarchy:
node functions are plain reducers over this dict, which keeps them trivially
unit-testable (pass a dict in, assert the dict/emitted events out) without
needing to mock a stateful object.
"""

from typing import TypedDict


class LifeSupportState(TypedDict, total=False):
    # Original operator prompt that started the run.
    prompt: str

    # Populated as the pipeline progresses — each node reads its predecessor's
    # output and writes its own, mirroring the `input`/`output` shown in the
    # frontend node inspector.
    telemetry: str
    diagnosis: str
    repair_plan: str
    repair_attempt: int  # 1-indexed; safety-reviewer loop increments this
    review_verdict: str  # "REJECT" | "PENDING_APPROVAL" | "APPROVE"
    review_reason: str
    review_duration_ms: int  # measured in safety_reviewer, reused by hitl_gate's completed/failed event
    quality_note: str
    final_response: str

    # Set by the interrupt() resume payload (Command(resume={"approved": bool})).
    approved: bool | None
