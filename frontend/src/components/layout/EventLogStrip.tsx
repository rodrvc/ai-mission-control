"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { captainLogLineForDamageCause, captainLogLineForEvent } from "@/lib/game/captainLog";
import { useRunStore } from "@/lib/store/runStore";
import { useShipStore } from "@/lib/store/shipStore";
import type { RunEvent } from "@/lib/types/events";

const DAMAGE_CAUSE_PRIORITY_MS = 6000;

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
  const lastDamageCause = useShipStore((state) => state.lastDamageCause);
  const scrollRef = useRef<HTMLDivElement>(null);
  const previousCause = useRef<string | undefined>(undefined);
  const [isDamageCauseFresh, setIsDamageCauseFresh] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  // shipStore.lastDamageCause is never cleared once set (D20), so we can't use
  // its truthiness directly or this line would stick forever after the first
  // damage event. Track when the cause string last *changed* instead, and only
  // give it priority for a short window — same expiring pattern DamageCauseToast
  // uses — so later narrative beats can surface again afterward.
  useEffect(() => {
    if (lastDamageCause && lastDamageCause !== previousCause.current) {
      previousCause.current = lastDamageCause;
      setIsDamageCauseFresh(true);
      const timer = setTimeout(() => setIsDamageCauseFresh(false), DAMAGE_CAUSE_PRIORITY_MS);
      return () => clearTimeout(timer);
    }
  }, [lastDamageCause]);

  // "Captain's log" line: the most recent in-fiction beat, derived from the
  // same event stream the technical list already renders (no new events, no
  // duplicate UI) plus lastDamageCause for the one signal that never had a
  // dedicated event (D20 — cause is written straight to shipStore). A fresh
  // damage cause wins for a short window since it's the more urgent story
  // beat; otherwise fall back to the latest node/run beat with a narrative
  // line.
  const captainLogLine = useMemo(() => {
    if (isDamageCauseFresh && lastDamageCause) return captainLogLineForDamageCause(lastDamageCause);
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const line = captainLogLineForEvent(events[i]);
      if (line) return line;
    }
    return null;
  }, [events, lastDamageCause, isDamageCauseFresh]);

  return (
    <section className="flex h-40 shrink-0 flex-col border-t border-panel-border bg-panel px-5 py-3">
      <div className="mb-2 flex shrink-0 items-baseline justify-between gap-3">
        <h2 className="font-mono text-xs font-semibold tracking-widest text-text-muted uppercase">
          Event Log
        </h2>
        {captainLogLine && (
          <p className="truncate font-mono text-xs text-accent italic">{captainLogLine}</p>
        )}
      </div>

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
