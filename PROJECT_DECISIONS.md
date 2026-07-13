# Project Decisions — Mission Control AI

Approved decisions. Subagents must follow these; do not re-litigate.

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | UI, code, and docs in **English** | International recruiter audience. |
| D2 | HITL is a **toggle**: manual approval on/off. When ON, run pauses at `waiting_review` until user approves/rejects; when OFF, Safety Reviewer decides automatically | Demonstrates LangGraph interrupts without forcing interaction. |
| D3 | Phase 1 is **fully simulated in the frontend** (scripted event player). Real LLM (OpenAI, `gpt-4o-mini`) arrives in Phase 2–3, with simulated fallback when no API key | Validate UX cheaply first. |
| D4 | **Event contract is frozen** (see ARCHITECTURE.md). Frontend Phase 1 simulator and Phase 2 backend SSE emit the exact same shape | Frontend doesn't change when backend connects. |
| D5 | Monorepo: `frontend/` (Next.js + TS + React Flow + Tailwind), `backend/` (FastAPI + LangGraph), `docs/` | Simple, no microservices. |
| D6 | Run **locally first**; deploy to Railway in Phase 4 | |
| D7 | Graph is **read-only**: no editing, dragging is allowed but no connecting/deleting. Fixed topology, per-scenario path highlighting | Not an n8n clone. |
| D8 | 3 scenarios: life-support incident, navigation incident, mission knowledge question. Knowledge path skips diagnostics/repair/reviewer to show dynamic routing | |
| D9 | No auth, no database, no editor in MVP | |
| D10 | OpenAI key source: copy from `../city-activities-api/.env` into `backend/.env` (never commit) | |
| D11 | **Narrative UX replaces the scenario picker**: the user IS the captain (implicit, never stated). An email icon with badge opens an inbox modal. Welcome email (campaign to planet **XJS-7**, ship **ISV Meridian**, onboard AI **VEGA**) arrives on load; after closing it, 3 mission emails arrive. All missions available at once (no sequential gating, no persistence) | Immersive demo; recruiter learns by doing. |
| D12 | **Free-text prompt console** is the only way to launch a run (scenario `<select>` removed). Phase 1: keyword-based intent matching (life-support / navigation / knowledge). Irrelevant prompts → orchestrator runs, halts, and replies "not relevant to the mission" (guardrail demo). Phase 2: real LLM router, same UI | Shows intent routing, not a switch. |
| D13 | **HITL is narrative**: manual-approval toggle removed. The navigation mission ALWAYS pauses at "Awaiting captain authorization for correction burn" (Approve/Reject). Life-support keeps its scripted reviewer auto-reject/retry | Interrupts become part of the story. |
| D14 | Guided onboarding via subtle hints (pulsing badge, tooltip on prompt console after reading a mission). No forced tour library | |
