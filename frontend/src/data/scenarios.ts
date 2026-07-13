// Scenario metadata for the ISV Meridian's three mission domains. Since D12,
// scenarios are reached via the command console + intent router
// (lib/simulation/router.ts), not a picker — this table now documents the
// canonical example request for each domain, matched against the scripted
// `user-request` events in lib/simulation/scenarios/*.ts and the paths
// defined in ARCHITECTURE.md.

import type { Scenario } from "@/lib/types/events";

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
