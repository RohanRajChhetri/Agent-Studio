"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Users,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Target,
  MessageSquareQuote,
  Loader2,
  FolderDown,
  ExternalLink,
  Check,
  Layers,
  Search,
  Plus,
  X,
  Volume2,
  VolumeX,
  Copy,
  Scale,
  Shield,
  Cpu,
  Layers2,
  ArrowRight,
  Filter,
  Zap,
  ClipboardList,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { MarkdownRenderer } from "./markdown-renderer";
import { playTaskStartedSound, playTaskCompletedSound } from "@/lib/sound-effects";
import { AgentAvatar } from "@/components/ui/agent-avatar";

export interface DebateMessage {
  agentId: string;
  agentName: string;
  displayName: string;
  avatar: string;
  themeColor: string;
  roleTitle?: string;
  stance?: string;
  round: number;
  rebuttalTarget?: string;
  content: string;
  latency: number;
}

export interface DebateVerdict {
  summary: string;
  consensusPoints: string[];
  winningStance: string;
  recommendedAction: string;
}

interface DebateArenaProps {
  agents: AgentProfile[];
  onStartDebate: (payload: {
    topic: string;
    agentIds: string[];
    stances: Record<string, string>;
    rounds: number;
  }) => Promise<void>;
  isLoading: boolean;
  messages: DebateMessage[];
  verdict: DebateVerdict | null;
  onReset: () => void;
}

export const STANCE_OPTIONS = [
  {
    value: "Proponent",
    label: "Proponent (Advocate)",
    short: "Advocate",
    color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
    border: "border-l-emerald-500",
  },
  {
    value: "Skeptic / Challenger",
    label: "Skeptic (Challenger)",
    short: "Challenger",
    color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
    badge: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
    border: "border-l-rose-500",
  },
  {
    value: "Pragmatist",
    label: "Pragmatist (Realist)",
    short: "Realist",
    color: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20",
    badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
    border: "border-l-amber-500",
  },
  {
    value: "Synthesizer / Arbiter",
    label: "Synthesizer (Arbiter)",
    short: "Synthesizer",
    color: "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20",
    badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
    border: "border-l-sky-500",
  },
];

const TOPIC_PRESETS = [
  {
    title: "Microservices vs Modular Monolith",
    prompt: "Should our production architecture adopt a distributed micro-agent mesh or a consolidated modular orchestrator?",
    tag: "Architecture",
  },
  {
    title: "Event-Driven vs Direct RPC",
    prompt: "Should inter-agent coordination rely on an asynchronous Redis event bus or synchronous type-safe direct RPC pipelines?",
    tag: "Protocol",
  },
  {
    title: "Stateless Fleet vs Persistent Memory",
    prompt: "Should agent operations be strictly stateless with context injection, or maintain persistent long-term vector graph memory?",
    tag: "State Management",
  },
  {
    title: "SQLite Vector vs Cloud pgvector",
    prompt: "Should embedded local SQLite vector search be preferred over centralized Cloud PostgreSQL pgvector for production knowledge retrieval?",
    tag: "Data Layer",
  },
];

