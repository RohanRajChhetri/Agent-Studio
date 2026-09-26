"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarClock,
  Clock,
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Bot,
  Trash2,
  Edit2,
  RefreshCw,
  Power,
  ChevronDown,
  X,
  FileText,
  ExternalLink,
  Zap,
  FolderDown,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { WebhookSimulator } from "@/components/routines/webhook-simulator";

interface RoutineItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  type: "daily" | "one_time";
  time?: string | null;
  scheduledAt?: string | null;
  enabled: boolean;
  autoExecute: boolean;
  priority: string;
  agentId?: string | null;
  agent?: AgentProfile | null;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  createdAt: string;
}

interface RoutineExecutionResult {
  routineTitle: string;
  agentName: string;
  agentAvatar: string;
  timestamp: string;
  deliverable: string;
  modelUsed?: string;
  vaultFile?: string;
}

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"routines" | "webhooks">("routines");

  // Deliverable Viewer Modal
  const [activeDeliverable, setActiveDeliverable] = useState<RoutineExecutionResult | null>(null);

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formType, setFormType] = useState<"daily" | "one_time">("daily");
  const [formTime, setFormTime] = useState("09:00");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formAgentId, setFormAgentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cached deliverables from recent runs
  const [recentOutputs, setRecentOutputs] = useState<Record<string, string>>({});

  const fetchRoutines = async () => {
    try {
      const res = await fetch("/api/routines");
      if (res.ok) {
        const data = await res.json();
        setRoutines(data.routines || []);
      }
    } catch (err) {
      console.error("Failed to fetch routines:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        const agentList: AgentProfile[] = Array.isArray(data) ? data : data.agents || [];
        setAgents(agentList);
        if (agentList.length > 0 && !formAgentId) {
          setFormAgentId(agentList[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch agents:", err);
    }
  };

  useEffect(() => {
    fetchRoutines();
    fetchAgents();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("tab") === "webhooks" || window.location.hash === "#webhooks") {
        setViewMode("webhooks");
      }
      if (params.get("new") === "true") {
        setIsModalOpen(true);
      }
    }

    // Check due routines in background every 30s
    const interval = setInterval(() => {
      fetchRoutines();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setFormTitle("");
    setFormPrompt("");
    setFormType("daily");
    setFormTime("09:00");
    setFormScheduledAt("");
    if (agents.length > 0) setFormAgentId(agents[0].id);
    setIsModalOpen(true);
  };

  const openEditModal = (r: RoutineItem) => {
    setEditingRoutine(r);
    setFormTitle(r.title);
    setFormPrompt(r.prompt);
    setFormType(r.type);
    setFormTime(r.time || "09:00");
    setFormScheduledAt(r.scheduledAt ? new Date(r.scheduledAt).toISOString().slice(0, 16) : "");
    setFormAgentId(r.agentId || (agents[0]?.id ?? ""));
    setIsModalOpen(true);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrompt.trim()) {
      toast.error("Please enter a title and goal instructions");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        prompt: formPrompt.trim(),
        type: formType,
        time: formType === "daily" ? formTime : null,
        scheduledAt: formType === "one_time" && formScheduledAt ? formScheduledAt : null,
        agentId: formAgentId || null,
        autoExecute: true,
        priority: "medium",
      };

      if (editingRoutine) {
        const res = await fetch(`/api/routines/${editingRoutine.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Routine updated");
          setIsModalOpen(false);
          fetchRoutines();
        } else {
          toast.error("Failed to update routine");
        }
      } else {
        const res = await fetch("/api/routines", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("New routine created and activated");
          setIsModalOpen(false);
          fetchRoutines();
        } else {
          toast.error("Failed to create routine");
        }
      }
    } catch {
      toast.error("Error saving routine");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleEnabled = async (routine: RoutineItem) => {
    try {
      const nextState = !routine.enabled;
      const res = await fetch(`/api/routines/${routine.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextState }),
      });
      if (res.ok) {
        toast.success(nextState ? `Routine activated` : `Routine paused`);
        fetchRoutines();
      }
    } catch {
      toast.error("Failed to toggle routine");
    }
  };

  const handleDeleteRoutine = async (id: string) => {
    if (!confirm("Are you sure you want to delete this routine?")) return;
    try {
      const res = await fetch(`/api/routines/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Routine deleted");
        fetchRoutines();
      }
    } catch {
      toast.error("Failed to delete routine");
    }
  };

  const handleTriggerRoutine = async (routine: RoutineItem) => {
    setTriggeringId(routine.id);
    const toastId = toast.loading(`Executing "${routine.title}" via ${routine.agent?.displayName || "Agent"}...`);

    try {
      const res = await fetch(`/api/routines/${routine.id}/trigger`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Completed! Deliverable generated and saved.`, { id: toastId });

        const deliverableText = data.executionResult?.content || data.task?.result || "Task completed successfully.";
        
        // Cache output locally
        setRecentOutputs((prev) => ({
          ...prev,
          [routine.id]: deliverableText,
        }));

        // Open deliverable viewer immediately so the user sees the work done
        setActiveDeliverable({
          routineTitle: routine.title,
          agentName: routine.agent?.displayName || "Agent",
          agentAvatar: routine.agent?.avatar || "🤖",
          timestamp: new Date().toLocaleTimeString(),
          deliverable: deliverableText,
          modelUsed: data.executionResult?.modelUsed,
        });

        fetchRoutines();
      } else {
        toast.error(data.error || "Execution failed", { id: toastId });
      }
    } catch {
      toast.error("Routine execution failed", { id: toastId });
    } finally {
      setTriggeringId(null);
    }
  };

  const handleViewDeliverable = (routine: RoutineItem) => {
    const cached = recentOutputs[routine.id];
    if (cached) {
      setActiveDeliverable({
        routineTitle: routine.title,
        agentName: routine.agent?.displayName || "Agent",
        agentAvatar: routine.agent?.avatar || "🤖",
        timestamp: routine.lastRunAt ? new Date(routine.lastRunAt).toLocaleTimeString() : "Recent",
        deliverable: cached,
      });
    } else {
      // Trigger a run if no cached output exists yet
      handleTriggerRoutine(routine);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto pb-12">
      {/* Sleek, Clean Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#e6f3fe] border border-[#0075de]/20 text-[#0075de] text-xs font-medium">
            <CalendarClock className="w-3.5 h-3.5 text-[#0075de]" />
            <span>Autonomous Background Engine</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Automated Routines
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
            Schedule recurring tasks that your AI agents execute autonomously on a timer. Outputs are auto-saved to your Obsidian Vault.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Switcher: Routines vs Webhook Simulator */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border text-xs">
            <button
              onClick={() => setViewMode("routines")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "routines"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Routines
            </button>
            <button
              onClick={() => setViewMode("webhooks")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "webhooks"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Webhook Simulator
            </button>
          </div>

          <button
            onClick={fetchRoutines}
            className="p-1.5 rounded-lg border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Refresh routines"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {viewMode === "routines" && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition-opacity cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Routine</span>
            </button>
          )}
        </div>
      </div>

      {viewMode === "webhooks" ? (
        <WebhookSimulator agents={agents} />
      ) : loading ? (
        <div className="py-20 text-center flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <RefreshCw className="w-6 h-6 animate-spin text-primary" />
          <span className="text-xs">Loading active routines...</span>
        </div>
      ) : routines.length === 0 ? (
        /* Minimalist Clean Empty State */
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center space-y-4 max-w-md mx-auto">
          <div className="w-10 h-10 rounded-lg bg-[#e6f3fe] text-[#0075de] border border-[#0075de]/20 flex items-center justify-center mx-auto text-lg">
            ⏰
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No automated routines set up</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Create a daily recurring routine (like a morning summary or code review) for your agents to execute automatically.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition-opacity cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Routine</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {routines.map((routine) => {
            const isTriggering = triggeringId === routine.id;
            const hasOutput = Boolean(recentOutputs[routine.id]);

            return (
              <div
                key={routine.id}
                className={`rounded-xl border transition-colors p-5 flex flex-col justify-between space-y-4 relative ${
                  routine.enabled
                    ? "bg-card border-border hover:border-border/90"
                    : "bg-muted/30 border-border/60 opacity-65"
                }`}
              >
                {/* Header: Schedule Type & Active Switch */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[#e6f3fe] text-[#0075de] border border-[#0075de]/20 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#0075de]" />
                      <span>{routine.type === "daily" ? `Daily at ${routine.time || "09:00"}` : "One-Time"}</span>
                    </span>

                    {routine.agent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted text-foreground border border-border flex items-center gap-1">
                        <span>{routine.agent.avatar}</span>
                        <span>{routine.agent.displayName}</span>
                      </span>
                    )}
                  </div>

                  {/* Power Toggle */}
                  <button
                    onClick={() => handleToggleEnabled(routine)}
                    className={`p-1.5 rounded-md border transition-colors cursor-pointer ${
                      routine.enabled
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20"
                        : "bg-muted text-muted-foreground border-border hover:text-foreground"
                    }`}
                    title={routine.enabled ? "Routine active (click to pause)" : "Routine paused (click to activate)"}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Title & Goal */}
                <div className="space-y-1.5">
                  <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                    {routine.title}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed bg-muted/40 p-2.5 rounded-lg border border-border">
                    {routine.prompt}
                  </p>
                </div>

                {/* Next Run Info */}
                <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border pt-2 font-mono">
                  <span>Next scheduled:</span>
                  <span className="font-medium text-foreground">
                    {routine.enabled && routine.nextRunAt
                      ? new Date(routine.nextRunAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "Paused"}
                  </span>
                </div>

                {/* Action Bar */}
                <div className="flex items-center gap-2 border-t border-border pt-3">
                  {/* Run Now Button */}
                  <button
                    onClick={() => handleTriggerRoutine(routine)}
                    disabled={isTriggering}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition-opacity disabled:opacity-50 cursor-pointer"
                  >
                    {isTriggering ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isTriggering ? "Running..." : "Run Now"}</span>
                  </button>

                  {/* View Output Button */}
                  {hasOutput && (
                    <button
                      onClick={() => handleViewDeliverable(routine)}
                      className="p-1.5 rounded-lg bg-card hover:bg-muted border border-border text-xs font-medium text-foreground transition-colors cursor-pointer"
                      title="View latest deliverable output"
                    >
                      <FileText className="w-4 h-4 text-primary" />
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => openEditModal(routine)}
                    className="p-1.5 rounded-lg bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Edit routine"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => handleDeleteRoutine(routine.id)}
                    className="p-1.5 rounded-lg bg-card hover:bg-red-500/10 border border-border text-muted-foreground hover:text-red-500 transition-colors cursor-pointer"
                    title="Delete routine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deliverable Viewer Drawer/Modal */}
      <AnimatePresence>
        {activeDeliverable && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-border pb-3 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="text-3xl shrink-0">{activeDeliverable.agentAvatar}</span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {activeDeliverable.routineTitle}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Executed by <strong className="text-foreground">{activeDeliverable.agentName}</strong> at {activeDeliverable.timestamp}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveDeliverable(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Deliverable Markdown Content */}
              <div className="flex-1 overflow-y-auto p-4 rounded-xl bg-secondary/30 border border-border text-xs text-foreground leading-relaxed">
                <MarkdownRenderer content={activeDeliverable.deliverable} />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border pt-3 shrink-0 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Deliverable auto-archived to Obsidian Vault (tasks/)</span>
                </div>

                <button
                  onClick={() => setActiveDeliverable(null)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs cursor-pointer hover:bg-primary/90"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Simplified, Clean Routine Creator Modal (Minimum Presets) */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {editingRoutine ? "Edit Routine" : "Create Automated Routine"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Define what to do, who does it, and when.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveRoutine} className="space-y-4">
                {/* 1. What: Title */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    1. Routine Title
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Code Health Check & Issue Audit"
                    className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>

                {/* 2. Instructions / Goal */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    2. Instructions & Goal
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    placeholder="What should the agent analyze, generate, or execute?"
                    className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                  />
                </div>

                {/* 3. Who: Assigned Specialist */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    3. Assign Agent Specialist
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {agents.map((ag) => (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => setFormAgentId(ag.id)}
                        className={`p-2 rounded-xl border text-left flex items-center gap-2 transition-all cursor-pointer ${
                          formAgentId === ag.id
                            ? "bg-primary/20 border-primary text-foreground font-semibold shadow-sm"
                            : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="text-lg shrink-0">{ag.avatar}</span>
                        <span className="text-xs truncate">{ag.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. When: Schedule Time */}
                <div className="space-y-2 pt-1 border-t border-border">
                  <label className="text-xs font-bold text-foreground">
                    4. Execution Schedule
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType("daily")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        formType === "daily"
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      }`}
                    >
                      ⏰ Every Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("one_time")}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        formType === "one_time"
                          ? "bg-primary/20 border-primary text-primary"
                          : "bg-secondary/40 border-border text-muted-foreground"
                      }`}
                    >
                      📅 Specific Date & Time
                    </button>
                  </div>

                  {formType === "daily" ? (
                    <div className="flex items-center gap-2 bg-secondary/30 p-2.5 rounded-xl border border-border">
                      <span className="text-xs text-muted-foreground">Run time daily:</span>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className="bg-card text-xs font-mono text-foreground px-2 py-1 rounded border border-border outline-none"
                      />
                    </div>
                  ) : (
                    <div className="bg-secondary/30 p-2.5 rounded-xl border border-border">
                      <input
                        type="datetime-local"
                        value={formScheduledAt}
                        onChange={(e) => setFormScheduledAt(e.target.value)}
                        className="bg-card text-xs font-mono text-foreground px-2 py-1 rounded border border-border outline-none w-full"
                      />
                    </div>
                  )}
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? "Saving..." : editingRoutine ? "Update Routine" : "Create Routine"}
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
