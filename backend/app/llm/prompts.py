"""System/user prompts for the real-LLM path (inactive without an OpenAI key).

Each node that can reason with an LLM gets one function here returning
(system, user) messages. telemetry_tool and quality_check are intentionally
absent — the plan mandates those two nodes are ALWAYS simulated (they are
deterministic instrument reads / a rote quality gate, not reasoning steps).

The safety-reviewer prompt hard-codes the isolation rule so that even with a
real LLM the pass-1-reject / pass-2-approve narrative stays deterministic —
this preserves the frontend's HITL demo UX while still being genuine model
reasoning (see plan: "Determinismo del reviewer").
"""

ORCHESTRATOR_SYSTEM = (
    "You are the Mission Orchestrator aboard the spacecraft Meridian. "
    "Given an operator incident report, decide which specialist should "
    "handle it. Respond with the specialist id only."
)


def orchestrator_user(prompt: str) -> str:
    return f"Operator report: {prompt}\n\nAvailable specialists: life-support-specialist, navigation-specialist, knowledge-specialist."


DIAGNOSTICS_SYSTEM = (
    "You are a spacecraft diagnostics agent. Given telemetry readings, "
    "identify the root cause of the anomaly in one or two sentences, "
    "precise enough to hand to a repair agent."
)


def diagnostics_user(telemetry: str) -> str:
    return f"Telemetry: {telemetry}\n\nWhat is the root cause?"


REPAIR_SYSTEM = (
    "You are a spacecraft repair agent. Given a diagnosis (and, on retry, a "
    "safety reviewer's rejection reason), draft a concrete repair plan as a "
    "single actionable sentence."
)


def repair_user(diagnosis: str, rejection_reason: str | None = None) -> str:
    if rejection_reason:
        return (
            f"Diagnosis: {diagnosis}\n\n"
            f"Your previous plan was rejected: {rejection_reason}\n"
            "Draft a revised plan that addresses the rejection."
        )
    return f"Diagnosis: {diagnosis}\n\nDraft a repair plan."


SAFETY_REVIEWER_SYSTEM = (
    "You are the Safety Reviewer for spacecraft repair plans. Hard rule: "
    "REJECT any plan that repressurizes a line without isolating the faulty "
    "valve first — reseating a valve under pressure risks re-triggering the "
    "leak. Respond with APPROVED or REJECTED, followed by a one-sentence "
    "reason."
)


def safety_reviewer_user(repair_plan: str) -> str:
    return f"Repair plan: {repair_plan}\n\nApprove or reject, with reason."
