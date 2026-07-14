"use client";

import { useShipStore } from "@/lib/store/shipStore";

interface DebugAction {
  label: string;
  run: () => void;
}

/**
 * Forced-test mechanism (D16): only rendered when the URL has ?debug=1.
 * Lets a developer trigger hull damage / resource drains on demand to
 * verify the damage -> O2 leak physics without waiting for the (not yet
 * implemented) random damage events.
 */
export function DebugPanel() {
  const damageHull = useShipStore((state) => state.damageHull);
  const restoreOxygen = useShipStore((state) => state.restoreOxygen);
  const consumeFuel = useShipStore((state) => state.consumeFuel);
  const spendTokens = useShipStore((state) => state.spendTokens);
  const reset = useShipStore((state) => state.reset);
  const actions: DebugAction[] = [
    { label: "Impact −15 hull", run: () => damageHull(15, "debug: simulated impact") },
    { label: "Impact −40 hull", run: () => damageHull(40, "debug: simulated impact") },
    { label: "O2 −20", run: () => restoreOxygen(-20) },
    { label: "Fuel −30", run: () => consumeFuel(30) },
    { label: "Tokens −150", run: () => spendTokens(150) },
    { label: "Reset ship", run: () => reset() },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col gap-1.5 rounded-md border border-panel-border bg-panel/95 p-3 shadow-lg backdrop-blur-sm">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-text-muted uppercase">
        Debug
      </span>
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={action.run}
          className="rounded border border-panel-border bg-panel-raised px-2.5 py-1 text-left font-mono text-[11px] text-foreground hover:border-accent hover:text-accent"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
