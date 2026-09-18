"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  X,
  Calendar,
  GripVertical,
  Loader2,
  Filter,
  Play,
  CheckCircle2,
  Sparkles,
  FileText,
  Copy,
  ArrowRight,
  HelpCircle,
  ChevronDown,
  Info,
  Check,
  RotateCcw,
  ExternalLink,
  Bot,
  ListTodo,
  Zap,
  Search,
  Clock,
  Trash2,
  Edit3,
  Layers,
  Split,
  ChevronRight,
  FolderDown,
  AlertCircle,
  CornerDownLeft,
  Brain,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { TaskItem, AgentProfile, SubtaskItem } from "@/types";
import { KANBAN_COLUMNS, PRIORITY_COLORS } from "@/types";
import { formatResponseTime } from "@/lib/utils";

// --- Helpers ---

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

function formatDueDate(dateStr?: string | Date | null): { text: string; isOverdue: boolean; isSoon: boolean } | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const isOverdue = d.getTime() < now.getTime() - 86400000;
    const isSoon = !isOverdue && d.getTime() - now.getTime() < 86400000 * 2;
    const text = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return { text, isOverdue, isSoon };
  } catch {
    return null;
  }
}

function getTaskSubtasks(task: TaskItem): SubtaskItem[] {
  if (task.subtasks && task.subtasks.length > 0) return task.subtasks;
  if (task.result) {
    try {
      const parsed = JSON.parse(task.result);
      if (Array.isArray(parsed.subtasks)) return parsed.subtasks;
    } catch {
      // not json
    }
  }
  return [];
}

const COLUMN_META = {
  backlog: {
    label: "Backlog",
    subtitle: "Tasks waiting for execution",
    icon: ListTodo,
    color: "text-slate-400",
    border: "border-slate-500/20",
    badge: "bg-secondary text-foreground",
    accent: "bg-slate-500",
  },
  in_progress: {
    label: "In Progress",
    subtitle: "Autonomous specialists executing",
    icon: Zap,
    color: "text-amber-400",
    border: "border-amber-500/30",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    accent: "bg-amber-500",
  },
  review: {
    label: "Review",
    subtitle: "Deliverables ready to inspect",
    icon: Search,
    color: "text-purple-400",
    border: "border-purple-500/30",
    badge: "bg-purple-500/15 text-purple-300 border-purple-500/30",
    accent: "bg-purple-500",
  },
  done: {
    label: "Done",
    subtitle: "Synced to Obsidian Vault",
    icon: CheckCircle2,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    accent: "bg-emerald-500",
  },
};

// --- Sortable Task Card ---

