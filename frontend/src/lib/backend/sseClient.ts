// Real-backend run client (ACU-68 Phase 2): mirrors the scripted engine's
// `startRun` interface exactly (see lib/simulation/engine.ts) but drives the
// run from the FastAPI + LangGraph backend over HTTP + SSE instead of a
// local setTimeout chain. Scenario scripts and the economy bridge stay
// untouched — this module only produces a `RunHandle` that emits real
// `RunEvent`s into `applyEvent`.

import type { RunHandle } from "@/lib/simulation/engine";
import type { RunEvent, ScenarioId } from "@/lib/types/events";

const BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

interface RunCreatedResponse {
  runId?: string;
  scenario?: "life-support" | "unsupported";
}

/**
 * Start a run against the real backend. `startRun` (the scripted engine) is
 * synchronous and returns a `RunHandle` immediately; to keep the same call
 * shape at the page.tsx call site, this function is also synchronous — the
 * POST /runs request happens in the background, and the handle's internal
 * state (runId, EventSource) is populated once it resolves.
 *
 * Because `cancel`/`approve`/`reject` can be called before the POST
 * resolves (e.g. the operator aborts immediately after submitting), each
 * one guards on a `closed` flag and, when the runId hasn't arrived yet,
 * defers the action via `pendingAction` to be replayed as soon as it does.
 */
export function startBackendRun(
  scenarioId: ScenarioId,
  promptText: string,
  applyEvent: (event: RunEvent) => void,
  // activeDomain intentionally unused: that copy-tailoring (ACU-61) only
  // applies to the scripted "irrelevant" path, which never reaches the real
  // backend (the page.tsx dispatcher only routes life-support here). Kept
  // as a parameter to match `startRun`'s signature exactly (RunHandle
  // factories are interchangeable at the page.tsx call site).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _activeDomain: Exclude<ScenarioId, "irrelevant"> | null,
): RunHandle {
  let closed = false;
  let runId: string | null = null;
  let eventSource: EventSource | null = null;
  let pendingAction: "cancel" | "approve" | "reject" | null = null;

  function postApproval(approved: boolean) {
    if (!runId || !BASE) return;
    fetch(`${BASE}/runs/${runId}/approval`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    }).catch((error) => {
      console.error("[sseClient] POST /runs/:id/approval failed", error);
    });
  }

  function applyPendingAction() {
    if (!pendingAction) return;
    const action = pendingAction;
    pendingAction = null;
    if (action === "cancel") {
      eventSource?.close();
      closed = true;
    } else if (action === "approve") {
      postApproval(true);
    } else if (action === "reject") {
      postApproval(false);
    }
  }

  async function run() {
    if (!BASE) {
      console.error("[sseClient] NEXT_PUBLIC_BACKEND_URL is not set; cannot start backend run.");
      return;
    }
    try {
      const response = await fetch(`${BASE}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, scenarioId }),
      });
      if (!response.ok) {
        console.error(`[sseClient] POST /runs failed with status ${response.status}`);
        return;
      }
      const data = (await response.json()) as RunCreatedResponse;
      if (!data.runId || data.scenario === "unsupported") {
        console.error("[sseClient] POST /runs returned no runId (unsupported scenario?)", data);
        return;
      }
      if (closed) {
        // cancel() already ran before the POST resolved — don't open a
        // stream for a run nobody wants anymore.
        return;
      }
      runId = data.runId;

      const source = new EventSource(`${BASE}/runs/${runId}/events`);
      eventSource = source;
      source.onmessage = (message: MessageEvent<string>) => {
        try {
          const event = JSON.parse(message.data) as RunEvent;
          applyEvent(event);
        } catch (error) {
          console.error("[sseClient] failed to parse SSE event", error, message.data);
        }
      };
      source.onerror = (error) => {
        console.error("[sseClient] EventSource error", error);
      };

      applyPendingAction();
    } catch (error) {
      console.error("[sseClient] failed to start backend run", error);
    }
  }

  void run();

  return {
    cancel: () => {
      if (closed) return;
      if (!runId) {
        pendingAction = "cancel";
        closed = true; // prevents opening a stream once the POST resolves
        return;
      }
      closed = true;
      eventSource?.close();
    },
    approve: () => {
      if (closed) return;
      if (!runId) {
        pendingAction = "approve";
        return;
      }
      postApproval(true);
    },
    reject: () => {
      if (closed) return;
      if (!runId) {
        pendingAction = "reject";
        return;
      }
      postApproval(false);
    },
  };
}
