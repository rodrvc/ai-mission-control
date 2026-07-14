"use client";

import { useEffect, useRef, useState } from "react";
import { HULL_BAND_THRESHOLDS, MAX_FUEL, MAX_HULL, MAX_OXYGEN } from "@/lib/game/constants";
import { useShipStore } from "@/lib/store/shipStore";

type Severity = "nominal" | "warning" | "critical";

const SEVERITY_BAR_CLASS: Record<Severity, string> = {
  nominal: "bg-accent",
  warning: "bg-warning",
  critical: "bg-danger animate-mc-pulse",
};

const SEVERITY_TEXT_CLASS: Record<Severity, string> = {
  nominal: "text-accent",
  warning: "text-warning",
  critical: "text-danger",
};

function severityForPercent(percent: number): Severity {
  if (percent < 25) return "critical";
  if (percent < 50) return "warning";
  return "nominal";
}

interface GaugeProps {
  label: string;
  value: number;
  max: number;
  severity: Severity;
}

/** Slim horizontal gauge bar with a mono caption and percentage read-out. */
function Gauge({ label, value, max, severity }: GaugeProps) {
  const percent = Math.round((value / max) * 100);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <span className="w-9 shrink-0 font-mono text-[10px] tracking-widest text-text-muted uppercase">
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-raised">
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${SEVERITY_BAR_CLASS[severity]}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`w-9 shrink-0 text-right font-mono text-[11px] font-semibold ${SEVERITY_TEXT_CLASS[severity]}`}
      >
        {percent}%
      </span>
    </div>
  );
}

/** Tracks the previous tokens value to render a tiny +/- trend indicator. */
function useTokenTrend(tokens: number): "up" | "down" | null {
  const previous = useRef(tokens);
  const [trend, setTrend] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    if (tokens !== previous.current) {
      setTrend(tokens > previous.current ? "up" : "down");
      previous.current = tokens;
      const timer = setTimeout(() => setTrend(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [tokens]);

  return trend;
}

/**
 * Compact mission-control HUD strip (D15): O2/HULL/FUEL gauges plus a token
 * counter. Sits directly under the header, above the graph canvas.
 */
export function ShipHud() {
  const oxygen = useShipStore((state) => state.oxygen);
  const hull = useShipStore((state) => state.hull);
  const fuel = useShipStore((state) => state.fuel);
  const tokens = useShipStore((state) => state.tokens);

  const trend = useTokenTrend(tokens);

  const oxygenPercent = (oxygen / MAX_OXYGEN) * 100;
  const isLeaking = hull < HULL_BAND_THRESHOLDS.sealed;
  const isLeakingFast = hull < HULL_BAND_THRESHOLDS.fast;

  const oxygenSeverity = isLeakingFast ? "critical" : severityForPercent(oxygenPercent);
  const hullSeverity = severityForPercent((hull / MAX_HULL) * 100);
  const fuelSeverity = severityForPercent((fuel / MAX_FUEL) * 100);

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-panel-border bg-panel px-6 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Gauge label="O2" value={oxygen} max={MAX_OXYGEN} severity={oxygenSeverity} />
        {isLeaking && (
          <span className="animate-mc-pulse shrink-0 rounded border border-danger bg-danger/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest text-danger uppercase">
            Pressure leak
          </span>
        )}
      </div>

      <Gauge label="Hull" value={hull} max={MAX_HULL} severity={hullSeverity} />
      <Gauge label="Fuel" value={fuel} max={MAX_FUEL} severity={fuelSeverity} />

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="font-mono text-[10px] tracking-widest text-text-muted uppercase">
          Tokens
        </span>
        <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
          {tokens}
        </span>
        {trend && (
          <span
            className={`font-mono text-[11px] font-semibold ${
              trend === "up" ? "text-success" : "text-danger"
            }`}
          >
            {trend === "up" ? "▲" : "▼"}
          </span>
        )}
      </div>
    </div>
  );
}
