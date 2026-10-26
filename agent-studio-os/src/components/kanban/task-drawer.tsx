"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Play,
  CheckCircle2,
  Sparkles,
  Calendar,
  Bot,
  Copy,
  Check,
  ExternalLink,
  Split,
  RefreshCw,
  Loader2,
  Trash2,
  Maximize2,
  Minimize2,
  FileText,
  CheckSquare,
  Layers,
  Edit3,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskItem, SubtaskItem } from "@/types";
import { PRIORITY_COLORS, PRIORITY_BADGE_CLASSES } from "@/types";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { AgentAvatar } from "@/components/ui/agent-avatar";


interface TaskDrawerProps {
  task: TaskItem | null;
  onClose: () => void;
  onRunTask: (task: TaskItem) => void;
  onSwarmTask?: (task: TaskItem) => void;
  onReflectTask?: (task: TaskItem, feedback: string) => void;
  onApproveTask: (task: TaskItem) => void;
  onReviseTask?: (task: TaskItem, feedback: string) => Promise<void> | void;
  onRejectTask?: (task: TaskItem, reason: string) => Promise<void> | void;
  onDeconstructTask: (task: TaskItem) => void;
  onDeleteTask: (id: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  isRunning?: boolean;
  isSwarming?: boolean;
  isReflecting?: boolean;
  isDeconstructing?: boolean;
  isRevising?: boolean;
}

export function TaskDrawer({
  task,
  onClose,
  onRunTask,
  onSwarmTask,
  onReflectTask,
  onApproveTask,
  onReviseTask,
  onRejectTask,
  onDeconstructTask,
  onDeleteTask,
  onUpdateStatus,
  onToggleSubtask,
  isRunning = false,
  isSwarming = false,
  isReflecting = false,
  isDeconstructing = false,
  isRevising = false,
}: TaskDrawerProps) {
  const [copiedResult, setCopiedResult] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [critiqueInput, setCritiqueInput] = useState("");
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Clean and parse markdown result in case it was stored as a JSON envelope
  const cleanResult = useMemo(() => {
    if (!task?.result) return "";
    const raw = task.result.trim();
    if (raw.startsWith("{") && raw.endsWith("}")) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null) {
          if (typeof parsed.originalResult === "string") return parsed.originalResult;
          if (typeof parsed.content === "string") return parsed.content;
          if (typeof parsed.result === "string") return parsed.result;
          if (typeof parsed.text === "string") return parsed.text;
          if (typeof parsed.deliverable === "string") return parsed.deliverable;
          if (Array.isArray(parsed.subtasks)) return "";
        }
      } catch {
        // Fallback to raw
      }
    }
    return raw;
  }, [task?.result]);

  const priorityStyle =
    PRIORITY_BADGE_CLASSES[task?.priority || "medium"] || PRIORITY_BADGE_CLASSES.medium;

  // Extract subtasks from task object or envelope in result
  const subtasks: SubtaskItem[] = useMemo(() => {
    if (task?.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      return task.subtasks;
    }
    if (task?.result) {
      const raw = task.result.trim();
      if (raw.startsWith("{") && raw.endsWith("}")) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed?.subtasks) && parsed.subtasks.length > 0) {
            return parsed.subtasks;
          }
        } catch {}
      }
    }
    return [];
  }, [task?.subtasks, task?.result]);

  const completedSubtasks = subtasks.filter((s: SubtaskItem) => s.completed).length;

  if (!task) return null;

  const handleCopy = () => {
    if (!cleanResult) return;
    navigator.clipboard.writeText(cleanResult);
    setCopiedResult(true);
    toast.success("Deliverable copied to clipboard");
    setTimeout(() => setCopiedResult(false), 2000);
  };

  const handleOpenObsidian = async () => {
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_obsidian",
          title: task.title,
          content: cleanResult || task.description,
          agentName: task.agent?.displayName || "Agent",
        }),
      });
      if (res.ok) {
        toast.success("Opened in desktop Obsidian");
      } else {
        toast.info("Task deliverable ready in vault tasks/");
      }
    } catch {
      toast.info("Task deliverable ready in vault tasks/");
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
        />

        {/* Modal Window Container (Linear / Jira spacious centered inspector) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 14 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={`relative z-10 flex flex-col bg-card/95 backdrop-blur-2xl border border-border shadow-2xl overflow-hidden transition-all duration-300 ${
            isMaximized
              ? "fixed inset-0 w-full h-full rounded-none"
              : "w-full max-w-5xl lg:max-w-6xl h-[92vh] max-h-[920px] rounded-2xl"
          }`}
        >
          {/* Modal Header */}
          <div className="px-4 sm:px-6 py-3.5 border-b border-border/80 flex items-center justify-between gap-4 bg-secondary/30 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1 flex-wrap">
              {/* Priority Pill */}
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1.5 shrink-0 border ${priorityStyle.badge}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`}
                />
                <span>{task.priority}</span>
              </span>

              {/* Status Pill */}
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-secondary border border-border text-foreground font-mono shrink-0">
                {task.status.replace("_", " ")}
              </span>

              {task.dueDate && (
                <span className="text-[11px] text-foreground/80 dark:text-muted-foreground flex items-center gap-1 font-mono shrink-0 font-medium">
                  <Calendar className="w-3 h-3 text-muted-foreground" />
                  <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                </span>
              )}

              <span className="text-muted-foreground/40 hidden sm:inline">•</span>

              {/* Task Title */}
              <h3 className="text-sm sm:text-base font-bold text-foreground truncate min-w-0 flex-1">
                {task.title}
              </h3>
            </div>

            {/* Header Controls */}
            <div className="flex items-center gap-2 shrink-0">
              {cleanResult && (
                <>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy Deliverable"
                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary transition cursor-pointer"
                  >
                    {copiedResult ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">
                      {copiedResult ? "Copied" : "Copy"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenObsidian}
                    title="Open deliverable in Obsidian Vault"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/90 px-2.5 py-1.5 rounded-lg bg-primary/10 border border-primary/25 hover:bg-primary/20 transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Open in Vault</span>
                  </button>
                </>
              )}

              {/* Maximize / Restore Toggle */}
              <button
                type="button"
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? "Restore window" : "Maximize view"}
                className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                {isMaximized ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={onClose}
                title="Close Inspector (Esc)"
                className="p-1.5 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Two-Column Inspector Layout */}
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Left / Main Column: Deliverable Markdown & Objective */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-7 space-y-6">
              {/* Deliverable Section (Shown if result exists) */}
              {cleanResult ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">
                          Agent Deliverable Output
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Completed by {task.agent?.displayName || "Specialist Agent"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-foreground/80 dark:text-muted-foreground px-2 py-0.5 rounded-md bg-secondary border border-border font-medium">
                        {cleanResult.split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                  </div>

                  {/* Clean Markdown Document Renderer */}
                  <div className="p-5 sm:p-6 rounded-2xl bg-card border border-purple-500/20 shadow-sm text-foreground leading-relaxed">
                    <MarkdownRenderer content={cleanResult} />
                  </div>
                </div>
              ) : isRunning || isSwarming ? (
                <div className="p-8 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700/50 dark:text-amber-200 text-center space-y-3">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-700 dark:text-amber-400" />
                  <h4 className="text-base font-bold text-amber-950 dark:text-amber-200">Autonomous Execution in Progress</h4>
                  <p className="text-xs text-amber-900/90 dark:text-amber-300/90 max-w-md mx-auto leading-relaxed">
                    The assigned agent specialist is currently processing directives, retrieving context, and assembling the final deliverable.
                  </p>
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-secondary/20 border border-dashed border-border text-center space-y-3">
                  <div className="p-3 rounded-full bg-secondary text-foreground/70 dark:text-muted-foreground w-12 h-12 mx-auto flex items-center justify-center">
                    <Sparkles className="w-5 h-5 opacity-70" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">
                      {task.status === "in_progress" ? "Task Queued in In Progress" : "No Deliverable Generated Yet"}
                    </h4>
                    <p className="text-xs text-foreground/75 dark:text-muted-foreground max-w-sm mx-auto mt-1">
                      Trigger autonomous execution to have the specialist agent analyze the requirements and produce the completed deliverable.
                    </p>
                  </div>
                  {(task.status === "backlog" || task.status === "in_progress") && (
                    <button
                      type="button"
                      onClick={() => onRunTask(task)}
                      disabled={isRunning || isSwarming}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute Task Now</span>
                    </button>
                  )}
                </div>
              )}

              {/* Task Objective / Requirements */}
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-foreground/60 dark:text-muted-foreground" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/75 dark:text-muted-foreground">
                    Objective & Requirements
                  </h4>
                </div>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/80 text-xs sm:text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                  {task.description || "No specific instructions provided."}
                </div>
              </div>
            </div>

            {/* Right / Sidebar Column: Specialist, Actions, Subtasks & Metadata */}
            <div className="w-full lg:w-80 xl:w-88 shrink-0 border-t lg:border-t-0 lg:border-l border-border/80 bg-secondary/20 flex flex-col min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4">
              {/* Primary Actions Card */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground/75 dark:text-muted-foreground">
                  Workflow Status & Actions
                </h5>

                {task.status === "review" && (
                  <div className="space-y-2.5">
                    {/* Primary Approval Button */}
                    <button
                      type="button"
                      onClick={() => onApproveTask(task)}
                      disabled={submittingReview || isRunning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Move to Done</span>
                    </button>

                    {/* Secondary Review Actions: Request Revision & Reject */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowRevisionForm((prev) => !prev);
                          setShowRejectForm(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          showRevisionForm
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300"
                            : "border-border bg-secondary hover:bg-secondary/80 text-foreground"
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Request Revision</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setShowRejectForm((prev) => !prev);
                          setShowRevisionForm(false);
                        }}
                        className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                          showRejectForm
                            ? "bg-red-500/20 border-red-500/40 text-red-700 dark:text-red-300"
                            : "border-border bg-secondary hover:bg-secondary/80 text-foreground"
                        }`}
                      >
                        <X className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        <span>Reject Deliverable</span>
                      </button>
                    </div>

                    {/* Revision Form */}
                    {showRevisionForm && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2 animate-fadeIn">
                        <label className="text-[11px] font-bold text-amber-800 dark:text-amber-300 block">
                          Reviewer Critique & Feedback:
                        </label>
                        <textarea
                          value={revisionFeedback}
                          onChange={(e) => setRevisionFeedback(e.target.value)}
                          placeholder="Specify changes needed (e.g. 'Add unit test cases', 'Shorten executive summary')..."
                          rows={3}
                          className="w-full text-xs p-2 rounded-lg bg-background border border-border focus:ring-1 focus:ring-amber-500 focus:outline-none resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowRevisionForm(false)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!revisionFeedback.trim() || submittingReview || isRevising}
                            onClick={async () => {
                              if (!revisionFeedback.trim()) return;
                              setSubmittingReview(true);
                              try {
                                if (onReviseTask) {
                                  await onReviseTask(task, revisionFeedback.trim());
                                  setShowRevisionForm(false);
                                  setRevisionFeedback("");
                                }
                              } finally {
                                setSubmittingReview(false);
                              }
                            }}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            {submittingReview || isRevising ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            <span>Submit to Agent</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reject Form */}
                    {showRejectForm && (
                      <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2 animate-fadeIn">
                        <label className="text-[11px] font-bold text-red-800 dark:text-red-300 block">
                          Reason for Rejection:
                        </label>
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason (e.g. Scope changed, off-target)..."
                          className="w-full text-xs p-2 rounded-lg bg-background border border-border focus:ring-1 focus:ring-red-500 focus:outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowRejectForm(false)}
                            className="px-2.5 py-1 text-xs rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={!rejectReason.trim() || submittingReview}
                            onClick={async () => {
                              if (!rejectReason.trim()) return;
                              setSubmittingReview(true);
                              try {
                                if (onRejectTask) {
                                  await onRejectTask(task, rejectReason.trim());
                                  setShowRejectForm(false);
                                  setRejectReason("");
                                }
                              } finally {
                                setSubmittingReview(false);
                              }
                            }}
                            className="px-3 py-1 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-500 text-white flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Return to Backlog</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Re-run and Swarm Options */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/40">
                      <button
                        type="button"
                        onClick={() => onRunTask(task)}
                        disabled={isRunning || isSwarming}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer disabled:opacity-50"
                      >
                        {isRunning ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Re-run Agent</span>
                      </button>

                      {onSwarmTask && (
                        <button
                          type="button"
                          onClick={() => onSwarmTask(task)}
                          disabled={isRunning || isSwarming}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                          title="Run Multi-Agent Swarm Pipeline"
                        >
                          {isSwarming ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Layers className="w-3.5 h-3.5" />
                          )}
                          <span>Run Swarm</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {task.status === "backlog" && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => onRunTask(task)}
                      disabled={isRunning || isSwarming}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                    >
                      {isRunning ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4 fill-current" />
                      )}
                      <span>Run Agent Now</span>
                    </button>

                    {onSwarmTask && (
                      <button
                        type="button"
                        onClick={() => onSwarmTask(task)}
                        disabled={isRunning || isSwarming}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#e6f3fe] dark:bg-purple-950/30 text-[#0075de] dark:text-purple-300 border border-[#0075de]/30 dark:border-purple-500/30 hover:bg-[#e6f3fe]/80 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                        title="Collaborative multi-agent swarm pipeline"
                      >
                        {isSwarming ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Layers className="w-3.5 h-3.5" />
                        )}
                        <span>Run Multi-Agent Swarm</span>
                      </button>
                    )}
                  </div>
                )}

                {task.status === "in_progress" && (
                  <div className="space-y-2">
                    {isRunning || isSwarming ? (
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 dark:bg-amber-950/40 dark:border-amber-700/50 dark:text-amber-200 flex items-center gap-2 text-xs">
                        <Loader2 className="w-4 h-4 animate-spin shrink-0 text-amber-700 dark:text-amber-400" />
                        <span className="font-semibold">{isSwarming ? "Multi-Agent Swarm running..." : "Autonomous agent running..."}</span>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => onRunTask(task)}
                          disabled={isRunning || isSwarming}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-md transition cursor-pointer disabled:opacity-50"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Run Agent Now</span>
                        </button>

                        {onSwarmTask && (
                          <button
                            type="button"
                            onClick={() => onSwarmTask(task)}
                            disabled={isRunning || isSwarming}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#e6f3fe] dark:bg-purple-950/30 text-[#0075de] dark:text-purple-300 border border-[#0075de]/30 dark:border-purple-500/30 hover:bg-[#e6f3fe]/80 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                            title="Collaborative multi-agent swarm pipeline"
                          >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Run Multi-Agent Swarm</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onUpdateStatus(task.id, "backlog")}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Return to Backlog</span>
                        </button>
                      </>
                    )}
                  </div>
                )}

                {task.status === "done" && (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 dark:bg-emerald-950/40 dark:border-emerald-700/50 dark:text-emerald-200 flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    <div>
                      <p className="font-bold">Task Completed</p>
                      <p className="text-[10.5px] text-emerald-900/80 dark:text-emerald-300/80 font-medium">Synced to Obsidian Vault</p>
                    </div>
                  </div>
                )}

                {/* AI Self-Reflection & Critique Box */}
                {cleanResult && onReflectTask && (
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border shadow-xs space-y-2.5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-primary" />
                      <span className="text-[11px] font-bold text-foreground">AI Critique & Self-Reflection</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Submit feedback or select a preset to have the agent reflect, self-correct, and upgrade to v2.
                    </p>

                    <div className="flex flex-wrap gap-1">
                      {[
                        "Make it more technical",
                        "Add edge cases & tests",
                        "Sharpen executive summary",
                        "Tighten formatting",
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setCritiqueInput(preset)}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border transition cursor-pointer"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1.5">
                      <textarea
                        value={critiqueInput}
                        onChange={(e) => setCritiqueInput(e.target.value)}
                        placeholder="Enter critique or refinement instructions..."
                        rows={2}
                        className="w-full p-2 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-sans"
                      />
                      <button
                        type="button"
                        disabled={isReflecting || !critiqueInput.trim()}
                        onClick={() => {
                          if (critiqueInput.trim() && onReflectTask) {
                            onReflectTask(task, critiqueInput.trim());
                            setCritiqueInput("");
                          }
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition cursor-pointer disabled:opacity-50"
                      >
                        {isReflecting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        <span>Reflect & Upgrade (v2)</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Move Status Directly */}
                <div className="pt-2 border-t border-border/80">
                  <label className="text-[10px] uppercase font-bold text-muted-foreground block mb-1.5">
                    Move Column:
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { id: "backlog", label: "Backlog" },
                      { id: "in_progress", label: "In Progress" },
                      { id: "review", label: "Review" },
                      { id: "done", label: "Done" },
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => onUpdateStatus(task.id, st.id)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-medium transition border cursor-pointer ${
                          task.status === st.id
                            ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                            : "bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground border-border"
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Assigned Specialist Card */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2.5">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Assigned Specialist
                </h5>
                {task.agent ? (
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-secondary border border-border text-primary flex items-center justify-center">
                      <AgentAvatar avatar={task.agent.avatar} className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-bold text-foreground block truncate">
                        {task.agent.displayName || task.agent.name}
                      </span>
                      <span className="text-[11px] text-foreground/70 dark:text-muted-foreground block truncate font-medium">
                        {task.agent.role}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-lg bg-secondary/50 border border-dashed border-border text-center text-xs text-foreground/70 dark:text-muted-foreground flex items-center justify-center gap-1.5 font-medium">
                    <Bot className="w-3.5 h-3.5 opacity-70" />
                    <span>No specialist assigned</span>
                  </div>
                )}
              </div>

              {/* Subtasks Milestones */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-foreground/60 dark:text-muted-foreground" />
                    <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground/75 dark:text-muted-foreground">
                      Subtasks
                    </h5>
                    {subtasks.length > 0 && (
                      <span className="text-[10.5px] font-mono font-bold text-primary">
                        ({completedSubtasks}/{subtasks.length})
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeconstructTask(task)}
                    disabled={isDeconstructing}
                    className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer disabled:opacity-50"
                    title="Break task into actionable specialist milestones"
                  >
                    {isDeconstructing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Split className="w-3 h-3" />
                    )}
                    <span>AI Deconstruct</span>
                  </button>
                </div>

                {/* Progress Bar */}
                {subtasks.length > 0 && (
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300"
                      style={{
                        width: `${(completedSubtasks / subtasks.length) * 100}%`,
                      }}
                    />
                  </div>
                )}

                {subtasks.length > 0 ? (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {subtasks.map((st: SubtaskItem) => (
                      <div
                        key={st.id}
                        onClick={() => onToggleSubtask && onToggleSubtask(task.id, st.id)}
                        className="p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 flex items-start gap-2.5 text-xs transition-all cursor-pointer group/st"
                      >
                        <div
                          className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center border shrink-0 transition-colors ${
                            st.completed
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-border bg-card group-hover/st:border-primary"
                          }`}
                        >
                          {st.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span
                              className={`font-semibold text-foreground text-[11.5px] leading-snug ${
                                st.completed ? "line-through opacity-60 text-muted-foreground" : ""
                              }`}
                            >
                              {st.title}
                            </span>
                            {st.agentName && (
                              <span className="text-[10px] text-foreground/75 dark:text-muted-foreground bg-muted border border-border px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-1.5">
                                <AgentAvatar avatar={st.agentAvatar} className="w-3 h-3 text-primary shrink-0" />
                                <span className="truncate max-w-[85px]">{st.agentName}</span>
                              </span>
                            )}
                          </div>
                          {st.description && (
                            <p className="text-[10.5px] text-foreground/70 dark:text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                              {st.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3.5 rounded-xl bg-secondary/20 border border-dashed border-border text-center space-y-2">
                    <p className="text-[11px] text-foreground/70 dark:text-muted-foreground italic">
                      No milestones yet. Click below to deconstruct into specialist steps.
                    </p>
                    <button
                      type="button"
                      onClick={() => onDeconstructTask(task)}
                      disabled={isDeconstructing}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                    >
                      {isDeconstructing ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Split className="w-3.5 h-3.5" />
                      )}
                      <span>AI Deconstruct Task</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Task Details & Metadata */}
              <div className="p-4 rounded-xl bg-card border border-border shadow-sm space-y-2 text-xs">
                <h5 className="text-[11px] font-bold uppercase tracking-wider text-foreground/75 dark:text-muted-foreground mb-2">
                  Metadata
                </h5>

                <div className="flex items-center justify-between text-foreground/75 dark:text-muted-foreground font-medium">
                  <span>Priority</span>
                  <span className="font-semibold text-foreground capitalize">
                    {task.priority}
                  </span>
                </div>

                {task.dueDate && (
                  <div className="flex items-center justify-between text-foreground/75 dark:text-muted-foreground font-medium">
                    <span>Due Date</span>
                    <span className="font-mono text-foreground font-semibold">
                      {new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-foreground/75 dark:text-muted-foreground font-medium">
                  <span>Task ID</span>
                  <span className="font-mono text-[10.5px] text-foreground/60 dark:text-muted-foreground/70 truncate max-w-[120px]">
                    {task.id}
                  </span>
                </div>
              </div>

              {/* Delete Task */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Are you sure you want to delete this task?")) {
                      onDeleteTask(task.id);
                      onClose();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl border border-destructive/20 bg-destructive/5 hover:bg-destructive/15 text-destructive text-xs font-semibold transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Task</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
