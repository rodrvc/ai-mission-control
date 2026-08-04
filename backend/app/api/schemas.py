"""Request/response DTOs for the HTTP API.

Kept separate from `events/contract.py` (the SSE payload contract) since
these shapes are backend-API-only and not part of the frozen frontend event
contract. `manualApproval` is intentionally absent from RunCreate — it was
derogated by decision D13 (see the ACU-68 plan) in favor of the real
interrupt()-based HITL gate.
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class RunCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    prompt: str
    scenario_id: str | None = Field(default=None, alias="scenarioId")


class RunCreated(BaseModel):
    """Response shape mirrors the plan's API contract: `{runId, scenario}`."""

    model_config = ConfigDict(populate_by_name=True)

    run_id: str | None = Field(default=None, alias="runId")
    scenario: Literal["life-support", "unsupported"]


class ApprovalRequest(BaseModel):
    approved: bool


class HealthResponse(BaseModel):
    ok: bool
    llm: Literal["openai", "simulated"]
