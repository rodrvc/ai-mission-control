"""In-memory registry of active RunSessions, keyed by runId.

A plain dict is sufficient for this vertical slice (single-process dev
server, no persistence requirement beyond one server lifetime). If this ever
needs to survive restarts or scale across processes, this is the seam to
swap for a Redis-backed registry — nothing outside this module knows the
storage is in-memory.
"""

import uuid

from app.runs.session import RunSession


class RunRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, RunSession] = {}

    def create(self) -> RunSession:
        run_id = str(uuid.uuid4())
        session = RunSession(run_id)
        self._sessions[run_id] = session
        return session

    def get(self, run_id: str) -> RunSession | None:
        return self._sessions.get(run_id)


# Process-wide singleton — routes.py depends on this instance via FastAPI's
# plain-import DI (no framework container needed for a service this small).
registry = RunRegistry()
