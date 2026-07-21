"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { DebugPanel } from "@/components/debug/DebugPanel";
import { DamageCauseToast } from "@/components/hud/DamageCauseToast";
import { GameOverOverlay } from "@/components/hud/GameOverOverlay";
import { ShipHud } from "@/components/hud/ShipHud";
import { EventLogStrip } from "@/components/layout/EventLogStrip";
import { GraphCanvas } from "@/components/layout/GraphCanvas";
import { Header } from "@/components/layout/Header";
import { SidePanel } from "@/components/layout/SidePanel";
import { VegaWidget } from "@/components/vega/VegaWidget";
import { createEconomyBridge } from "@/lib/game/economy";
import { resetIncidents } from "@/lib/game/incidents";
import { useResourceSounds } from "@/lib/hooks/useResourceSounds";
import { useShipTick } from "@/lib/hooks/useShipTick";
import { routePrompt } from "@/lib/simulation/router";
import { startRun, type RunHandle } from "@/lib/simulation/engine";
import { useInboxStore } from "@/lib/store/inboxStore";
import { useMissionStore } from "@/lib/store/missionStore";
import { useRunStore } from "@/lib/store/runStore";
import { useShipStore } from "@/lib/store/shipStore";

export default function Home() {
  const runStatus = useRunStore((state) => state.runStatus);
  const applyEvent = useRunStore((state) => state.applyEvent);
  const resetRun = useRunStore((state) => state.resetRun);
  const selectNode = useRunStore((state) => state.selectNode);
  const setScenario = useRunStore((state) => state.setScenario);

  const tokens = useShipStore((state) => state.tokens);
  const isGameOver = useShipStore((state) => state.isGameOver);
  const resetShip = useShipStore((state) => state.reset);
  const resetInbox = useInboxStore((state) => state.reset);
  const deliverWelcome = useInboxStore((state) => state.deliverWelcome);
  const resetMissions = useMissionStore((state) => state.reset);

  useShipTick();
  useResourceSounds();

  const handleRef = useRef<RunHandle | null>(null);

  const isRunning = runStatus !== "idle" && runStatus !== "completed" && runStatus !== "failed";
  const hasInsufficientCompute = tokens <= 0;

  const handleSubmitPrompt = useCallback(
    (prompt: string) => {
      if (tokens <= 0 || isGameOver) return;
      const routedScenario = routePrompt(prompt);
      const missionScenario = routedScenario === "irrelevant" ? null : routedScenario;
      // The currently active mission's domain — used to tailor VEGA's decline
      // copy (ACU-61) when this prompt turns out to be "irrelevant". A
      // mission's scenarioId is never "irrelevant" by construction (see
      // MISSION_DEFINITIONS in missionStore.ts).
      const activeMissionScenarioId = useMissionStore.getState().getActiveMission()?.scenarioId ?? null;
      const activeDomain =
        activeMissionScenarioId === "irrelevant" ? null : activeMissionScenarioId;
      handleRef.current?.cancel();
      resetRun();
      selectNode(null);
      setScenario(missionScenario);
      // Economy bridge (T17/D17/D18): sits in front of the pure runStore
      // reducer, billing per-node token costs and granting mission rewards
      // without runStore itself knowing about tokens/resources.
      const economyApplyEvent = createEconomyBridge(missionScenario, applyEvent);
      handleRef.current = startRun(routedScenario, prompt, economyApplyEvent, activeDomain);
    },
    [applyEvent, resetRun, selectNode, setScenario, tokens, isGameOver],
  );

  const handleRestartCampaign = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    resetShip();
    resetRun();
    resetInbox();
    resetMissions();
    resetIncidents();
    // Header's own mount effect only fires once, so after a restart (no
    // remount) we re-trigger the welcome email delivery here to restart the
    // narrative sequence (D11/D15 restart requirement).
    setTimeout(deliverWelcome, 2000);
  }, [resetShip, resetRun, resetInbox, resetMissions, deliverWelcome]);

  const handleAbort = useCallback(() => {
    handleRef.current?.cancel();
    handleRef.current = null;
    resetRun();
  }, [resetRun]);

  const handleApprove = useCallback(() => {
    handleRef.current?.approve();
  }, []);

  const handleReject = useCallback(() => {
    handleRef.current?.reject();
  }, []);

  // Auto-select the safety-reviewer node when a run pauses for approval, so
  // the side panel's Approve/Reject controls are immediately visible.
  useEffect(() => {
    if (runStatus === "awaiting_approval") {
      selectNode("safety-reviewer");
    }
  }, [runStatus, selectNode]);

  // Game over must stop the world, not just block new input: cancel the
  // active run's timer chain (its setTimeout chain would otherwise keep
  // emitting events behind the overlay) and stop the fuel-drain interval.
  // The overlay is the only way out (Restart), which already resets both.
  useEffect(() => {
    if (isGameOver) {
      handleRef.current?.cancel();
      handleRef.current = null;
      resetIncidents();
    }
  }, [isGameOver]);

  // Debug panel gate (D16): only when the URL has ?debug=1. window.location
  // is external, client-only state, so useSyncExternalStore is the correct
  // primitive: it returns the server snapshot (false) during SSR/hydration
  // — avoiding the mismatch a lazy useState initializer would cause by
  // reading window.location during the pre-hydration render — then the
  // real client snapshot right after mount, with no manual effect/setState
  // cascade. No useSearchParams Suspense boundary needed for this dev-only
  // affordance.
  const isDebugMode = useSyncExternalStore(
    subscribeNever,
    () => new URLSearchParams(window.location.search).get("debug") === "1",
    () => false,
  );

  return (
    <div className="flex h-screen flex-col">
      {/* inert while game over (fix for billed-behind-overlay bug): makes the
          whole app non-focusable/non-interactive without a manual focus trap. */}
      <div className="flex h-full flex-col" inert={isGameOver}>
        <Header isRunning={isRunning} onAbort={handleAbort} />
        <ShipHud />
        <DamageCauseToast />
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          <GraphCanvas onApprove={handleApprove} onReject={handleReject} />
          <SidePanel onApprove={handleApprove} onReject={handleReject} />
        </div>
        <EventLogStrip />
        <VegaWidget
          isRunning={isRunning}
          onSubmitPrompt={handleSubmitPrompt}
          onAbort={handleAbort}
          onApprove={handleApprove}
          onReject={handleReject}
          canSubmit={!hasInsufficientCompute}
        />
      </div>
      <GameOverOverlay onRestart={handleRestartCampaign} />
      {isDebugMode && <DebugPanel />}
    </div>
  );
}

/** The ?debug=1 flag is fixed for the lifetime of the page (no client-side
 * navigation changes it), so useSyncExternalStore never needs to notify —
 * subscribe is a permanent no-op. */
function subscribeNever(): () => void {
  return () => {};
}
