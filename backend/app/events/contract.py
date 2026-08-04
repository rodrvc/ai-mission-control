"""Event contract — EXACT mirror of frontend/src/lib/types/events.ts (FROZEN).

Do not change these shapes without updating events.ts and ARCHITECTURE.md
first. Fields are declared snake_case in Python but serialize as camelCase
over the wire via `alias`, matching the TS interface field-for-field.
`populate_by_name=True` lets we construct instances using the Python names.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NodeStatus = Literal[
    "pending",
    "running",
    "completed",
    "failed",
    "retrying",
    "waiting_review",
]

RunStatus = Literal["started", "awaiting_approval", "completed", "failed"]


class NodeUpdateEvent(BaseModel):
    """Mirrors events.ts `NodeUpdateEvent`."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["node_update"] = "node_update"
    run_id: str = Field(alias="runId")
    seq: int  # monotonic per run, server-stamped
    node_id: str = Field(alias="nodeId")
    status: NodeStatus
    title: str
    summary: str | None = None
    input: str | None = None
    output: str | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    reason: str | None = None
    duration_ms: int | None = Field(default=None, alias="durationMs")
    trace_url: str | None = Field(default=None, alias="traceUrl")
    timestamp: str  # ISO 8601, server-stamped


class RunStatusEvent(BaseModel):
    """Mirrors events.ts `RunStatusEvent`."""

    model_config = ConfigDict(populate_by_name=True)

    type: Literal["run_status"] = "run_status"
    run_id: str = Field(alias="runId")
    seq: int
    status: RunStatus
    active_node_id: str | None = Field(default=None, alias="activeNodeId")
    final_response: str | None = Field(default=None, alias="finalResponse")
    timestamp: str


RunEvent = NodeUpdateEvent | RunStatusEvent
