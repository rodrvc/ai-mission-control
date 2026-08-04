"""Deterministic fallback copy — verbatim strings from
frontend/src/lib/simulation/scenarios/life-support.ts (the `onReject` path,
which is life-support's default route: reviewer rejects pass 1, repair
retries, reviewer approves pass 2).

CRITICAL fidelity notes (see the ACU-68 plan, "Fidelidad de copy"):
  - The orchestrator `reason` below is NOT life-support.ts's own reason
    string. It is the override the frontend's engine.ts applies at runtime
    (ROUTING_REASON["life-support"]), which is what actually reaches the UI.
    Emitting the script's original reason here would silently diverge from
    what a real browser session shows.
  - telemetry-tool and quality-check are simulated unconditionally, even on
    the real-LLM path — they are instrument reads / rote gates, not
    reasoning steps (see llm/prompts.py docstring).

Every constant here is a single point of truth consumed by graph/nodes.py.
Keep values byte-for-byte identical to life-support.ts when the script
changes.
"""

USER_REQUEST_TITLE = "Oxygen pressure is dropping in the life support module."
USER_REQUEST_SUMMARY = "Operator incident report received."

ORCHESTRATOR_RUNNING_TITLE = "Routing incident"
ORCHESTRATOR_COMPLETED_TITLE = "Routed to Life Support Specialist"
ORCHESTRATOR_OUTPUT = "life-support-specialist"
ORCHESTRATOR_CONFIDENCE = 0.95
# Override applied by frontend/src/lib/simulation/engine.ts's ROUTING_REASON
# table, NOT life-support.ts's own scripted reason. This is the string a
# real run actually shows in the UI.
ORCHESTRATOR_REASON = "Detected life-support incident keywords → routing to Life Support Specialist."

SPECIALIST_RUNNING_TITLE = "Assessing life-support incident"
SPECIALIST_COMPLETED_TITLE = "Pulling live telemetry"
SPECIALIST_SUMMARY = "Requesting O2 sensor and valve telemetry before diagnosing."
SPECIALIST_OUTPUT = "Dispatched telemetry request for O2 partial pressure and valve states."
SPECIALIST_CONFIDENCE = 0.90

TELEMETRY_RUNNING_TITLE = "Reading life-support telemetry"
TELEMETRY_RUNNING_INPUT = "O2 sensors + valve bank V-2xx"
TELEMETRY_COMPLETED_TITLE = "Telemetry read complete"
TELEMETRY_OUTPUT = "O2 partial pressure 18.4 kPa, dropping 0.3 kPa/min · valve V-227 flow anomaly"
TELEMETRY_CONFIDENCE = 0.97

DIAGNOSTICS_RUNNING_TITLE = "Diagnosing root cause"
DIAGNOSTICS_COMPLETED_TITLE = "Root cause identified"
DIAGNOSTICS_OUTPUT = (
    "Valve V-227 stuck partially open, venting cabin O2 into a return line "
    "with no isolation. Requires valve reseat and line isolation before "
    "repressurization."
)
DIAGNOSTICS_CONFIDENCE = 0.88

REPAIR_ATTEMPT1_RUNNING_TITLE = "Drafting repair plan (attempt 1)"
REPAIR_ATTEMPT1_COMPLETED_TITLE = "Repair plan drafted"
REPAIR_ATTEMPT1_OUTPUT = "Reseat valve V-227 actuator and repressurize cabin O2 to 21 kPa."
REPAIR_ATTEMPT1_CONFIDENCE = 0.78

SAFETY_PASS1_RUNNING_TITLE = "Reviewing repair plan (pass 1)"
SAFETY_PASS1_FAILED_TITLE = "Repair plan rejected"
SAFETY_PASS1_OUTPUT = "REJECTED"
SAFETY_PASS1_REASON = (
    "Repair plan does not isolate valve V-227 before repressurization — "
    "reseating under pressure risks re-triggering the same leak."
)
SAFETY_PASS1_CONFIDENCE = 0.91

REPAIR_ATTEMPT2_RETRYING_TITLE = "Revising repair plan (attempt 2)"
REPAIR_ATTEMPT2_RETRYING_INPUT = "Rejection reason: isolate V-227 before repressurization."
REPAIR_ATTEMPT2_COMPLETED_TITLE = "Revised repair plan drafted"
REPAIR_ATTEMPT2_OUTPUT = (
    "Close upstream isolation valve V-226, reseat V-227 actuator offline, "
    "verify seal, then reopen V-226 and repressurize cabin O2 to 21 kPa."
)
REPAIR_ATTEMPT2_CONFIDENCE = 0.93

SAFETY_PASS2_RUNNING_TITLE = "Reviewing repair plan (pass 2)"
SAFETY_PASS2_WAITING_TITLE = "Awaiting safety verdict (pass 2)"
SAFETY_PASS2_COMPLETED_TITLE = "Repair plan approved (pass 2)"
SAFETY_PASS2_OUTPUT = "APPROVED"
SAFETY_PASS2_REASON = "Isolation-before-reseat sequence eliminates the re-leak risk flagged in pass 1."
SAFETY_PASS2_CONFIDENCE = 0.96

QUALITY_RUNNING_TITLE = "Final quality pass"
QUALITY_COMPLETED_TITLE = "Quality check passed"
QUALITY_OUTPUT = "Response verified for accuracy and operator tone."
QUALITY_CONFIDENCE = 0.94

FINAL_RESPONSE_TITLE = "Response delivered"
FINAL_RESPONSE_OUTPUT = (
    "VEGA: Valve V-227 was stuck open aboard the Meridian, venting cabin O2 "
    "into an unisolated return line. Repair executed: isolated upstream "
    "valve V-226, reseated V-227 offline, verified seal, repressurized to "
    "21 kPa. Safety review approved on second pass. O2 levels stable."
)
