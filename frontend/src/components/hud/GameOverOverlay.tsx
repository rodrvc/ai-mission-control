"use client";

import { useShipStore } from "@/lib/store/shipStore";

interface GameOverOverlayProps {
  onRestart: () => void;
}

/**
 * Full-screen blocking overlay shown when oxygen hits 0 (D15). Sits above
 * everything, including the header, and is the only way back into the
 * campaign via "Restart campaign".
 */
export function GameOverOverlay({ onRestart }: GameOverOverlayProps) {
  const isGameOver = useShipStore((state) => state.isGameOver);

  if (!isGameOver) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 className="font-mono text-2xl font-bold tracking-widest text-danger uppercase">
          Life Support Failure
        </h2>
        <p className="font-mono text-sm tracking-wide text-text-muted uppercase">Mission Lost</p>
        <p className="max-w-md font-mono text-sm text-text-muted">
          Oxygen reserves reached zero before the crew could restore pressure integrity. The
          Meridian falls silent.
        </p>
      </div>

      <button
        type="button"
        onClick={onRestart}
        className="rounded-md border border-accent bg-accent/15 px-6 py-2 font-mono text-xs font-semibold tracking-widest text-accent uppercase hover:bg-accent/25"
      >
        Restart Campaign
      </button>
    </div>
  );
}
