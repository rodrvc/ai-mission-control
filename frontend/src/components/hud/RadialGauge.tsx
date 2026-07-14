"use client";

export type GaugeSeverity = "nominal" | "warning" | "critical";

const SEVERITY_STROKE_CLASS: Record<GaugeSeverity, string> = {
  nominal: "stroke-accent",
  warning: "stroke-warning",
  critical: "stroke-danger",
};

const SEVERITY_TEXT_CLASS: Record<GaugeSeverity, string> = {
  nominal: "text-accent",
  warning: "text-warning",
  critical: "text-danger",
};

export interface RadialGaugeProps {
  /** 0..100 — the fraction of the ring to fill. */
  percent: number;
  severity: GaugeSeverity;
  /** Text rendered centered inside the ring, e.g. "72%". */
  centerLabel: string;
  size?: number;
  strokeWidth?: number;
}

/**
 * Circular SVG progress ring (D20). Pure presentational component — takes an
 * already-computed percent/severity so it stays reusable across O2, fuel,
 * and any future ring gauge without knowing about ship domain concepts.
 */
export function RadialGauge({
  percent,
  severity,
  centerLabel,
  size = 72,
  strokeWidth = 6,
}: RadialGaugeProps) {
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clampedPercent / 100);
  const center = size / 2;
  const isCritical = severity === "critical";

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={isCritical ? "animate-mc-pulse" : undefined}
      role="img"
      aria-label={centerLabel}
    >
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-panel-raised"
      />
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${center} ${center})`}
        className={`transition-[stroke-dashoffset] duration-500 ${SEVERITY_STROKE_CLASS[severity]}`}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        className={`font-mono text-[13px] font-semibold tabular-nums ${SEVERITY_TEXT_CLASS[severity]}`}
        fill="currentColor"
      >
        {centerLabel}
      </text>
    </svg>
  );
}
