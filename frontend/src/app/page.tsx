"use client";

import { useCallback, useEffect, useRef } from "react";
import { EventLogStrip } from "@/components/layout/EventLogStrip";
import { GraphCanvas } from "@/components/layout/GraphCanvas";
import { Header } from "@/components/layout/Header";
import { SidePanel } from "@/components/layout/SidePanel";
import { routePrompt } from "@/lib/simulation/router";
import { startRun, type RunHandle } from "@/lib/simulation/engine";
import { useRunStore } from "@/lib/store/runStore";

export default function Home() {
  const runStatus = useRunStore((state) => state.runStatus);
  const applyEvent = useRunStore((state) => state.applyEvent);
  const resetRun = useRunStore((state) => state.resetRun);
  const selectNode = useRunStore((state) => state.selectNode);
  const setScenario = useRunStore((state) => state.setScenario);

  const handleRef = useRef<RunHandle | null>(null);

  const isRunning = runStatus !== "idle" && runStatus !== "completed" && runStatus !== "failed";

  const handleSubmitPrompt = useCallback(
    (prompt: string) => {
      const routedScenario = routePrompt(prompt);
      handleRef.current?.cancel();
      resetRun();
      selectNode(null);
      setScenario(routedScenario === "irrelevant" ? null : routedScenario);
      handleRef.current = startRun(routedScenario, prompt, applyEvent);
    },
    [applyEvent, resetRun, selectNode, setScenario],
  );

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

  return (
    <div className="flex h-screen flex-col">
      <Header
        isRunning={isRunning}
        onSubmitPrompt={handleSubmitPrompt}
        onAbort={handleAbort}
      />
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <GraphCanvas onApprove={handleApprove} onReject={handleReject} />
        <SidePanel onApprove={handleApprove} onReject={handleReject} />
      </div>
      <EventLogStrip />
    </div>
  );
}
