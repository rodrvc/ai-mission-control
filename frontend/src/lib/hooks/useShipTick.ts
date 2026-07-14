"use client";

import { useEffect } from "react";
import { TICK_INTERVAL_MS } from "@/lib/game/constants";
import { useShipStore } from "@/lib/store/shipStore";

/**
 * Single interval driver for the ship resource simulation (D15). Mount once
 * near the app root. Ticks are paused once the game is over so the overlay
 * state stays stable.
 */
export function useShipTick(): void {
  const tick = useShipStore((state) => state.tick);
  const isGameOver = useShipStore((state) => state.isGameOver);

  useEffect(() => {
    if (isGameOver) return;
    const interval = setInterval(tick, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [tick, isGameOver]);
}
