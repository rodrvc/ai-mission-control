// Scenario metadata for the ISV Meridian's three mission domains. Since D12,
// scenarios are reached via the command console + intent router
// (lib/simulation/router.ts), not a picker — this table now documents the
// canonical example request for each domain, matched against the scripted
// `user-request` events in lib/simulation/scenarios/*.ts and the paths
// defined in ARCHITECTURE.md.

import type { Scenario, ScenarioId } from "@/lib/types/events";

export const SCENARIOS: Scenario[] = [
  {
    id: "life-support",
    label: "Life Support",
    request: "Oxygen pressure is dropping in the life support module.",
    description:
      "Diagnose and repair a life-support fault aboard the Meridian, with a safety-review retry.",
  },
  {
    id: "navigation",
    label: "Navigation",
    request: "Plot a correction burn for the XJS-7 approach vector.",
    description:
      "Diagnose and correct a trajectory deviation on the Meridian's approach to XJS-7 — always pauses for captain authorization.",
  },
  {
    id: "knowledge",
    label: "Knowledge",
    request: "What's our ETA to XJS-7?",
    description: "Answer a mission-intel query via VEGA's knowledge base and long-range survey data.",
  },
];

/** ACU-61: domain-flavored teaching copy for the VEGA console — an example
 * shape for the console placeholder, and a nudge phrase used when steering a
 * declined ("irrelevant") request back toward a domain. Neither string
 * contains a winning `ROUTING_KEYWORDS` term (lib/simulation/router.ts) — the
 * player still has to find their own wording, just aimed at the right system. */
export const SCENARIO_HINTS: Record<Exclude<ScenarioId, "irrelevant">, { placeholder: string; nudge: string }> = {
  "life-support": {
    placeholder: "Describe the anomaly you're seeing on a ship system…",
    nudge: "the state of a ship system",
  },
  navigation: {
    placeholder: "Describe where the ship needs to be heading…",
    nudge: "where the ship should be heading",
  },
  knowledge: {
    placeholder: "Ask VEGA something about the mission itself…",
    nudge: "the mission itself",
  },
};

/** Generic placeholder shown before any mission domain has been established
 * (no prompt routed yet this session). */
export const DEFAULT_CONSOLE_PLACEHOLDER = "Delegate a task to the ship's crew…";
