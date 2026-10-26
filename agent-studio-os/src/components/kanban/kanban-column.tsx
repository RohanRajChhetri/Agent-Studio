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
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import type { TaskItem } from "@/types";
import { KanbanCard } from "./kanban-card";

export interface ColumnDefinition {
  id: "backlog" | "in_progress" | "review" | "done";
  label: string;
  icon: React.ElementType;
  color: string;
  border: string;
  badge: string;
}

export const KANBAN_COLUMN_DEFS: ColumnDefinition[] = [
  {
    id: "backlog",
    label: "Backlog",
    icon: ListTodo,
    color: "text-muted-foreground",
    border: "border-border",
    badge: "bg-secondary text-muted-foreground border-border",
  },
  {
    id: "in_progress",
    label: "In Progress",
    icon: Zap,
    color: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
  {
    id: "review",
    label: "Review",
    icon: Search,
    color: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/20",
    badge: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
  },
  {
    id: "done",
    label: "Done",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
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
  isSelectionMode?: boolean;
  selectedTaskIds?: Set<string>;
  onToggleSelect?: (taskId: string, e: React.MouseEvent) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: (columnId: string) => void;
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
  isSelectionMode = false,
  selectedTaskIds = new Set(),
  onToggleSelect,
  isCollapsed = false,
  onToggleCollapse,
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

  // Render slim collapsed column
  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => onToggleCollapse?.(column.id)}
        className="flex flex-col items-center justify-between h-full max-h-full py-4 px-1 rounded-lg border border-border bg-card hover:bg-muted/40 transition-all w-12 min-w-[48px] shrink-0 cursor-pointer select-none group shadow-2xs"
        title={`Click to expand ${column.label}`}
      >
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse?.(column.id);
            }}
            className="p-1 rounded-md text-muted-foreground group-hover:text-foreground group-hover:bg-muted transition"
            title="Expand column"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
          <div className={`p-1.5 rounded-md bg-muted/80 ${column.color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <span className={`px-1.5 py-0.5 rounded-sm text-[10px] font-mono font-bold border ${column.badge}`}>
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center justify-center [writing-mode:vertical-rl] rotate-180 py-4">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground group-hover:text-foreground transition-colors">
            {column.label}
          </span>
        </div>

        <div className="w-1.5 h-6 rounded-full bg-border/60 group-hover:bg-primary/40 transition-colors" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 rounded-lg border border-border bg-card p-3 sm:p-3.5 space-y-2 min-w-[270px] sm:min-w-[290px] flex-1 overflow-hidden shadow-2xs">
      {/* Column Header (Clean & Minimal: Icon, Label, Count, Actions) */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md bg-muted/80 border border-border/50 shrink-0 ${column.color}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {column.label}
          </h3>
          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-semibold font-mono border ${column.badge}`}>
            {tasks.length}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsQuickAdding(!isQuickAdding)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={`Quick add task to ${column.label}`}
            aria-label={`Quick add task to ${column.label}`}
          >
            {isQuickAdding ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          </button>

          {onToggleCollapse && (
            <button
              type="button"
              onClick={() => onToggleCollapse(column.id)}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title={`Collapse ${column.label} column`}
              aria-label={`Collapse ${column.label} column`}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick Add Inline Form */}
      {isQuickAdding && (
        <form
          onSubmit={handleQuickSubmit}
          className="p-2.5 rounded-lg border border-border bg-card shadow-xs space-y-2 animate-in fade-in zoom-in-95 duration-100"
        >
          <input
            type="text"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            placeholder={`Task title in ${column.label}...`}
            autoFocus
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
          />
          <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                setIsQuickAdding(false);
                setQuickTitle("");
              }}
              className="px-2 py-0.5 rounded-md text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!quickTitle.trim()}
              className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold text-[10px] flex items-center gap-1 shadow-2xs disabled:opacity-40 cursor-pointer"
            >
              <span>Add</span>
              <CornerDownLeft className="w-2.5 h-2.5" />
            </button>
          </div>
        </form>
      )}

      {/* Droppable & Sortable Card Container */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-0 rounded-lg p-1 space-y-2.5 transition-all overflow-y-auto overscroll-contain pr-1 scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/30 ${
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
              isSelectionMode={isSelectionMode}
              isSelected={selectedTaskIds.has(task.id)}
              onToggleSelect={onToggleSelect}
            />
          ))}

          {tasks.length === 0 && !isQuickAdding && (
            <div
              onClick={() => setIsQuickAdding(true)}
              className="flex flex-col items-center justify-center h-32 rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground gap-1.5 text-center p-4 hover:border-primary/40 hover:bg-card/40 transition-colors cursor-pointer select-none"
            >
              <Icon className={`w-4 h-4 opacity-40 ${column.color}`} />
              <span className="text-[11px] font-medium text-muted-foreground">+ Add Task</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
