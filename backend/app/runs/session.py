"""RunSession — everything the API needs to track about one in-flight run.

Bundles the emitter (event queue), the GraphRunner (execution), and the
asyncio.Task driving it in the background, so routes.py never has to reach
into graph internals directly. Single Responsibility: this class is a data
holder + thin lifecycle wrapper, no HTTP or SSE-framing concerns live here.
"""

import asyncio

from app.events.emitter import RunEmitter
from app.graph.runner import GraphRunner


class RunSession:
    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self.emitter = RunEmitter(run_id)
        self.runner = GraphRunner(run_id, self.emitter)
        self.task: asyncio.Task | None = None

    def start(self, prompt: str) -> None:
        """Launches graph execution as a background task so POST /runs can
        return immediately with the runId while the SSE endpoint streams
        events as they're produced."""
        self.task = asyncio.create_task(self.runner.start(prompt))

    def resume(self, approved: bool) -> None:
        """Launches the resume-from-interrupt continuation as a background task."""
        self.task = asyncio.create_task(self.runner.resume(approved))
