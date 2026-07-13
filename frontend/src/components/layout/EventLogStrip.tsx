"use client";

import { useEffect, useRef } from "react";
import { useRunStore } from "@/lib/store/runStore";
import type { RunEvent } from "@/lib/types/events";

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString(undefined, {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function describeEvent(event: RunEvent): { nodeId: string; status: string; title: string } {
  if (event.type === "node_update") {
    return { nodeId: event.nodeId, status: event.status, title: event.title };
  }
  return {
    nodeId: event.activeNodeId ?? "run",
    status: event.status,
    title: event.finalResponse ?? "run status update",
  };
}

/**
 * Bottom event-log feed. Renders the store's append-only event log,
 * most recent last, auto-scrolled to the bottom as new events arrive.
 */
export function EventLogStrip() {
  const events = useRunStore((state) => state.events);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-panel-border bg-panel px-5 py-3">
      <h2 className="mb-2 shrink-0 font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
        Event Log
      </h2>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="font-mono text-xs text-text-muted">
            No events yet. Run a scenario to see live telemetry.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {events.map((event, index) => {
              const { nodeId, status, title } = describeEvent(event);
              return (
                <li
                  key={`${event.type}-${event.seq}-${index}`}
                  className="truncate font-mono text-xs text-text-muted"
                >
                  <span className="text-foreground">{formatTime(event.timestamp)}</span>
                  {" · "}
                  <span>{nodeId}</span>
                  {" · "}
                  <span>{status}</span>
                  {" · "}
                  <span>{title}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
