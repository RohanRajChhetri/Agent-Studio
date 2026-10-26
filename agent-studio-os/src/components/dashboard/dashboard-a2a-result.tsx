"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Crown,
  Sparkles,
  Layers,
  Copy,
  Check,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { A2AHierarchyExecutionResult } from "@/types/a2a";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface DashboardA2AResultProps {
  a2aResult: A2AHierarchyExecutionResult | null;
  isA2AExecuting: boolean;
  a2aStep: string;
  onClose: () => void;
  onDispatchToKanban?: () => void;
  dispatchedKanbanCount?: number | null;
  isDispatching?: boolean;
}

export function DashboardA2AResult({
  a2aResult,
  isA2AExecuting,
  a2aStep,
  onClose,
  onDispatchToKanban,
  dispatchedKanbanCount,
  isDispatching = false,
}: DashboardA2AResultProps) {
  const [copiedDeliverable, setCopiedDeliverable] = useState(false);
  const [expandedSubordinates, setExpandedSubordinates] = useState<Record<string, boolean>>({});

  const handleCopy = () => {
    if (!a2aResult?.finalDeliverable) return;
    navigator.clipboard.writeText(a2aResult.finalDeliverable);
    setCopiedDeliverable(true);
    toast.success("Copied Master Deliverable to clipboard");
    setTimeout(() => setCopiedDeliverable(false), 2000);
  };

  const toggleSubordinate = (nodeId: string) => {
    setExpandedSubordinates((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  return (
    <>
      {/* A2A Execution Progress Indicator */}
      {isA2AExecuting && (
        <div className="mt-3 p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2 animate-pulse shadow-2xs">
          <div className="flex items-center justify-between text-xs font-semibold text-primary font-mono">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{a2aStep || "Orchestrating mission across agent hierarchy..."}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/20">
              Pillar 1 Engine
            </span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1 overflow-hidden">
            <div className="bg-primary h-full rounded-full animate-[progress_12s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* A2A Mission Result Panel */}
      <AnimatePresence>
        {a2aResult && !isA2AExecuting && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.99 }}
            className="mt-3 rounded-lg border border-border bg-card overflow-hidden shadow-2xs space-y-4 p-5"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 flex-wrap border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0 shadow-2xs">
                  <Crown className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground font-mono">
                      A2A Chain-of-Command Fulfilled
                    </h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-semibold font-mono border border-primary/20">
                      {a2aResult.totalSubtasks} Subtasks
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mission: &quot;{a2aResult.missionTopic}&quot;
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground px-2 py-1 rounded-sm bg-secondary border border-border">
                  {Math.round(a2aResult.totalLatencyMs / 1000)}s Latency
                </span>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Close result"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Action Toolbar */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-secondary hover:bg-muted text-xs font-semibold text-foreground transition cursor-pointer shadow-2xs"
                >
                  {copiedDeliverable ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedDeliverable ? "Copied" : "Copy Deliverable"}</span>
                </button>

                {onDispatchToKanban && (
                  <button
                    type="button"
                    onClick={onDispatchToKanban}
                    disabled={isDispatching}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  >
                    {isDispatching ? (
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
                )}
              </div>

              {dispatchedKanbanCount && (
                <Link
                  href="/kanban"
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 font-mono"
                >
                  <span>Open Kanban Board</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              )}
            </div>

            {/* Master Executive Deliverable */}
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Master Executive Deliverable (Synthesized by {a2aResult.orchestratorName})</span>
              </h4>
              <div className="p-4 rounded-md bg-secondary/30 border border-border text-xs leading-relaxed max-h-80 overflow-y-auto">
                <MarkdownRenderer content={a2aResult.finalDeliverable} />
              </div>
            </div>

            {/* Subordinate Deliverables Breakdown */}
            {a2aResult.executionTree.subordinates && a2aResult.executionTree.subordinates.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">
                  Subordinate Chain-of-Command Reports ({a2aResult.executionTree.subordinates.length})
                </h4>
                <div className="space-y-2">
                  {a2aResult.executionTree.subordinates.map((sub, idx) => {
                    const isExpanded = expandedSubordinates[sub.agentId] ?? false;
                    return (
                      <div
                        key={idx}
                        className="rounded-md border border-border bg-card overflow-hidden shadow-2xs"
                      >
                        <button
                          type="button"
                          onClick={() => toggleSubordinate(sub.agentId)}
                          className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-muted/40 transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 text-xs">
                            <span className="relative inline-flex shrink-0">
                              <AgentAvatar avatar={sub.avatar} className="w-4 h-4 text-primary shrink-0" />
                              <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-card" />
                            </span>
                            <span className="font-bold text-foreground">{sub.agentName}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-sm bg-secondary text-muted-foreground font-mono border border-border">
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
    </>
  );
}
