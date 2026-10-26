"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Search,
  Filter,
  Trash2,
  Sparkles,
  Bot,
  Zap,
  CheckCircle2,
  RefreshCw,
  CheckSquare,
  Square,
  ArrowUpDown,
  X,
  Play,
  MoveRight,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import type { TaskItem, AgentProfile } from "@/types";
import {
  KanbanColumn,
  KANBAN_COLUMN_DEFS,
} from "@/components/kanban/kanban-column";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { TaskDrawer } from "@/components/kanban/task-drawer";
import { CreateTaskModal } from "@/components/kanban/create-task-modal";
import {
  playTaskStartedSound,
  playTaskCompletedSound,
  playWarningSound,
} from "@/lib/sound-effects";

type SortOption = "position" | "priority" | "dueDate" | "newest" | "oldest";
type QuickFilterOption = "all" | "urgent_high" | "due_soon" | "has_deliverable" | "unassigned";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export default function KanbanPage() {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("position");
  const [quickFilter, setQuickFilter] = useState<QuickFilterOption>("all");

  // Interaction & Selection State
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<string>("backlog");
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Collapsed columns state (persists per session)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("agent_studio_collapsed_cols");
        if (saved) return new Set(JSON.parse(saved));
      } catch {}
    }
    return new Set<string>();
  });

  // Task execution states
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [swarmingTaskId, setSwarmingTaskId] = useState<string | null>(null);
  const [reflectingTaskId, setReflectingTaskId] = useState<string | null>(null);
  const [deconstructingTaskId, setDeconstructingTaskId] = useState<string | null>(null);
  const [revisingTaskId, setRevisingTaskId] = useState<string | null>(null);
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  // Toggle column collapse
  const handleToggleCollapse = (colId: string) => {
    setCollapsedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      try {
        localStorage.setItem("agent_studio_collapsed_cols", JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  // dnd-kit sensors: 8px threshold prevents accidental drag when clicking buttons/links
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

  // Fetch initial data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [tasksRes, agentsRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/agents"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(Array.isArray(data) ? data : []);
      }
      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch {
      toast.error("Failed to load Kanban workspace data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    fetchData();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("new") === "true") {
        setShowCreateModal(true);
      }
    }
  }, [fetchData]);

  // Drag & Drop Handlers
  const handleDragStart = (event: DragStartEvent) => {
    if (isSelectionMode) return;
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over || isSelectionMode) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Determine target column status
    const targetColumn = KANBAN_COLUMN_DEFS.find((col) => col.id === overId);
    let targetStatus: string | null = null;

    if (targetColumn) {
      targetStatus = targetColumn.id;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (!targetStatus) return;

    const currentTask = tasks.find((t) => t.id === activeId);
    if (!currentTask || currentTask.status === targetStatus) return;

    const originalStatus = currentTask.status;

    // Optimistically update
    setTasks((prev) =>
      prev.map((t) => (t.id === activeId ? { ...t, status: targetStatus as any } : t))
    );
    if (selectedTask?.id === activeId) {
      setSelectedTask((prev) => (prev ? { ...prev, status: targetStatus as any } : null));
    }

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeId, status: targetStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");

      const updated = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === activeId ? updated : t)));
      if (selectedTask?.id === activeId) {
        setSelectedTask(updated);
      }
      toast.success(`Task moved to ${targetStatus.replace("_", " ")}`);
    } catch {
      // Rollback on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === activeId ? { ...t, status: originalStatus } : t))
      );
      if (selectedTask?.id === activeId) {
        setSelectedTask((prev) => (prev ? { ...prev, status: originalStatus } : null));
      }
      toast.error("Failed to move task");
    }
  };

  // Run Task with Autonomous Agent
  const handleRunTask = async (task: TaskItem) => {
    const originalStatus = task.status;
    setRunningTaskId(task.id);
    playTaskStartedSound();

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "in_progress", result: null } : t
      )
    );
    if (selectedTask?.id === task.id) {
      setSelectedTask((prev) =>
        prev ? { ...prev, status: "in_progress", result: null } : null
      );
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        playTaskCompletedSound();
        toast.success("Agent finished execution! Deliverable ready in Review.");
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? data.task : t))
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        playWarningSound();
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: originalStatus, result: task.result } : t
          )
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask((prev) =>
            prev ? { ...prev, status: originalStatus, result: task.result } : null
          );
        }
        toast.error(data.error || "Execution failed");
      }
    } catch {
      playWarningSound();
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: originalStatus, result: task.result } : t
        )
      );
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) =>
          prev ? { ...prev, status: originalStatus, result: task.result } : null
        );
      }
      toast.error("Execution network error");
    } finally {
      setRunningTaskId(null);
    }
  };

  // Approve Deliverable -> Move to Done via Review API
  const handleApproveTask = async (task: TaskItem) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });

      if (!res.ok) throw new Error("Failed to approve task");

      const data = await res.json();
      const updated = data.task || { ...task, status: "done" };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask(updated);
      }
      toast.success("Deliverable approved & synced to Obsidian Vault (`tasks/`)");
    } catch {
      toast.error("Failed to approve deliverable");
    }
  };

  // Request Revision with Human Critique
  const handleReviseTask = async (task: TaskItem, feedback: string) => {
    setRevisingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revise",
          feedback,
          autoExecute: true,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit revision");
      }

      const data = await res.json();
      const updated = data.task || task;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask(updated);
      }
      toast.success("Specialist agent revised deliverable addressing your feedback!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit revision");
    } finally {
      setRevisingTaskId(null);
    }
  };

  // Reject Deliverable -> Move to Backlog with Reason
  const handleRejectTask = async (task: TaskItem, reason: string) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reject",
          reason,
        }),
      });

      if (!res.ok) throw new Error("Failed to reject task");

      const data = await res.json();
      const updated = data.task || { ...task, status: "backlog" };
      setTasks((prev) => prev.map((t) => (t.id === task.id ? updated : t)));
      if (selectedTask?.id === task.id) {
        setSelectedTask(updated);
      }
      toast.info(`Task returned to Backlog: ${reason}`);
    } catch {
      toast.error("Failed to reject deliverable");
    }
  };

  // Run Collaborative Multi-Agent Swarm
  const handleSwarmTask = async (task: TaskItem) => {
    const originalStatus = task.status;
    setSwarmingTaskId(task.id);

    setTasks((prev) =>
      prev.map((t) =>
        t.id === task.id ? { ...t, status: "in_progress", result: null } : t
      )
    );
    if (selectedTask?.id === task.id) {
      setSelectedTask((prev) =>
        prev ? { ...prev, status: "in_progress", result: null } : null
      );
    }

    try {
      const res = await fetch(`/api/tasks/${task.id}/swarm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(`Swarm pipeline completed with ${data.steps?.length || "multiple"} agents! Moved to Review.`);
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? data.task : t))
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, status: originalStatus, result: task.result } : t
          )
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask((prev) =>
            prev ? { ...prev, status: originalStatus, result: task.result } : null
          );
        }
        toast.error(data.error || "Swarm execution failed");
      }
    } catch {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, status: originalStatus, result: task.result } : t
        )
      );
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) =>
          prev ? { ...prev, status: originalStatus, result: task.result } : null
        );
      }
      toast.error("Swarm network error");
    } finally {
      setSwarmingTaskId(null);
    }
  };

  // Run AI Self-Reflection & Critique
  const handleReflectTask = async (task: TaskItem, feedback: string) => {
    setReflectingTaskId(task.id);
    try {
      const res = await fetch(`/api/tasks/${task.id}/reflect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("AI Agent self-reflected and upgraded deliverable to v2!");
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? data.task : t))
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        toast.error(data.error || "Reflection failed");
      }
    } catch {
      toast.error("Reflection network error");
    } finally {
      setReflectingTaskId(null);
    }
  };

  // Deconstruct task with AI
  const handleDeconstructTask = async (task: TaskItem) => {
    setDeconstructingTaskId(task.id);
    playTaskStartedSound();
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
      if (!res.ok) throw new Error(data.error || "Failed to deconstruct task");

      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, subtasks: data.subtasks } : t))
      );
      if (selectedTask?.id === task.id) {
        setSelectedTask((prev) =>
          prev ? { ...prev, subtasks: data.subtasks } : null
        );
      }
      playTaskCompletedSound();
      toast.success(`Generated ${data.subtasks.length} specialist subtasks!`);
    } catch (err: any) {
      playWarningSound();
      toast.error(err.message || "Failed to deconstruct task");
    } finally {
      setDeconstructingTaskId(null);
    }
  };

  // Toggle individual subtask completion status
  const handleToggleSubtask = async (taskId: string, subtaskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    if (!targetTask) return;

    const currentSubtasks = targetTask.subtasks || [];
    const updatedSubtasks = currentSubtasks.map((st) =>
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, subtasks: updatedSubtasks } : t))
    );
    if (selectedTask?.id === taskId) {
      setSelectedTask((prev) =>
        prev ? { ...prev, subtasks: updatedSubtasks } : null
      );
    }

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          subtasks: updatedSubtasks,
        }),
      });
    } catch {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, subtasks: currentSubtasks } : t))
      );
      if (selectedTask?.id === taskId) {
        setSelectedTask((prev) =>
          prev ? { ...prev, subtasks: currentSubtasks } : null
        );
      }
      toast.error("Failed to update milestone status");
    }
  };

  // Quick Add inside column
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
      if (!res.ok) throw new Error("Failed to create task");
      const created = await res.json();
      setTasks((prev) => [...prev, created]);
      toast.success(`Task added to ${status.replace("_", " ")}`);
    } catch {
      toast.error("Failed to add task");
    }
  };

  // Modal Create
  const handleModalCreate = async (taskData: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    assigned_agent: string | null;
    due_date: string | null;
    status: string;
  }) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: taskData.title,
        description: taskData.description,
        agentId: taskData.assigned_agent,
        priority: taskData.priority,
        dueDate: taskData.due_date,
        status: taskData.status,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create task");
    }
    const created = await res.json();
    setTasks((prev) => [...prev, created]);
    toast.success(`Task "${created.title}" created successfully`);
  };

  // Delete Task
  const handleDeleteTask = async (id: string) => {
    try {
      const res = await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete task");
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);
      setSelectedTaskIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  // Clear Done Column
  const handleClearDone = async () => {
    try {
      const res = await fetch("/api/tasks?status=done", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear tasks");
      setTasks((prev) => prev.filter((t) => t.status !== "done"));
      if (selectedTask?.status === "done") setSelectedTask(null);
      toast.success("Cleared all completed tasks");
    } catch {
      toast.error("Failed to clear completed tasks");
    }
  };

  // Move status directly from drawer
  const handleUpdateStatus = async (id: string, status: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: status as any } : t))
    );
    if (selectedTask?.id === id) {
      setSelectedTask((prev) => (prev ? { ...prev, status: status as any } : null));
    }
    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (res.ok) {
        toast.success(`Moved to ${status.replace("_", " ")}`);
      }
    } catch {
      toast.error("Failed to update status");
    }
  };

  // Toggle selection on a single task
  const handleToggleSelectTask = (taskId: string, e: React.MouseEvent) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  // Batch Move Tasks
  const handleBatchMove = async (targetStatus: string) => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    setBatchActionLoading(true);

    // Optimistically update
    setTasks((prev) =>
      prev.map((t) => (ids.includes(t.id) ? { ...t, status: targetStatus as any } : t))
    );

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: targetStatus }),
      });
      if (!res.ok) throw new Error("Failed to batch update status");
      toast.success(`Moved ${ids.length} tasks to ${targetStatus.replace("_", " ")}`);
      setSelectedTaskIds(new Set());
      setIsSelectionMode(false);
    } catch {
      toast.error("Failed to update selected tasks");
      fetchData();
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Delete Tasks
  const handleBatchDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    const ids = Array.from(selectedTaskIds);
    const confirmed = window.confirm(`Permanently delete ${ids.length} selected tasks?`);
    if (!confirmed) return;

    setBatchActionLoading(true);
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));

    try {
      const res = await fetch(`/api/tasks?ids=${ids.join(",")}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tasks");
      toast.success(`Deleted ${ids.length} tasks`);
      setSelectedTaskIds(new Set());
      setIsSelectionMode(false);
    } catch {
      toast.error("Failed to delete selected tasks");
      fetchData();
    } finally {
      setBatchActionLoading(false);
    }
  };

  // Batch Run Tasks (trigger sequential agent run)
  const handleBatchRun = async () => {
    if (selectedTaskIds.size === 0) return;
    const targetTasks = tasks.filter(
      (t) => selectedTaskIds.has(t.id) && (t.status === "backlog" || t.status === "in_progress")
    );

    if (targetTasks.length === 0) {
      toast.info("No actionable backlog tasks in current selection");
      return;
    }

    toast.info(`Starting execution of ${targetTasks.length} tasks...`);
    setIsSelectionMode(false);
    setSelectedTaskIds(new Set());

    for (const t of targetTasks) {
      await handleRunTask(t);
    }
  };

  // Select all currently visible filtered tasks
  const handleSelectAllFiltered = () => {
    const visibleIds = filteredTasks.map((t) => t.id);
    setSelectedTaskIds(new Set(visibleIds));
  };

  // Clear current selection
  const handleClearSelection = () => {
    setSelectedTaskIds(new Set());
    setIsSelectionMode(false);
  };

  // Filter & Sort tasks
  const filteredTasks = useMemo(() => {
    const result = tasks.filter((task) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = task.title.toLowerCase().includes(q);
        const matchDesc = task.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      // Agent filter
      if (selectedAgentFilter !== "all") {
        if (selectedAgentFilter === "unassigned") {
          if (task.agentId) return false;
        } else if (task.agentId !== selectedAgentFilter) {
          return false;
        }
      }
      // Priority filter
      if (selectedPriorityFilter !== "all") {
        if (task.priority !== selectedPriorityFilter) return false;
      }
      // Quick filter chips
      if (quickFilter === "urgent_high") {
        if (task.priority !== "urgent" && task.priority !== "high") return false;
      } else if (quickFilter === "due_soon") {
        if (!task.dueDate) return false;
        const due = new Date(task.dueDate).getTime();
        const now = Date.now();
        // due in next 7 days or overdue
        if (due > now + 7 * 86400000) return false;
      } else if (quickFilter === "has_deliverable") {
        if (!task.result || task.result.trim().length === 0) return false;
      } else if (quickFilter === "unassigned") {
        if (task.agentId) return false;
      }

      return true;
    });

    // Sorting
    result.sort((a, b) => {
      if (sortBy === "priority") {
        const pA = PRIORITY_ORDER[a.priority] || 0;
        const pB = PRIORITY_ORDER[b.priority] || 0;
        return pB - pA;
      }
      if (sortBy === "dueDate") {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "newest") {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      // default: position or original order
      return (a.position || 0) - (b.position || 0);
    });

    return result;
  }, [tasks, searchQuery, selectedAgentFilter, selectedPriorityFilter, quickFilter, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: tasks.length,
      backlog: tasks.filter((t) => t.status === "backlog").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      review: tasks.filter((t) => t.status === "review").length,
      done: tasks.filter((t) => t.status === "done").length,
    };
  }, [tasks]);

  if (!mounted) {
    return (
      <div className="flex flex-col h-[calc(100vh-4rem)] p-4 sm:p-6 overflow-hidden animate-pulse">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="space-y-2">
            <div className="h-7 w-36 bg-secondary/80 rounded-xl" />
            <div className="h-3.5 w-60 bg-secondary/40 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-20 bg-secondary/60 rounded-lg" />
            <div className="h-8 w-28 bg-secondary/60 rounded-lg" />
          </div>
        </div>
        <div className="h-10 w-full bg-secondary/30 rounded-xl mb-4" />
        <div className="flex gap-4 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 rounded-xl border border-border bg-card/40 p-4 space-y-3">
              <div className="h-4 w-20 bg-secondary/70 rounded" />
              <div className="h-28 bg-secondary/30 rounded-xl" />
              <div className="h-28 bg-secondary/30 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[600px] p-4 sm:p-5 overflow-hidden">
      {/* Sleek Top Header & Unified Action Bar */}
      <div className="flex flex-col gap-3 mb-3.5 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Kanban
              </h1>
              <span className="text-xs font-mono font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted border border-border">
                {tasks.length} tasks
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Task execution board synchronized with Obsidian Vault deliverables
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Multi-Select Mode Toggle */}
            <button
              onClick={() => {
                setIsSelectionMode((prev) => !prev);
                if (isSelectionMode) setSelectedTaskIds(new Set());
              }}
              title="Toggle multi-select mode"
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                isSelectionMode
                  ? "bg-primary text-primary-foreground border-primary shadow-xs"
                  : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isSelectionMode ? "Selecting..." : "Select"}</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              title="Refresh Tasks"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            {/* Clear Completed */}
            {stats.done > 0 && (
              <button
                onClick={handleClearDone}
                title="Clear completed tasks"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 bg-card hover:bg-destructive/10 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear Done</span>
                <span>({stats.done})</span>
              </button>
            )}

            {/* Create Task Button */}
            <button
              onClick={() => {
                setCreateInitialStatus("backlog");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Unified Search, Filters & Sorting Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 p-2 rounded-xl bg-card border border-border/80 shadow-xs">
          {/* Left: Search & Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[170px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Agent Filter */}
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition cursor-pointer"
            >
              <option value="all">All Agents</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName || agent.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            {/* Quick Sort Dropdown */}
            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground hidden sm:inline" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-1.5 rounded-lg bg-muted/60 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition cursor-pointer font-medium"
              >
                <option value="position">Default Order</option>
                <option value="priority">Priority (High → Low)</option>
                <option value="dueDate">Due Date (Earliest)</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>

          {/* Right: Quick Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: "all", label: "All" },
              { id: "urgent_high", label: "Urgent/High" },
              { id: "due_soon", label: "Due Soon" },
              { id: "has_deliverable", label: "Deliverable Ready" },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickFilter(chip.id as QuickFilterOption)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
                  quickFilter === chip.id
                    ? "bg-primary/10 text-primary border border-primary/30 font-semibold"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/60"
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Kanban Board Droppable Columns (Responsive & Flexible) */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex h-full min-h-0 gap-3 min-w-[960px]">
            {KANBAN_COLUMN_DEFS.map((column) => {
              const columnTasks = filteredTasks.filter(
                (t) => t.status === column.id
              );
              const isColCollapsed = collapsedColumns.has(column.id);

              return (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  tasks={columnTasks}
                  onSelectTask={(task) => setSelectedTask(task)}
                  onRunTask={handleRunTask}
                  onEditTask={(task) => setSelectedTask(task)}
                  onDeleteTask={handleDeleteTask}
                  onQuickAdd={handleQuickAdd}
                  onToggleSubtask={handleToggleSubtask}
                  onDeconstructTask={handleDeconstructTask}
                  runningTaskId={runningTaskId}
                  deconstructingTaskId={deconstructingTaskId}
                  isSelectionMode={isSelectionMode}
                  selectedTaskIds={selectedTaskIds}
                  onToggleSelect={handleToggleSelectTask}
                  isCollapsed={isColCollapsed}
                  onToggleCollapse={handleToggleCollapse}
                />
              );
            })}
          </div>

          {/* Drag Overlay for smooth preview */}
          <DragOverlay>
            {activeTask ? (
              <div className="transform rotate-1 scale-[1.02] shadow-2xl opacity-90 w-[300px]">
                <KanbanCard
                  task={activeTask}
                  onSelect={() => {}}
                  onRun={() => {}}
                  onEdit={() => {}}
                  onDelete={() => {}}
                  onToggleSubtask={handleToggleSubtask}
                  isRunning={runningTaskId === activeTask.id}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Floating Batch Action Bar (Appears when tasks are selected) */}
      {isSelectionMode && selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pr-3 border-r border-border">
            <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[11px] font-bold">
              {selectedTaskIds.size}
            </span>
            <span className="text-xs font-medium text-foreground">
              selected
            </span>
            <button
              type="button"
              onClick={handleSelectAllFiltered}
              className="text-[11px] text-muted-foreground hover:text-primary transition underline cursor-pointer ml-1"
            >
              Select All ({filteredTasks.length})
            </button>
          </div>

          {/* Batch Actions: Move To */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <MoveRight className="w-3 h-3" /> Move:
            </span>
            {[
              { id: "backlog", label: "Backlog" },
              { id: "in_progress", label: "In Progress" },
              { id: "review", label: "Review" },
              { id: "done", label: "Done" },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                disabled={batchActionLoading}
                onClick={() => handleBatchMove(st.id)}
                className="px-2 py-1 rounded-md text-[11px] font-medium bg-muted hover:bg-secondary text-foreground border border-border/60 transition cursor-pointer disabled:opacity-50"
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Batch Run */}
          <button
            type="button"
            disabled={batchActionLoading}
            onClick={handleBatchRun}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition cursor-pointer disabled:opacity-50"
            title="Execute all selected actionable tasks"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Run</span>
          </button>

          {/* Batch Delete */}
          <button
            type="button"
            disabled={batchActionLoading}
            onClick={handleBatchDelete}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition cursor-pointer disabled:opacity-50"
            title="Delete selected tasks"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Dismiss / Clear Selection */}
          <button
            type="button"
            onClick={handleClearSelection}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition cursor-pointer ml-1"
            title="Exit selection mode"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Task Drawer for Deliverable Review & Directives */}
      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onRunTask={handleRunTask}
        onSwarmTask={handleSwarmTask}
        onReflectTask={handleReflectTask}
        onApproveTask={handleApproveTask}
        onReviseTask={handleReviseTask}
        onRejectTask={handleRejectTask}
        onDeconstructTask={handleDeconstructTask}
        onDeleteTask={handleDeleteTask}
        onUpdateStatus={handleUpdateStatus}
        onToggleSubtask={handleToggleSubtask}
        isRunning={runningTaskId === selectedTask?.id}
        isSwarming={swarmingTaskId === selectedTask?.id}
        isReflecting={reflectingTaskId === selectedTask?.id}
        isDeconstructing={deconstructingTaskId === selectedTask?.id}
        isRevising={revisingTaskId === selectedTask?.id}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleModalCreate}
        agents={agents}
        initialStatus={createInitialStatus}
      />
    </div>
  );
}
