"use client";

import { useEffect, useRef, useState } from "react";
import { useShipStore } from "@/lib/store/shipStore";

const VISIBLE_MS = 6000;

/**
 * Surfaces `lastDamageCause` (D20: written by every damageHull call, never
 * rendered anywhere) as a short-lived banner under the HUD. Watches for the
 * cause *string* changing rather than any particular trigger event, so it
 * works whether damage is applied on "email arrives" or "mission read/
 * activated" (ACU-60 may move that trigger in a parallel worktree) — both
 * paths already go through shipStore.damageHull, which is the only thing
 * this component depends on.
 */
export function DamageCauseToast() {
  const lastDamageCause = useShipStore((state) => state.lastDamageCause);
  const previousCause = useRef<string | undefined>(undefined);
  const [visibleCause, setVisibleCause] = useState<string | null>(null);

  useEffect(() => {
    if (lastDamageCause && lastDamageCause !== previousCause.current) {
      setVisibleCause(lastDamageCause);
      previousCause.current = lastDamageCause;
      const timer = setTimeout(() => setVisibleCause(null), VISIBLE_MS);
      return () => clearTimeout(timer);
    }
    previousCause.current = lastDamageCause;
  }, [lastDamageCause]);

  if (!visibleCause) return null;

  return (
    <div
      role="status"
      className="flex items-center gap-2 border-b border-danger/40 bg-danger/10 px-6 py-1.5 font-mono text-xs text-danger"
    >
      <span className="font-semibold tracking-widest uppercase">Alert</span>
      <span className="text-danger/90">{visibleCause}</span>
    </div>
  );
}
