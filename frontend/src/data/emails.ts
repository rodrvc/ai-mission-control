// Narrative onboarding emails (D11, D14). E0 arrives on load; E1-E3 arrive
// together once E0's modal is closed. Body copy uses paragraphs joined by
// blank lines (markdown-lite) — the reading pane splits on "\n\n". Each
// mission email's closing hint line nudges the captain toward the command
// console and, implicitly, toward keywords the intent router
// (lib/simulation/router.ts) will recognize.

export interface Email {
  id: string;
  from: string;
  subject: string;
  /** Paragraphs separated by a blank line; last paragraph is the signature. */
  body: string;
  /** Milliseconds after the previous batch is dismissed before this arrives. */
  arrivesAfter: number;
}

export const EMAILS: Email[] = [
  {
    id: "E0",
    from: "Mission Command · Sol Relay",
    subject: "Welcome aboard, Captain",
    body: [
      "Captain,",
      "Welcome aboard the ISV Meridian. You now hold the conn for the remainder of our transit to XJS-7 — a designated survey world at the edge of charted space, and the reason this ship exists.",
      "You will not be standing watch alone. VEGA, the Meridian's onboard intelligence, is online across every deck and will assist with anything you require. Behind VEGA stands a full complement of specialist crews — life support, navigation, mission intelligence, repair, and safety review — ready to act the moment you give the word.",
      "Mission Command will route directives to you as they arrive. Keep an eye on incoming mail: it will carry the tasking this ship needs from its captain.",
      "Godspeed, Captain. The Meridian is yours.",
      "— Mission Command, Sol Relay",
    ].join("\n\n"),
    arrivesAfter: 0,
  },
  {
    id: "E1",
    from: "Mission Intelligence · Sol Relay",
    subject: "Mission: Long-range intel on the XJS-7 approach",
    body: [
      "Captain,",
      "Sol Relay has not had a fresh look at the XJS-7 corridor since the Meridian passed the last comms buoy. Command wants a current picture before we commit further burn budget to the approach.",
      "Request a long-range survey scan of the corridor and a status report from VEGA — transit status, distance remaining, and current ETA to XJS-7 orbit. Mission intelligence will compile the telemetry summary the moment you ask.",
      "This is a standing information request, not an emergency — but Command wants it on record before the next course review.",
      "Transmit your directive to VEGA via the ship console.",
      "— Mission Intelligence, Sol Relay",
    ].join("\n\n"),
    arrivesAfter: 4000,
  },
  {
    id: "E2",
    from: "Flight Surgeon · Dr. Osei",
    subject: "Mission: Life support anomaly, aft module",
    body: [
      "Captain,",
      "Engineering flagged a slow but steady drop in oxygen pressure readings in the aft life support module over the last two watch cycles. A hull breach in the aft section is bleeding pressure — cabin O2 is now dropping, and the trend will not self-correct on its own.",
      "Please task the crew with investigating the pressure drop — I want to know whether we are looking at a sensor fault, a seal leak, or a scrubber problem before it becomes a breach.",
      "Route it through VEGA so repair and safety review are looped in from the start.",
      "Transmit your directive to VEGA via the ship console.",
      "— Dr. Osei, Flight Surgeon",
    ].join("\n\n"),
    arrivesAfter: 4000,
  },
  {
    id: "E3",
    from: "Navigation Control",
    subject: "Mission: Approach correction required",
    body: [
      "Captain,",
      "Nav control is reading a trajectory deviation on our XJS-7 approach corridor: the deviation is costing propellant every second we stay off-course, and it compounds the longer we hold the current heading. We need a course correction plotted before it grows into a costlier burn later.",
      "Order the crew to work the correction with VEGA. Be advised: any correction burn on final approach requires your direct authorization before ignition — VEGA will hold at that gate until you confirm.",
      "Transmit your directive to VEGA via the ship console.",
      "— Navigation Control",
    ].join("\n\n"),
    arrivesAfter: 4000,
  },
];
