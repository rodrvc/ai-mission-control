"""RunEmitter — the single place that stamps runId/seq/timestamp on events.

Centralizing this (rather than letting graph nodes build events by hand)
guarantees the two invariants the frontend relies on (see ARCHITECTURE.md /
the ACU-68 plan): `seq` is monotonic per run starting at 1, and every event
in a run carries the same `runId`. Nodes only supply the domain fields.
"""

import asyncio
from datetime import UTC, datetime

from app.events.contract import NodeStatus, NodeUpdateEvent, RunEvent, RunStatus, RunStatusEvent


def _now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class RunEmitter:
    """Stamps and publishes events for a single run onto an asyncio.Queue.

    The queue decouples the graph execution (producer, running as a
    background asyncio task) from the SSE endpoint (consumer, draining the
    queue as the HTTP response streams). `None` is the sentinel meaning
    "no more events" — the SSE route stops iterating when it sees it.
    """

    def __init__(self, run_id: str) -> None:
        self.run_id = run_id
        self._seq = 0
        self.queue: asyncio.Queue[RunEvent | None] = asyncio.Queue()

    def _next_seq(self) -> int:
        self._seq += 1
        return self._seq

    async def node(
        self,
        node_id: str,
        status: NodeStatus,
        title: str,
        *,
        summary: str | None = None,
        input: str | None = None,
        output: str | None = None,
        confidence: float | None = None,
        reason: str | None = None,
        duration_ms: int | None = None,
        trace_url: str | None = None,
    ) -> NodeUpdateEvent:
        event = NodeUpdateEvent(
            run_id=self.run_id,
            seq=self._next_seq(),
            node_id=node_id,
            status=status,
            title=title,
            summary=summary,
            input=input,
            output=output,
            confidence=confidence,
            reason=reason,
            duration_ms=duration_ms,
            trace_url=trace_url,
            timestamp=_now_iso(),
        )
        await self.queue.put(event)
        return event

    async def status(
        self,
        status: RunStatus,
        *,
        active_node_id: str | None = None,
        final_response: str | None = None,
    ) -> RunStatusEvent:
        event = RunStatusEvent(
            run_id=self.run_id,
            seq=self._next_seq(),
            status=status,
            active_node_id=active_node_id,
            final_response=final_response,
            timestamp=_now_iso(),
        )
        await self.queue.put(event)
        return event

    async def close(self) -> None:
        """Signal end-of-stream to the SSE consumer."""
        await self.queue.put(None)
