"""LangGraph node functions for the life-support mission.

Each node is a thin orchestration wrapper: emit `running`, do the work
(LLM call if available, else the deterministic simulated fallback), emit the
terminal status, and return the state delta. Wall-clock duration is measured
around the "work" step only (not the emit calls) so `durationMs` reflects
actual node cost, matching how a real LangSmith trace would measure it.

Nodes depend on `RunEmitter` and `get_llm()` via constructor/closure
injection (see `graph/build.py`), never by importing a global — this keeps
every node testable in isolation with a fake emitter and no network access.
"""

import asyncio
import time
from typing import Any

from langgraph.types import interrupt

from app.events.emitter import RunEmitter
from app.graph.state import LifeSupportState
from app.llm import simulated as sim
from app.llm.client import get_llm
from app.llm.prompts import (
    DIAGNOSTICS_SYSTEM,
    ORCHESTRATOR_SYSTEM,
    REPAIR_SYSTEM,
    SAFETY_REVIEWER_SYSTEM,
    diagnostics_user,
    orchestrator_user,
    repair_user,
    safety_reviewer_user,
)

# Short, non-zero sleep so the frontend animation (which reacts to each SSE
# event) has something to render between transitions, per the plan ("Añadir
# asyncio.sleep corto por nodo para animación legible"). Kept small enough
# that the whole run stays snappy for local dev / demos.
_STEP_DELAY_S = 0.15


async def _simulate_delay() -> None:
    await asyncio.sleep(_STEP_DELAY_S)


async def _call_llm(system: str, user: str) -> str | None:
    """Invokes the real LLM if configured; returns None on any failure or absence.

    Node functions treat None as "fall back to simulated copy" — a network
    error or missing key must never crash a run, only cause it to behave as
    if simulated mode was selected for that single call.
    """
    llm = get_llm()
    if llm is None:
        return None
    try:
        from langchain_core.messages import HumanMessage, SystemMessage

        response = await llm.ainvoke([SystemMessage(content=system), HumanMessage(content=user)])
        return str(response.content).strip()
    except Exception:
        return None


