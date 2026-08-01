"use client";

/**
 * VEGA's visual embodiment — the "Bridge Droid" (variant B1: glass dome).
 *
 * A single SVG head that expresses VEGA's reaction to the ship's state purely
 * through eyes, antenna colour and motion (plus a couple of ambient extras like
 * a sonar ring or a nervous sweat drop). It never speaks — the copy lives in
 * VegaWidget; this only carries mood. Self-contained: all keyframes are scoped
 * via styled-jsx so it doesn't depend on globals.css.
 *
 * Design was chosen iteratively with the product owner: B1 Glass Dome base,
 * with a fear-not-anger "warning" expression rendered with eyes only (no brows
 * or mouth) so it stays consistent with the rest of the state set.
 */

/** The nine moods VEGA can be in. Each maps to a real app condition — the
 * mapping itself lives in VegaWidget (see stateFromRun there), not here, so
 * this component stays a pure presentational function of `state`. */
export type VegaState =
  | "idle" // standing by
  | "listening" // captain is typing / input focused
  | "thinking" // run in progress
  | "speaking" // delivering a final response
  | "warning" // heads-up: something needs attention, not urgent
  | "alert" // awaiting authorization / emergency
  | "success" // run completed OK
  | "offline" // insufficient compute — crews offline
  | "decline"; // request out of scope

interface VegaAvatarProps {
  state?: VegaState;
  /** Pixel size of the square SVG. Defaults to 28 (matches the old VegaMark). */
  size?: number;
  className?: string;
  title?: string;
}

// Shared palette (kept local so the SVG is portable even outside this app's
// tokens; values mirror globals.css so it looks native here).
const TEAL = "#2dd4bf";
const AMBER = "#f5a524";
const RED = "#f0455a";
const GREEN = "#34d399";
const MUTED = "#2b3644";
const FACE = "#060a11";

const GLOW = {
  teal: "drop-shadow(0 0 5px rgba(45,212,191,0.6))",
  amber: "drop-shadow(0 0 5px rgba(245,165,36,0.7))",
  red: "drop-shadow(0 0 5px rgba(240,69,90,0.7))",
  green: "drop-shadow(0 0 5px rgba(52,211,153,0.7))",
} as const;

