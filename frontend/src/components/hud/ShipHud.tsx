"use client";

import { useEffect, useRef, useState } from "react";
import { HULL_BAND_THRESHOLDS, MAX_FUEL, MAX_HULL, MAX_OXYGEN, STARTING_TOKENS } from "@/lib/game/constants";
import { getHull, useShipStore } from "@/lib/store/shipStore";
import { HullShipSilhouette } from "@/components/hud/HullShipSilhouette";
import { RadialGauge, type GaugeSeverity } from "@/components/hud/RadialGauge";

function severityForPercent(percent: number): GaugeSeverity {
  if (percent < 25) return "critical";
  if (percent < 50) return "warning";
  return "nominal";
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

/** Shared card chrome: panel background, border, rounded, mono caption. */
function HudCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-[140px] flex-1 flex-col items-center gap-1.5 rounded-lg border border-panel-border bg-panel px-3 py-2.5">
      <span className="font-mono text-[10px] font-semibold tracking-widest text-text-muted uppercase">
        {title}
      </span>
      {children}
    </div>
  );
}

/**
 * Mission-control HUD cards row (D20): O2/FUEL as radial gauges, TOKENS as a
 * numeric card, HULL as a ship-section silhouette card. Sits directly under
 * the header, above the graph canvas; wraps responsively on small widths.
 */
export function ShipHud() {
  const oxygen = useShipStore((state) => state.oxygen);
  const hullSections = useShipStore((state) => state.hullSections);
  const fuel = useShipStore((state) => state.fuel);
  const tokens = useShipStore((state) => state.tokens);
  const hull = useShipStore(getHull);

  const trend = useTokenTrend(tokens);

  const oxygenPercent = (oxygen / MAX_OXYGEN) * 100;
  const fuelPercent = (fuel / MAX_FUEL) * 100;
  const hullPercent = (hull / MAX_HULL) * 100;
  const tokensPercent = (tokens / STARTING_TOKENS) * 100;

  const isLeaking = hull < HULL_BAND_THRESHOLDS.sealed;
  const isLeakingFast = hull < HULL_BAND_THRESHOLDS.fast;

  const oxygenSeverity = isLeakingFast ? "critical" : severityForPercent(oxygenPercent);
  const fuelSeverity = severityForPercent(fuelPercent);

  return (
    <div className="flex flex-wrap items-stretch gap-3 border-b border-panel-border bg-panel-raised/40 px-6 py-3">
      <HudCard title="O2">
        <RadialGauge
          percent={oxygenPercent}
          severity={oxygenSeverity}
          centerLabel={`${Math.round(oxygenPercent)}%`}
        />
        {isLeaking && (
          <span className="animate-mc-pulse rounded border border-danger bg-danger/15 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-widest text-danger uppercase">
            Pressure leak
          </span>
        )}
      </HudCard>

      <HudCard title="Fuel">
        <RadialGauge
          percent={fuelPercent}
          severity={fuelSeverity}
          centerLabel={`${Math.round(fuelPercent)}%`}
        />
      </HudCard>

      <HudCard title="Hull">
        <div className="flex items-center gap-2.5">
          <HullShipSilhouette sections={hullSections} />
          <span
            className={`font-mono text-sm font-semibold tabular-nums ${
              severityForPercent(hullPercent) === "critical"
                ? "text-danger"
                : severityForPercent(hullPercent) === "warning"
                  ? "text-warning"
                  : "text-accent"
            }`}
          >
            {Math.round(hullPercent)}%
          </span>
        </div>
      </HudCard>

      <HudCard title="Tokens">
        <div className="relative flex items-center justify-center">
          <RadialGauge
            percent={tokensPercent}
            severity={severityForPercent(tokensPercent)}
            centerLabel={`${tokens}`}
          />
          {trend && (
            <span
              className={`absolute -top-1 -right-1 font-mono text-[11px] font-semibold ${
                trend === "up" ? "text-success" : "text-danger"
              }`}
            >
              {trend === "up" ? "▲" : "▼"}
            </span>
          )}
        </div>
      </HudCard>
    </div>
  );
}
