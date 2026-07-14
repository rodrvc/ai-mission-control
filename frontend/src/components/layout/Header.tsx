"use client";

import { useEffect, useState } from "react";
import { ConsoleHint } from "@/components/inbox/ConsoleHint";
import { InboxModal } from "@/components/inbox/InboxModal";
import { MailButton } from "@/components/inbox/MailButton";
import { SHIP_AI_NAME, SHIP_NAME } from "@/data/narrative";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useRunStore } from "@/lib/store/runStore";
import { useShipStore } from "@/lib/store/shipStore";

interface HeaderProps {
  isRunning: boolean;
  onSubmitPrompt: (prompt: string) => void;
  onAbort: () => void;
  /** False when tokens are depleted (D17) — console goes read-only. */
  canSubmit?: boolean;
}

const RUN_STATUS_LABEL: Record<string, string> = {
  started: "Run in progress…",
  awaiting_approval: "Awaiting captain authorization…",
};

/**
 * Top mission bar: ship name plus a command console. Replaces the old
 * scenario picker and manual-approval toggle (D12/D13) — the operator
 * delegates a task in free text and the intent router picks a scenario.
 * The input is disabled mid-run (current run state shows instead); ABORT
 * stays available throughout.
 */
export function Header({ isRunning, onSubmitPrompt, onAbort, canSubmit = true }: HeaderProps) {
  const runStatus = useRunStore((state) => state.runStatus);
  const [prompt, setPrompt] = useState("");

  const deliverWelcome = useInboxStore((state) => state.deliverWelcome);
  const dismissConsoleHint = useInboxStore((state) => state.dismissConsoleHint);
  const muted = useShipStore((state) => state.muted);
  const toggleMuted = useShipStore((state) => state.toggleMuted);

  // Deliver the welcome email once, shortly after the console mounts (D11).
  useEffect(() => {
    const timer = setTimeout(deliverWelcome, 2000);
    return () => clearTimeout(timer);
  }, [deliverWelcome]);

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isRunning || !canSubmit) return;
    onSubmitPrompt(trimmed);
    setPrompt("");
  };

  return (
    <header className="flex flex-wrap items-center gap-4 border-b border-panel-border bg-panel px-6 py-4">
      <h1 className="font-mono text-sm font-semibold tracking-widest text-foreground uppercase">
        {SHIP_NAME} <span className="text-accent">—</span> Mission Control
      </h1>

      <div className="ml-auto flex min-w-0 flex-1 items-center gap-3 sm:max-w-2xl">
        <div className="relative flex min-w-0 flex-1 items-center gap-2 rounded-md border border-panel-border bg-panel-raised px-3 py-1.5">
          <ConsoleHint />
          <span className="font-mono text-sm font-semibold text-accent">
            {SHIP_AI_NAME} ▸
          </span>
          {isRunning ? (
            <span className="truncate font-mono text-sm text-text-muted">
              {RUN_STATUS_LABEL[runStatus] ?? "Run in progress…"}
            </span>
          ) : !canSubmit ? (
            <span className="truncate font-mono text-sm text-danger">
              INSUFFICIENT COMPUTE — agents offline
            </span>
          ) : (
            <input
              type="text"
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                dismissConsoleHint();
              }}
              onFocus={dismissConsoleHint}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
              }}
              placeholder="Delegate a task to the ship's crew…"
              className="min-w-0 flex-1 bg-transparent font-mono text-sm text-foreground outline-none placeholder:text-text-muted"
            />
          )}
        </div>

        {!isRunning && (
          <button
            type="button"
            disabled={!prompt.trim() || !canSubmit}
            onClick={submit}
            className="shrink-0 rounded-md border border-accent bg-accent/15 px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-accent uppercase hover:bg-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Execute
          </button>
        )}

        {isRunning && (
          <button
            type="button"
            onClick={onAbort}
            className="shrink-0 rounded-md border border-danger bg-danger/15 px-4 py-1.5 font-mono text-xs font-semibold tracking-wide text-danger uppercase hover:bg-danger/25"
          >
            Abort
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={toggleMuted}
        aria-label={muted ? "Unmute ship alerts" : "Mute ship alerts"}
        aria-pressed={muted}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-border bg-panel-raised text-text-muted hover:border-accent hover:text-accent"
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
