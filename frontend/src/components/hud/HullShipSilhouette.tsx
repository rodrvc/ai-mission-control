"use client";

import type { HullSectionId, HullSections } from "@/lib/store/shipStore";
import { HULL_SECTION_IDS } from "@/lib/store/shipStore";

export type SectionSeverity = "nominal" | "warning" | "critical";

const SEVERITY_FILL_CLASS: Record<SectionSeverity, string> = {
  nominal: "fill-success",
  warning: "fill-warning",
  critical: "fill-danger",
};

function severityForSection(percent: number): SectionSeverity {
  if (percent < 25) return "critical";
  if (percent < 50) return "warning";
  return "nominal";
}

const SECTION_LABEL: Record<HullSectionId, string> = {
  "command-deck": "Command Deck",
  "aft-module": "Aft Module",
  engineering: "Engineering",
  drive: "Drive",
};

/** Bow-to-stern rectangles making up a minimal top-down ship silhouette.
 * Order matches HULL_SECTION_IDS (command-deck at the bow, drive at the
 * stern). Purely presentational layout constants. */
const SECTION_RECTS: Record<HullSectionId, { x: number; width: number }> = {
  "command-deck": { x: 4, width: 26 },
  "aft-module": { x: 30, width: 24 },
  engineering: { x: 54, width: 24 },
  drive: { x: 78, width: 18 },
};

const SHIP_HEIGHT = 28;

interface HullShipSilhouetteProps {
  sections: HullSections;
}

/**
 * Minimal top-down ship silhouette split into the 4 named hull sections
 * (D20), each fill-colored by its own integrity band. A native <title> on
 * each section gives a hover tooltip with name + percent.
 */
export function HullShipSilhouette({ sections }: HullShipSilhouetteProps) {
  return (
    <svg
      width={100}
      height={SHIP_HEIGHT}
      viewBox={`0 0 100 ${SHIP_HEIGHT}`}
      role="img"
      aria-label="Hull sections"
      className="shrink-0"
    >
      {HULL_SECTION_IDS.map((id) => {
        const integrity = sections[id];
        const severity = severityForSection(integrity);
        const { x, width } = SECTION_RECTS[id];
        return (
          <rect
            key={id}
            x={x}
            y={4}
            width={width}
            height={SHIP_HEIGHT - 8}
            rx={3}
            className={`${SEVERITY_FILL_CLASS[severity]} transition-[fill] duration-500`}
            stroke="var(--panel-border)"
            strokeWidth={1}
          >
            <title>{`${SECTION_LABEL[id]}: ${Math.round(integrity)}%`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
