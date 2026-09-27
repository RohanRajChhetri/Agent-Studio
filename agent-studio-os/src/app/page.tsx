"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import type { A2AHierarchyExecutionResult } from "@/types/a2a";
import { matchBestAgent } from "@/lib/agent-matcher";
import { DailyBriefingCard } from "@/components/dashboard/daily-briefing-card";
import { BrainDumpModal } from "@/components/dashboard/brain-dump-modal";
import { DashboardHeroHeader } from "@/components/dashboard/dashboard-hero-header";
import { DashboardCommandBar } from "@/components/dashboard/dashboard-command-bar";
import { DashboardA2AResult } from "@/components/dashboard/dashboard-a2a-result";
import {
  DashboardChatPanel,
  type DashboardChatMessage,
} from "@/components/dashboard/dashboard-chat-panel";
import { useDashboardChat } from "@/context/dashboard-chat-context";

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [_loading, setLoading] = useState(true);

  // Command input state
  const [prompt, setPrompt] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);

  // Global Persistent Chat State from Context (persists across page changes)
  const {
    isChatActive,
    chatMessages,
    isChatSending,
    followUpInput,
    setFollowUpInput,
    currentSessionId,
    sendChatMessage,
    closeChat,
    sendToKanban: contextSendToKanban,
    setActiveAgent: setContextActiveAgent,
    setAgents: setContextAgents,
  } = useDashboardChat();

  // A2A Hierarchical Chain-of-Command State
  const [a2aResult, setA2aResult] = useState<A2AHierarchyExecutionResult | null>(null);
  const [isA2AExecuting, setIsA2AExecuting] = useState(false);
  const [a2aStep, setA2aStep] = useState<string>("");
  const [dispatchedKanbanCount, setDispatchedKanbanCount] = useState<number | null>(null);
  const [isDispatchingA2AKanban, setIsDispatchingA2AKanban] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : data.agents || []);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    loadData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("dump") === "true") {
        setShowBrainDump(true);
      }

      const handleDataUpdate = () => {
        loadData();
      };
      window.addEventListener("agent-data-updated", handleDataUpdate);
      return () => window.removeEventListener("agent-data-updated", handleDataUpdate);
    }
  }, [loadData]);

  // Resolve currently targeted agent with smart domain-aware auto-assignment
  const activeAgent = useMemo(() => {
    if (selectedAgentId !== "auto") {
      return agents.find((a) => a.id === selectedAgentId) || agents[0];
    }
    return (
      matchBestAgent(prompt, agents) ||
      agents.find((a) => a.role === "orchestrator") ||
      agents[0] ||
      undefined
    );
  }, [agents, selectedAgentId, prompt]);

  // Sync activeAgent and agents with global context
  useEffect(() => {
    if (activeAgent) {
      setContextActiveAgent(activeAgent);
    }
    if (agents.length > 0) {
      setContextAgents(agents);
    }
  }, [activeAgent, agents, setContextActiveAgent, setContextAgents]);

  const handleSelectSlashCommand = (cmd: string) => {
    if (cmd === "/agents") {
      setPrompt("/agents ");
    } else if (cmd === "/kanban") {
      setPrompt("/kanban ");
    } else if (cmd === "/dump" || cmd === "/braindump") {
      setShowBrainDump(true);
    } else if (cmd === "/packs") {
      router.push("/agents?packs=true");
    } else if (cmd === "/pipeline") {
      router.push("/agents?tab=pipeline");
    } else if (cmd === "/voice") {
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      setPrompt("");
    } else if (cmd === "/cost") {
      window.dispatchEvent(new CustomEvent("open-cost-tracker"));
      setPrompt("");
    } else if (cmd === "/memory") {
      router.push("/memory");
    } else {
      setPrompt(cmd + " ");
    }
  };

  // Dispatch / Queue Task directly to Kanban board
  const handleSendToKanban = async (taskTitle?: string, taskDescription?: string) => {
    const rawTitle = (taskTitle || prompt).trim();
    if (!rawTitle) {
      toast.error("Please enter a task title or objective to queue to Kanban");
      return;
    }

    const targetAgent =
      selectedAgentId !== "auto"
        ? agents.find((a) => a.id === selectedAgentId) || activeAgent
        : matchBestAgent(rawTitle + " " + (taskDescription || ""), agents) || activeAgent;

    setIsSubmitting(true);
    try {
      await contextSendToKanban(rawTitle, taskDescription);
      await loadData();
      if (!taskTitle) {
        setPrompt("");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute A2A Hierarchical Chain of Command
  const executeA2AMission = async (missionText: string) => {
    if (!missionText.trim()) {
      toast.error("Please provide a mission topic for the agent hierarchy");
      return;
    }

    setIsA2AExecuting(true);
    setA2aResult(null);
    setDispatchedKanbanCount(null);
    setA2aStep("1/4: Orchestrator analyzing & decomposing mission...");

    const step1 = setTimeout(() => {
      setA2aStep("2/4: Issuing A2A contracts & delegating down hierarchy...");
    }, 3500);
    const step2 = setTimeout(() => {
      setA2aStep("3/4: Specialists executing tactical deliverables...");
    }, 7500);
    const step3 = setTimeout(() => {
      setA2aStep("4/4: Synthesizing Master Executive Deliverable...");
    }, 12000);

    try {
      const res = await fetch("/api/a2a/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionTopic: missionText.trim(),
          orchestratorId: selectedAgentId !== "auto" ? selectedAgentId : undefined,
        }),
      });

      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);

      const data = await res.json();
      if (res.ok && data.success) {
        setA2aResult(data);
        toast.success(
          `A2A Chain of Command fulfilled! ${data.totalSubtasks} subtasks executed across hierarchy.`
        );
      } else {
        toast.error(data.error || "A2A Hierarchical execution failed");
      }
    } catch {
      toast.error("Network error executing hierarchical mission");
    } finally {
      setIsA2AExecuting(false);
      setA2aStep("");
    }
  };

  // Dispatch A2A Deliverable to Kanban Board
  const handleDispatchA2AToKanban = async () => {
    if (!a2aResult) return;
    setIsDispatchingA2AKanban(true);
    try {
      const res = await fetch("/api/a2a/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: a2aResult.missionTopic,
          verdict: {
            summary: a2aResult.rootSummary,
            consensusPoints: [
              `Hierarchical command executed across ${a2aResult.totalSubtasks} subtasks.`,
              `Master synthesized by ${a2aResult.orchestratorName}.`,
            ],
            recommendedAction: "Execute concrete implementation tickets via Kanban board.",
          },
          targetStatus: "todo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchedKanbanCount(data.createdTasks?.length || 3);
        toast.success(`Dispatched ${data.createdTasks?.length || 3} tasks directly to Kanban!`);
      } else {
        toast.error(data.error || "Failed to dispatch tasks");
      }
    } catch {
      toast.error("Network error dispatching tasks");
    } finally {
      setIsDispatchingA2AKanban(false);
    }
  };

  // Handle Command Submission
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const rawPrompt = prompt.trim();

    // 0. BRAIN DUMP SHORTCUT
    if (rawPrompt.toLowerCase() === "/dump" || rawPrompt.toLowerCase() === "/braindump") {
      setPrompt("");
      setShowBrainDump(true);
      return;
    }

    // 0.1 PACKS SHORTCUT
    if (rawPrompt.toLowerCase() === "/packs") {
      setPrompt("");
      router.push("/agents?packs=true");
      return;
    }

    // 1. A2A HIERARCHICAL CHAIN OF COMMAND
    if (rawPrompt.toLowerCase().startsWith("/agents")) {
      const missionTopic = rawPrompt.replace(/^\/agents\s*/i, "").trim();
      if (!missionTopic) {
        toast.error(
          "Please enter a mission description after /agents (e.g. /agents Build JWT authentication)"
        );
        return;
      }
      setPrompt("");
      await executeA2AMission(missionTopic);
      return;
    }

    // 2. KANBAN TASK SHORTCUT
    if (rawPrompt.toLowerCase().startsWith("/task") || rawPrompt.toLowerCase().startsWith("/kanban")) {
      const taskTitle = rawPrompt.replace(/^\/(task|kanban)\s*/i, "").trim();
      if (!taskTitle) {
        toast.error("Please enter a task title (e.g. /kanban Build user auth microservice)");
        return;
      }
      setPrompt("");
      await handleSendToKanban(taskTitle);
      return;
    }

    // 3. VOICE ORB SHORTCUT
    if (rawPrompt.toLowerCase() === "/voice") {
      setPrompt("");
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      return;
    }

    // 4. COST TRACKER SHORTCUT
    if (rawPrompt.toLowerCase() === "/cost" || rawPrompt.toLowerCase() === "/telemetry") {
      setPrompt("");
      window.dispatchEvent(new CustomEvent("open-cost-tracker"));
      return;
    }

    // 5. ROUTINES / OTHER SHORTCUTS
    if (rawPrompt.toLowerCase() === "/pipeline") {
      setPrompt("");
      router.push("/agents?tab=pipeline");
      return;
    }
    if (rawPrompt.toLowerCase() === "/memory" || rawPrompt.toLowerCase() === "/vault") {
      setPrompt("");
      router.push("/memory");
      return;
    }
    if (rawPrompt.toLowerCase() === "/routines") {
      setPrompt("");
      router.push("/routines");
      return;
    }
    if (rawPrompt.toLowerCase() === "/settings") {
      setPrompt("");
      router.push("/settings");
      return;
    }

    // Standard Chat with agent right on dashboard
    setPrompt("");
    await sendChatMessage(rawPrompt);
  };

  const handleFollowUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpInput.trim() || isChatSending) return;
    const text = followUpInput.trim();
    setFollowUpInput("");
    await sendChatMessage(text);
  };

  if (!mounted) {
    return (
      <div className="max-w-3xl mx-auto py-12 sm:py-20 px-4 space-y-8 animate-pulse">
        <div className="space-y-3 text-center flex flex-col items-center">
          <div className="h-4 w-32 bg-secondary/80 rounded-full" />
          <div className="h-10 w-72 bg-secondary/70 rounded-2xl" />
          <div className="h-4 w-96 bg-secondary/40 rounded-lg" />
        </div>
        <div className="h-24 w-full bg-secondary/50 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 sm:py-20 px-4 space-y-8">
      {/* 1. Minimalist Hero Header */}
      <DashboardHeroHeader agentCount={agents.length} />

      {/* 2. Daily Executive Morning Briefing */}
      <DailyBriefingCard />

      {/* 3. Universal Command Bar */}
      <div className="relative">
        <DashboardCommandBar
          prompt={prompt}
          setPrompt={setPrompt}
          selectedAgentId={selectedAgentId}
          setSelectedAgentId={setSelectedAgentId}
          agents={agents}
          activeAgent={activeAgent}
          isSubmitting={isSubmitting}
          isChatSending={isChatSending}
          isA2AExecuting={isA2AExecuting}
          onCommandSubmit={handleCommandSubmit}
          onSendToKanban={handleSendToKanban}
          onSelectSlashCommand={handleSelectSlashCommand}
          onOpenBrainDump={() => setShowBrainDump(true)}
        />

        {/* 4. A2A Hierarchical Mission Result Card */}
        <DashboardA2AResult
          a2aResult={a2aResult}
          isA2AExecuting={isA2AExecuting}
          a2aStep={a2aStep}
          onClose={() => setA2aResult(null)}
          onDispatchToKanban={handleDispatchA2AToKanban}
          dispatchedKanbanCount={dispatchedKanbanCount}
          isDispatching={isDispatchingA2AKanban}
        />

        {/* 5. Live Interactive Chat Panel */}
        <DashboardChatPanel
          isChatActive={isChatActive && !a2aResult && !isA2AExecuting}
          activeAgent={activeAgent}
          currentSessionId={currentSessionId}
          chatMessages={chatMessages}
          isChatSending={isChatSending}
          followUpInput={followUpInput}
          setFollowUpInput={setFollowUpInput}
          onFollowUpSubmit={handleFollowUpSubmit}
          onCloseChat={closeChat}
          onSendToKanban={handleSendToKanban}
        />
      </div>

      {/* 6. Brain Dump Modal */}
      <BrainDumpModal
        isOpen={showBrainDump}
        onClose={() => setShowBrainDump(false)}
        agents={agents}
        onTasksCreated={loadData}
      />
    </div>
  );
}
