"use client";

import { useState } from "react";
import {
  Swords,
  Users,
  Sparkles,
  Play,
  RotateCcw,
  CheckCircle2,
  Trophy,
  Target,
  Lightbulb,
  MessageSquareQuote,
  Loader2,
  FolderDown,
  ExternalLink,
  Check,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { MarkdownRenderer } from "./markdown-renderer";

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

const STANCE_OPTIONS = [
  { value: "Proponent", label: "Proponent (Advocate)", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  { value: "Skeptic / Challenger", label: "Skeptic (Critic)", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
  { value: "Pragmatist", label: "Pragmatist (Realist)", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  { value: "Synthesizer / Arbiter", label: "Synthesizer (Judge)", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
];

export function DebateArena({
  agents,
  onStartDebate,
  isLoading,
  messages,
  verdict,
  onReset,
}: DebateArenaProps) {
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

  // Vault Export State
  const [isExportingVault, setIsExportingVault] = useState(false);
  const [exportedVaultPath, setExportedVaultPath] = useState<string | null>(null);

  // A2A Kanban Dispatch State
  const [isDispatchingKanban, setIsDispatchingKanban] = useState(false);
  const [dispatchedTaskCount, setDispatchedTaskCount] = useState<number | null>(null);

  const toggleAgent = (agentId: string) => {
    if (selectedAgentIds.includes(agentId)) {
      if (selectedAgentIds.length <= 2) {
        return; // minimum 2 agents needed for a debate
      }
      setSelectedAgentIds((prev) => prev.filter((id) => id !== agentId));
    } else {
      setSelectedAgentIds((prev) => [...prev, agentId]);
    }
  };

  const setAgentStance = (agentId: string, stance: string) => {
    setStances((prev) => ({ ...prev, [agentId]: stance }));
  };

  const handleLaunch = () => {
    if (!topic.trim() || selectedAgentIds.length < 2 || isLoading) return;
    setExportedVaultPath(null);
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
          topic: topic || "Executive Consensus",
          verdict,
          participatingAgentIds: selectedAgentIds,
          targetStatus: "todo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchedTaskCount(data.createdTasks?.length || 3);
        toast.success(
          `Dispatched ${data.createdTasks?.length || 3} tasks directly to Kanban with A2A contracts!`
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
      const sanitizedTitle = (topic || "debate-clash")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40)
        .replace(/^-|-$/g, "");
      const fileName = `Debates/debate-${sanitizedTitle}-${Date.now().toString().slice(-6)}.md`;

      const participantsList = Array.from(
        new Set(messages.map((m) => `${m.displayName} (${m.stance || m.roleTitle})`))
      );

      const mdContent = `---
title: "Debate: ${(topic || "Multi-Agent Clash").replace(/"/g, '\\"')}"
type: debate
date: "${new Date().toISOString()}"
winner: "${(verdict?.winningStance || "Consensus").replace(/"/g, '\\"')}"
participants:
${participantsList.map((p) => `  - "${p}"`).join("\n")}
tags:
  - debate
  - multi-agent
  - architectural-consensus
---

# Debate: ${topic || "Multi-Agent Clash"}

> [!NOTE]
> Autonomous multi-agent debate conducted across ${messages.length} rounds/arguments on ${new Date().toLocaleString()}.

${
  verdict
    ? `## 🏆 Executive Verdict & Architectural Consensus
**Summary:** ${verdict.summary}

### Key Consensus Points
${(verdict.consensusPoints || []).map((pt) => `- ${pt}`).join("\n")}

### Recommended Action
> **Decision / Next Step:** ${verdict.recommendedAction}

---`
    : ""
}

## ⚔️ Debate Speeches & Cross-Examination
${messages
  .map(
    (m) => `### ${m.avatar} ${m.displayName} (${m.stance || m.roleTitle}) — Round ${m.round}
${m.rebuttalTarget ? `*⚡ Rebuttal directly addressing @${m.rebuttalTarget}*\n` : ""}
${m.content}

*Latency: ${m.latency}ms*`
  )
  .join("\n\n---\n\n")}

---
*Archived from Agent Studio OS Debate Arena*
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
        toast.success(`Saved to Obsidian Vault: ${fileName}`);
      } else {
        const data = await res.json();
        throw new Error(data.error || "Failed to save note to Vault");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to export debate");
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

  const hasResults = messages.length > 0;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Arena Title & Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-r from-purple-950/40 via-background to-indigo-950/40 p-5 sm:p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-400 text-xs font-semibold">
              <Swords className="w-3.5 h-3.5" />
              <span>Multi-Agent Clash Arena</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              Autonomous Executive Debate
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl">
              Select specialists, assign dialectical stances, and pit them against each other in structured, multi-turn cross-examination.
            </p>
          </div>

          {hasResults && (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Export to Vault Button */}
              <button
                onClick={handleExportToVault}
                disabled={isExportingVault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                title="Export entire debate transcript and verdict to Obsidian Vault"
              >
                {isExportingVault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : exportedVaultPath ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <FolderDown className="w-3.5 h-3.5" />
                )}
                <span>{exportedVaultPath ? "Archived to Vault" : "Export to Vault"}</span>
              </button>

              {exportedVaultPath && (
                <button
                  onClick={handleOpenInObsidian}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-all cursor-pointer shadow-sm"
                  title="Open this note in Obsidian desktop app"
                >
                  <ExternalLink className="w-3 h-3 text-purple-400" />
                  <span>Open in Obsidian</span>
                </button>
              )}

              <button
                onClick={onReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-xs font-medium text-foreground transition-all cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>New Debate Clash</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Setup Config Card (Visible if no results yet) */}
      {!hasResults && (
        <div className="rounded-2xl border border-border bg-card/70 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-lg">
          {/* Step 1: Select Debaters & Stances */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Select Participating Debaters ({selectedAgentIds.length} of {agents.length} active)
                </h3>
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                Min. 2 specialists required
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {agents.map((agent) => {
                const isSelected = selectedAgentIds.includes(agent.id);
                const currentStance = stances[agent.id] || "Proponent";

                return (
                  <div
                    key={agent.id}
                    onClick={() => toggleAgent(agent.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 select-none ${
                      isSelected
                        ? "border-purple-500/50 bg-purple-500/10 shadow-md ring-1 ring-purple-500/30"
                        : "border-border bg-secondary/40 hover:bg-secondary/70 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl shrink-0">{agent.avatar}</span>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {agent.displayName}
                          </h4>
                          <span className="text-[10px] text-muted-foreground truncate block">
                            {agent.role}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "bg-purple-500 text-white" : "border border-border"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </div>
                    </div>

                    {/* Stance Selector Pill if selected */}
                    {isSelected && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="pt-1 border-t border-purple-500/20 flex items-center justify-between gap-2"
                      >
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                          Stance:
                        </span>
                        <select
                          value={currentStance}
                          onChange={(e) => setAgentStance(agent.id, e.target.value)}
                          className="bg-card text-[11px] text-foreground font-medium rounded-lg px-2 py-0.5 border border-border outline-none cursor-pointer"
                        >
                          {STANCE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Step 2: Debate Topic & Motion */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                2
              </span>
              <h3 className="text-sm font-bold text-foreground">
                Set Debate Motion / Problem Statement
              </h3>
            </div>

            <textarea
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              rows={2}
              placeholder="e.g. Should our production agent runtime adopt a decentralized micro-agent mesh or a unified orchestrator?"
              className="w-full p-3.5 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 resize-none"
            />

          </div>

          {/* Step 3: Intensity & Launch Bar */}
          <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground">Debate Intensity:</span>
              <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-xl border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setRounds(1)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    rounds === 1
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  1 Round (Quick)
                </button>
                <button
                  type="button"
                  onClick={() => setRounds(2)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    rounds === 2
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  2 Rounds (Cross-Exam)
                </button>
                <button
                  type="button"
                  onClick={() => setRounds(3)}
                  className={`px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                    rounds === 3
                      ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  3 Rounds (Championship)
                </button>
              </div>
            </div>

            <button
              onClick={handleLaunch}
              disabled={!topic.trim() || selectedAgentIds.length < 2 || isLoading}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Debate in Progress...</span>
                </>
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  <span>Start Arena Debate</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Loading Live Status */}
      {isLoading && (
        <div className="p-8 rounded-2xl border border-purple-500/30 bg-purple-950/20 flex flex-col items-center justify-center space-y-3 text-center animate-pulse">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
            <Swords className="w-6 h-6 animate-bounce" />
          </div>
          <h3 className="text-sm font-bold text-foreground">
            Specialists are Cross-Examining Arguments...
          </h3>
          <p className="text-xs text-muted-foreground max-w-md">
            Agents are analyzing opposing theses, stress-testing architectural assumptions, and preparing counter-arguments.
          </p>
        </div>
      )}

      {/* Live Stream Debate Messages */}
      {hasResults && (
        <div className="space-y-6">
          {/* Active Debate Header Summary */}
          <div className="p-4 rounded-xl border border-border bg-card/60 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold uppercase tracking-wider text-[10px]">
                Motion:
              </span>
              <span className="font-semibold text-foreground italic">"{topic}"</span>
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {messages.length} Arguments Recorded
            </span>
          </div>

          {/* Grouped by Round */}
          {[1, 2, 3].map((r) => {
            const roundMsgs = messages.filter((m) => m.round === r);
            if (roundMsgs.length === 0) return null;

            return (
              <div key={r} className="space-y-4">
                {/* Round Header */}
                <div className="flex items-center gap-3">
                  <div className="h-[1px] flex-1 bg-border" />
                  <div className="px-3 py-1 rounded-full bg-secondary border border-border text-[11px] font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {r === 1
                        ? "Round 1: Opening Positions"
                        : r === 2
                        ? "Round 2: Cross-Examination & Rebuttals"
                        : "Round 3: Closing Synthesis"}
                    </span>
                  </div>
                  <div className="h-[1px] flex-1 bg-border" />
                </div>

                {/* Round Speeches */}
                <div className="grid grid-cols-1 gap-4">
                  {roundMsgs.map((msg, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-5 space-y-3 shadow-md hover:border-purple-500/30 transition-all"
                    >
                      {/* Speaker Meta Header */}
                      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl shrink-0">{msg.avatar}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-foreground">
                                {msg.displayName}
                              </h4>
                              {msg.stance && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                  {msg.stance}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              {msg.roleTitle || msg.agentName}
                            </span>
                          </div>
                        </div>

                        {msg.rebuttalTarget && (
                          <div className="hidden sm:flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                            <Swords className="w-3 h-3" />
                            <span>Rebuttal to @{msg.rebuttalTarget}</span>
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="text-xs text-foreground leading-relaxed prose prose-invert max-w-none">
                        <MarkdownRenderer content={msg.content} />
                      </div>

                      {/* Footer Latency */}
                      <div className="flex justify-end pt-1 text-[10px] text-muted-foreground font-mono">
                        Latency: {msg.latency}ms
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Executive Verdict & Consensus Card */}
          {verdict && (
            <div className="rounded-2xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-background to-teal-950/20 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Executive Verdict & Architectural Consensus
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Arbitrated synthesis and decision matrix derived from specialist clash.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Direct Vault Action Pill inside Verdict */}
                  <button
                    onClick={handleExportToVault}
                    disabled={isExportingVault}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 hover:bg-emerald-500/30 text-xs font-semibold text-emerald-300 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title="Export debate directly to Obsidian Vault"
                  >
                    {isExportingVault ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : exportedVaultPath ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <FolderDown className="w-3.5 h-3.5" />
                    )}
                    <span>{exportedVaultPath ? "Saved to Obsidian Vault" : "Save to Obsidian Vault"}</span>
                  </button>

                  {/* A2A Kanban Dispatch Button */}
                  <button
                    onClick={handleDispatchToKanban}
                    disabled={isDispatchingKanban}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#0075de]/40 bg-[#0075de]/20 hover:bg-[#0075de]/30 text-xs font-semibold text-[#0075de] dark:text-[#60a5fa] transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    title="Autonomous A2A decomposition into Kanban tickets"
                  >
                    {isDispatchingKanban ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : dispatchedTaskCount ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
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

              {/* Summary */}
              <div className="p-3.5 rounded-xl bg-card/60 border border-border text-xs text-foreground leading-relaxed">
                {verdict.summary}
              </div>

              {/* Consensus Points */}
              {verdict.consensusPoints && verdict.consensusPoints.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Key Agreement Points</span>
                  </span>
                  <ul className="space-y-1 text-xs text-muted-foreground pl-2">
                    {verdict.consensusPoints.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2">
                        <span className="text-emerald-500 font-bold">•</span>
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommended Action */}
              {verdict.recommendedAction && (
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-2.5 text-xs text-emerald-300">
                  <Target className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-foreground block">
                      Recommended Next Step:
                    </span>
                    <span>{verdict.recommendedAction}</span>
                  </div>
                </div>
              )}

              {/* Kanban Dispatch Status Banner */}
              {dispatchedTaskCount && (
                <div className="p-3 rounded-xl bg-secondary/80 border border-[#0075de]/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-foreground font-mono">
                    <span className="text-[#0075de] font-bold">✓ A2A Kanban Dispatch:</span>
                    <span>{dispatchedTaskCount} tickets created and assigned to specialists</span>
                  </div>
                  <Link
                    href="/kanban"
                    className="flex items-center gap-1 text-xs text-[#0075de] font-semibold hover:underline ml-2 shrink-0"
                  >
                    <span>Open Kanban Board</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Obsidian Status Banner if Exported */}
              {exportedVaultPath && (
                <div className="p-3 rounded-xl bg-secondary/80 border border-border flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground font-mono">
                    <span className="text-emerald-400 font-bold">✓ Vault File:</span>
                    <span className="truncate max-w-sm sm:max-w-md">{exportedVaultPath}</span>
                  </div>
                  <button
                    onClick={handleOpenInObsidian}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline cursor-pointer ml-2 shrink-0"
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
    </div>
  );
}
