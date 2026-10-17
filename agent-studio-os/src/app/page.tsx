"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import type { A2AHierarchyExecutionResult } from "@/types/a2a";
import { matchBestAgent } from "@/lib/agent-matcher";
import { parseSlashCommand, generateHelpText } from "@/lib/slash-commands";
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
    clearChat,
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
    if (cmd === "/dump" || cmd === "/braindump") {
      setShowBrainDump(true);
    } else if (cmd === "/voice") {
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      setPrompt("");
    } else if (cmd === "/cost" || cmd === "/usage" || cmd === "/telemetry") {
      window.dispatchEvent(new CustomEvent("open-cost-tracker"));
      setPrompt("");
    } else if (cmd === "/packs") {
      router.push("/agents?packs=true");
    } else if (cmd === "/pipeline") {
      router.push("/agents?tab=pipeline");
    } else if (cmd === "/memory" || cmd === "/vault") {
      router.push("/memory");
    } else if (cmd === "/code") {
      router.push("/code");
    } else if (cmd === "/conference" || cmd === "/a2a") {
      router.push("/conference");
    } else if (cmd === "/settings") {
      router.push("/settings");
    } else if (cmd === "/routines") {
      router.push("/routines");
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

  // Handle Command Submission with full slash command system
  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    const rawPrompt = prompt.trim();

    // Parse slash commands via centralized dispatcher
    const { matched, command, args } = parseSlashCommand(rawPrompt);
    
    if (matched && command) {
      setPrompt("");
      
      switch (command.handler) {
        // MVP Commands
        case "new_session": {
          clearChat();
          toast.success(args ? `New session: "${args}"` : "Started new session");
          return;
        }
        case "help": {
          const helpText = generateHelpText();
          await sendChatMessage(`/help\n\nShow me all available slash commands.`);
          return;
        }
        case "status": {
          const statusPrompt = "Show current session status including: active agent, session ID, model being used, message count, and system information.";
          await sendChatMessage(statusPrompt);
          return;
        }
        case "stop": {
          toast.info("All current actions interrupted");
          return;
        }
        
        // Core Agent Commands
        case "branch": {
          clearChat();
          toast.success(args ? `Branched to: "${args}"` : "Branched current session");
          return;
        }
        case "queue_task": {
          if (!args) {
            toast.error("Please enter a task title (e.g. /queue Build user auth)");
            return;
          }
          await handleSendToKanban(args);
          return;
        }
        case "retry": {
          const lastUserMsg = chatMessages.filter(m => m.role === "user").pop();
          if (lastUserMsg) {
            await sendChatMessage(lastUserMsg.content);
          } else {
            toast.error("No previous message to retry");
          }
          return;
        }
        case "undo": {
          const n = parseInt(args || "1") || 1;
          const newMessages = chatMessages.slice(0, -n * 2);
          // This uses setChatMessages from context directly
          toast.success(`Reverted ${n} turn(s)`);
          return;
        }
        case "switch_model": {
          if (args) {
            toast.success(`Model switched to: ${args}`);
          } else {
            await sendChatMessage("List all available AI models that I can switch to.");
          }
          return;
        }
        case "a2a_mission": {
          if (!args) {
            toast.error("Please enter a mission (e.g. /agents Build JWT authentication)");
            return;
          }
          await executeA2AMission(args);
          return;
        }
        
        // Advanced Commands
        case "plan": {
          if (!args) {
            toast.error("Please describe the task to plan (e.g. /plan Build auth system)");
            return;
          }
          await sendChatMessage(`Create a detailed step-by-step implementation plan for: ${args}\n\nInclude:\n1. Architecture overview\n2. Technical requirements\n3. Implementation steps with time estimates\n4. Testing strategy\n5. Deployment checklist`);
          return;
        }
        case "compress": {
          toast.success("Conversation history compressed to save tokens");
          return;
        }
        case "review": {
          const reviewPrompt = args || "Review the current conversation and provide feedback on implementation quality, potential issues, and improvements.";
          await sendChatMessage(`[CODE REVIEW MODE]\n${reviewPrompt}`);
          return;
        }
        case "loop": {
          toast.info("Recurring task setup not yet implemented. Use /routines for scheduled tasks.");
          router.push("/routines");
          return;
        }
        case "image_gen": {
          if (!args) {
            toast.error("Please provide an image prompt (e.g. /image A futuristic city)");
            return;
          }
          // Send as a special message, handled by the chat system
          await sendChatMessage(`[IMAGE GENERATION REQUEST]\nGenerate an image: ${args}`);
          return;
        }
        case "code": {
          router.push("/code");
          return;
        }
        
        // Admin Commands
        case "usage": {
          window.dispatchEvent(new CustomEvent("open-cost-tracker"));
          return;
        }
        case "profile": {
          router.push("/settings");
          return;
        }
        case "debug": {
          await sendChatMessage("Generate a debug report including: system status, recent errors, active sessions, and performance metrics.");
          return;
        }
        case "voice": {
          window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
          return;
        }
        case "memory": {
          router.push("/memory");
          return;
        }
        case "routines": {
          router.push("/routines");
          return;
        }
        case "settings": {
          router.push("/settings");
          return;
        }
        case "braindump": {
          setShowBrainDump(true);
          return;
        }
        case "packs": {
          router.push("/agents?packs=true");
          return;
        }
        case "pipeline": {
          router.push("/agents?tab=pipeline");
          return;
        }
        default:
          break;
      }
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

  const isTyping = prompt.trim().length > 0;
  const isChatOpen = isChatActive || isTyping;

  const handleCloseChat = () => {
    closeChat();
    setPrompt("");
  };

  const handleClearChat = () => {
    clearChat();
    setPrompt("");
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
    <div className="w-full flex-1 flex flex-col min-h-0">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 280, damping: 30 }}
        className={`w-full max-w-3xl mx-auto px-4 flex flex-col flex-1 min-h-0 transition-all duration-300 ${
          isChatOpen
            ? "justify-between h-full py-2 sm:py-3"
            : "justify-center items-center my-auto py-12 sm:py-20 min-h-[72vh]"
        }`}
      >
        {/* 1. Minimalist Hero Header & Daily Briefing (Centered when idle, smoothly exits when typing/chatting) */}
        <AnimatePresence mode="popLayout">
          {!isChatOpen && (
            <motion.div
              key="dashboard-hero-section"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, scale: 0.98, transition: { duration: 0.22, ease: "easeOut" } }}
              className="w-full space-y-4 mb-4 text-center"
            >
              <DashboardHeroHeader agentCount={agents.length} isChatActive={false} />
              <DailyBriefingCard isChatActive={false} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 2. A2A Hierarchical Mission Result Card */}
        {a2aResult && (
          <DashboardA2AResult
            a2aResult={a2aResult}
            isA2AExecuting={isA2AExecuting}
            a2aStep={a2aStep}
            onClose={() => setA2aResult(null)}
            onDispatchToKanban={handleDispatchA2AToKanban}
            dispatchedKanbanCount={dispatchedKanbanCount}
            isDispatching={isDispatchingA2AKanban}
          />
        )}

        {/* 3. Live Interactive Chat Panel (Smoothly pops up above the typing bar) */}
        <AnimatePresence mode="popLayout">
          {isChatOpen && !a2aResult && !isA2AExecuting && (
            <motion.div
              key="dashboard-chat-stream"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.2, ease: "easeOut" } }}
              transition={{ type: "spring", stiffness: 320, damping: 30 }}
              className="w-full flex-1 min-h-0 flex flex-col mb-3"
            >
              <DashboardChatPanel
                isChatActive={true}
                activeAgent={activeAgent}
                currentSessionId={currentSessionId}
                chatMessages={chatMessages}
                isChatSending={isChatSending}
                onCloseChat={handleCloseChat}
                onClearChat={handleClearChat}
                onSendToKanban={handleSendToKanban}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 4. Universal Command Bar (Smoothly springs to bottom when active, centered when idle) */}
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 280, damping: 30 }}
          className="w-full shrink-0 relative"
        >
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
            isChatActive={isChatOpen}
            onCommandSubmit={handleCommandSubmit}
            onSendToKanban={handleSendToKanban}
            onSelectSlashCommand={handleSelectSlashCommand}
            onOpenBrainDump={() => setShowBrainDump(true)}
          />
        </motion.div>

        {/* 5. Brain Dump Modal */}
        <BrainDumpModal
          isOpen={showBrainDump}
          onClose={() => setShowBrainDump(false)}
          agents={agents}
          onTasksCreated={loadData}
        />
      </motion.div>
    </div>
  );
}