function SortableTaskCard({
  task,
  onDelete,
  onRun,
  onRunSwarm,
  onDecompose,
  onSelect,
  onMoveStatus,
  onToggleSubtask,
  isRunning,
  isSwarmRunning,
  isDecomposing,
}: {
  task: TaskItem;
  onDelete: (id: string) => void;
  onRun: (task: TaskItem) => void;
  onRunSwarm: (task: TaskItem) => void;
  onDecompose: (task: TaskItem) => void;
  onSelect: (task: TaskItem) => void;
  onMoveStatus: (id: string, status: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  isRunning?: boolean;
  isSwarmRunning?: boolean;
  isDecomposing?: boolean;
}) {
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

  const priorityColor =
    PRIORITY_COLORS[task.priority as keyof typeof PRIORITY_COLORS] || "#6b7280";
  const subtasks = getTaskSubtasks(task);
  const completedCount = subtasks.filter((s) => s.completed).length;
  const dueInfo = formatDueDate(task.dueDate);
  const relTime = formatRelativeTime(task.createdAt);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-xl border bg-card/85 backdrop-blur-md transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer ${
        isDragging
          ? "opacity-40 border-primary shadow-xl scale-[0.98]"
          : "border-border hover:border-border/90 hover:bg-card"
      } ${isRunning || isSwarmRunning ? "ring-1 ring-amber-500/40" : ""}`}
      onClick={() => onSelect(task)}
    >
      <div className="p-3.5 space-y-2.5">
        {/* Top Meta: Drag handle, Priority, Due Date, Timestamp */}
        <div className="flex items-center justify-between gap-1.5 text-[11px]">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              className="p-1 -ml-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-colors"
              title="Drag card"
            >
              <GripVertical className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
            </button>

            {/* Priority Tag */}
            <span
              className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0"
              style={{
                backgroundColor: `${priorityColor}18`,
                color: priorityColor,
                border: `1px solid ${priorityColor}35`,
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: priorityColor }} />
              {task.priority}
            </span>

            {/* Due Date Alert */}
            {dueInfo && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-1 shrink-0 ${
                  dueInfo.isOverdue
                    ? "bg-red-500/15 text-red-400 border border-red-500/30"
                    : dueInfo.isSoon
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                    : "bg-secondary text-muted-foreground border border-border"
                }`}
                title={dueInfo.isOverdue ? "Overdue" : "Due date"}
              >
                <Calendar className="w-2.5 h-2.5" />
                {dueInfo.text}
              </span>
            )}
          </div>

          {/* Creation Timestamp */}
          <div className="flex items-center gap-1.5 shrink-0">
            {relTime && (
              <span
                className="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5"
                title={`Created: ${new Date(task.createdAt).toLocaleString()}`}
              >
                <Clock className="w-2.5 h-2.5 opacity-60" />
                {relTime}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id);
              }}
              className="p-1 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
              title="Delete task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Task Title */}
        <h4 className="text-xs sm:text-sm font-semibold text-foreground leading-snug break-words">
          {task.title}
        </h4>

        {/* Description snippet */}
        {task.description && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}

        {/* Interactive Subtasks Progress */}
        {subtasks.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="p-2.5 rounded-lg bg-secondary/40 border border-border/70 space-y-1.5"
          >
            <div className="flex items-center justify-between text-[10px]">
              <span className="font-semibold text-foreground flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-primary" />
                <span>Subtasks</span>
                <span className="text-muted-foreground font-mono font-normal">
                  ({completedCount}/{subtasks.length})
                </span>
              </span>
              <span className="font-mono text-muted-foreground">
                {Math.round((completedCount / subtasks.length) * 100)}%
              </span>
            </div>

            {/* Micro Progress Bar */}
            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
              />
            </div>

            {/* Top 2 Subtasks Preview with Quick Toggles */}
            <div className="space-y-1 pt-0.5">
              {subtasks.slice(0, 2).map((st) => (
                <div
                  key={st.id}
                  onClick={() => onToggleSubtask && onToggleSubtask(task.id, st.id)}
                  className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer py-0.5 group/item"
                >
                  <div
                    className={`w-3 h-3 rounded flex items-center justify-center shrink-0 border transition-colors ${
                      st.completed
                        ? "bg-emerald-500 border-emerald-500 text-white"
                        : "border-border bg-card group-hover/item:border-primary"
                    }`}
                  >
                    {st.completed && <Check className="w-2 h-2 stroke-[3]" />}
                  </div>
                  <span
                    className={`truncate flex-1 ${
                      st.completed ? "line-through opacity-60 text-muted-foreground" : ""
                    }`}
                  >
                    {st.title}
                  </span>
                </div>
              ))}
              {subtasks.length > 2 && (
                <p className="text-[10px] text-muted-foreground/80 pl-4 font-mono">
                  +{subtasks.length - 2} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Deliverable Ready Banner */}
        {task.result && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onSelect(task);
            }}
            className="flex items-center justify-between p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer group/deliv shadow-sm"
          >
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-[11px] font-bold text-emerald-300">Deliverable Ready</span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-0.5 group-hover/deliv:bg-emerald-500/30 transition-colors">
              <span>Inspect</span>
              <ArrowRight className="w-2.5 h-2.5" />
            </span>
          </div>
        )}

        {/* In Progress Pulsing Status */}
        {task.status === "in_progress" && !task.result && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300">
            <Loader2 className="w-3 h-3 animate-spin text-amber-400 shrink-0" />
            <span className="text-[11px] font-medium animate-pulse">
              Autonomous execution running...
            </span>
          </div>
        )}

        {/* Card Footer: Agent Assigned & Quick Actions */}
        <div className="pt-2 border-t border-border flex items-center justify-between gap-1.5 text-xs">
          {/* Agent Pill */}
          <div className="min-w-0">
            {task.agent ? (
              <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-foreground flex items-center gap-1 font-medium border border-border/80 text-[11px] max-w-[130px] truncate">
                {task.agent.avatar && task.agent.avatar !== "🤖" ? (
                  <span className="text-xs shrink-0">{task.agent.avatar}</span>
                ) : (
                  <Bot className="w-3 h-3 text-primary shrink-0" />
                )}
                <span className="truncate font-semibold">{task.agent.displayName}</span>
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Unassigned</span>
            )}
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Quick Run Agent */}
            <button
              onClick={() => onRun(task)}
              disabled={isRunning || isSwarmRunning}
              title="Run assigned specialist agent on this task"
              className="p-1 rounded-md border border-border hover:border-primary/40 bg-secondary/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
            </button>

            {/* Quick Run Swarm */}
            <button
              onClick={() => onRunSwarm(task)}
              disabled={isRunning || isSwarmRunning}
              title="Run multi-agent swarm pipeline"
              className="p-1 rounded-md border border-border hover:border-amber-500/40 bg-secondary/60 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-400 transition-all disabled:opacity-50"
            >
              {isSwarmRunning ? (
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
              ) : (
                <Sparkles className="w-3 h-3 text-amber-400" />
              )}
            </button>

            {/* Quick Deconstruct */}
            <button
              onClick={() => onDecompose(task)}
              disabled={isDecomposing}
              title="Deconstruct task into subtasks via AI"
              className="p-1 rounded-md border border-border hover:border-indigo-500/40 bg-secondary/60 hover:bg-indigo-500/10 text-muted-foreground hover:text-primary transition-all disabled:opacity-50"
            >
              {isDecomposing ? (
                <Loader2 className="w-3 h-3 animate-spin text-primary" />
              ) : (
                <Split className="w-3 h-3" />
              )}
            </button>

            {/* Move to next/prev column select */}
            <select
              value={task.status}
              onChange={(e) => onMoveStatus(task.id, e.target.value)}
              aria-label="Move task status"
              className="bg-secondary/90 text-muted-foreground hover:text-foreground border border-border rounded-md px-1 py-0.5 text-[10px] outline-none cursor-pointer [&>option]:bg-card [&>option]:text-foreground max-w-[85px]"
            >
              <option value="backlog">Backlog</option>
              <option value="in_progress">In Prog</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Kanban Column ---

