"use client";

import { useEffect } from "react";
import { InboxModal } from "@/components/inbox/InboxModal";
import { MailButton } from "@/components/inbox/MailButton";
import { SHIP_NAME } from "@/data/narrative";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useRunStore } from "@/lib/store/runStore";
import { useShipStore } from "@/lib/store/shipStore";

interface HeaderProps {
  isRunning: boolean;
  onAbort: () => void;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  started: "Run in progress…",
  awaiting_approval: "Awaiting captain authorization…",
};

/**
 * Top mission bar: ship name, compact run status + ABORT while a run is
 * active, mail, and mute. The command console itself lives in the VegaWidget
 * floating chat (D21) — Header no longer owns prompt input.
 */
export function Header({ isRunning, onAbort }: HeaderProps) {
  const runStatus = useRunStore((state) => state.runStatus);

  const deliverWelcome = useInboxStore((state) => state.deliverWelcome);
  const muted = useShipStore((state) => state.muted);
  const toggleMuted = useShipStore((state) => state.toggleMuted);

  // Deliver the welcome email once, shortly after the console mounts (D11).
  useEffect(() => {
    const timer = setTimeout(deliverWelcome, 2000);
    return () => clearTimeout(timer);
  }, [deliverWelcome]);

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-panel-border bg-panel px-6 py-4">
      <h1 className="font-mono text-sm font-semibold tracking-widest text-foreground uppercase">
        {SHIP_NAME} <span className="text-accent">—</span> Mission Control
      </h1>

      {isRunning && (
        <div className="ml-auto flex items-center gap-3">
          <span className="truncate font-mono text-sm text-text-muted">
            {RUN_STATUS_LABEL[runStatus] ?? "Run in progress…"}
          </span>
          <button
            type="button"
            onClick={onAbort}
            className="shrink-0 rounded-md border border-danger bg-danger/15 px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-danger uppercase hover:bg-danger/25"
          >
            Abort
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={toggleMuted}
        aria-label={muted ? "Unmute ship alerts" : "Mute ship alerts"}
        aria-pressed={muted}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-border bg-panel-raised text-text-muted hover:border-accent hover:text-accent ${isRunning ? "" : "ml-auto"}`}
      >
        {muted ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="m16 9 5 6M21 9l-5 6" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="h-4 w-4"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5 6 9H3v6h3l5 4V5Z" />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
            />
          </svg>
        )}
      </button>

      <MailButton />
      <InboxModal />
    </header>
  );
}
