"""Drives a compiled life-support graph end-to-end, translating LangGraph's
execution into the RunStatusEvent lifecycle the frontend expects.

This is the only module that knows about LangGraph's `interrupt`/`Command`
resume mechanics — everything upstream (API routes, RunSession) only calls
`start()` / `resume()` and reacts to events on the emitter's queue. That
separation is what let graph/nodes.py and graph/build.py be written and
tested without any awareness of how a run is paused/resumed over HTTP.
"""

from langgraph.types import Command

from app.events.emitter import RunEmitter
from app.graph.build import build_life_support_graph
from app.graph.state import LifeSupportState


class GraphRunner:
    """Owns one compiled graph + thread for exactly one run."""

    def __init__(self, run_id: str, emitter: RunEmitter) -> None:
        self.run_id = run_id
        self.emitter = emitter
        self.graph = build_life_support_graph(emitter)
        self.config = {"configurable": {"thread_id": run_id}}

    def _is_interrupted(self) -> bool:
        """True if the graph's current checkpoint is parked on an interrupt()."""
        snapshot = self.graph.get_state(self.config)
        return bool(snapshot.next)  # non-empty `next` = graph has pending nodes (interrupted)

    async def start(self, prompt: str) -> None:
        """Runs the graph from the start until it either finishes or hits the
        interrupt() inside safety_reviewer (pass 2)."""
        await self.emitter.status("started")
        initial_state: LifeSupportState = {"prompt": prompt, "repair_attempt": 0}

        async for _ in self.graph.astream(initial_state, config=self.config):
            pass  # node functions emit their own events via the injected emitter

        await self._finish_or_pause()

    async def resume(self, approved: bool) -> None:
        """Resumes a run parked at the safety-reviewer interrupt with a human decision."""
        if not self._is_interrupted():
            # Nothing to resume — defensive no-op rather than raising, so a
            # duplicate/late POST /approval can't crash an already-finished run.
            return

        async for _ in self.graph.astream(Command(resume={"approved": approved}), config=self.config):
            pass

        await self._finish_or_pause()

    async def _finish_or_pause(self) -> None:
        """Inspects graph state after an astream pass and emits the matching
        RunStatusEvent: awaiting_approval (still interrupted), completed, or
        failed."""
        if self._is_interrupted():
            await self.emitter.status("awaiting_approval", active_node_id="safety-reviewer")
            return  # run stays parked; emitter queue is NOT closed

        final_state = self.graph.get_state(self.config).values
        if final_state.get("final_response"):
            await self.emitter.status("completed", final_response=final_state["final_response"])
        else:
            await self.emitter.status("failed")
        await self.emitter.close()