function KanbanColumn({
  column,
  tasks,
  onDeleteTask,
  onRunTask,
  onRunSwarm,
  onDecompose,
  onSelectTask,
  onMoveStatus,
  onToggleSubtask,
  onQuickAdd,
  runningTaskId,
  runningSwarmTaskId,
  decomposingTaskId,
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  tasks: TaskItem[];
  onDeleteTask: (id: string) => void;
  onRunTask: (task: TaskItem) => void;
  onRunSwarm: (task: TaskItem) => void;
  onDecompose: (task: TaskItem) => void;
  onSelectTask: (task: TaskItem) => void;
  onMoveStatus: (id: string, status: string) => void;
  onToggleSubtask?: (taskId: string, subtaskId: string) => void;
  onQuickAdd: (status: string, title: string) => void;
  runningTaskId: string | null;
  runningSwarmTaskId: string | null;
  decomposingTaskId?: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const meta = COLUMN_META[column.id as keyof typeof COLUMN_META] || COLUMN_META.backlog;
  const ColumnIcon = meta.icon;

  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isQuickAdding && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isQuickAdding]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickTitle.trim()) {
      onQuickAdd(column.id, quickTitle.trim());
      setQuickTitle("");
      setIsQuickAdding(false);
    }
  };

  return (
    <div className="flex flex-col min-h-[70vh] rounded-2xl border border-border/80 bg-secondary/30 backdrop-blur-md p-3">
      {/* Column Header */}
      <div className="mb-3 px-1 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${meta.border} bg-secondary/80`}>
            <ColumnIcon className={`w-4 h-4 ${meta.color}`} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-bold text-foreground truncate">{meta.label}</h3>
              <span className="text-[10px] text-muted-foreground font-mono px-1.5 py-0.2 rounded-full bg-secondary border border-border font-semibold">
                {tasks.length}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground truncate">{meta.subtitle}</p>
          </div>
        </div>

        {/* Column Action: Quick Add Button */}
        <button
          onClick={() => setIsQuickAdding((prev) => !prev)}
          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
            isQuickAdding
              ? "bg-primary text-white border-primary"
              : "border-border hover:border-border/80 bg-secondary/60 text-muted-foreground hover:text-foreground"
          }`}
          title={`Quick add task to ${meta.label}`}
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Inline Quick-Add Card */}
      {isQuickAdding && (
        <form
          onSubmit={handleQuickSubmit}
          className="mb-3 p-3 rounded-xl border border-primary/40 bg-card shadow-lg space-y-2 animate-in fade-in zoom-in-95 duration-150"
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Task title... (Enter to add, Esc to cancel)"
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsQuickAdding(false);
                setQuickTitle("");
              }
            }}
            className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
          />
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-[10px] text-muted-foreground">Press Enter to save</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setIsQuickAdding(false);
                  setQuickTitle("");
                }}
                className="px-2 py-1 rounded text-muted-foreground hover:text-foreground text-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="px-2.5 py-1 rounded bg-primary text-white font-semibold disabled:opacity-50 text-[10px] flex items-center gap-1"
              >
                <span>Add</span>
                <CornerDownLeft className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Droppable Container */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl transition-all p-1 space-y-2.5 min-h-[220px] ${
          isOver
            ? "border-2 border-dashed border-primary/60 bg-primary/5 ring-4 ring-primary/10"
            : ""
        }`}
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          <AnimatePresence>
            {tasks.map((task) => (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
              >
                <SortableTaskCard
                  task={task}
                  onDelete={onDeleteTask}
                  onRun={onRunTask}
                  onRunSwarm={onRunSwarm}
                  onDecompose={onDecompose}
                  onSelect={onSelectTask}
                  onMoveStatus={onMoveStatus}
                  onToggleSubtask={onToggleSubtask}
                  isRunning={runningTaskId === task.id}
                  isSwarmRunning={runningSwarmTaskId === task.id}
                  isDecomposing={decomposingTaskId === task.id}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {tasks.length === 0 && !isQuickAdding && (
            <div
              onClick={() => setIsQuickAdding(true)}
              className="flex flex-col items-center justify-center h-36 rounded-xl border border-dashed border-border/80 text-xs text-muted-foreground gap-2 text-center p-4 hover:border-primary/50 hover:bg-card/40 transition-colors cursor-pointer"
            >
              <ColumnIcon className={`w-5 h-5 opacity-40 ${meta.color}`} />
              <span className="text-[11px]">Drop task here or click to + Add</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

// --- Main Page Component ---

export default function KanbanPage() {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Filters & Search
  const [filterAgent, setFilterAgent] = useState<string>("");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Running execution states
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [runningSwarmTaskId, setRunningSwarmTaskId] = useState<string | null>(null);
  const [decomposingTaskId, setDecomposingTaskId] = useState<string | null>(null);

  // Deliverable drawer code execution states
  const [taskCodeOutputs, setTaskCodeOutputs] = useState<
    Record<string, { stdout: string; stderr: string; time: number; running: boolean }>
  >({});
  const [reflecting, setReflecting] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);

  // Create Task Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newDueDate, setNewDueDate] = useState("");
  const [newStatus, setNewStatus] = useState("backlog");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch Tasks and Agents
  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, agentsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/agents"),
      ]);
      const [tasksData, agentsData] = await Promise.all([
        tasksRes.json(),
        agentsRes.json(),
      ]);
      setTasks(tasksData);
      setAgents(agentsData);
    } catch (error) {
      console.error("Error fetching kanban data:", error);
      toast.error("Failed to load Kanban board");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Drag & Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const task = tasks.find((t) => t.id === activeId);
    if (!task) return;

    let targetStatus = task.status;
    const isOverColumn = KANBAN_COLUMNS.some((c) => c.id === overId);

    if (isOverColumn) {
      targetStatus = overId as TaskItem["status"];
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (task.status !== targetStatus) {
      const originalStatus = task.status;
      setTasks((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, status: targetStatus } : t))
      );

      try {
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: activeId, status: targetStatus }),
        });

        if (!res.ok) {
          throw new Error("Failed to update status");
        }

        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === activeId ? updated : t)));
        toast.success(`Task moved to ${targetStatus.replace("_", " ")}`);
      } catch {
        setTasks((prev) =>
          prev.map((t) => (t.id === activeId ? { ...t, status: originalStatus } : t))
        );
        toast.error("Failed to update task status");
      }
    }
  };

  // Move status via quick select
  const handleMoveStatus = async (id: string, status: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: status as any } : t))
    );
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(`Task moved to ${status.replace("_", " ")}`);
      }
    } catch {
      toast.error("Failed to move task");
    }
  };

  // Quick Add task in column
  const handleQuickAdd = async (status: string, title: string) => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          status,
          priority: "medium",
        }),
      });
      if (!res.ok) throw new Error("Failed to add task");
      const created = await res.json();
      setTasks((prev) => [...prev, created]);
      toast.success(`Task added to ${status.replace("_", " ")}`);
    } catch {
      toast.error("Failed to create task");
    }
  };

  // Full Create Task Modal
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDesc.trim(),
          agentId: newAgent || null,
          priority: newPriority,
          dueDate: newDueDate || null,
          status: newStatus,
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      const task = await res.json();
      setTasks((prev) => [...prev, task]);
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      setNewAgent("");
      setNewPriority("medium");
      setNewDueDate("");
      setNewStatus("backlog");
      toast.success(`Task "${task.title}" created`);
    } catch {
      toast.error("Failed to create task");
    }
  };

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  // Run Task with Single Agent
  const handleRunTask = async (task: TaskItem) => {
    setRunningTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Agent executed task! Deliverable is ready in Review.`);
        setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        toast.error(data.error || "Task execution failed");
      }
    } catch {
      toast.error("Failed to trigger task execution");
    } finally {
      setRunningTaskId(null);
    }
  };

  // Run Swarm Pipeline
  const handleRunSwarm = async (task: TaskItem) => {
    setRunningSwarmTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/swarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Swarm pipeline finished! Collective deliverable saved.");
        setTasks((prev) => prev.map((t) => (t.id === task.id ? data.task : t)));
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        toast.error(data.error || "Swarm execution failed");
      }
    } catch {
      toast.error("Failed to run swarm pipeline");
    } finally {
      setRunningSwarmTaskId(null);
    }
  };

  // AI Task Deconstruct / Decomposition
  const handleDecompose = async (task: TaskItem) => {
    setDecomposingTaskId(task.id);
    try {
      const res = await fetch("/api/tasks/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: task.id,
          title: task.title,
          description: task.description,
          agents,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to decompose task");

      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, subtasks: data.subtasks } : t
        )
      );
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) => (prev ? { ...prev, subtasks: data.subtasks } : null));
      }
      toast.success(`Generated ${data.subtasks.length} specialist subtasks!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to decompose task");
    } finally {
      setDecomposingTaskId(null);
    }
  };

  // Toggle Subtask
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    let updatedSubtasks: SubtaskItem[] = [];
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const currentSubtasks = getTaskSubtasks(t);
        const updated = currentSubtasks.map((st) =>
          st.id === subtaskId ? { ...st, completed: !st.completed } : st
        );
        updatedSubtasks = updated;
        return { ...t, subtasks: updated };
      })
    );

    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) => (prev ? { ...prev, subtasks: updatedSubtasks } : null));
    }

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          result: JSON.stringify({ subtasks: updatedSubtasks }),
        }),
      });
    } catch {
      toast.error("Failed to update subtask");
    }
  };

  // Agent Self-Reflection / Revision
  const handleReflect = async (taskId: string) => {
    if (!feedbackText.trim()) {
      toast.error("Please enter critique feedback for the agent to revise");
      return;
    }
    setReflecting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: feedbackText.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Agent reflected and updated deliverable!");
        setTasks((prev) => prev.map((t) => (t.id === taskId ? data.task : t)));
        setSelectedTask(data.task);
        setShowFeedbackInput(false);
        setFeedbackText("");
      } else {
        toast.error(data.error || "Self-reflection failed");
      }
    } catch {
      toast.error("Failed to request revision");
    } finally {
      setReflecting(false);
    }
  };

  // Open specific task deliverable note in desktop Obsidian
  const handleOpenTaskInObsidian = async (task: TaskItem) => {
    toast.info("Opening note in desktop Obsidian...");
    try {
      const slug = (task.title || "task")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const taskFile = `tasks/${slug}.md`;
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_obsidian",
          path: taskFile,
          title: task.title,
          content: task.result || task.description,
          agentName: task.agent?.displayName,
        }),
      });
      const data = await res.json();
      if (data.success || data.opened) {
        toast.success(`Note opened in Obsidian! (${taskFile})`);
      } else if (data.uri) {
        window.location.href = data.uri;
      } else {
        toast.error(data.error || "Could not launch Obsidian");
      }
    } catch {
      toast.error("Could not trigger Obsidian protocol");
    }
  };

  // Seed Starter Tasks
  const handleSeed = async () => {
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      const data = await res.json();
      setTasks(data);
      toast.success("Loaded starter Kanban tasks with agent assignments!");
    } catch {
      toast.error("Failed to seed starter tasks");
    }
  };

  // Filter & Search Logic
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterAgent && t.agentId !== filterAgent) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesTitle = t.title.toLowerCase().includes(query);
        const matchesDesc = (t.description || "").toLowerCase().includes(query);
        const matchesAgent = (t.agent?.displayName || "").toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc && !matchesAgent) return false;
      }
      return true;
    });
  }, [tasks, filterAgent, filterPriority, searchQuery]);

  // Executive KPI Counts
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProg = tasks.filter((t) => t.status === "in_progress").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const backlog = tasks.filter((t) => t.status === "backlog").length;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, inProg, review, done, backlog, rate };
  }, [tasks]);

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 inline-flex items-center gap-1.5 shadow-sm">
              <Sparkles className="w-3 h-3 text-primary" />
              Autonomous Pipeline
            </span>
            {(runningTaskId || runningSwarmTaskId) && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 font-mono animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Execution in Flight
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Autonomous Kanban Board
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Orchestrate autonomous agent missions, execute code tasks, and sync deliverables to your Obsidian memory vault.
          </p>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {tasks.length === 0 && (
            <button
              onClick={handleSeed}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all cursor-pointer shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Load Starter Tasks</span>
            </button>
          )}

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Tasks */}
        <div className="p-3.5 rounded-2xl border border-border bg-card/60 backdrop-blur-md flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Total Missions</p>
            <h4 className="text-xl font-bold text-foreground mt-0.5">{stats.total}</h4>
          </div>
          <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground border border-border">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* In Progress */}
        <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/[0.04] backdrop-blur-md flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium text-amber-300">In Execution</p>
              {stats.inProg > 0 && <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />}
            </div>
            <h4 className="text-xl font-bold text-amber-300 mt-0.5">{stats.inProg}</h4>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Zap className="w-4 h-4" />
          </div>
        </div>

        {/* Review Deliverables */}
        <div className="p-3.5 rounded-2xl border border-purple-500/30 bg-purple-500/[0.04] backdrop-blur-md flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] font-medium text-purple-300">Deliverables in Review</p>
            <h4 className="text-xl font-bold text-purple-300 mt-0.5">{stats.review}</h4>
          </div>
          <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Search className="w-4 h-4" />
          </div>
        </div>

        {/* Completed & Synced */}
        <div className="p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] backdrop-blur-md flex items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-medium text-emerald-300">Done & Vault Synced</p>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">({stats.rate}%)</span>
            </div>
            <h4 className="text-xl font-bold text-emerald-300 mt-0.5">{stats.done}</h4>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Control & Filter Toolbar */}
      <div className="p-3 rounded-2xl border border-border bg-card/70 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search missions by title, instructions, or specialist..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 rounded-xl border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Agent Filter */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border bg-secondary/60 text-xs">
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={filterAgent}
              onChange={(e) => setFilterAgent(e.target.value)}
              aria-label="Filter tasks by agent"
              className="bg-transparent border-none outline-none text-xs text-foreground cursor-pointer font-medium"
            >
              <option value="" className="bg-card">All Specialists</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id} className="bg-card">
                  {a.avatar} {a.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter Pills */}
          <div className="flex items-center gap-1 bg-secondary/60 p-0.5 rounded-xl border border-border text-[11px]">
            {["all", "high", "medium", "low"].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition-all cursor-pointer ${
                  filterPriority === p
                    ? "bg-card text-foreground font-semibold shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Reset Filters */}
          {(searchQuery || filterAgent || filterPriority !== "all") && (
            <button
              onClick={() => {
                setSearchQuery("");
                setFilterAgent("");
                setFilterPriority("all");
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Kanban Columns Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Loading autonomous mission matrix...</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                tasks={filteredTasks.filter((t) => t.status === col.id)}
                onDeleteTask={handleDeleteTask}
                onRunTask={handleRunTask}
                onRunSwarm={handleRunSwarm}
                onDecompose={handleDecompose}
                onSelectTask={setSelectedTask}
                onMoveStatus={handleMoveStatus}
                onToggleSubtask={handleToggleSubtask}
                onQuickAdd={handleQuickAdd}
                runningTaskId={runningTaskId}
                runningSwarmTaskId={runningSwarmTaskId}
                decomposingTaskId={decomposingTaskId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <div className="w-[280px] p-3 rounded-xl border border-primary bg-card/95 shadow-2xl backdrop-blur-xl">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Moving {activeTask.status.replace("_", " ")}
                </span>
                <h4 className="text-xs font-semibold text-foreground mt-1 truncate">
                  {activeTask.title}
                </h4>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Task Details & Deliverable Slide-over Drawer */}
      <AnimatePresence>
        {selectedTask && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedTask(null)}
          >
            <motion.div
              initial={{ x: "100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-2xl bg-card border-l border-border h-full shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="p-5 border-b border-border flex items-center justify-between bg-secondary/40 shrink-0">
                <div className="space-y-1 min-w-0 flex-1 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: `${PRIORITY_COLORS[selectedTask.priority as keyof typeof PRIORITY_COLORS] || "#6b7280"}20`,
                        color: PRIORITY_COLORS[selectedTask.priority as keyof typeof PRIORITY_COLORS] || "#6b7280",
                      }}
                    >
                      {selectedTask.priority}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono uppercase font-semibold">
                      {selectedTask.status.replace("_", " ")}
                    </span>
                    {selectedTask.createdAt && (
                      <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Created {formatRelativeTime(selectedTask.createdAt)}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold text-foreground leading-snug break-words">
                    {selectedTask.title}
                  </h2>
                </div>

                <button
                  onClick={() => setSelectedTask(null)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* Description */}
                {selectedTask.description && (
                  <div className="p-3.5 rounded-xl bg-secondary/40 border border-border space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Mission Brief
                    </span>
                    <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {selectedTask.description}
                    </p>
                  </div>
                )}

                {/* Assigned Specialist & Execution Bar */}
                <div className="p-4 rounded-xl bg-secondary/40 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                      {selectedTask.agent?.avatar && selectedTask.agent.avatar !== "🤖" ? (
                        <span className="text-xl">{selectedTask.agent.avatar}</span>
                      ) : (
                        <Bot className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        {selectedTask.agent?.displayName || "Unassigned Specialist"}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        Role: {selectedTask.agent?.role || "Specialist"} &bull; Hermes: {selectedTask.agent?.name || "default"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleRunTask(selectedTask)}
                      disabled={runningTaskId === selectedTask.id || runningSwarmTaskId === selectedTask.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-sm cursor-pointer"
                    >
                      {runningTaskId === selectedTask.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current" />
                      )}
                      <span>{selectedTask.result ? "Re-run Agent" : "Execute Task"}</span>
                    </button>

                    <button
                      onClick={() => handleRunSwarm(selectedTask)}
                      disabled={runningTaskId === selectedTask.id || runningSwarmTaskId === selectedTask.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                      title="Run with specialist swarm"
                    >
                      {runningSwarmTaskId === selectedTask.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>Swarm</span>
                    </button>
                  </div>
                </div>

                {/* Subtasks Section */}
                {(() => {
                  const subtasks = getTaskSubtasks(selectedTask);
                  if (subtasks.length === 0) return null;
                  return (
                    <div className="space-y-2.5 p-4 rounded-xl border border-border bg-secondary/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-primary" />
                          <span>Subtask Directives ({subtasks.filter((s) => s.completed).length}/{subtasks.length})</span>
                        </span>
                      </div>

                      <div className="space-y-1.5 pt-1">
                        {subtasks.map((st) => (
                          <div
                            key={st.id}
                            onClick={() => handleToggleSubtask(selectedTask.id, st.id)}
                            className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border hover:border-primary/50 cursor-pointer transition-all"
                          >
                            <div
                              className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                st.completed
                                  ? "bg-emerald-500 border-emerald-500 text-white"
                                  : "border-border bg-secondary"
                              }`}
                            >
                              {st.completed && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span
                              className={`text-xs flex-1 ${
                                st.completed ? "line-through text-muted-foreground opacity-60" : "text-foreground font-medium"
                              }`}
                            >
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Deliverable Section */}
                {selectedTask.result ? (
                  <div className="space-y-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.03]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                          Verified Deliverable
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(selectedTask.result || "");
                            toast.success("Deliverable copied to clipboard!");
                          }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border hover:border-border text-xs text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </button>

                        <button
                          onClick={() => handleOpenTaskInObsidian(selectedTask)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 text-xs font-medium transition-all cursor-pointer"
                          title="Open specific deliverable note in desktop Obsidian"
                        >
                          <FolderDown className="w-3.5 h-3.5" />
                          <span>Open in Obsidian</span>
                        </button>

                        <Link
                          href="/memory"
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                          title="View Obsidian Memory Galaxy Graph"
                        >
                          <Brain className="w-3.5 h-3.5" />
                          <span>Memory Graph</span>
                        </Link>
                      </div>
                    </div>

                    {/* Formatted Markdown Output */}
                    <div className="p-4 rounded-xl bg-card border border-border text-xs text-foreground leading-relaxed whitespace-pre-wrap font-sans overflow-x-auto">
                      {selectedTask.result}
                    </div>

                    {/* Critique & Revision Feedback Box */}
                    <div className="pt-2 border-t border-border/80 space-y-2">
                      <button
                        onClick={() => setShowFeedbackInput((prev) => !prev)}
                        className="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Request Revision / Provide Critique</span>
                      </button>

                      {showFeedbackInput && (
                        <div className="space-y-2 pt-1">
                          <textarea
                            placeholder="Enter critique, revisions, or missing elements for the agent to refine..."
                            value={feedbackText}
                            onChange={(e) => setFeedbackText(e.target.value)}
                            rows={3}
                            className="w-full p-2.5 rounded-xl border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setShowFeedbackInput(false)}
                              className="px-3 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleReflect(selectedTask.id)}
                              disabled={reflecting || !feedbackText.trim()}
                              className="flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                              {reflecting ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              <span>Submit Critique & Reflect</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-2">
                    <Sparkles className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                    <p className="text-xs font-semibold text-foreground">Mission Not Executed Yet</p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Click &quot;Execute Task&quot; above to have {selectedTask.agent?.displayName || "a specialist agent"} autonomously process tools, reasoning, and synthesis.
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Full Create Task Modal */}
      <AnimatePresence>
        {showCreate && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Create New Task Mission</h3>
                    <p className="text-[10px] text-muted-foreground">Assign objective to autonomous fleet</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Task Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Research competitor pricing models"
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground mb-1 block">
                    Mission Instructions & Details
                  </label>
                  <textarea
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="What specific tools, deliverables, or analysis should the agent perform?"
                    rows={3}
                    className="w-full px-3.5 py-2 rounded-xl border border-border bg-secondary/50 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Assign Specialist
                    </label>
                    <select
                      value={newAgent}
                      onChange={(e) => setNewAgent(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="">None (Unassigned)</option>
                      {agents.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.avatar} {a.displayName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Priority
                    </label>
                    <select
                      value={newPriority}
                      onChange={(e) => setNewPriority(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Initial Column
                    </label>
                    <select
                      value={newStatus}
                      onChange={(e) => setNewStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="backlog">Backlog</option>
                      <option value="in_progress">In Progress</option>
                      <option value="review">Review</option>
                      <option value="done">Done</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground mb-1 block">
                      Due Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={newDueDate}
                      onChange={(e) => setNewDueDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-border flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                  >
                    Create Task
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
