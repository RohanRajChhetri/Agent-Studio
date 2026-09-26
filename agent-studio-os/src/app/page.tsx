"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Send,
  Loader2,
  X,
  Copy,
  Check,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Crown,
  Sparkles,
  Layers,
  CheckCircle2,
  Columns3,
  Bot,
  Plus,
  Mic,
  Coins,
  Brain,
  CalendarClock,
  Settings,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import type { A2AHierarchyExecutionResult } from "@/types/a2a";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { matchBestAgent } from "@/lib/agent-matcher";
import { DailyBriefingCard } from "@/components/dashboard/daily-briefing-card";
import { BrainDumpModal } from "@/components/dashboard/brain-dump-modal";

interface DashboardChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentAvatar?: string;
  latency?: number;
  model?: string;
  createdAt: string;
}

const SLASH_COMMANDS = [
  {
    cmd: "/agents",
    label: "A2A Chain of Command",
    badge: "Pillar 1",
    desc: "Decompose & execute mission down the agent hierarchy (Orchestrator → Managers → Specialists)",
    icon: Crown,
    color: "text-[#0075de] bg-[#e6f3fe] dark:bg-primary/10 border-[#0075de]/30",
  },
  {
    cmd: "/kanban",
    label: "Dispatch to Kanban",
    badge: "Pillar 4",
    desc: "Queue an autonomous task directly to the Kanban board with auto-assigned specialist",
    icon: Columns3,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  {
    cmd: "/briefing",
    label: "Daily Morning Briefing",
    badge: "Daily Routine",
    desc: "Generate or read today's proactive executive morning briefing with voice narration",
    icon: Sun,
    color: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  },
  {
    cmd: "/dump",
    label: "Voice & Text Brain Dump",
    badge: "Quick Capture",
    desc: "Dictate raw thoughts & auto-decompose into specialist Kanban tickets",
    icon: Brain,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  {
    cmd: "/packs",
    label: "Agent Starter Packs",
    badge: "Marketplace",
    desc: "1-Click deploy specialized fleets (Solopreneurs, Researchers, Creators)",
    icon: Sparkles,
    color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/30",
  },
  {
    cmd: "/pipeline",
    label: "Feature Pipeline DAG",
    badge: "Workforce",
    desc: "Launch multi-stage autonomous pipeline builder to execute sequential specialist stages",
    icon: Layers,
    color: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  },
  {
    cmd: "/voice",
    label: "Gemini Live Voice",
    badge: "Cockpit",
    desc: "Open real-time bidirectional speech cockpit with animated orb (Alt+V)",
    icon: Mic,
    color: "text-rose-500 bg-rose-500/10 border-rose-500/30",
  },
  {
    cmd: "/cost",
    label: "Token & Cost Telemetry",
    badge: "Telemetry",
    desc: "Inspect token usage, model costs, local router savings, and provider latencies (Alt+C)",
    icon: Coins,
    color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    cmd: "/memory",
    label: "Obsidian Vault & Galaxy",
    badge: "Pillar 3",
    desc: "Explore 3D Knowledge Galaxy graph and sync bidirectional Obsidian markdown notes",
    icon: Brain,
    color: "text-sky-500 bg-sky-500/10 border-sky-500/30",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Command input state
  const [prompt, setPrompt] = useState("");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("auto");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);

  // Interactive In-Dashboard Live Chat State
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // A2A Hierarchical Chain-of-Command State
  const [a2aResult, setA2aResult] = useState<A2AHierarchyExecutionResult | null>(null);
  const [isA2AExecuting, setIsA2AExecuting] = useState(false);
  const [a2aStep, setA2aStep] = useState<string>("");
  const [expandedSubordinates, setExpandedSubordinates] = useState<Record<string, boolean>>({});
  const [dispatchedKanbanCount, setDispatchedKanbanCount] = useState<number | null>(null);
  const [isDispatchingA2AKanban, setIsDispatchingA2AKanban] = useState(false);
  const [copiedA2ADeliverable, setCopiedA2ADeliverable] = useState(false);

  // Specialist selector popover state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    }
  }, [loadData]);

  // Scroll to bottom of chat when new message arrives
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatSending]);

  // Handle outside click for picker
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pickerOpen]);

  // Resolve currently targeted agent with smart domain-aware auto-assignment
  const activeAgent = useMemo(() => {
    if (selectedAgentId !== "auto") {
      return agents.find((a) => a.id === selectedAgentId) || agents[0];
    }
    // Intelligently match optimal specialist based on user prompt, falling back to Orchestrator (not newest agent)
    return matchBestAgent(prompt, agents) || agents.find((a) => a.role === "orchestrator") || agents[0] || null;
  }, [agents, selectedAgentId, prompt]);

  const filteredPickerAgents = useMemo(() => {
    if (!pickerSearch.trim()) return agents;
    const q = pickerSearch.toLowerCase();
    return agents.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        (a.role && a.role.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q))
    );
  }, [agents, pickerSearch]);

  // Handle Input Changes & Slash Command Triggering
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPrompt(val);

    if (val === "/" || (val.startsWith("/") && !val.includes(" "))) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const handleSelectSlashCommand = (cmd: string) => {
    setShowSlashMenu(false);
    if (cmd === "/agents") {
      setPrompt("/agents ");
      inputRef.current?.focus();
    } else if (cmd === "/kanban") {
      setPrompt("/kanban ");
      inputRef.current?.focus();
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
      inputRef.current?.focus();
    }
  };

  // Send message directly to agent via /api/chat
  const sendChatMessage = async (text: string) => {
    if (!text.trim()) return;

    // Resolve target agent dynamically for auto-assign mode based on message content
    const targetAgent =
      selectedAgentId !== "auto"
        ? agents.find((a) => a.id === selectedAgentId) || activeAgent
        : matchBestAgent(text, agents) || activeAgent;

    const userMessage: DashboardChatMessage = {
      id: "user-" + Date.now(),
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setIsChatActive(true);
    setIsChatSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text.trim(),
          agentId: targetAgent?.id,
          sessionId: currentSessionId || undefined,
          useVaultRAG: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to receive response from agent");

      if (data.sessionId) setCurrentSessionId(data.sessionId);

      const botMessage: DashboardChatMessage = {
        id: "bot-" + Date.now(),
        role: "assistant",
        content: data.content,
        agentName: targetAgent?.displayName || "Autonomous Specialist",
        agentAvatar: targetAgent?.avatar || "🤖",
        latency: data.latency,
        model: data.model,
        createdAt: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      toast.error(err.message || "Failed to chat with agent");
    } finally {
      setIsChatSending(false);
    }
  };

  // Dispatch / Queue Task directly to Kanban board
  const handleSendToKanban = async (taskTitle?: string, taskDescription?: string) => {
    const rawTitle = (taskTitle || prompt).trim();
    if (!rawTitle) {
      toast.error("Please enter a task title or objective to queue to Kanban");
      return;
    }

    // Resolve optimal specialist agent for this task
    const targetAgent =
      selectedAgentId !== "auto"
        ? agents.find((a) => a.id === selectedAgentId) || activeAgent
        : matchBestAgent(rawTitle + " " + (taskDescription || ""), agents) || activeAgent;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: rawTitle,
          description: taskDescription || "Dispatched from Mission Control Command Center",
          priority: "medium",
          agentId: targetAgent?.id || null,
          status: "backlog",
        }),
      });

      if (!res.ok) throw new Error("Failed to queue task to Kanban");

      const created = await res.json();
      toast.success(
        `Task "${created.title}" assigned to ${targetAgent?.displayName || "Specialist"} & queued on Kanban!`
      );
      if (!taskTitle) {
        setPrompt("");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to queue task to Kanban");
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
    setShowSlashMenu(false);

    // 0. BRAIN DUMP SHORTCUT (/dump or /braindump)
    if (rawPrompt.toLowerCase() === "/dump" || rawPrompt.toLowerCase() === "/braindump") {
      setPrompt("");
      setShowBrainDump(true);
      return;
    }

    // 0.1 PACKS SHORTCUT (/packs)
    if (rawPrompt.toLowerCase() === "/packs") {
      setPrompt("");
      router.push("/agents?packs=true");
      return;
    }

    // 1. A2A HIERARCHICAL CHAIN OF COMMAND (/agents <mission>)
    if (rawPrompt.toLowerCase().startsWith("/agents")) {
      const missionTopic = rawPrompt.replace(/^\/agents\s*/i, "").trim();
      if (!missionTopic) {
        toast.error("Please enter a mission description after /agents (e.g. /agents Build JWT authentication)");
        return;
      }
      setPrompt("");
      await executeA2AMission(missionTopic);
      return;
    }

    // 2. KANBAN TASK SHORTCUT (/kanban <title> or /task <title>)
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

    // 3. VOICE ORB SHORTCUT (/voice)
    if (rawPrompt.toLowerCase() === "/voice") {
      setPrompt("");
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      return;
    }

    // 4. COST TRACKER SHORTCUT (/cost or /telemetry)
    if (rawPrompt.toLowerCase() === "/cost" || rawPrompt.toLowerCase() === "/telemetry") {
      setPrompt("");
      window.dispatchEvent(new CustomEvent("open-cost-tracker"));
      return;
    }

    // 5. PIPELINE BUILDER SHORTCUT (/pipeline)
    if (rawPrompt.toLowerCase() === "/pipeline") {
      setPrompt("");
      router.push("/agents?tab=pipeline");
      return;
    }

    // 6. MEMORY VAULT SHORTCUT (/memory or /vault)
    if (rawPrompt.toLowerCase() === "/memory" || rawPrompt.toLowerCase() === "/vault") {
      setPrompt("");
      router.push("/memory");
      return;
    }

    // 7. ROUTINES SHORTCUT (/routines)
    if (rawPrompt.toLowerCase() === "/routines") {
      setPrompt("");
      router.push("/routines");
      return;
    }

    // 8. SETTINGS SHORTCUT (/settings)
    if (rawPrompt.toLowerCase() === "/settings") {
      setPrompt("");
      router.push("/settings");
      return;
    }

    // 9. CHAT DIRECT: converse right on the dashboard!
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

  const handleCopyChat = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const handleCopyA2A = () => {
    if (!a2aResult?.finalDeliverable) return;
    navigator.clipboard.writeText(a2aResult.finalDeliverable);
    setCopiedA2ADeliverable(true);
    toast.success("Copied Master Deliverable to clipboard");
    setTimeout(() => setCopiedA2ADeliverable(false), 2000);
  };

  const toggleSubordinateNode = (nodeId: string) => {
    setExpandedSubordinates((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  // SSR Skeleton
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
      {/* 1. Minimalist Command Center Hero */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6f3fe] text-[#0075de] text-[11px] font-medium border border-[#0075de]/20">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0075de]" />
          <span>Agent Studio OS</span>
          <span className="opacity-40">•</span>
          <span>{agents.length} Autonomous Specialists</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-tight">
          Where teams and agents{" "}
          <span className="inline-block px-3 py-0.5 mx-1 rounded-full bg-[#f6d5b8] text-black font-semibold text-2xl sm:text-3xl lg:text-4xl align-baseline">
            orchestrate
          </span>{" "}
          together
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
          Type <code className="px-1.5 py-0.5 rounded bg-muted font-mono text-foreground font-semibold">/agents</code> to activate the autonomous A2A chain of command across your specialist team, chat with personas, or queue tasks to Kanban.
        </p>
      </div>

      {/* 1. Daily Executive Morning Briefing */}
      <DailyBriefingCard />

      {/* 2. Hero Universal Command Bar */}
      <div className="relative">
        <form
          onSubmit={handleCommandSubmit}
          className="relative rounded-xl border border-border bg-card p-2.5 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 shadow-xs"
        >
          <div className="flex items-center gap-2.5 px-2">
            {prompt.trim().toLowerCase().startsWith("/agents") ? (
              <Crown className="w-4 h-4 text-[#0075de] shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
            )}

            <input
              ref={inputRef}
              type="text"
              value={prompt}
              onChange={handleInputChange}
              onFocus={() => {
                if (prompt.startsWith("/") && !prompt.includes(" ")) setShowSlashMenu(true);
              }}
              placeholder={
                prompt.trim().toLowerCase().startsWith("/agents")
                  ? "Enter high-level mission for the agent hierarchy... (e.g. /agents Build JWT authentication)"
                  : selectedAgentId === "auto"
                  ? "Message your autonomous team or queue a task... (Type /agents for A2A)"
                  : `Message ${activeAgent?.displayName || "specialist"}... (Type /agents for A2A)`
              }
              autoFocus
              className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-none"
            />

            {prompt.trim() && (
              <div className="flex items-center gap-1.5 shrink-0">
                {!prompt.trim().toLowerCase().startsWith("/agents") && (
                  <button
                    type="button"
                    onClick={() => handleSendToKanban()}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                    title="Send as new task to Kanban board"
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span>Send to Kanban</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isChatSending || isA2AExecuting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 text-xs font-bold cursor-pointer"
                  title={prompt.trim().toLowerCase().startsWith("/agents") ? "Execute A2A Mission" : "Send message"}
                >
                  {isSubmitting || isChatSending || isA2AExecuting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : prompt.trim().toLowerCase().startsWith("/agents") ? (
                    <>
                      <Crown className="w-3.5 h-3.5" />
                      <span>Execute A2A</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Slash Commands Dropdown Menu */}
          {showSlashMenu && (
            <div className="absolute left-2 right-2 top-full mt-2 z-50 rounded-xl border border-border bg-card p-1.5 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Slash Commands
              </div>
              {SLASH_COMMANDS.map((sc) => {
                const Icon = sc.icon;
                return (
                  <button
                    key={sc.cmd}
                    type="button"
                    onClick={() => handleSelectSlashCommand(sc.cmd)}
                    className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-secondary/60 transition cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs ${sc.color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <span>{sc.cmd}</span>
                          <span className="font-normal text-muted-foreground">— {sc.label}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{sc.desc}</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono whitespace-nowrap ml-2">
                      {sc.badge}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Sub-bar options: Specialist Picker + Clean Command Hint */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t border-border text-xs px-1 relative">
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground transition cursor-pointer"
              >
                <span className="text-xs">{selectedAgentId === "auto" ? "⚡" : (activeAgent?.avatar || "🤖")}</span>
                <span className="font-semibold text-xs text-foreground">
                  {selectedAgentId === "auto" ? (
                    prompt.trim() && activeAgent ? `Auto-Assign: ${activeAgent.displayName}` : "Auto-Assign"
                  ) : activeAgent?.displayName}
                </span>
                <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Popover Dropdown */}
              {pickerOpen && (
                <div
                  ref={pickerRef}
                  className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border bg-card p-2 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="relative">
                    <Bot className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Filter agents..."
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                    {/* Auto-Assign */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAgentId("auto");
                        setPickerOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer text-left ${
                        selectedAgentId === "auto"
                          ? "bg-[#e6f3fe] text-[#0075de] font-semibold"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">⚡</span>
                        <div>
                          <div className="font-medium">Auto-Assign</div>
                          <div className="text-[10px] text-muted-foreground">Smart cascade model routing</div>
                        </div>
                      </div>
                      {selectedAgentId === "auto" && <Check className="w-3.5 h-3.5 text-[#0075de]" />}
                    </button>

                    {/* Filtered Agent List */}
                    {filteredPickerAgents.map((agent) => {
                      const isSelected = selectedAgentId === agent.id;
                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => {
                            setSelectedAgentId(agent.id);
                            setPickerOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer text-left ${
                            isSelected
                              ? "bg-[#e6f3fe] text-[#0075de] font-semibold"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base shrink-0">{agent.avatar || "🤖"}</span>
                            <div className="min-w-0">
                              <div className="font-medium truncate">{agent.displayName}</div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {agent.role || "specialist"} {agent.department ? `• ${agent.department}` : ""}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#0075de] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Capture Tools + Hint */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowBrainDump(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition cursor-pointer"
                title="Voice & Text Brain Dump — speech recognition & auto-decomposition into tickets"
              >
                <Brain className="w-3.5 h-3.5" />
                <span>Brain Dump</span>
              </button>

              <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 ml-1">
                <span>Type</span>
                <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px] text-foreground font-semibold border border-border">/agents</kbd>
                <span>for A2A</span>
              </div>
            </div>
          </div>
        </form>

        {/* 3. A2A HIERARCHICAL CHAIN OF COMMAND PROGRESS BANNER */}
        {isA2AExecuting && (
          <div className="mt-3 p-4 rounded-xl border border-[#0075de]/40 bg-[#0075de]/5 space-y-2 animate-pulse">
            <div className="flex items-center justify-between text-xs font-semibold text-[#0075de]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{a2aStep || "Orchestrating mission across agent hierarchy..."}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0075de]/10 border border-[#0075de]/20">
                Pillar 1 Engine
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#0075de] h-full rounded-full animate-[progress_12s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {/* 4. A2A HIERARCHICAL MISSION RESULTS PANEL */}
        <AnimatePresence>
          {a2aResult && !isA2AExecuting && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              className="mt-3 rounded-2xl border border-border bg-card overflow-hidden shadow-lg space-y-4 p-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e6f3fe] text-[#0075de] flex items-center justify-center border border-[#0075de]/30 shrink-0">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">
                        A2A Chain-of-Command Fulfilled
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3fe] text-[#0075de] font-semibold border border-[#0075de]/30">
                        {a2aResult.totalSubtasks} Subtasks
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Mission: &quot;{a2aResult.missionTopic}&quot;
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground px-2 py-1 rounded-md bg-secondary border border-border">
                    {Math.round(a2aResult.totalLatencyMs / 1000)}s Latency
                  </span>
                  <button
                    onClick={() => setA2aResult(null)}
                    className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyA2A}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
                  >
                    {copiedA2ADeliverable ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedA2ADeliverable ? "Copied" : "Copy Deliverable"}</span>
                  </button>

                  <button
                    onClick={handleDispatchA2AToKanban}
                    disabled={isDispatchingA2AKanban}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0075de]/40 bg-[#0075de]/20 hover:bg-[#0075de]/30 text-xs font-semibold text-[#0075de] dark:text-[#60a5fa] transition cursor-pointer disabled:opacity-50"
                  >
                    {isDispatchingA2AKanban ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : dispatchedKanbanCount ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {dispatchedKanbanCount
                        ? `${dispatchedKanbanCount} Tasks Dispatched to Kanban`
                        : "Dispatch Tasks to Kanban"}
                    </span>
                  </button>
                </div>

                {dispatchedKanbanCount && (
                  <Link
                    href="/kanban"
                    className="text-xs font-semibold text-[#0075de] hover:underline flex items-center gap-1"
                  >
                    <span>Open Kanban Board</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {/* Master Executive Deliverable */}
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Master Executive Deliverable (Synthesized by {a2aResult.orchestratorName})</span>
                </h4>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border text-xs leading-relaxed max-h-80 overflow-y-auto">
                  <MarkdownRenderer content={a2aResult.finalDeliverable} />
                </div>
              </div>

              {/* Breakdown of Subordinate Deliverables */}
              {a2aResult.executionTree.subordinates && a2aResult.executionTree.subordinates.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Subordinate Chain-of-Command Reports ({a2aResult.executionTree.subordinates.length})
                  </h4>
                  <div className="space-y-2">
                    {a2aResult.executionTree.subordinates.map((sub, idx) => {
                      const isExpanded = expandedSubordinates[sub.agentId] ?? false;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-card/60 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleSubordinateNode(sub.agentId)}
                            className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-secondary/40 transition cursor-pointer"
                          >
                            <div className="flex items-center gap-2 text-xs">
                              <span>{sub.avatar}</span>
                              <span className="font-bold text-foreground">{sub.agentName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                {sub.agentRole}
                              </span>
                              <span className="text-muted-foreground font-mono truncate max-w-xs">
                                — {sub.taskTitle}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {sub.latencyMs && (
                                <span className="text-[10px] font-mono">
                                  {Math.round(sub.latencyMs / 1000)}s
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </button>

                          {isExpanded && sub.output && (
                            <div className="p-3.5 border-t border-border bg-muted/20 text-xs leading-relaxed max-h-56 overflow-y-auto">
                              <MarkdownRenderer content={sub.output} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 5. LIVE INTERACTIVE CHAT PANEL ON DASHBOARD */}
        <AnimatePresence>
          {isChatActive && !a2aResult && !isA2AExecuting && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.99 }}
              className="mt-4 rounded-2xl border border-border bg-card shadow-xl backdrop-blur-md overflow-hidden transition-all divide-y divide-border"
            >
              {/* Chat Panel Header */}
              <div className="flex items-center justify-between p-3.5 bg-secondary/25">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm shadow-xs">
                      {activeAgent?.avatar || "🤖"}
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-foreground truncate">
                        {activeAgent?.displayName || "Specialist Agent"}
                      </p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium shrink-0">
                        {activeAgent?.department || activeAgent?.role || "Specialist"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
                      <span className="text-emerald-500 font-semibold">● Active</span>
                      <span>•</span>
                      <span>Memory Vault Synced</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/chat?agentId=${activeAgent?.id || ""}${currentSessionId ? `&sessionId=${currentSessionId}` : ""}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-[#e6f3fe] transition border border-primary/20"
                    title="Open in full screen Chat Workspace"
                  >
                    <span>Full Screen</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setChatMessages([]);
                      setIsChatActive(false);
                      setCurrentSessionId(null);
                    }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                    title="Close chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div
                ref={chatScrollRef}
                className="p-4 sm:p-5 space-y-4 max-h-[440px] overflow-y-auto scrollbar-thin"
              >
                {chatMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <span className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-xs">
                          {msg.agentAvatar || activeAgent?.avatar || "🤖"}
                        </span>
                      )}

                      <div className={`space-y-1.5 ${isUser ? "max-w-[80%]" : "max-w-[90%] w-full"}`}>
                        {/* Meta bar for agent message */}
                        {!isUser && (
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                            <span className="font-semibold text-foreground">
                              {msg.agentName || activeAgent?.displayName || "Specialist"}
                            </span>
                            <span className="text-[10px] font-mono opacity-70">
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        )}

                        <div
                          className={`rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed relative group shadow-xs ${
                            isUser
                              ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                              : "bg-secondary/40 border border-border text-foreground"
                          }`}
                        >
                          {!isUser ? (
                            <div className="prose prose-xs dark:prose-invert max-w-none">
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          )}

                          {/* Action Footer for Agent Deliverable */}
                          {!isUser && (
                            <div className="mt-3 pt-2.5 border-t border-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                              <div className="flex items-center gap-1.5">
                                {msg.latency && <span>{msg.latency}ms</span>}
                                {msg.latency && <span>•</span>}
                                <span>{msg.model || "auto"}</span>
                              </div>

                              <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => handleCopyChat(msg.id, msg.content)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Copy response text"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-400" />
                                      <span className="text-emerald-400 font-semibold font-sans">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span className="font-sans">Copy</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    const snippetTitle = msg.content.split("\n")[0].replace(/^#*\s*/, "").slice(0, 60) || "Agent Deliverable";
                                    handleSendToKanban(snippetTitle, msg.content);
                                  }}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold font-sans transition cursor-pointer"
                                  title="Send this deliverable as a Kanban task"
                                >
                                  <Columns3 className="w-3 h-3" />
                                  <span>Send to Kanban</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Generating Response Skeleton / Typing Indicator */}
                {isChatSending && (
                  <div className="flex gap-3 items-center pl-1 text-xs text-muted-foreground">
                    <span className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm shrink-0 shadow-xs animate-pulse">
                      {activeAgent?.avatar || "🤖"}
                    </span>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span className="font-medium text-foreground">
                        {activeAgent?.displayName || "Specialist"} is synthesizing response...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Follow-up input form */}
              <form
                onSubmit={handleFollowUpSubmit}
                className="flex items-center gap-2 p-3 bg-secondary/15"
              >
                <input
                  type="text"
                  value={followUpInput}
                  onChange={(e) => setFollowUpInput(e.target.value)}
                  placeholder={`Reply to ${activeAgent?.displayName || "agent"}... (Press Enter)`}
                  disabled={isChatSending}
                  className="flex-1 bg-secondary/50 border border-border px-3.5 py-2 rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
                />

                {followUpInput.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      handleSendToKanban(followUpInput);
                      setFollowUpInput("");
                    }}
                    className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer"
                    title="Send follow-up as a task to Kanban"
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">To Kanban</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={!followUpInput.trim() || isChatSending}
                  className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition cursor-pointer shrink-0 shadow-xs"
                  title="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {/* Brain Dump Modal */}
      <BrainDumpModal
        isOpen={showBrainDump}
        onClose={() => setShowBrainDump(false)}
        agents={agents}
        onTasksCreated={loadData}
      />
    </div>
  );
}