export function VegaAvatar({ state = "idle", size = 28, className, title }: VegaAvatarProps) {
  return (
    <span
      className={className}
      role="img"
      aria-label={title ?? `VEGA — ${state}`}
      style={{ display: "inline-flex", width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
        {/* Glass-dome gradient (B1). id is namespaced to avoid collisions when
            multiple avatars render on one page. */}
        <defs>
          <linearGradient id="vega-dome" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#20293a" />
            <stop offset="1" stopColor="#121826" />
          </linearGradient>
        </defs>
        <StateGroup state={state} />
      </svg>

      {/* Scoped keyframes — no dependency on globals.css. */}
      <style jsx>{`
        span :global(.va-bob-tilt) {
          animation: va-bob-tilt 5s ease-in-out infinite;
          transform-origin: 50% 80%;
        }
        span :global(.va-bob-slow) {
          animation: va-bob-slow 3s ease-in-out infinite;
        }
        span :global(.va-blink) {
          animation: va-blink 5s ease-in-out infinite;
          transform-origin: center;
          transform-box: fill-box;
        }
        span :global(.va-blink.b2) {
          animation-delay: 0.05s;
        }
        span :global(.va-pulse) {
          animation: va-pulse 2.4s ease-in-out infinite;
        }
        span :global(.va-sway) {
          animation: va-sway 3.5s ease-in-out infinite;
          transform-origin: 50% 100%;
          transform-box: fill-box;
        }
        span :global(.va-shake) {
          animation: va-shake 0.4s ease-in-out infinite;
        }
        span :global(.va-worried) {
          animation: va-worried 1.3s ease-in-out infinite;
        }
        span :global(.va-flat) {
          animation: va-flat 3s ease-in-out infinite;
        }

        @keyframes va-blink {
          0%, 92%, 100% { transform: scaleY(1); }
          96% { transform: scaleY(0.08); }
        }
        @keyframes va-bob-tilt {
          0%, 100% { transform: translateY(0) rotate(-1.5deg); }
          50% { transform: translateY(-5px) rotate(1.5deg); }
        }
        @keyframes va-bob-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes va-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes va-sway {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes va-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-2px); }
          40% { transform: translateX(2px); }
          60% { transform: translateX(-2px); }
          80% { transform: translateX(2px); }
        }
        @keyframes va-worried {
          0%, 100% { transform: translate(0, 0); }
          25% { transform: translate(-0.8px, -2px); }
          50% { transform: translate(0.8px, 0); }
          75% { transform: translate(-0.6px, -2px); }
        }
        @keyframes va-flat {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.15; }
        }

        @media (prefers-reduced-motion: reduce) {
          span :global(.va-bob-tilt),
          span :global(.va-bob-slow),
          span :global(.va-blink),
          span :global(.va-pulse),
          span :global(.va-sway),
          span :global(.va-shake),
          span :global(.va-worried),
          span :global(.va-flat) {
            animation: none !important;
          }
        }
      `}</style>
    </span>
  );
}

/* ---------- shared head chrome (dome + ears), reused by most states ---------- */

/** The ear pods flanking the head. Colour of the little ear light varies by
 * state, so it's a prop. */
function Ears({ light = TEAL, stroke = "#33465e" }: { light?: string; stroke?: string }) {
  return (
    <>
      <rect x="18" y="40" width="8" height="16" rx="4" fill="#141b28" stroke={stroke} strokeWidth="1.5" />
      <rect x="74" y="40" width="8" height="16" rx="4" fill="#141b28" stroke={stroke} strokeWidth="1.5" />
      <circle className="va-pulse" cx="22" cy="48" r="1.6" fill={light} />
      <circle className="va-pulse" cx="78" cy="48" r="1.6" fill={light} />
    </>
  );
}

/** Glass reflection highlight across the top of the dome (B1 signature). */
function DomeGlint({ y = 30, opacity = 0.06 }: { y?: number; opacity?: number }) {
  return (
    <>
      <path d={`M28 ${y} Q50 ${y - 4} 72 ${y} L72 ${y + 8} Q50 ${y + 3} 28 ${y + 8} Z`} fill="#fff" opacity={opacity} />
      <ellipse cx="35" cy={y + 3} rx="7" ry="2.5" fill="#fff" opacity={opacity * 2} />
    </>
  );
}

/* ---------------------------- per-state renderers ---------------------------- */

function StateGroup({ state }: { state: VegaState }) {
  switch (state) {
    case "listening":
      return <Listening />;
    case "thinking":
      return <Thinking />;
    case "speaking":
      return <Speaking />;
    case "warning":
      return <Warning />;
    case "alert":
      return <Alert />;
    case "success":
      return <Success />;
    case "offline":
      return <Offline />;
    case "decline":
      return <Decline />;
    case "idle":
    default:
      return <Idle />;
  }
}

function Idle() {
  return (
    <g className="va-bob-tilt">
      <g className="va-sway">
        <line x1="50" y1="20" x2="50" y2="11" stroke={TEAL} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="9" r="2.6" fill={TEAL} style={{ filter: GLOW.teal }} />
      </g>
      <Ears />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      <g className="va-blink">
        <ellipse cx="41" cy="43" rx="5.5" ry="7" fill={TEAL} style={{ filter: GLOW.teal }} />
        <circle cx="42.5" cy="40.5" r="1.8" fill="#eafffb" />
      </g>
      <g className="va-blink b2">
        <ellipse cx="59" cy="43" rx="5.5" ry="7" fill={TEAL} style={{ filter: GLOW.teal }} />
        <circle cx="60.5" cy="40.5" r="1.8" fill="#eafffb" />
      </g>
      <DomeGlint />
    </g>
  );
}

function Listening() {
  return (
    <g className="va-bob-slow">
      <line x1="50" y1="19" x2="50" y2="9" stroke={TEAL} strokeWidth="2" />
      <circle className="va-pulse" cx="50" cy="7" r="2.8" fill={TEAL} style={{ filter: GLOW.teal }} />
      <rect x="18" y="40" width="8" height="16" rx="4" fill="#141b28" stroke="#33465e" strokeWidth="1.5" />
      <rect x="74" y="40" width="8" height="16" rx="4" fill="#141b28" stroke="#33465e" strokeWidth="1.5" />
      {/* sonar rings emanating from the ears */}
      <circle cx="22" cy="48" r="6" fill="none" stroke={TEAL} strokeWidth="1.5">
        <animate attributeName="r" values="4;13" dur="1.6s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="1.6s" repeatCount="indefinite" />
      </circle>
      <circle cx="78" cy="48" r="6" fill="none" stroke={TEAL} strokeWidth="1.5">
        <animate attributeName="r" values="4;13" dur="1.6s" begin="0.4s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.7;0" dur="1.6s" begin="0.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="22" cy="48" r="1.6" fill={TEAL} />
      <circle cx="78" cy="48" r="1.6" fill={TEAL} />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      <ellipse cx="41" cy="43" rx="6" ry="8" fill={TEAL} style={{ filter: GLOW.teal }} />
      <circle cx="42.5" cy="40" r="2" fill="#eafffb" />
      <ellipse cx="59" cy="43" rx="6" ry="8" fill={TEAL} style={{ filter: GLOW.teal }} />
      <circle cx="60.5" cy="40" r="2" fill="#eafffb" />
      <DomeGlint />
    </g>
  );
}

function Thinking() {
  return (
    <g className="va-bob-slow">
      <g className="va-sway">
        <line x1="50" y1="20" x2="50" y2="11" stroke={TEAL} strokeWidth="2" />
        <circle cx="50" cy="9" r="2.6" fill={TEAL} style={{ filter: GLOW.teal }} />
      </g>
      {/* spinning arc on the antenna tip */}
      <circle cx="50" cy="9" r="5" fill="none" stroke={TEAL} strokeWidth="1.4" strokeDasharray="6 20">
        <animateTransform attributeName="transform" type="rotate" from="0 50 9" to="360 50 9" dur="1.2s" repeatCount="indefinite" />
      </circle>
      <Ears />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      {/* squinting eyes looking up */}
      <path d="M36 41 Q41 37 46 41" fill="none" stroke={TEAL} strokeWidth="3.4" strokeLinecap="round" style={{ filter: GLOW.teal }} />
      <path d="M54 41 Q59 37 64 41" fill="none" stroke={TEAL} strokeWidth="3.4" strokeLinecap="round" style={{ filter: GLOW.teal }} />
      {/* thinking dots */}
      {[43, 50, 57].map((cx, i) => (
        <circle key={cx} cx={cx} cy="50" r="1.6" fill={TEAL}>
          <animate attributeName="opacity" values="0.2;1;0.2" dur="1.2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
      <DomeGlint />
    </g>
  );
}

function Speaking() {
  return (
    <g className="va-bob-slow">
      <g className="va-sway">
        <line x1="50" y1="20" x2="50" y2="11" stroke={TEAL} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="9" r="2.6" fill={TEAL} style={{ filter: GLOW.teal }} />
      </g>
      <Ears />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="28" width="44" height="30" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      <ellipse cx="41" cy="40" rx="5.5" ry="6.5" fill={TEAL} style={{ filter: GLOW.teal }} />
      <circle cx="42.5" cy="38" r="1.8" fill="#eafffb" />
      <ellipse cx="59" cy="40" rx="5.5" ry="6.5" fill={TEAL} style={{ filter: GLOW.teal }} />
      <circle cx="60.5" cy="38" r="1.8" fill="#eafffb" />
      {/* waveform "mouth" */}
      <g fill="none" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" style={{ filter: GLOW.teal }}>
        {[
          { x: 44, base: 51, amp: 2, dur: "0.5s" },
          { x: 48, base: 50, amp: 4, dur: "0.4s" },
          { x: 52, base: 50, amp: 4, dur: "0.45s" },
          { x: 56, base: 51, amp: 2, dur: "0.55s" },
        ].map(({ x, base, amp, dur }) => (
          <line key={x} x1={x} y1={base} x2={x} y2={base}>
            <animate attributeName="y1" values={`${base - amp};${base + amp};${base - amp}`} dur={dur} repeatCount="indefinite" />
            <animate attributeName="y2" values={`${base + amp};${base - amp};${base + amp}`} dur={dur} repeatCount="indefinite" />
          </line>
        ))}
      </g>
      <DomeGlint y={28} />
    </g>
  );
}

/** Warning — nervous / scared, expressed with EYES ONLY (no brows or mouth) so
 * it stays consistent with the rest of the set. The upper-inner lid wedge over
 * each eye deforms the round eye into a tense, uneven shape that reads as worry;
 * a sweat drop and a small jitter finish it. Amber, calmer than `alert`. */
function Warning() {
  return (
    <g className="va-worried">
      <g className="va-sway" style={{ animationDuration: "1.8s" }}>
        <line x1="50" y1="19" x2="50" y2="9" stroke={AMBER} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="7" r="2.8" fill={AMBER} style={{ filter: GLOW.amber, animationDuration: "1.6s" }} />
      </g>
      <Ears light={AMBER} />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      <g className="va-blink" style={{ animationDuration: "2.8s" }}>
        <circle cx="41" cy="44" r="6.5" fill={AMBER} style={{ filter: GLOW.amber }} />
        <circle cx="43" cy="41.5" r="2" fill="#fff4e0" />
        {/* upper-inner lid wedge (matches face bg) */}
        <path d="M34 38 L48 40 L48 37 L34 36 Z" fill={FACE} />
      </g>
      <g className="va-blink b2" style={{ animationDuration: "2.8s" }}>
        <circle cx="59" cy="44" r="6.5" fill={AMBER} style={{ filter: GLOW.amber }} />
        <circle cx="57" cy="41.5" r="2" fill="#fff4e0" />
        <path d="M66 38 L52 40 L52 37 L66 36 Z" fill={FACE} />
      </g>
      {/* nervous sweat drop */}
      <path d="M68 41 q2 4 0 5.5 q-2 -1.5 0 -5.5 z" fill="#7fd3ff" opacity="0.85">
        <animate attributeName="opacity" values="0;0.85;0.85;0" dur="2.6s" repeatCount="indefinite" />
        <animateTransform attributeName="transform" type="translate" values="0 -1; 0 3" dur="2.6s" repeatCount="indefinite" />
      </path>
      <DomeGlint />
    </g>
  );
}

/** Alert — the strong level: emergency / critical authorization. Amber eyes,
 * tense brows, RED antenna, hard shake. Reserved for the urgent stuff. */
function Alert() {
  return (
    <g className="va-shake">
      <g className="va-sway" style={{ animationDuration: "1.2s" }}>
        <line x1="50" y1="20" x2="50" y2="11" stroke={RED} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="9" r="2.8" fill={RED} style={{ filter: GLOW.red }} />
      </g>
      <rect x="18" y="40" width="8" height="16" rx="4" fill="#141b28" stroke="#3a2f22" strokeWidth="1.5" />
      <rect x="74" y="40" width="8" height="16" rx="4" fill="#141b28" stroke="#3a2f22" strokeWidth="1.5" />
      <circle className="va-pulse" cx="22" cy="48" r="1.6" fill={AMBER} />
      <circle className="va-pulse" cx="78" cy="48" r="1.6" fill={AMBER} />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a2f22" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#3a2f22" strokeWidth="1.5" />
      <line x1="34" y1="35" x2="45" y2="38" stroke={AMBER} strokeWidth="2.4" strokeLinecap="round" />
      <line x1="66" y1="35" x2="55" y2="38" stroke={AMBER} strokeWidth="2.4" strokeLinecap="round" />
      <g className="va-blink" style={{ animationDuration: "2.5s" }}>
        <ellipse cx="41" cy="45" rx="5.5" ry="6" fill={AMBER} style={{ filter: GLOW.amber }} />
        <circle cx="42.5" cy="43" r="1.6" fill="#fff4e0" />
      </g>
      <g className="va-blink b2" style={{ animationDuration: "2.5s" }}>
        <ellipse cx="59" cy="45" rx="5.5" ry="6" fill={AMBER} style={{ filter: GLOW.amber }} />
        <circle cx="60.5" cy="43" r="1.6" fill="#fff4e0" />
      </g>
      <DomeGlint opacity={0.05} />
    </g>
  );
}

function Success() {
  return (
    <g className="va-bob-tilt" style={{ animationDuration: "2.5s" }}>
      <g className="va-sway">
        <line x1="50" y1="20" x2="50" y2="11" stroke={GREEN} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="9" r="2.6" fill={GREEN} style={{ filter: GLOW.green }} />
      </g>
      <Ears light={GREEN} />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#284b3d" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      {/* happy curved eyes ^_^ */}
      <path d="M36 46 Q41 39 46 46" fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" style={{ filter: GLOW.green }} />
      <path d="M54 46 Q59 39 64 46" fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" style={{ filter: GLOW.green }} />
      <DomeGlint />
    </g>
  );
}

function Offline() {
  return (
    <g style={{ transform: "translateY(4px)" }}>
      <line x1="50" y1="20" x2="53" y2="13" stroke={MUTED} strokeWidth="2" />
      <circle cx="53.5" cy="11.5" r="2.4" fill={MUTED} />
      <rect x="18" y="40" width="8" height="16" rx="4" fill="#111722" stroke="#232e3e" strokeWidth="1.5" />
      <rect x="74" y="40" width="8" height="16" rx="4" fill="#111722" stroke="#232e3e" strokeWidth="1.5" />
      <circle cx="22" cy="48" r="1.6" fill={MUTED} />
      <circle cx="78" cy="48" r="1.6" fill={MUTED} />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="#111722" stroke="#232e3e" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1a222e" strokeWidth="1.5" />
      {/* dead flatline eyes */}
      <line className="va-flat" x1="35" y1="43" x2="47" y2="43" stroke="#3a4657" strokeWidth="3" strokeLinecap="round" />
      <line className="va-flat" x1="53" y1="43" x2="65" y2="43" stroke="#3a4657" strokeWidth="3" strokeLinecap="round" />
      <DomeGlint opacity={0.02} />
    </g>
  );
}

function Decline() {
  return (
    <g className="va-bob-tilt" style={{ transform: "rotate(4deg)", animationDuration: "6s" }}>
      <g className="va-sway">
        <line x1="50" y1="20" x2="50" y2="11" stroke={TEAL} strokeWidth="2" />
        <circle className="va-pulse" cx="50" cy="9" r="2.6" fill={TEAL} style={{ filter: GLOW.teal }} />
      </g>
      <Ears />
      <rect x="24" y="24" width="52" height="42" rx="20" fill="url(#vega-dome)" stroke="#3a4d66" strokeWidth="2" />
      <rect x="28" y="30" width="44" height="26" rx="14" fill={FACE} stroke="#1f2a3a" strokeWidth="1.5" />
      {/* one open eye, one skeptical squint */}
      <g className="va-blink">
        <ellipse cx="41" cy="43" rx="5.5" ry="7" fill={TEAL} style={{ filter: GLOW.teal }} />
        <circle cx="42.5" cy="40.5" r="1.8" fill="#eafffb" />
      </g>
      <path d="M53 44 Q59 41 65 44" fill="none" stroke={TEAL} strokeWidth="3.4" strokeLinecap="round" style={{ filter: GLOW.teal }} />
      <DomeGlint />
    </g>
  );
}
