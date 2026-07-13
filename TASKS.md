# TASKS — Mission Control AI

Status: `[ ]` todo · `[~]` in progress · `[x]` done · owner in parens.

## Phase 1 — Simulated vertical slice (frontend only)
- [x] T1 (worker-frontend-1): Scaffold Next.js + TS + Tailwind + React Flow; event types; dark mission-control theme; layout shell (header, canvas, side panel, log feed).
- [x] T2 (worker-frontend-2): Custom nodes with 6 visual states; fixed graph topology + layout; run store (Zustand); node inspector panel.
- [x] T3 (worker-frontend-3): Simulation engine + 3 scenario scripts (incl. reject/retry loop and HITL pause); scenario selector; Run button; approval UI; manual-approval toggle.
- [x] T4 (qa): Review + build + run all 3 scenarios + edge cases + basic a11y. Findings (1 MAJOR, 3 MINOR, 2 NIT) fixed by fix-worker and re-verified live in browser.
- [x] T5 (docs): README v1, architecture diagram (README.md + docs/FLOW.md).

## Phase 1.5 — Narrative UX (D11–D14)
- [x] T12 (worker): Prompt console replaces scenario select; keyword intent router + irrelevant-prompt guardrail flow; remove approval toggle; navigation flow always pauses for captain authorization; scenario copy updated to XJS-7 / ISV Meridian / VEGA narrative.
- [x] T13 (worker): Email system — badge icon, inbox modal, welcome + 3 mission emails, arrival timing, read/unread, guided hints.
- [x] T14 (qa): Full narrative playthrough QA. Findings (2 MAJOR, 2 MINOR, 1 NIT) fixed and re-verified live: mission-batch double-delivery guard, real DENY→revise→re-authorize HITL loop, modal focus trap, router tie-break by safety priority + word-boundary matching.
- [x] T15 (docs): README/FLOW update for narrative UX.

## Phase 2 — Real backend
- [ ] T6: FastAPI + endpoints + SSE per contract.
- [ ] T7: LangGraph StateGraph (routing, retries, reviewer loop, interrupt for HITL), simulated tools; optional OpenAI (gpt-4o-mini) with simulated fallback.
- [ ] T8: Frontend SSE client replacing simulator (same store).
- [ ] T9: QA end-to-end.

## Phase 3 — LangSmith + metrics
- [ ] T10: LangSmith tracing + traceUrl in events; run metrics; failure injection.

## Phase 4 — Polish + deploy
- [ ] T11: Visual refinement, more scenarios, Railway deploy, final docs/demo.
