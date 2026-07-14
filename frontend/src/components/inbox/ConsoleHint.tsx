"use client";

import { useInboxStore } from "@/lib/store/inboxStore";

/**
 * One-time guided hint (D14): a subtle glowing tooltip pointing at the VEGA
 * floating action button (D21), shown after the captain reads a mission
 * email and closes the inbox. Disappears as soon as the widget is opened
 * (wired via dismissConsoleHint, called from VegaWidget's FAB onClick).
 */
export function ConsoleHint() {
  const isActive = useInboxStore((state) => state.isConsoleHintActive);

  if (!isActive) return null;

  return (
    <div
      role="status"
      className="animate-mc-pulse pointer-events-none absolute right-0 bottom-full z-10 mb-2 rounded-md border border-accent/50 bg-panel-raised px-3 py-1.5 font-mono text-xs whitespace-nowrap text-accent shadow-lg"
    >
      <span
        aria-hidden="true"
        className="absolute -bottom-1 right-6 h-2 w-2 rotate-45 border-r border-b border-accent/50 bg-panel-raised"
      />
      Transmit your directive to VEGA
    </div>
  );
}
