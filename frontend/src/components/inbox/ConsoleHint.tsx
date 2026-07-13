"use client";

import { useInboxStore } from "@/lib/store/inboxStore";

/**
 * One-time guided hint (D14): a subtle glowing tooltip pointing at the
 * command console input, shown after the captain reads a mission email and
 * closes the inbox. Disappears as soon as the console gains focus (wired via
 * dismissConsoleHint, called from Header's input onFocus).
 */
export function ConsoleHint() {
  const isActive = useInboxStore((state) => state.isConsoleHintActive);

  if (!isActive) return null;

  return (
    <div
      role="status"
      className="animate-mc-pulse pointer-events-none absolute top-full right-0 z-10 mt-2 rounded-md border border-accent/50 bg-panel-raised px-3 py-1.5 font-mono text-xs whitespace-nowrap text-accent shadow-lg"
    >
      <span
        aria-hidden="true"
        className="absolute -top-1 right-6 h-2 w-2 rotate-45 border-t border-l border-accent/50 bg-panel-raised"
      />
      Transmit your directive here
    </div>
  );
}
