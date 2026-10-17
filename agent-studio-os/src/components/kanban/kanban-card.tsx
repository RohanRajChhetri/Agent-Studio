"use client";

import { useMemo, useState, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Calendar,
  Clock,
  Edit3,
  Trash2,
  CheckCircle2,
  Check,
  Sparkles,
  ArrowRight,
  Loader2,
  Bot,
  Play,
  Layers,
  Zap,
  Split,
} from "lucide-react";
import type { TaskItem, SubtaskItem } from "@/types";
import { PRIORITY_COLORS, PRIORITY_BADGE_CLASSES } from "@/types";

interface KanbanCardProps {
  task: TaskItem;
  onSelect: (task: TaskItem) => void;
  onRun: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (id: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onDeconstruct?: (task: TaskItem) => void;
  isRunning?: boolean;
  isDeconstructing?: boolean;
}

function formatRelativeTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function formatDueDate(dateStr?: string | Date | null): { text: string; isOverdue: boolean } | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isOverdue = d.getTime() < now.getTime() - 86400000;
    const text = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return { text, isOverdue };
  } catch {
    return null;
  }
}

export function KanbanCard({
  task,
  onSelect,
  onRun,
  onEdit,
  onDelete,
  onToggleSubtask,
  onDeconstruct,
  isRunning = false,
  isDeconstructing = false,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityStyle =
    PRIORITY_BADGE_CLASSES[task.priority] || PRIORITY_BADGE_CLASSES.medium;
  const subtasks: SubtaskItem[] = useMemo(() => {
    if (task.subtasks && Array.isArray(task.subtasks) && task.subtasks.length > 0) {
      return task.subtasks;
    }
    if (task.result) {
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
  }, [task.subtasks, task.result]);
  const completedSubtasks = subtasks.filter((s: SubtaskItem) => s.completed).length;
  const dueInfo = formatDueDate(task.dueDate);
  const relTime = formatRelativeTime(task.createdAt);

  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setElapsedSec(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  const liveStage = useMemo(() => {
    if (elapsedSec < 3) return { label: "Grounding vault memory & intent...", pct: 25 };
    if (elapsedSec < 7) return { label: "Synthesizing specialist execution plan...", pct: 50 };
    if (elapsedSec < 12) return { label: "Running agentic tool loop & code verification...", pct: 75 };
    return { label: "Compiling deliverable & saving to vault...", pct: 92 };
  }, [elapsedSec]);

  const isInProgress = task.status === "in_progress" || isRunning;
  const isReview = task.status === "review";
  const isDone = task.status === "done";

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(task)}
      className={`group relative rounded-lg border bg-card transition-colors cursor-pointer select-none ${
        isDragging
          ? "opacity-40 border-primary scale-[0.99]"
          : "border-border hover:border-border/90"
      } ${
        isInProgress
          ? "border-amber-400 dark:border-amber-500/50"
          : isReview
          ? "border-purple-400 dark:border-purple-500/50"
          : isDone
          ? "border-emerald-400 dark:border-emerald-500/50"
          : ""
      }`}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Top Metadata Row */}
        <div className="flex items-center justify-between gap-1.5 text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="p-1 -ml-1 rounded hover:bg-muted text-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing transition-colors"
              title="Drag task"
            >
              <GripVertical className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100" />
            </button>

            {/* Priority Pill */}
            <span
              className={`text-[9.5px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 border ${priorityStyle.badge}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${priorityStyle.dot}`}
              />
              <span>{task.priority}</span>
            </span>

            {/* Due Date */}
            {dueInfo && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono flex items-center gap-1 shrink-0 ${
                  dueInfo.isOverdue
                    ? "bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/50 font-semibold"
                    : "bg-muted/80 text-foreground/80 border border-border dark:bg-secondary dark:text-muted-foreground font-medium"
                }`}
              >
                <Calendar className="w-2.5 h-2.5" />
                <span>{dueInfo.text}</span>
              </span>
            )}
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {relTime && (
              <span className="text-[11px] text-foreground/70 dark:text-muted-foreground font-mono flex items-center gap-1 mr-0.5">
                <Clock className="w-2.5 h-2.5 opacity-70" />
                <span>{relTime}</span>
              </span>
            )}

            {onDeconstruct && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeconstruct(task);
                }}
                disabled={isDeconstructing || isRunning}
                className="p-1 rounded-md text-foreground/70 hover:text-primary hover:bg-primary/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer disabled:opacity-50"
                title="AI Deconstruct into Specialist Subtasks"
                aria-label="AI Deconstruct"
              >
                {isDeconstructing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : (
                  <Split className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(task);
              }}
              className="p-1 rounded-md text-foreground/70 hover:text-foreground hover:bg-secondary transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Edit Task"
              aria-label="Edit Task"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 rounded-md text-foreground/70 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
              title="Delete Task"
              aria-label="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Title */}
        <h4 className="text-xs sm:text-sm font-bold text-foreground leading-snug break-words">
          {task.title}
        </h4>

        {/* Description Snippet */}
        {task.description && (
          <p className="text-[11.5px] text-foreground/75 dark:text-muted-foreground line-clamp-2 leading-relaxed font-normal">
            {task.description}
          </p>
        )}

        {/* Subtasks Progress Micro-Bar (if any) */}
        {subtasks.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-xl bg-secondary/50 dark:bg-secondary/40 border border-border space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span>Subtasks ({completedSubtasks}/{subtasks.length})</span>
              </span>
              <span className="font-mono text-foreground/80 dark:text-muted-foreground font-semibold">
                {Math.round((completedSubtasks / subtasks.length) * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted dark:bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* UNIFIED STATUS INDICATORS (Predictable & Consistent Across All Columns) */}
        {isRunning ? (
          /* Active Multi-Phase Autonomous Reasoning Bar */
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-foreground space-y-1.5 shadow-xs">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-[11px] font-bold text-foreground truncate">
                  {liveStage.label}
                </span>
              </div>
              <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 shrink-0">
                {elapsedSec}s
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-amber-500/20 overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500 rounded-full"
                style={{ width: `${liveStage.pct}%` }}
              />
            </div>
          </div>
        ) : task.status === "in_progress" ? (
          /* Queued In Progress State */
          <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50/70 border border-amber-300/80 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800/50 dark:text-amber-200 text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-[11px] font-medium text-amber-950 dark:text-amber-200">In Progress</span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRun(task);
              }}
              className="text-[10px] font-bold uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white px-2 py-0.5 rounded-md flex items-center gap-1 transition-all cursor-pointer shadow-xs"
              title="Run Agent"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Run</span>
            </button>
          </div>
        ) : isReview ? (
          /* Deliverable Ready Banner */
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
            className="flex items-center justify-between p-2 rounded-xl bg-purple-50 border border-purple-300 text-purple-950 hover:bg-purple-100 dark:bg-purple-950/40 dark:border-purple-700/50 dark:text-purple-200 dark:hover:bg-purple-950/60 transition-all cursor-pointer shadow-xs group/btn"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-700 dark:text-purple-300 shrink-0" />
              <span className="text-[11px] font-bold text-purple-950 dark:text-purple-200">Deliverable Ready</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-200 text-purple-950 dark:bg-purple-800/60 dark:text-purple-200 px-2 py-0.5 rounded-md flex items-center gap-0.5 group-hover/btn:bg-purple-300 dark:group-hover/btn:bg-purple-800/80">
              <span>Inspect</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        ) : isDone ? (
          /* Done & Archived Banner */
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
            className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-700/50 dark:text-emerald-200 dark:hover:bg-emerald-950/60 text-xs transition-all cursor-pointer group/btn"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-300 shrink-0" />
              <span className="text-[11px] font-semibold text-emerald-950 dark:text-emerald-200">Synced to Obsidian Vault</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-200 text-emerald-950 dark:bg-emerald-800/60 dark:text-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-0.5 group-hover/btn:bg-emerald-300 dark:group-hover/btn:bg-emerald-800/80">
              <span>Inspect Deliverable</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        ) : null}

        {/* Footer: Assigned Agent & Primary Action */}
        <div className="pt-2 border-t border-border/80 flex items-center justify-between gap-2 text-xs">
          {/* Agent Pill */}
          <div className="min-w-0">
            {task.agent ? (
              <span className="px-2 py-0.5 rounded-lg bg-muted text-foreground flex items-center gap-1 font-semibold border border-border text-[11px] truncate max-w-[135px]">
                <span className="text-xs shrink-0">{task.agent.avatar}</span>
                <span className="truncate">{task.agent.displayName}</span>
              </span>
            ) : (
              <span className="text-[11px] text-foreground/70 dark:text-muted-foreground font-medium flex items-center gap-1">
                <Bot className="w-3.5 h-3.5 text-foreground/50 dark:text-muted-foreground opacity-70" />
                <span>Unassigned</span>
              </span>
            )}
          </div>

          {/* Primary Action Button */}
          <div onClick={(e) => e.stopPropagation()}>
            {task.status === "backlog" || (task.status === "in_progress" && !isRunning) ? (
              <button
                type="button"
                onClick={() => onRun(task)}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="Execute task autonomously with assigned agent"
              >
                {isRunning ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Play className="w-3 h-3 fill-current" />
                )}
                <span>Run Agent</span>
              </button>
            ) : isRunning ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400 font-semibold">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Executing...</span>
              </span>
            ) : isReview ? (
              <button
                type="button"
                onClick={() => onSelect(task)}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Review Deliverable"
                aria-label="Review Deliverable"
              >
                <span>Review Deliverable</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : isDone ? (
              <button
                type="button"
                onClick={() => onSelect(task)}
                className="flex items-center gap-1 px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
                title="Inspect Completed Deliverable"
                aria-label="Inspect Completed Deliverable"
              >
                <span>Inspect Deliverable</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-[10.5px] text-foreground/70 dark:text-muted-foreground font-mono font-medium">
                {task.status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
