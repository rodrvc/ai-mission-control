// Intent router (D12, Phase 1): case-insensitive, word-based keyword scoring.
// Pure function — no side effects, easy to unit test. Phase 2 swaps this for
// a real LLM router behind the same signature.

import type { ScenarioId } from "@/lib/types/events";

/** Scenario domains the router can match a prompt to (excludes "irrelevant"). */
type RoutableScenarioId = Exclude<ScenarioId, "irrelevant">;

/** Keyword table driving the score. Exported for tests/docs. */
export const ROUTING_KEYWORDS: Record<RoutableScenarioId, string[]> = {
  "life-support": [
    "oxygen",
    "o2",
    "pressure",
    "air",
    "life support",
    "leak",
    "valve",
    "breach",
    "co2",
    "scrubber",
  ],
  navigation: [
    "course",
    "trajectory",
    "navigation",
    "heading",
    "orbit",
    "burn",
    "approach",
    "vector",
    "correction",
    "thruster",
  ],
  knowledge: [
    "scan",
    "survey",
    "status",
    "eta",
    "how long",
    "distance",
    "mission",
    "xjs",
    "report",
    "telemetry summary",
  ],
};

/**
 * Priority order used to break ties on tied nonzero scores — safety first:
 * life-support > navigation > knowledge.
 */
const PRIORITY_ORDER: RoutableScenarioId[] = ["life-support", "navigation", "knowledge"];

/** Escape a keyword for safe embedding in a RegExp. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build a word-boundary matcher for `keyword`. Multi-word keywords (e.g.
 * "life support") keep phrase matching — `\b` around the whole phrase — so
 * "reportedly" won't match the single-word keyword "report" but a phrase
 * like "life support" still matches within "the life support system".
 */
function keywordMatches(normalized: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(keyword)}\\b`);
  return pattern.test(normalized);
}

/**
 * Score `prompt` against each scenario's keyword list and return the best
 * match. Zero score → "irrelevant" (no crew or ship system claims the
 * request). Ties on a tied nonzero score resolve by priority — safety first:
 * life-support > navigation > knowledge.
 */
export function routePrompt(prompt: string): RoutableScenarioId | "irrelevant" {
  const normalized = prompt.toLowerCase();

  const scores = (
    Object.entries(ROUTING_KEYWORDS) as [RoutableScenarioId, string[]][]
  ).map(([scenarioId, keywords]) => {
    const score = keywords.reduce(
      (count, keyword) => count + (keywordMatches(normalized, keyword) ? 1 : 0),
      0,
    );
    return { scenarioId, score };
  });

  const bestScore = Math.max(...scores.map((s) => s.score));
  if (bestScore === 0) {
    return "irrelevant";
  }

  const tiedForBest = scores.filter((s) => s.score === bestScore).map((s) => s.scenarioId);
  if (tiedForBest.length === 1) {
    return tiedForBest[0];
  }

  // Tie-break by priority: safety first.
  for (const scenarioId of PRIORITY_ORDER) {
    if (tiedForBest.includes(scenarioId)) {
      return scenarioId;
    }
  }
  return "irrelevant";
}
