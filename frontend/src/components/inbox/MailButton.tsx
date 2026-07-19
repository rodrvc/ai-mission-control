"use client";

import { useEffect, useRef, useState } from "react";
import { useInboxStore } from "@/lib/store/inboxStore";

/** How long the first-arrival halo stays lit before settling into the
 * regular badge pulse (D-ACU59) — long enough to catch a first glance at the
 * header without lingering as a permanent distraction. */
const FIRST_ARRIVAL_HALO_MS = 4000;

/**
 * Circular mail icon button for the Header. Shows an unread-count badge that
 * pulses (mc-pulse, see globals.css) whenever there is unread mail — the
 * arrival cue for D11's narrative onboarding. The very first transmission's
 * arrival gets a stronger directional halo + header glow so a first-time
 * captain's eye is drawn there without a generic tooltip.
 */
export function MailButton() {
  const unreadCount = useInboxStore((state) => state.unreadIds.length);
  const openModal = useInboxStore((state) => state.openModal);

  const hasSeenMail = useRef(false);
  const [isFirstArrival, setIsFirstArrival] = useState(false);

  useEffect(() => {
    if (unreadCount > 0 && !hasSeenMail.current) {
      hasSeenMail.current = true;
      setIsFirstArrival(true);
      const timer = setTimeout(() => setIsFirstArrival(false), FIRST_ARRIVAL_HALO_MS);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  return (
    <button
      type="button"
      onClick={openModal}
      aria-label={
        unreadCount > 0 ? `Open inbox, ${unreadCount} unread transmission(s)` : "Open inbox"
      }
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-panel-raised text-text-muted transition-shadow hover:border-accent hover:text-accent ${
        isFirstArrival
          ? "animate-mc-pulse border-accent shadow-[0_0_16px_4px_rgba(45,212,191,0.45)]"
          : "border-panel-border"
      }`}
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
          className={`animate-mc-pulse absolute -top-1 -right-1 flex items-center justify-center rounded-full bg-accent px-1 font-mono text-[10px] font-bold text-accent-foreground ${
            isFirstArrival ? "h-5 min-w-5" : "h-4 min-w-4"
          }`}
          aria-hidden="true"
        >
          {unreadCount}
        </span>
      )}
    </button>
  );
}
