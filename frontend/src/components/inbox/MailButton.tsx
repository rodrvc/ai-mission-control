"use client";

import { useInboxStore } from "@/lib/store/inboxStore";

/**
 * Circular mail icon button for the Header. Shows an unread-count badge that
 * pulses (mc-pulse, see globals.css) whenever there is unread mail — the
 * arrival cue for D11's narrative onboarding.
 */
export function MailButton() {
  const unreadCount = useInboxStore((state) => state.unreadIds.length);
  const openModal = useInboxStore((state) => state.openModal);

  return (
    <button
      type="button"
      onClick={openModal}
      aria-label={
        unreadCount > 0 ? `Open inbox, ${unreadCount} unread transmission(s)` : "Open inbox"
      }
      className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-panel-border bg-panel-raised text-text-muted hover:border-accent hover:text-accent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="h-4 w-4"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 6.75A1.75 1.75 0 0 1 4.75 5h14.5A1.75 1.75 0 0 1 21 6.75v10.5A1.75 1.75 0 0 1 19.25 19H4.75A1.75 1.75 0 0 1 3 17.25V6.75Z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="m4 7 8 6 8-6" />
      </svg>

      {unreadCount > 0 && (
        <span
          className="animate-mc-pulse absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-foreground"
          aria-hidden="true"
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
