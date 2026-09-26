"use client";

import { useState, useMemo } from "react";
import {
  X,
  Sparkles,
  Crown,
  Shield,
  Zap,
  Play,
  Loader2,
  CheckCircle2,
  Layers,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Target,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import type { A2AHierarchyExecutionResult, A2AHierarchyNodeExecution } from "@/types/a2a";

interface A2AMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentProfile[];
  initialOrchestratorId?: string;
  onMissionComplete?: () => void;
}

export function A2AMissionModal({
  isOpen,
  onClose,
  agents,
  initialOrchestratorId,
  onMissionComplete,
}: A2AMissionModalProps) {
  // Find default orchestrator
  const defaultOrchestrator = useMemo(() => {
    if (initialOrchestratorId) {
      const found = agents.find((a) => a.id === initialOrchestratorId);
      if (found) return found;
    }
    const orch = agents.find((a) => a.role === "orchestrator");
    return orch || agents[0];
  }, [agents, initialOrchestratorId]);

  const [selectedOrchestratorId, setSelectedOrchestratorId] = useState<string>(
    defaultOrchestrator?.id || ""
  );
  const [missionTopic, setMissionTopic] = useState("");
  const [missionDetails, setMissionDetails] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string>("");
  const [executionResult, setExecutionResult] = useState<A2AHierarchyExecutionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [dispatchedCount, setDispatchedCount] = useState<number | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const selectedOrchestrator = useMemo(
    () => agents.find((a) => a.id === selectedOrchestratorId) || defaultOrchestrator,
    [agents, selectedOrchestratorId, defaultOrchestrator]
  );

  // Compute subordinates tree for preview
  const directSubordinates = useMemo(() => {
    if (!selectedOrchestrator) return [];
    return agents.filter((a) => a.reportsToId === selectedOrchestrator.id);
  }, [agents, selectedOrchestrator]);

  if (!isOpen) return null;

  const handleLaunchMission = async () => {
    if (!missionTopic.trim() || !selectedOrchestrator || isRunning) return;

    setIsRunning(true);
    setExecutionResult(null);
    setDispatchedCount(null);
    setCurrentStep("1/4: Orchestrator analyzing and decomposing mission...");

    let stepTimer1: any = null;
    let stepTimer2: any = null;
    let stepTimer3: any = null;

    try {
      stepTimer1 = setTimeout(() => {
        setCurrentStep("2/4: Issuing A2A contracts & delegating to managers...");
      }, 3500);

      stepTimer2 = setTimeout(() => {
        setCurrentStep("3/4: Specialists executing tactical deliverables...");
      }, 7500);

      stepTimer3 = setTimeout(() => {
        setCurrentStep("4/4: Synthesizing Master Executive Deliverable...");
      }, 12000);

      const res = await fetch("/api/a2a/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orchestratorId: selectedOrchestrator.id,
          missionTopic: missionTopic.trim(),
          missionDetails: missionDetails.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setExecutionResult(data);
        toast.success(`A2A Chain of Command fulfilled! ${data.totalSubtasks} subtasks executed.`);
        if (onMissionComplete) onMissionComplete();
      } else {
        toast.error(data.error || "A2A Hierarchical execution failed");
      }
    } catch {
      toast.error("Network error executing hierarchical mission");
    } finally {
      if (stepTimer1) clearTimeout(stepTimer1);
      if (stepTimer2) clearTimeout(stepTimer2);
      if (stepTimer3) clearTimeout(stepTimer3);
      setIsRunning(false);
      setCurrentStep("");
    }
  };

  const handleCopy = () => {
    if (!executionResult?.finalDeliverable) return;
    navigator.clipboard.writeText(executionResult.finalDeliverable);
    setCopied(true);
    toast.success("Copied executive deliverable to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDispatchToKanban = async () => {
    if (!executionResult) return;
    setIsDispatching(true);
    try {
      const res = await fetch("/api/a2a/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: executionResult.missionTopic,
          verdict: {
            summary: executionResult.rootSummary,
            consensusPoints: [
              `Hierarchical command executed across ${executionResult.totalSubtasks} subtasks.`,
              `Master synthesized by ${executionResult.orchestratorName}.`,
            ],
            recommendedAction: "Execute concrete implementation tickets via Kanban board.",
          },
          targetStatus: "todo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDispatchedCount(data.createdTasks?.length || 3);
        toast.success(`Dispatched ${data.createdTasks?.length || 3} tasks to Kanban board!`);
      } else {
        toast.error(data.error || "Failed to dispatch tasks");
      }
    } catch {
      toast.error("Network error dispatching tasks");
    } finally {
      setIsDispatching(false);
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#e6f3fe] text-[#0075de] flex items-center justify-center border border-[#0075de]/30 shrink-0">
              <Crown className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-foreground">
                  A2A Hierarchical Chain of Command
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#e6f3fe] text-[#0075de] font-medium border border-[#0075de]/30">
                  Pillar 1 Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Orchestrator decomposes goals &rarr; Delegates to Managers &rarr; Specialists execute &rarr; Deliverables bubble up
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {!executionResult ? (
            <>
              {/* Orchestrator Selector & Hierarchy Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-[#0075de]" />
                    <span>Select Orchestrating Commander</span>
                  </label>
                  <select
                    value={selectedOrchestratorId}
                    onChange={(e) => setSelectedOrchestratorId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:border-[#0075de]"
                  >
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.avatar || "🤖"} {agent.displayName} ({agent.role} — {agent.department || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subordinate Readiness Pill */}
                <div className="p-3 rounded-xl bg-secondary/50 border border-border text-xs flex flex-col justify-center">
                  <span className="text-muted-foreground text-[11px] block">
                    Active Chain of Command:
                  </span>
                  <div className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
                    <span>{directSubordinates.length} Direct Subordinates</span>
                    <span className="text-muted-foreground font-normal">
                      ({directSubordinates.map((s) => s.displayName).join(", ") || "General Swarm Auto-Dispatch"})
                    </span>
                  </div>
                </div>
              </div>

              {/* Mission Goal & Requirements */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#0075de]" />
                    <span>Overarching Mission Topic / Strategic Objective</span>
                  </label>
                  <input
                    type="text"
                    value={missionTopic}
                    onChange={(e) => setMissionTopic(e.target.value)}
                    placeholder="e.g. Build end-to-end resilient vector search engine with hybrid indexing"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0075de]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Technical Constraints & Details (Optional)
                  </label>
                  <textarea
                    rows={3}
                    value={missionDetails}
                    onChange={(e) => setMissionDetails(e.target.value)}
                    placeholder="Add specific libraries, API keys, compliance standards, or output schemas..."
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#0075de]"
                  />
                </div>
              </div>

              {/* Progress Indicator when running */}
              {isRunning && (
                <div className="p-4 rounded-xl border border-[#0075de]/40 bg-[#0075de]/5 space-y-2 animate-pulse">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#0075de]">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{currentStep || "Executing A2A Chain of Command..."}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                    <div className="bg-[#0075de] h-full rounded-full animate-[progress_12s_ease-in-out_infinite]" />
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Results View */
            <div className="space-y-6">
              {/* Mission Summary Card */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-[#0075de]/10 via-secondary/40 to-background border border-[#0075de]/30 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-[#0075de] text-white flex items-center justify-center text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                    </span>
                    <h3 className="text-sm font-bold text-foreground">
                      Mission Accomplished: {executionResult.missionTopic}
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {executionResult.rootSummary}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                  <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">
                    {executionResult.totalSubtasks} Subtasks
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-secondary border border-border">
                    {Math.round(executionResult.totalLatencyMs / 1000)}s Latency
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-border">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? "Copied" : "Copy Deliverable"}</span>
                  </button>

                  <button
                    onClick={handleDispatchToKanban}
                    disabled={isDispatching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#0075de]/40 bg-[#0075de]/20 hover:bg-[#0075de]/30 text-xs font-semibold text-[#0075de] dark:text-[#60a5fa] transition cursor-pointer disabled:opacity-50"
                  >
                    {isDispatching ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : dispatchedCount ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Layers className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {dispatchedCount ? `${dispatchedCount} Tasks in Kanban` : "Dispatch Tasks to Kanban"}
                    </span>
                  </button>
                </div>

                {dispatchedCount && (
                  <Link
                    href="/kanban"
                    className="text-xs font-semibold text-[#0075de] hover:underline flex items-center gap-1"
                  >
                    <span>View Kanban Board</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              {/* Master Executive Deliverable */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Master Executive Deliverable
                </h4>
                <div className="p-4 rounded-xl bg-card border border-border text-xs text-foreground font-sans leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                  {executionResult.finalDeliverable}
                </div>
              </div>

              {/* Breakdown of Subordinate Deliverables */}
              {executionResult.executionTree.subordinates && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Subordinate Chain-of-Command Reports
                  </h4>
                  <div className="space-y-2">
                    {executionResult.executionTree.subordinates.map((sub, idx) => {
                      const isExpanded = expandedNodes[sub.agentId] ?? false;
                      return (
                        <div
                          key={idx}
                          className="rounded-xl border border-border bg-card/60 overflow-hidden"
                        >
                          <button
                            type="button"
                            onClick={() => toggleNode(sub.agentId)}
                            className="w-full px-4 py-2.5 flex items-center justify-between text-left hover:bg-secondary/30 transition cursor-pointer"
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
                            <div className="p-4 border-t border-border bg-muted/20 text-xs text-foreground font-sans whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">
                              {sub.output}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/20">
          <button
            onClick={() => {
              if (executionResult) {
                setExecutionResult(null);
              } else {
                onClose();
              }
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
          >
            {executionResult ? "New Mission" : "Cancel"}
          </button>

          {!executionResult && (
            <button
              onClick={handleLaunchMission}
              disabled={isRunning || !missionTopic.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-[#0075de] hover:bg-[#0060b8] text-white shadow-md transition cursor-pointer disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Delegating Down Hierarchy...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Deploy A2A Chain of Command</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