def make_nodes(emitter: RunEmitter) -> dict[str, Any]:
    """Builds the node-function dict, closing over `emitter` (DI seam)."""

    async def user_request(state: LifeSupportState) -> dict:
        prompt = state["prompt"]
        await emitter.node(
            "user-request",
            "completed",
            title=prompt,
            summary=sim.USER_REQUEST_SUMMARY,
            output=prompt,
        )
        return {}

    async def orchestrator(state: LifeSupportState) -> dict:
        prompt = state["prompt"]
        await emitter.node(
            "orchestrator",
            "running",
            title=sim.ORCHESTRATOR_RUNNING_TITLE,
            input=prompt,
        )
        start = time.monotonic()
        llm_output = await _call_llm(ORCHESTRATOR_SYSTEM, orchestrator_user(prompt))
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)

        # Routing target is always life-support-specialist in this vertical
        # slice (the router already filtered for life-support prompts before
        # the graph was invoked). The `reason` is ALWAYS the frontend-engine
        # override string, per the plan's verified finding — real LLM output
        # (if any) is discarded here to preserve UI fidelity.
        output = llm_output or sim.ORCHESTRATOR_OUTPUT
        await emitter.node(
            "orchestrator",
            "completed",
            title=sim.ORCHESTRATOR_COMPLETED_TITLE,
            output=sim.ORCHESTRATOR_OUTPUT if llm_output is None else output,
            confidence=sim.ORCHESTRATOR_CONFIDENCE,
            reason=sim.ORCHESTRATOR_REASON,
            duration_ms=duration_ms,
        )
        return {}

    async def specialist(state: LifeSupportState) -> dict:
        prompt = state["prompt"]
        await emitter.node(
            "life-support-specialist",
            "running",
            title=sim.SPECIALIST_RUNNING_TITLE,
            input=prompt,
        )
        start = time.monotonic()
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)
        await emitter.node(
            "life-support-specialist",
            "completed",
            title=sim.SPECIALIST_COMPLETED_TITLE,
            summary=sim.SPECIALIST_SUMMARY,
            output=sim.SPECIALIST_OUTPUT,
            confidence=sim.SPECIALIST_CONFIDENCE,
            duration_ms=duration_ms,
        )
        return {}

    async def telemetry_tool(state: LifeSupportState) -> dict:
        # Always simulated (instrument read, never LLM reasoning) — see
        # llm/prompts.py docstring.
        await emitter.node(
            "telemetry-tool",
            "running",
            title=sim.TELEMETRY_RUNNING_TITLE,
            input=sim.TELEMETRY_RUNNING_INPUT,
        )
        start = time.monotonic()
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)
        await emitter.node(
            "telemetry-tool",
            "completed",
            title=sim.TELEMETRY_COMPLETED_TITLE,
            output=sim.TELEMETRY_OUTPUT,
            confidence=sim.TELEMETRY_CONFIDENCE,
            duration_ms=duration_ms,
        )
        return {"telemetry": sim.TELEMETRY_OUTPUT}

    async def diagnostics(state: LifeSupportState) -> dict:
        telemetry = state["telemetry"]
        await emitter.node(
            "diagnostics-agent",
            "running",
            title=sim.DIAGNOSTICS_RUNNING_TITLE,
            input=telemetry,
        )
        start = time.monotonic()
        llm_output = await _call_llm(DIAGNOSTICS_SYSTEM, diagnostics_user(telemetry))
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)
        output = llm_output or sim.DIAGNOSTICS_OUTPUT
        await emitter.node(
            "diagnostics-agent",
            "completed",
            title=sim.DIAGNOSTICS_COMPLETED_TITLE,
            output=output,
            confidence=sim.DIAGNOSTICS_CONFIDENCE,
            duration_ms=duration_ms,
        )
        return {"diagnosis": output}

    async def repair(state: LifeSupportState) -> dict:
        attempt = state.get("repair_attempt", 0) + 1
        diagnosis = state["diagnosis"]
        rejection_reason = state.get("review_reason") if attempt > 1 else None

        status = "running" if attempt == 1 else "retrying"
        running_title = sim.REPAIR_ATTEMPT1_RUNNING_TITLE if attempt == 1 else sim.REPAIR_ATTEMPT2_RETRYING_TITLE
        running_input = diagnosis if attempt == 1 else sim.REPAIR_ATTEMPT2_RETRYING_INPUT
        await emitter.node("repair-agent", status, title=running_title, input=running_input)

        start = time.monotonic()
        llm_output = await _call_llm(REPAIR_SYSTEM, repair_user(diagnosis, rejection_reason))
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)

        if attempt == 1:
            output = llm_output or sim.REPAIR_ATTEMPT1_OUTPUT
            completed_title = sim.REPAIR_ATTEMPT1_COMPLETED_TITLE
            confidence = sim.REPAIR_ATTEMPT1_CONFIDENCE
        else:
            output = llm_output or sim.REPAIR_ATTEMPT2_OUTPUT
            completed_title = sim.REPAIR_ATTEMPT2_COMPLETED_TITLE
            confidence = sim.REPAIR_ATTEMPT2_CONFIDENCE

        await emitter.node(
            "repair-agent",
            "completed",
            title=completed_title,
            output=output,
            confidence=confidence,
            duration_ms=duration_ms,
        )
        return {"repair_plan": output, "repair_attempt": attempt}

    async def safety_reviewer(state: LifeSupportState) -> dict:
        """Runs the review reasoning (pass 1 or pass 2) and emits its
        side-effecting events. Deliberately contains NO interrupt() call:
        LangGraph replays a node's entire body from the top on every resume
        past an interrupt, so any side effect placed before the interrupt
        would fire twice. Splitting the interrupt into its own downstream
        node (`hitl_gate`, below) keeps this node's events one-shot even
        though the graph as a whole pauses/resumes here (verified against
        LangGraph's actual replay behavior — see git history for the repro).
        """
        attempt = state["repair_attempt"]
        repair_plan = state["repair_plan"]

        running_title = sim.SAFETY_PASS1_RUNNING_TITLE if attempt == 1 else sim.SAFETY_PASS2_RUNNING_TITLE
        await emitter.node("safety-reviewer", "running", title=running_title, input=repair_plan)

        start = time.monotonic()
        await _call_llm(SAFETY_REVIEWER_SYSTEM, safety_reviewer_user(repair_plan))
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)

        # Deterministic isolation rule (plan: "Determinismo del reviewer"):
        # pass 1 always rejects (naive plan reseats under pressure), pass 2
        # always approves (revised plan isolates V-226 first). This holds
        # even with a real LLM configured — the rule is a hard safety gate,
        # not a suggestion, so we don't let model variance flip the
        # narrative the frontend economy/HITL demo depends on. The LLM's
        # verdict text is intentionally discarded above (not assigned) —
        # only the deterministic path below decides state.
        if attempt == 1:
            await emitter.node(
                "safety-reviewer",
                "failed",
                title=sim.SAFETY_PASS1_FAILED_TITLE,
                output=sim.SAFETY_PASS1_OUTPUT,
                reason=sim.SAFETY_PASS1_REASON,
                confidence=sim.SAFETY_PASS1_CONFIDENCE,
                duration_ms=duration_ms,
            )
            return {"review_verdict": "REJECT", "review_reason": sim.SAFETY_PASS1_REASON}

        # Pass 2: emit waiting_review, then hand off to hitl_gate for the
        # actual interrupt() pause (this is the "new" pause the plan calls
        # out — the scripted frontend UX never paused here, but a genuine
        # agent architecture should).
        await emitter.node(
            "safety-reviewer",
            "waiting_review",
            title=sim.SAFETY_PASS2_WAITING_TITLE,
            input=repair_plan,
        )
        return {"review_verdict": "PENDING_APPROVAL", "review_duration_ms": duration_ms}

    async def hitl_gate(state: LifeSupportState) -> dict:
        """The ONLY node that calls interrupt(). Contains no side effects
        before the interrupt call, so re-running this tiny node body on
        resume is harmless — `interrupt()` simply returns the resume payload
        instead of raising the second time through."""
        repair_plan = state["repair_plan"]
        decision = interrupt({"nodeId": "safety-reviewer", "repairPlan": repair_plan})
        approved = bool(decision.get("approved")) if isinstance(decision, dict) else bool(decision)
        duration_ms = state.get("review_duration_ms")

        if approved:
            await emitter.node(
                "safety-reviewer",
                "completed",
                title=sim.SAFETY_PASS2_COMPLETED_TITLE,
                output=sim.SAFETY_PASS2_OUTPUT,
                reason=sim.SAFETY_PASS2_REASON,
                confidence=sim.SAFETY_PASS2_CONFIDENCE,
                duration_ms=duration_ms,
            )
            return {"review_verdict": "APPROVE", "approved": True}

        # Human rejected pass 2: fail the run rather than looping forever —
        # a human veto after the deterministic safety gate already approved
        # is treated as final (out of scope: an N-th repair attempt).
        await emitter.node(
            "safety-reviewer",
            "failed",
            title="Repair plan rejected by operator",
            output="REJECTED",
            reason="Operator rejected the approved repair plan during review.",
            duration_ms=duration_ms,
        )
        return {"review_verdict": "REJECT", "approved": False}

    async def quality_check(state: LifeSupportState) -> dict:
        repair_plan = state["repair_plan"]
        await emitter.node(
            "quality-check",
            "running",
            title=sim.QUALITY_RUNNING_TITLE,
            input=f"Approved repair plan for {repair_plan}",
        )
        start = time.monotonic()
        await _simulate_delay()
        duration_ms = int((time.monotonic() - start) * 1000)
        await emitter.node(
            "quality-check",
            "completed",
            title=sim.QUALITY_COMPLETED_TITLE,
            output=sim.QUALITY_OUTPUT,
            confidence=sim.QUALITY_CONFIDENCE,
            duration_ms=duration_ms,
        )
        return {"quality_note": sim.QUALITY_OUTPUT}

    async def final_response(state: LifeSupportState) -> dict:
        await emitter.node(
            "final-response",
            "completed",
            title=sim.FINAL_RESPONSE_TITLE,
            output=sim.FINAL_RESPONSE_OUTPUT,
            duration_ms=120,
        )
        return {"final_response": sim.FINAL_RESPONSE_OUTPUT}

    return {
        "user_request": user_request,
        "orchestrator": orchestrator,
        "specialist": specialist,
        "telemetry_tool": telemetry_tool,
        "diagnostics": diagnostics,
        "repair": repair,
        "safety_reviewer": safety_reviewer,
        "hitl_gate": hitl_gate,
        "quality_check": quality_check,
        "final_response": final_response,
    }