export function DebateArena({
  agents,
  onStartDebate,
  isLoading,
  messages,
  verdict,
  onReset,
}: DebateArenaProps) {
  // Council selection state (default to first 3 agents)
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(() => {
    return agents.slice(0, 3).map((a) => a.id);
  });

  const [stances, setStances] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    agents.forEach((a, idx) => {
      initial[a.id] =
        idx === 0
          ? "Proponent"
          : idx === 1
          ? "Skeptic / Challenger"
          : idx === 2
          ? "Pragmatist"
          : "Synthesizer / Arbiter";
    });
    return initial;
  });

  const [topic, setTopic] = useState("");
  const [rounds, setRounds] = useState(2);
  const [activeRoundTab, setActiveRoundTab] = useState<number>(1);

  // Agent Picker Modal state
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerTier, setPickerTier] = useState<string>("all");

  // Vault Export State
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [exportedVaultPath, setExportedVaultPath] = useState<string | null>(null);

  // A2A Kanban Dispatch State
  const [isDispatchingKanban, setIsDispatchingKanban] = useState(false);
  const [dispatchedTaskCount, setDispatchedTaskCount] = useState<number | null>(null);

  // Speech TTS State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Track results sound
  useEffect(() => {
    if (verdict && !isLoading) {
      try {
        playTaskCompletedSound();
      } catch {}
    }
  }, [verdict, isLoading]);

  const toggleAgent = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      if (selectedAgentIds.length <= 2) {
        toast.info("A minimum of 2 delegates is required for a roundtable deliberation");
        return;
      }
      setSelectedAgentIds((prev) => prev.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds((prev) => [...prev, agentId]);
      // If no stance assigned yet, assign based on count
      if (!stances[agentId]) {
        const nextStance =
          selectedAgentIds.length === 0
            ? "Proponent"
            : selectedAgentIds.length === 1
            ? "Skeptic / Challenger"
            : selectedAgentIds.length === 2
            ? "Pragmatist"
            : "Synthesizer / Arbiter";
        setStances((prev) => ({ ...prev, [agentId]: nextStance }));
      }
    }
  };

  const setAgentStance = (agentId: string, stance: string) => {
    setStances((prev) => ({ ...prev, [agentId]: stance }));
  };

  // Preset Council Configs
  const applyCouncilPreset = (presetName: string) => {
    let targetAgents: AgentProfile[] = [];

    if (presetName === "architecture") {
      targetAgents = agents.filter(
        (a) =>
          ["pact", "priva", "justitia"].some((n) => a.name.toLowerCase().includes(n)) ||
          a.role === "orchestrator"
      );
    } else if (presetName === "product") {
      targetAgents = agents.filter(
        (a) =>
          ["chaos", "assertx", "empathy"].some((n) => a.name.toLowerCase().includes(n)) ||
          a.role === "specialist"
      );
    } else if (presetName === "security") {
      targetAgents = agents.filter(
        (a) =>
          ["sentinel", "argus", "cipher"].some((n) => a.name.toLowerCase().includes(n)) ||
          a.department?.toLowerCase().includes("security")
      );
    } else if (presetName === "strategy") {
      targetAgents = agents.filter(
        (a) =>
          ["oracle", "axiom", "rohan"].some((n) => a.name.toLowerCase().includes(n))
      );
    }

    // Fallback if specific agents not found: pick 3 agents
    if (targetAgents.length < 3) {
      targetAgents = agents.slice(0, 3);
    } else {
      targetAgents = targetAgents.slice(0, 3);
    }

    const ids = targetAgents.map((a) => a.id);
    setSelectedAgentIds(ids);

    setStances((prev) => ({
      ...prev,
      [ids[0]]: "Proponent",
      [ids[1]]: "Skeptic / Challenger",
      [ids[2]]: "Synthesizer / Arbiter",
    }));

    toast.success(`Configured ${presetName.toUpperCase()} Council`);
  };

  const handleLaunch = () => {
    if (!topic.trim() || selectedAgentIds.length < 2 || isLoading) return;
    setExportedVaultPath(null);
    setDispatchedTaskCount(null);
    try {
      playTaskStartedSound();
    } catch {}
    onStartDebate({
      topic: topic.trim(),
      agentIds: selectedAgentIds,
      stances,
      rounds,
    });
  };

  const handleDispatchToKanban = async () => {
    if (!verdict) return;
    setIsDispatchingKanban(true);
    try {
      const res = await fetch("/api/a2a/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic || "Executive Roundtable Consensus",
          verdict,
          participatingAgentIds: selectedAgentIds,
          targetStatus: "todo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchedTaskCount(data.createdTasks?.length || 3);
        toast.success(
          `Dispatched ${data.createdTasks?.length || 3} actionable tasks to Kanban via A2A Protocol!`
        );
      } else {
        toast.error(data.error || "Failed to dispatch to Kanban");
      }
    } catch {
      toast.error("Network error dispatching to Kanban");
    } finally {
      setIsDispatchingKanban(false);
    }
  };

  const handleExportToVault = async () => {
    if (messages.length === 0) return;
    setIsExportingVault(true);

    try {
      const sanitizedTitle = (topic || "roundtable-deliberation")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)
        .replace(/^-|-$/g, "");
      const fileName = `Roundtables/roundtable-${sanitizedTitle}-${Date.now().toString().slice(-6)}.md`;

      const participantsList = Array.from(
        new Set(messages.map((m) => `${m.displayName} (${m.stance || m.roleTitle})`))
      );

      const mdContent = `---
title: "Executive Roundtable: ${(topic || "Multi-Agent Deliberation").replace(/"/g, '\\"')}"
type: roundtable-deliberation
date: "${new Date().toISOString()}"
winner: "${(verdict?.winningStance || "Consensus Derived").replace(/"/g, '\\"')}"
participants:
${participantsList.map((p) => `  - "${p}"`).join("\n")}
tags:
  - roundtable
  - executive-deliberation
  - architectural-consensus
  - a2a-protocol
---

# Executive Roundtable: ${topic || "Multi-Agent Deliberation"}

> [!NOTE]
> Autonomous multi-agent roundtable conducted across ${messages.length} cross-examinations on ${new Date().toLocaleString()}.

${
  verdict
    ? `## Executive Verdict & Architectural Consensus
**Summary:** ${verdict.summary}

### Key Consensus Agreements
${(verdict.consensusPoints || []).map((pt) => `- ${pt}`).join("\n")}

### Recommended Actionable Decision
> **Strategic Decision:** ${verdict.recommendedAction}

---`
    : ""
}

## Council Speeches & Cross-Examination
${messages
  .map(
    (m) => `### ${m.displayName} (${m.stance || m.roleTitle}) — Round ${m.round}
${m.rebuttalTarget ? `*Cross-examination addressing @${m.rebuttalTarget}*\n` : ""}
${m.content}

*Latency: ${m.latency}ms*`
  )
  .join("\n\n---\n\n")}

---
*Archived from Agent Studio OS Executive Roundtable Room*
`;

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: fileName,
          content: mdContent,
        }),
      });

      if (res.ok) {
        setExportedVaultPath(fileName);
        toast.success(`Archived to Obsidian Vault: ${fileName}`);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note to Vault");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export deliberation");
    } finally {
      setIsExportingVault(false);
    }
  };

  const handleOpenInObsidian = async () => {
    if (!exportedVaultPath) return;
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_obsidian",
          path: exportedVaultPath,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Opened in desktop Obsidian");
      } else {
        toast.info(`Vault note ready at ${exportedVaultPath}`);
      }
    } catch {
      toast.info(`Vault note ready at ${exportedVaultPath}`);
    }
  };

  const handleCopySpeech = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    toast.success("Speech copied to clipboard");
    setTimeout(() => {
      setCopiedMsgId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const handleSpeakSpeech = (content: string, id: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.info("Speech synthesis not supported in this browser");
      return;
    }

    if (speakingMsgId === id) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = content.replace(/[*#`_~[\]()]/g, "");
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    window.speechSynthesis.speak(utterance);
    setSpeakingMsgId(id);
  };

  const hasResults = messages.length > 0;

  // Selected agents list
  const selectedAgents = useMemo(() => {
    return selectedAgentIds
      .map((id) => agents.find((a) => a.id === id))
      .filter((a): a is AgentProfile => Boolean(a));
  }, [selectedAgentIds, agents]);

  // Filtered agents for picker modal
  const filteredFleet = useMemo(() => {
    return agents.filter((a) => {
      if (pickerTier !== "all" && a.role !== pickerTier) return false;
      if (!pickerSearch.trim()) return true;
      const q = pickerSearch.toLowerCase();
      return (
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.department && a.department.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q))
      );
    });
  }, [agents, pickerSearch, pickerTier]);

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-6 max-w-5xl mx-auto w-full font-sans">
      {/* 1. Executive Hero Cockpit Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-xs backdrop-blur-xl">
        {/* Subtle Brand Accent Glows (Notion Blue & Slate - Zero Purple) */}
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-primary/8 dark:bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-sky-500/5 dark:bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="flex items-start gap-4 min-w-0">
            {/* Primary Icon Box */}
            <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 shadow-xs">
              <Users className="w-6 h-6" />
            </div>

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary border border-border text-[11px] font-semibold text-foreground tracking-wide">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span>Executive Roundtable</span>
                </span>
                <span className="inline-block text-[10px] text-muted-foreground font-mono">
                  Autonomous Dialectic Protocol • Consensus Engine
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight leading-snug">
                Multi-Agent Deliberation Council
              </h2>

              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Convene specialized agents for rigorous, multi-turn cross-examination. Reconcile contradictory theses, pressure-test architectural assumptions, and synthesize binding consensus into autonomous Kanban tickets.
              </p>

              {/* Architectural Feature Badges */}
              <div className="pt-1 flex items-center gap-2 flex-wrap text-[11px] font-medium text-muted-foreground">
                <span className="px-2.5 py-0.5 rounded-lg bg-secondary/80 border border-border flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span>Multi-Turn Cross-Exam</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-secondary/80 border border-border flex items-center gap-1.5">
                  <ClipboardList className="w-3 h-3 text-primary" />
                  <span>A2A Kanban Dispatch</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-secondary/80 border border-border flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3 text-emerald-500" />
                  <span>Obsidian Vault Archival</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-secondary/80 border border-border flex items-center gap-1.5 font-mono text-[10px]">
                  <Users className="w-3 h-3 text-purple-500" />
                  <span>{agents.length} Fleet Specialists</span>
                </span>
              </div>
            </div>
          </div>

          {/* Action Header Controls when results are active */}
          {hasResults && (
            <div className="flex items-center gap-2 flex-wrap shrink-0 justify-start md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border">
              {/* Export to Vault Button */}
              <button
                onClick={handleExportToVault}
                disabled={isExportingVault}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                title="Archive complete transcript and verdict to Obsidian Vault"
              >
                {isExportingVault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedVaultPath ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <FolderDown className="w-3.5 h-3.5" />
                )}
                <span>{exportedVaultPath ? "Archived to Vault" : "Save to Vault"}</span>
              </button>

              {exportedVaultPath && (
                <button
                  onClick={handleOpenInObsidian}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-all cursor-pointer shadow-xs"
                  title="Open this note in Obsidian desktop"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary" />
                  <span>Open Obsidian</span>
                </button>
              )}

              <button
                onClick={onReset}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                <span>New Session</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Council Setup Chamber (Visible before debate starts or in new session) */}
      {!hasResults && (
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-6 shadow-xs">
          {/* Step 1: Council Delegates & Chamber Presets */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Roundtable Council Chamber
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    Assign 2 to 6 specialist delegates and designate dialectic stances.
                  </p>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10.5px] text-muted-foreground font-medium mr-1">Presets:</span>
                <button
                  type="button"
                  onClick={() => applyCouncilPreset("architecture")}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border transition-all cursor-pointer flex items-center gap-1"
                >
                  <Cpu className="w-3 h-3 text-primary" />
                  <span>Architecture</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCouncilPreset("security")}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border transition-all cursor-pointer flex items-center gap-1"
                >
                  <Shield className="w-3 h-3 text-emerald-500" />
                  <span>Security</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCouncilPreset("product")}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border transition-all cursor-pointer flex items-center gap-1"
                >
                  <Layers2 className="w-3 h-3 text-amber-500" />
                  <span>Product</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyCouncilPreset("strategy")}
                  className="px-2.5 py-1 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground text-[10.5px] font-medium border border-border transition-all cursor-pointer flex items-center gap-1"
                >
                  <Lightbulb className="w-3 h-3 text-sky-500" />
                  <span>Strategy</span>
                </button>
              </div>
            </div>

            {/* Active Council Delegate Seats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {selectedAgents.map((agent) => {
                const currentStance = stances[agent.id] || "Proponent";
                const stanceMeta =
                  STANCE_OPTIONS.find((s) => s.value === currentStance) || STANCE_OPTIONS[0];

                return (
                  <div
                    key={agent.id}
                    className="relative rounded-xl border border-border bg-card p-3.5 space-y-3 shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
                  >
                    {/* Top Row: Avatar, Name, Role & Remove Button */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                          <AgentAvatar avatar={agent.avatar} className="w-5 h-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {agent.displayName}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <span className="uppercase font-mono tracking-wider font-semibold">
                              {agent.role || "specialist"}
                            </span>
                            {agent.department && (
                              <>
                                <span>•</span>
                                <span className="truncate">{agent.department}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => toggleAgent(agent.id)}
                        className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
                        title="Remove delegate from council"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Stance Selector Pill & Dropdown */}
                    <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                        Dialectic Stance:
                      </span>

                      <select
                        value={currentStance}
                        onChange={(e) => setAgentStance(agent.id, e.target.value)}
                        className={`text-[11px] font-semibold rounded-lg px-2 py-1 border outline-none cursor-pointer flex-1 min-w-0 truncate ${stanceMeta.color}`}
                      >
                        {STANCE_OPTIONS.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className="bg-card text-foreground"
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}

              {/* Add Delegate Seat Card */}
              <button
                type="button"
                onClick={() => setShowAgentPicker(true)}
                className="rounded-xl border border-dashed border-border hover:border-primary/50 bg-secondary/30 hover:bg-secondary/60 p-4 flex flex-col items-center justify-center text-center space-y-1.5 transition-all cursor-pointer min-h-[110px] group"
              >
                <div className="w-8 h-8 rounded-full bg-secondary border border-border group-hover:border-primary/40 group-hover:bg-primary/10 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                  <Plus className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  Add Delegate
                </span>
                <span className="text-[10.5px] text-muted-foreground">
                  Browse {agents.length} fleet specialists
                </span>
              </button>
            </div>
          </div>

          {/* Step 2: Deliberation Motion / Topic */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Deliberation Motion & Problem Statement
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {topic.length} characters
              </span>
            </div>

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={3}
              placeholder="State the core motion, architectural trade-off, or strategic dilemma for the council to cross-examine..."
              className="w-full p-3.5 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none leading-relaxed"
            />

            {/* Inspiration Prompt Chips */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground font-medium">
                <Lightbulb className="w-3 h-3 text-amber-500" />
                <span>Preset Motions & Architecture Dilemmas:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {TOPIC_PRESETS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setTopic(p.prompt)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary border border-border text-foreground hover:border-primary/40 transition-all cursor-pointer flex items-center gap-1 text-left"
                  >
                    <span className="font-medium">{p.title}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3: Deliberation Depth & Launch Bar */}
          <div className="pt-4 border-t border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <span className="text-xs font-medium text-muted-foreground shrink-0">
                Deliberation Depth:
              </span>
              <div className="grid grid-cols-3 gap-1 bg-secondary p-1 rounded-xl border border-border text-xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setRounds(1)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center text-[11px] sm:text-xs ${
                    rounds === 1
                      ? "bg-card text-foreground font-bold shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1 Round (Theses)
                </button>
                <button
                  type="button"
                  onClick={() => setRounds(2)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center text-[11px] sm:text-xs ${
                    rounds === 2
                      ? "bg-card text-foreground font-bold shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  2 Rounds (Cross-Exam)
                </button>
                <button
                  type="button"
                  onClick={() => setRounds(3)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer text-center text-[11px] sm:text-xs ${
                    rounds === 3
                      ? "bg-card text-foreground font-bold shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  3 Rounds (Consensus)
                </button>
              </div>
            </div>

            {/* Convene Primary CTA Button */}
            <button
              type="button"
              onClick={handleLaunch}
              disabled={!topic.trim() || selectedAgentIds.length < 2 || isLoading}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Council in Deliberation...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-primary-foreground" />
                  <span>Convene Roundtable ({selectedAgentIds.length} Delegates)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* 3. Live Deliberation Loading Tracker */}
      {isLoading && (
        <div className="p-8 rounded-2xl border border-primary/20 bg-card/60 backdrop-blur-xl flex flex-col items-center justify-center space-y-4 text-center shadow-xs">
          <div className="flex items-center justify-center gap-2">
            {selectedAgents.map((a, i) => (
              <div
                key={a.id}
                className="w-11 h-11 rounded-2xl bg-secondary border border-border flex items-center justify-center shadow-xs animate-pulse"
                style={{ animationDelay: `${i * 150}ms` }}
              >
                <AgentAvatar avatar={a.avatar} className="w-6 h-6 text-primary" />
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-bold text-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Delegates Are Cross-Examining Theses...</span>
            </h3>
            <p className="text-xs text-muted-foreground max-w-md">
              Specialists are stress-testing conflicting architectural assumptions, quoting opposing claims, and deriving binding consensus.
            </p>
          </div>

          {/* Stepper indicators */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground pt-1">
            <span className="px-2 py-0.5 rounded-md bg-secondary border border-border">
              Phase 1: Theses
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-semibold">
              Phase 2: Cross-Examination
            </span>
            <ArrowRight className="w-3 h-3 text-muted-foreground" />
            <span className="px-2 py-0.5 rounded-md bg-secondary border border-border">
              Phase 3: Synthesis
            </span>
          </div>
        </div>
      )}

      {/* 4. Active Results: Speeches Feed & Executive Verdict */}
      {hasResults && (
        <div className="space-y-6">
          {/* Active Motion Header Summary */}
          <div className="p-4 rounded-xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
            <div className="flex items-start sm:items-center gap-2.5 min-w-0">
              <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[10px] shrink-0">
                Deliberation Motion
              </span>
              <span className="font-semibold text-foreground italic break-words">
                "{topic}"
              </span>
            </div>

            <div className="flex items-center gap-3 shrink-0 self-start sm:self-auto font-mono text-[11px] text-muted-foreground">
              <span>{messages.length} Speeches Recorded</span>
              <span>•</span>
              <span>{selectedAgentIds.length} Delegates</span>
            </div>
          </div>

          {/* Round Timeline & Speeches */}
          {[1, 2, 3].map((r) => {
            const roundMsgs = messages.filter((m) => m.round === r);
            if (roundMsgs.length === 0) return null;

            return (
              <div key={r} className="space-y-4">
                {/* Round Header Divider */}
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-border" />
                  <div className="px-3.5 py-1 rounded-full bg-secondary border border-border text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-2 shrink-0 shadow-2xs">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {r === 1
                        ? "Round 1: Opening Positions & Core Theses"
                        : r === 2
                        ? "Round 2: Cross-Examination & Direct Rebuttals"
                        : "Round 3: Closing Synthesis & Compromises"}
                    </span>
                  </div>
                  <div className="h-[1px] flex-1 bg-border" />
                </div>

                {/* Round Speeches Grid */}
                <div className="grid grid-cols-1 gap-4">
                  {roundMsgs.map((msg, idx) => {
                    const stanceMeta =
                      STANCE_OPTIONS.find((s) => s.value === msg.stance) || STANCE_OPTIONS[0];

                    return (
                      <div
                        key={idx}
                        className={`rounded-2xl border border-border bg-card p-4 sm:p-5 space-y-3.5 shadow-xs border-l-4 ${stanceMeta.border}`}
                      >
                        {/* Speaker Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0">
                              <AgentAvatar avatar={msg.avatar} className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-bold text-foreground truncate">
                                  {msg.displayName}
                                </h4>
                                {msg.stance && (
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${stanceMeta.badge}`}
                                  >
                                    {msg.stance}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10.5px] text-muted-foreground truncate block">
                                {msg.roleTitle || msg.agentName}
                              </span>
                            </div>
                          </div>

                          {/* Rebuttal Target Badge & Micro-Actions */}
                          <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                            {msg.rebuttalTarget && (
                              <div className="flex items-center gap-1.5 text-[10.5px] px-2.5 py-0.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-semibold shrink-0">
                                <Zap className="w-3 h-3 text-rose-500 shrink-0" />
                                <span>Cross-examining</span>
                                <span className="font-bold">@{msg.rebuttalTarget}</span>
                              </div>
                            )}

                            {/* TTS Voice Readout Button */}
                            <button
                              type="button"
                              onClick={() => handleSpeakSpeech(msg.content, `msg-${idx}`)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title={
                                speakingMsgId === `msg-${idx}`
                                  ? "Stop reading aloud"
                                  : "Read speech aloud"
                              }
                            >
                              {speakingMsgId === `msg-${idx}` ? (
                                <VolumeX className="w-3.5 h-3.5 text-primary animate-pulse" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Copy Button */}
                            <button
                              type="button"
                              onClick={() => handleCopySpeech(msg.content, `msg-${idx}`)}
                              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                              title="Copy speech to clipboard"
                            >
                              {copiedMsgId === `msg-${idx}` ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Speech Content */}
                        <div className="text-xs text-foreground leading-relaxed prose dark:prose-invert max-w-none">
                          <MarkdownRenderer content={msg.content} />
                        </div>

                        {/* Latency and telemetry footer */}
                        <div className="flex items-center justify-between pt-1 text-[10.5px] text-muted-foreground font-mono border-t border-border/40">
                          <span className="text-[10px] text-muted-foreground">
                            Delegate Speech • Round {msg.round}
                          </span>
                          <span>Latency: {msg.latency}ms</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* 5. Executive Verdict & Architectural Consensus Card */}
          {verdict && (
            <div className="rounded-2xl border-2 border-emerald-500/30 bg-card p-5 sm:p-6 space-y-5 shadow-sm animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                    <Trophy className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        Executive Verdict & Architectural Consensus
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                        Binding
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Synthesized arbitration derived from multi-perspective specialist cross-examination.
                    </p>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  {/* Vault Action */}
                  <button
                    type="button"
                    onClick={handleExportToVault}
                    disabled={isExportingVault}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-semibold text-emerald-600 dark:text-emerald-400 transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isExportingVault ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : exportedVaultPath ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <FolderDown className="w-3.5 h-3.5" />
                    )}
                    <span>{exportedVaultPath ? "Saved to Vault" : "Save to Vault"}</span>
                  </button>

                  {/* A2A Kanban Dispatch Button */}
                  <button
                    type="button"
                    onClick={handleDispatchToKanban}
                    disabled={isDispatchingKanban}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    {isDispatchingKanban ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : dispatchedTaskCount ? (
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {dispatchedTaskCount
                        ? `${dispatchedTaskCount} Tasks Dispatched`
                        : "Dispatch to Kanban via A2A"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Winning Stance Banner */}
              {verdict.winningStance && (
                <div className="p-3.5 rounded-xl bg-secondary/80 border border-border flex items-center gap-2.5 text-xs">
                  <Scale className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-muted-foreground">Winning Stance / Leading Thesis:</span>
                  <span className="font-bold text-foreground">{verdict.winningStance}</span>
                </div>
              )}

              {/* Executive Summary */}
              <div className="p-4 rounded-xl bg-secondary/40 border border-border text-xs text-foreground leading-relaxed">
                <span className="font-bold block mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Arbitration Summary
                </span>
                {verdict.summary}
              </div>

              {/* Consensus Points Checklist */}
              {verdict.consensusPoints && verdict.consensusPoints.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Key Architectural Consensus Agreements</span>
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {verdict.consensusPoints.map((pt, pIdx) => (
                      <div
                        key={pIdx}
                        className="p-3 rounded-xl bg-card border border-border/80 flex items-start gap-2.5 text-xs text-foreground"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{pt}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Next Action */}
              {verdict.recommendedAction && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-xs text-emerald-700 dark:text-emerald-300">
                  <Target className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground block mb-0.5">
                      Recommended Strategic Action:
                    </span>
                    <span>{verdict.recommendedAction}</span>
                  </div>
                </div>
              )}

              {/* Kanban Dispatch Confirmation Banner */}
              {dispatchedTaskCount && (
                <div className="p-3.5 rounded-xl bg-secondary border border-primary/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-foreground font-mono flex-wrap">
                    <span className="text-primary font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      A2A Kanban Dispatch:
                    </span>
                    <span>{dispatchedTaskCount} tickets created and assigned to specialists</span>
                  </div>
                  <Link
                    href="/kanban"
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline shrink-0"
                  >
                    <span>Open Kanban Board</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Obsidian Status Banner */}
              {exportedVaultPath && (
                <div className="p-3.5 rounded-xl bg-secondary border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground font-mono min-w-0">
                    <span className="text-emerald-500 font-bold shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Obsidian Vault:
                    </span>
                    <span className="truncate">{exportedVaultPath}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenInObsidian}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline cursor-pointer shrink-0"
                  >
                    <span>Open in Obsidian</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 5. Fleet Agent Picker Modal (Browse & Select from all 27+ Specialists) */}
      {showAgentPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl max-h-[85vh] rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xl flex flex-col space-y-4">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    Select Roundtable Council Delegates
                  </h3>
                  <p className="text-[11px] text-muted-foreground">
                    {selectedAgentIds.length} delegates currently seated in the council.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowAgentPicker(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search & Tier Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search fleet specialists by name, role, department..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl border border-border text-[11px]">
                {["all", "orchestrator", "specialist", "worker"].map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setPickerTier(tier)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer capitalize ${
                      pickerTier === tier
                        ? "bg-card text-foreground font-bold shadow-xs border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {tier}
                  </button>
                ))}
              </div>
            </div>

            {/* Agent Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2.5 pr-1">
              {filteredFleet.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);

                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border bg-card hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <AgentAvatar avatar={agent.avatar} className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {agent.displayName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                          <span className="uppercase font-mono font-semibold">
                            {agent.role || "specialist"}
                          </span>
                          {agent.department && (
                            <>
                              <span>•</span>
                              <span className="truncate">{agent.department}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border"
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">
                {selectedAgentIds.length} delegates seated (min. 2 required)
              </span>
              <button
                type="button"
                onClick={() => setShowAgentPicker(false)}
                className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all cursor-pointer shadow-xs"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
