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
  ChevronRight,
  ChevronDown,
  Sliders,
  FileText,
  Zap,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { WebhookSimulator } from "@/components/routines/webhook-simulator";
import { DagPipelineBuilder } from "@/components/routines/dag-pipeline-builder";
import { formatResponseTime } from "@/lib/utils";


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

const TEMPLATES = [
  {
    title: "Daily Competitor & Market Scan",
    prompt: "Scan latest competitor releases, pricing changes, and top AI developer tooling trends. Generate a bulleted synthesis in shared memory.",
    type: "daily",
    time: "09:00",
    priority: "high",
  },
  {
    title: "Morning Codebase Health Check",
    prompt: "Review recent commits, test suites, and open issues. Write a structured morning audit report with high-priority action items.",
    type: "daily",
    time: "08:30",
    priority: "medium",
  },
  {
    title: "Weekly Growth & Content Drafts",
    prompt: "Synthesize key product milestones from this week into 3 engaging Twitter/X threads and 1 LinkedIn breakdown.",
    type: "daily",
    time: "17:00",
    priority: "medium",
  },
];

export default function RoutinesPage() {
  const [routines, setRoutines] = useState<RoutineItem[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<"all" | "daily" | "one_time">("all");
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  // Webhook & Pipeline State
  const [activeTab, setActiveTab] = useState<"routines" | "webhooks" | "pipelines">("routines");
  const [webhookEventType, setWebhookEventType] = useState<"github_push" | "cron_routine" | "generic_task">("github_push");
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [webhookResult, setWebhookResult] = useState<any>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<RoutineItem | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formPrompt, setFormPrompt] = useState("");
  const [formType, setFormType] = useState<"daily" | "one_time">("daily");
  const [formTime, setFormTime] = useState("09:00");
  const [formScheduledAt, setFormScheduledAt] = useState("");
  const [formAgentId, setFormAgentId] = useState("");
  const [formPriority, setFormPriority] = useState("medium");
  const [formAutoExecute, setFormAutoExecute] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        const agentList: AgentProfile[] = Array.isArray(data) ? data : (data.agents || []);
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
  }, []);

  const openCreateModal = () => {
    setEditingRoutine(null);
    setFormTitle("");
    setFormPrompt("");
    setFormType("daily");
    setFormTime("09:00");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    setFormScheduledAt(tomorrow.toISOString().slice(0, 16));
    setFormPriority("medium");
    setFormAutoExecute(true);
    if (agents.length > 0) setFormAgentId(agents[0].id);
    setIsModalOpen(true);
  };

  const openEditModal = (routine: RoutineItem) => {
    setEditingRoutine(routine);
    setFormTitle(routine.title);
    setFormPrompt(routine.prompt);
    setFormType(routine.type);
    setFormTime(routine.time || "09:00");
    setFormScheduledAt(
      routine.scheduledAt
        ? new Date(routine.scheduledAt).toISOString().slice(0, 16)
        : ""
    );
    setFormAgentId(routine.agentId || (agents[0]?.id ?? ""));
    setFormPriority(routine.priority);
    setFormAutoExecute(routine.autoExecute);
    setIsModalOpen(true);
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setFormTitle(t.title);
    setFormPrompt(t.prompt);
    setFormType(t.type as "daily");
    setFormTime(t.time);
    setFormPriority(t.priority);
  };

  const handleSaveRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formPrompt.trim()) {
      toast.error("Please enter a title and prompt");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle,
        prompt: formPrompt,
        type: formType,
        time: formType === "daily" ? formTime : null,
        scheduledAt: formType === "one_time" ? formScheduledAt : null,
        agentId: formAgentId || null,
        priority: formPriority,
        autoExecute: formAutoExecute,
      };

      if (editingRoutine) {
        const res = await fetch(`/api/routines/${editingRoutine.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Routine updated successfully");
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
          toast.success("Routine created successfully");
          setIsModalOpen(false);
          fetchRoutines();
        } else {
          toast.error("Failed to create routine");
        }
      }
    } catch (err) {
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
        toast.success(`Routine ${nextState ? "activated" : "paused"}`);
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
    const toastId = toast.loading(`Triggering routine "${routine.title}" with ${routine.agent?.displayName || "Agent"}...`);
    try {
      const res = await fetch(`/api/routines/${routine.id}/trigger`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Task executed! Deliverable ready in Review on Kanban board.`, { id: toastId });
        fetchRoutines();
      } else {
        toast.error(data.error || "Failed to trigger routine", { id: toastId });
      }
    } catch (err) {
      toast.error("Execution failed", { id: toastId });
    } finally {
      setTriggeringId(null);
    }
  };

  const handleSimulateWebhook = async () => {
    setSimulatingWebhook(true);
    setWebhookResult(null);
    let payload: any = {};
    if (webhookEventType === "github_push") {
      payload = {
        repository: { name: "agent-studio-os" },
        commits: [
          {
            message: "feat: add multi-agent delegation & sandbox tools",
            author: { name: "Rohan" },
            modified: ["src/lib/rag.ts", "src/lib/tools-engine.ts"],
          },
        ],
        agent: "vulcan-devops",
      };
    } else if (webhookEventType === "cron_routine") {
      payload = {
        title: "Daily Autonomous Infrastructure Audit",
        description: "Audit agent latencies, memory store health, and system routes.",
        priority: "high",
        agent: "vulcan-devops",
      };
    } else {
      payload = {
        title: "Automated Competitor Feature Alert",
        description: "Analyze new LLM gateway updates released today.",
        priority: "medium",
        agent: "athena",
      };
    }

    try {
      const res = await fetch("/api/webhooks/default-secret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setWebhookResult(data);
        toast.success(`Webhook triggered! Task executed via ${data.task?.agent?.displayName || "Agent"}`);
      } else {
        toast.error(data.error || "Webhook simulation failed");
      }
    } catch {
      toast.error("Failed to fire webhook event");
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const filteredRoutines = routines.filter((r) => {
    if (filterType === "all") return true;
    return r.type === filterType;
  });

  const dailyCount = routines.filter((r) => r.type === "daily").length;
  const oneTimeCount = routines.filter((r) => r.type === "one_time").length;
  const activeCount = routines.filter((r) => r.enabled).length;

  return (
    <div className="space-y-5 w-full">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-border inline-flex items-center gap-1.5">
              <CalendarClock className="w-3 h-3" />
              Autonomous Engine
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Routines & Scheduled Tasks
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Schedule recurring daily routines or one-time tasks executed autonomously by your agent fleet.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchRoutines}
            className="p-2.5 rounded-xl bg-secondary/60 hover:bg-secondary/60 border border-border text-muted-foreground hover:text-foreground transition-all"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground font-semibold text-xs shadow-lg shadow-indigo-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Routine</span>
          </button>
        </div>
      </div>

      {/* Top View Mode Switcher */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <button
          onClick={() => setActiveTab("routines")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "routines"
              ? "bg-primary/20 text-primary border-border shadow-sm"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <CalendarClock className="w-3.5 h-3.5" />
          <span>Scheduled Routines ({routines.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("webhooks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "webhooks"
              ? "bg-primary/20 text-primary border-border shadow-sm"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-muted-foreground dark:text-muted-foreground" />
          <span>Webhooks & Automation Triggers</span>
        </button>

        <button
          onClick={() => setActiveTab("pipelines")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border ${
            activeTab === "pipelines"
              ? "bg-primary/20 text-primary border-border shadow-sm"
              : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-foreground" />
          <span>Multi-Agent Pipelines (DAG)</span>
        </button>
      </div>

      {activeTab === "pipelines" ? (
        <DagPipelineBuilder agents={agents} />
      ) : activeTab === "webhooks" ? (
        <WebhookSimulator agents={agents} />
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass rounded-lg p-4 border border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-border flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">Daily Recurring</span>
            <div className="text-xl font-bold text-foreground mt-0.5">{dailyCount}</div>
          </div>
        </div>

        <div className="glass rounded-lg p-4 border border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-border flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">One-Time Scheduled</span>
            <div className="text-xl font-bold text-foreground mt-0.5">{oneTimeCount}</div>
          </div>
        </div>

        <div className="glass rounded-lg p-4 border border-border flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-muted-foreground font-medium">Active Automations</span>
            <div className="text-xl font-bold text-emerald-300 mt-0.5">{activeCount} / {routines.length}</div>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        {(
          [
            { id: "all", label: "All Routines", count: routines.length },
            { id: "daily", label: "Daily Recurring", count: dailyCount },
            { id: "one_time", label: "One-Time Scheduled", count: oneTimeCount },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterType(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              filterType === tab.id
                ? "bg-secondary/50 text-foreground border border-border shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            <span>{tab.label}</span>
            <span className="px-1.5 py-0.2 rounded-md text-[10px] bg-secondary/50">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Routines Grid */}
      {loading ? (
        <div className="py-24 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-6 h-6 animate-spin text-foreground" />
          <span className="text-xs">Loading scheduled routines...</span>
        </div>
      ) : filteredRoutines.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/40 backdrop-blur-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary border border-border text-foreground flex items-center justify-center mx-auto">
            <CalendarClock className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-sm font-semibold text-foreground">No routines scheduled yet</h3>
            <p className="text-xs text-muted-foreground">
              Create your first daily routine or one-time scheduled task to let your agents autonomously execute work at specific times.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground font-semibold text-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Scheduled Routine</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredRoutines.map((routine) => {
            const isTriggering = triggeringId === routine.id;
            return (
              <motion.div
                key={routine.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded-lg border transition-all p-5 flex flex-col justify-between gap-4 relative shadow-lg ${
                  routine.enabled
                    ? "bg-secondary/85 border-border hover:border-border"
                    : "bg-card/60 backdrop-blur-xl border-border opacity-60"
                }`}
              >
                {/* Header */}
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          routine.type === "daily"
                            ? "bg-primary/20 text-primary border border-border"
                            : "bg-primary/20 text-primary border border-border"
                        }`}
                      >
                        {routine.type === "daily" ? `⏰ Daily ${routine.time || "09:00"}` : "📅 One-Time"}
                      </span>

                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold tracking-wider ${
                          routine.priority === "urgent"
                            ? "bg-red-500/20 text-red-300"
                            : routine.priority === "high"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {routine.priority}
                      </span>
                    </div>

                    {/* Status Power Toggle */}
                    <button
                      onClick={() => handleToggleEnabled(routine)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        routine.enabled
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25"
                          : "bg-secondary border-border text-muted-foreground hover:text-muted-foreground"
                      }`}
                      title={routine.enabled ? "Active (Click to pause)" : "Paused (Click to activate)"}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h3 className="text-sm font-bold text-foreground line-clamp-1">
                    {routine.title}
                  </h3>

                  <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed bg-secondary/40 p-2.5 rounded-xl border border-border">
                    {routine.prompt}
                  </p>
                </div>

                {/* Agent & Timing Info */}
                <div className="space-y-2 pt-2 border-t border-border text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Assigned Agent:</span>
                    {routine.agent ? (
                      <span className="flex items-center gap-1 font-semibold text-foreground">
                        <span>{routine.agent.avatar}</span>
                        <span>{routine.agent.displayName}</span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic text-[11px]">Auto / Any Agent</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Next Run:</span>
                    <span className="text-primary font-medium font-mono">
                      {routine.enabled && routine.nextRunAt
                        ? new Date(routine.nextRunAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Paused"}
                    </span>
                  </div>

                  {routine.lastRunAt && (
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>Last run:</span>
                      <span>{new Date(routine.lastRunAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                  <button
                    onClick={() => handleTriggerRoutine(routine)}
                    disabled={isTriggering}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                  >
                    {isTriggering ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current" />
                    )}
                    <span>{isTriggering ? "Executing..." : "Trigger Now"}</span>
                  </button>

                  <button
                    onClick={() => openEditModal(routine)}
                    className="p-2 rounded-xl bg-secondary/50 hover:bg-secondary/50 border border-border text-muted-foreground hover:text-foreground transition-all"
                    title="Edit Routine"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDeleteRoutine(routine.id)}
                    className="p-2 rounded-xl bg-secondary/50 hover:bg-red-500/10 border border-border text-muted-foreground hover:text-red-400 transition-all"
                    title="Delete Routine"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Routine Creation & Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl rounded-lg border border-border bg-card p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {editingRoutine ? "Edit Scheduled Routine" : "Create Scheduled Routine"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Set a daily time or one-time date for autonomous execution
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {/* Template Pills */}
              {!editingRoutine && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Templates:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((tmpl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyTemplate(tmpl)}
                        className="px-2.5 py-1 rounded-lg bg-secondary/50 hover:bg-secondary/50 border border-border text-muted-foreground hover:text-foreground text-xs font-medium transition-all"
                      >
                        ⚡ {tmpl.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveRoutine} className="space-y-4">
                {/* Title */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Routine Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Daily Competitor Pricing Audit"
                    className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-600"
                  />
                </div>

                {/* Schedule Type Selection */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormType("daily")}
                    className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                      formType === "daily"
                        ? "bg-primary/15 text-primary border-border text-foreground"
                        : "bg-card/50 backdrop-blur-xl border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5 text-foreground" />
                      <span>Daily Recurring</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Repeats every day at a designated time
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormType("one_time")}
                    className={`p-3 rounded-xl border text-left transition-all space-y-1 ${
                      formType === "one_time"
                        ? "bg-primary/15 text-primary border-border text-foreground"
                        : "bg-card/50 backdrop-blur-xl border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Calendar className="w-3.5 h-3.5 text-foreground" />
                      <span>One-Time Scheduled</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Executes once at a specific date and time
                    </p>
                  </button>
                </div>

                {/* Time or Datetime Input */}
                {formType === "daily" ? (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Daily Execution Time (24h)
                    </label>
                    <input
                      type="time"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-amber-600"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Execution Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formScheduledAt}
                      onChange={(e) => setFormScheduledAt(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-amber-600"
                    />
                  </div>
                )}

                {/* Agent & Priority Row */}
                {(() => {
                  const selectedAgent = agents.find((a) => a.id === formAgentId) || (agents.length > 0 ? agents[0] : null);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                          <span>Assigned AI Agent</span>
                          {selectedAgent && (
                            <span className="text-[10px] text-foreground font-normal">
                              {selectedAgent.role || selectedAgent.department || "Specialist"}
                            </span>
                          )}
                        </label>
                        <div className="relative">
                          <select
                            value={formAgentId || (selectedAgent?.id ?? "")}
                            onChange={(e) => setFormAgentId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-amber-600 [&>option]:bg-card [&>option]:text-foreground appearance-none pr-8 cursor-pointer"
                          >
                            {agents.length === 0 && (
                              <option value="" className="bg-card text-muted-foreground">
                                Loading agents...
                              </option>
                            )}
                            {agents.map((agent) => (
                              <option key={agent.id} value={agent.id} className="bg-card text-foreground">
                                {agent.avatar} {agent.displayName} ({agent.name})
                              </option>
                            ))}
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </div>

                        {selectedAgent && (
                          <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50 border border-border">
                            <span className="text-base">{selectedAgent.avatar}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-foreground truncate">{selectedAgent.displayName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{selectedAgent.model || "auto/fast"}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Task Priority
                        </label>
                        <div className="relative">
                          <select
                            value={formPriority}
                            onChange={(e) => setFormPriority(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-amber-600 [&>option]:bg-card [&>option]:text-foreground appearance-none pr-8 cursor-pointer"
                          >
                            <option value="low" className="bg-card text-foreground">Low Priority</option>
                            <option value="medium" className="bg-card text-foreground">Medium Priority</option>
                            <option value="high" className="bg-card text-foreground">High Priority</option>
                            <option value="urgent" className="bg-card text-foreground">Urgent</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Prompt Instructions */}
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Agent Instructions / Objective <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={formPrompt}
                    onChange={(e) => setFormPrompt(e.target.value)}
                    placeholder="Provide specific instructions for what the agent must do and format when this routine triggers..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-amber-600 resize-none leading-relaxed"
                  />
                </div>

                {/* Auto-execute checkbox */}
                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-card/60 backdrop-blur-xl border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formAutoExecute}
                    onChange={(e) => setFormAutoExecute(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                  />
                  <div className="text-xs">
                    <span className="font-semibold text-foreground">
                      Autonomous Agent Execution
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      When triggered, the agent runs immediately with Hermes runtime and saves the deliverable to the Obsidian vault under Review.
                    </p>
                  </div>
                </label>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20"
                  >
                    {isSubmitting ? "Saving..." : editingRoutine ? "Update Routine" : "Save Routine"}
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
