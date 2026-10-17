"use client";

import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Plus,
  X,
  ListTodo,
  Zap,
  Search,
  CheckCircle2,
  CornerDownLeft,
} from "lucide-react";
import type { TaskItem } from "@/types";
import { KanbanCard } from "./kanban-card";

export interface ColumnDefinition {
  id: "backlog" | "in_progress" | "review" | "done";
  label: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  border: string;
  badge: string;
}

export const KANBAN_COLUMN_DEFS: ColumnDefinition[] = [
  {
    id: "backlog",
    label: "Backlog",
    subtitle: "Tasks waiting for execution",
    icon: ListTodo,
    color: "text-slate-700 dark:text-slate-300",
    border: "border-slate-300 dark:border-slate-700",
    badge: "bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800/80 dark:text-slate-200 dark:border-slate-700 font-bold",
  },
  {
    id: "in_progress",
    label: "In Progress",
    subtitle: "Autonomous specialists executing",
    icon: Zap,
    color: "text-amber-700 dark:text-amber-400",
    border: "border-amber-300 dark:border-amber-600/40",
    badge: "bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/50 font-bold",
  },
  {
    id: "review",
    label: "Review",
    subtitle: "Deliverables ready to inspect",
    icon: Search,
    color: "text-purple-700 dark:text-purple-400",
    border: "border-purple-300 dark:border-purple-600/40",
    badge: "bg-purple-100 text-purple-950 border border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-700/50 font-bold",
  },
  {
    id: "done",
    label: "Done",
    subtitle: "Synced to Obsidian Vault",
    icon: CheckCircle2,
    color: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-300 dark:border-emerald-600/40",
    badge: "bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700/50 font-bold",
  },
];

interface KanbanColumnProps {
  column: ColumnDefinition;
  tasks: TaskItem[];
  onSelectTask: (task: TaskItem) => void;
  onRunTask: (task: TaskItem) => void;
  onEditTask: (task: TaskItem) => void;
  onDeleteTask: (id: string) => void;
  onQuickAdd: (status: string, title: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onDeconstructTask?: (task: TaskItem) => void;
  runningTaskId?: string | null;
  deconstructingTaskId?: string | null;
}

export function KanbanColumn({
  column,
  tasks,
  onSelectTask,
  onRunTask,
  onEditTask,
  onDeleteTask,
  onQuickAdd,
  onToggleSubtask,
  onDeconstructTask,
  runningTaskId,
  deconstructingTaskId,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    onQuickAdd(column.id, quickTitle.trim());
    setQuickTitle("");
    setIsQuickAdding(false);
  };

  const Icon = column.icon;

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 rounded-xl border border-border bg-card p-3 sm:p-4 space-y-2.5 min-w-[280px] sm:min-w-[300px] flex-1 overflow-hidden shadow-xs">
      {/* Column Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-md bg-muted border border-border ${column.color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                {column.label}
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${column.badge}`}>
                {tasks.length}
              </span>
            </div>
            <p className="text-[11px] text-foreground/75 dark:text-muted-foreground line-clamp-1 font-medium">
              {column.subtitle}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsQuickAdding(!isQuickAdding)}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          title={`Quick add task to ${column.label}`}
          aria-label={`Quick add task to ${column.label}`}
        >
          {isQuickAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Quick Add Input Form */}
      {isQuickAdding && (
        <form
          onSubmit={handleQuickSubmit}
          className="p-2.5 rounded-xl border border-primary/40 bg-card shadow-lg space-y-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={`Task title in ${column.label}...`}
            autoFocus
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border">
            <button
              type="button"
              onClick={() => {
                setIsQuickAdding(false);
                setQuickTitle("");
              }}
              className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-2.5 py-1 rounded bg-primary text-primary-foreground font-bold text-[10px] flex items-center gap-1 shadow-sm disabled:opacity-40 cursor-pointer"
            >
              <span>Add Task</span>
              <CornerDownLeft className="w-2.5 h-2.5" />
            </button>
          </div>
        </form>
      )}

      {/* Droppable & Sortable Card Container */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-xl p-1 space-y-2.5 transition-all overflow-y-auto overscroll-contain pr-1.5 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 ${
          isOver
            ? "border-2 border-dashed border-primary/50 bg-primary/5 ring-4 ring-primary/10"
            : ""
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onSelect={onSelectTask}
              onRun={onRunTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              onToggleSubtask={onToggleSubtask}
              onDeconstruct={onDeconstructTask}
              isRunning={runningTaskId === task.id}
              isDeconstructing={deconstructingTaskId === task.id}
            />
          ))}

          {tasks.length === 0 && !isQuickAdding && (
            <div
              onClick={() => setIsQuickAdding(true)}
              className="flex flex-col items-center justify-center h-40 rounded-xl border border-dashed border-border/80 text-xs text-foreground/70 dark:text-muted-foreground gap-2 text-center p-4 hover:border-primary/50 hover:bg-card/40 transition-colors cursor-pointer select-none"
            >
              <Icon className={`w-5 h-5 opacity-60 ${column.color}`} />
              <span className="text-[11.5px] font-semibold text-foreground/80 dark:text-muted-foreground">+ Add New Task</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
