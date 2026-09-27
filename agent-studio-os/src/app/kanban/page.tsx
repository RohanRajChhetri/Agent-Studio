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
  Layers,
  Zap,
  CheckCircle2,
  RefreshCw,
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

export default function KanbanPage() {
  const [mounted, setMounted] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>("all");
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>("all");

  // Interaction State
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<string>("backlog");
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null);
  const [swarmingTaskId, setSwarmingTaskId] = useState<string | null>(null);
  const [reflectingTaskId, setReflectingTaskId] = useState<string | null>(null);
  const [deconstructingTaskId, setDeconstructingTaskId] = useState<string | null>(null);
  const [revisingTaskId, setRevisingTaskId] = useState<string | null>(null);

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
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

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

    // Optimistically move task to in_progress immediately with progress pulse
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
        toast.success("Agent finished execution! Deliverable ready in Review.");
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? data.task : t))
        );
        if (selectedTask?.id === task.id) {
          setSelectedTask(data.task);
        }
      } else {
        // Rollback on failure
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
      toast.success(`Generated ${data.subtasks.length} specialist subtasks!`);
    } catch (err: any) {
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

    // Optimistically update
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
      // Rollback if network/server failed
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

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
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
      return true;
    });
  }, [tasks, searchQuery, selectedAgentFilter, selectedPriorityFilter]);

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
            <div className="h-7 w-44 bg-secondary/80 rounded-xl" />
            <div className="h-3.5 w-72 bg-secondary/40 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 bg-secondary/60 rounded-xl" />
            <div className="h-9 w-28 bg-secondary/60 rounded-xl" />
          </div>
        </div>

        <div className="h-12 w-full bg-secondary/30 rounded-2xl mb-4" />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card/40 p-4 space-y-3"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/80">
                <div className="h-4 w-24 bg-secondary/70 rounded" />
                <div className="h-4 w-6 bg-secondary/70 rounded-full" />
              </div>
              <div className="space-y-3 pt-2">
                <div className="h-28 bg-secondary/30 rounded-xl" />
                <div className="h-28 bg-secondary/30 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] min-h-[600px] p-4 sm:p-6 overflow-hidden">
      {/* Top Header & Toolbar */}
      <div className="flex flex-col gap-4 mb-4 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-[#e6f3fe] text-[#0075de] border border-[#0075de]/20">
                <Layers className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                Agent Kanban
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Autonomous execution board • Backlog &rarr; In Progress &rarr; Review &rarr; Obsidian Vault
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              disabled={isLoading}
              title="Refresh Tasks"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-medium transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>

            {stats.done > 0 && (
              <button
                onClick={handleClearDone}
                title="Clear completed tasks"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30 bg-card hover:bg-destructive/10 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Completed ({stats.done})</span>
              </button>
            )}

            <button
              onClick={() => {
                setCreateInitialStatus("backlog");
                setShowCreateModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Task</span>
            </button>
          </div>
        </div>

        {/* Toolbar: Search, Filters, Quick Metrics */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-xl bg-card border border-border">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
              />
            </div>

            {/* Agent Filter */}
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-muted border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition cursor-pointer"
            >
              <option value="all">All Agents</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.avatar || "🤖"} {agent.name}
                </option>
              ))}
            </select>

            {/* Priority Filter */}
            <select
              value={selectedPriorityFilter}
              onChange={(e) => setSelectedPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2.5 py-1 rounded-lg bg-secondary/80 text-foreground/80 dark:text-muted-foreground font-medium border border-border">
              Total: <strong className="text-foreground">{stats.total}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-950 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800/40 font-medium">
              In Progress: <strong className="font-bold">{stats.in_progress}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-purple-100 text-purple-950 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-800/40 font-medium">
              Review: <strong className="font-bold">{stats.review}</strong>
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-950 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/40 font-medium">
              Done: <strong className="font-bold">{stats.done}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Kanban Board Droppable Columns */}
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden pb-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 h-full min-h-0 min-w-[1000px]">
            {KANBAN_COLUMN_DEFS.map((column) => {
              const columnTasks = filteredTasks.filter(
                (t) => t.status === column.id
              );
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
                  runningTaskId={runningTaskId}
                />
              );
            })}
          </div>

          {/* Drag Overlay for smooth preview */}
          <DragOverlay>
            {activeTask ? (
              <div className="transform rotate-2 scale-105 shadow-2xl opacity-90">
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
