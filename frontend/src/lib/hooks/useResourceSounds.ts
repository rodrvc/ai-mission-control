"use client";

import { useEffect, useRef } from "react";
import { MAX_FUEL, MAX_HULL, MAX_OXYGEN } from "@/lib/game/constants";
import { playSound } from "@/lib/sound/sounds";
import { getHull, useShipStore } from "@/lib/store/shipStore";

const CRITICAL_PERCENT = 25;

function isCritical(value: number, max: number): boolean {
  return (value / max) * 100 < CRITICAL_PERCENT;
}

/**
 * Fires the "alert" sound once per critical-band *entry* for oxygen, hull,
 * and fuel (not every tick while critical), and the "gameOver" tone once
 * when oxygen depletion ends the run (D18). Mount once near the app root,
 * alongside useShipTick.
 */
export function useResourceSounds(): void {
  const oxygen = useShipStore((state) => state.oxygen);
  const hull = useShipStore(getHull);
  const fuel = useShipStore((state) => state.fuel);
  const isGameOver = useShipStore((state) => state.isGameOver);

  const wasCritical = useRef({ oxygen: false, hull: false, fuel: false });
  const gameOverSounded = useRef(false);

  useEffect(() => {
    const nowCritical = {
      oxygen: isCritical(oxygen, MAX_OXYGEN),
      hull: isCritical(hull, MAX_HULL),
      fuel: isCritical(fuel, MAX_FUEL),
    };
    const enteredCritical =
      (nowCritical.oxygen && !wasCritical.current.oxygen) ||
      (nowCritical.hull && !wasCritical.current.hull) ||
      (nowCritical.fuel && !wasCritical.current.fuel);
    if (enteredCritical) playSound("alert");
    wasCritical.current = nowCritical;
  }, [oxygen, hull, fuel]);

  useEffect(() => {
    if (isGameOver && !gameOverSounded.current) {
      gameOverSounded.current = true;
      playSound("gameOver");
    }
    if (!isGameOver) {
      gameOverSounded.current = false;
    }
  }, [isGameOver]);
}
