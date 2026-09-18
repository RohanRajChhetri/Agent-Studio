"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Bot,
  ListTodo,
  Brain,
  ArrowRight,
  Plus,
  MessageSquare,
  Settings,
  Columns3,
  Activity,
  Cpu,
  CheckCircle2,
  Clock,
  ExternalLink,
  Zap,
  Radio,
  Share2,
  FolderDown,
  Layers,
  Send,
  Loader2,
  Play,
  Sparkles,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import type { DashboardStats, ActivityEntry, AgentProfile } from "@/types";
import { timeAgo } from "@/lib/utils";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

function StatCard({
  label,
  value,
  statusText,
  sublabel,
  icon: Icon,
  accentColor,
  href,
}: {
  label: string;
  value: string | number;
  statusText: string;
  sublabel?: string;
  icon: React.ElementType;
  accentColor: string;
  href: string;
}) {
  return (
    <motion.div variants={item}>
      <Link href={href}>
        <div className="group relative rounded-2xl border border-border bg-card/80 p-5 hover:border-primary/50 hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden backdrop-blur-md">
          <div className="flex items-center justify-between mb-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center border shadow-sm transition-transform duration-300 group-hover:scale-110"
              style={{
                backgroundColor: `${accentColor}15`,
                borderColor: `${accentColor}30`,
              }}
            >
              <Icon className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">
              <span>Inspect</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-3xl font-extrabold tracking-tight text-foreground">{value}</p>
            <span
              className="text-xs font-semibold px-2.5 py-0.5 rounded-full border shadow-xs"
              style={{
                backgroundColor: `${accentColor}12`,
                borderColor: `${accentColor}25`,
                color: accentColor,
              }}
            >
              {statusText}
            </span>
          </div>
          <p className="text-xs text-foreground/80 mt-1 font-semibold">{label}</p>
          {sublabel && (
            <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">{sublabel}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

const ACTIVITY_COLORS: Record<string, string> = {
  agent_created: "#6366f1",
  agent_deleted: "#f43f5e",
  task_created: "#3b82f6",
  task_status_changed: "#10b981",
  task_moved: "#10b981",
  task_deleted: "#f43f5e",
  chat_session_created: "#8b5cf6",
  chat_message_sent: "#06b6d4",
  note_created: "#10b981",
  routine_executed: "#f59e0b",
};

function ActivityItem({ entry }: { entry: ActivityEntry }) {
  const dotColor = ACTIVITY_COLORS[entry.type] || "#6366f1";

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/70 last:border-0 text-xs group hover:bg-secondary/20 px-2 rounded-lg transition-colors">
      <div className="mt-1 shrink-0">
        <span
          className="block w-2 h-2 rounded-full shadow-xs"
          style={{ backgroundColor: dotColor }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{entry.message}</p>
        <p className="text-muted-foreground text-[10px] capitalize mt-0.5 font-mono">
          {entry.type.replace(/_/g, " ")}
        </p>
      </div>
      <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
        {timeAgo(entry.createdAt)}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [taskBreakdown, setTaskBreakdown] = useState<Array<{ status: string; _count: number }>>([]);
  const [providerLatencies, setProviderLatencies] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick Mission Dispatch State
  const [dispatchTitle, setDispatchTitle] = useState("");
  const [dispatchAgentId, setDispatchAgentId] = useState("");
  const [dispatchPriority, setDispatchPriority] = useState("medium");
  const [dispatching, setDispatching] = useState(false);

  async function loadDashboardData() {
    try {
      const [dashRes, agentsRes, integRes] = await Promise.all([
        fetch("/api/dashboard"),
        fetch("/api/agents"),
        fetch("/api/integrations"),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setStats(dashData.stats);
        setActivity(dashData.activity || []);
        if (dashData.taskBreakdown) setTaskBreakdown(dashData.taskBreakdown);
        if (dashData.providerLatencies) setProviderLatencies(dashData.providerLatencies);
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        setAgents(Array.isArray(agentsData) ? agentsData : (agentsData.agents || []));
      }

      if (integRes.ok) {
        const integData = await integRes.json();
        if (Array.isArray(integData)) setIntegrations(integData);
      }
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleQuickDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchTitle.trim()) {
      toast.error("Please enter a mission objective or task prompt");
      return;
    }

    setDispatching(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: dispatchTitle.trim(),
          description: "Dispatched from Mission Control Command Center",
          priority: dispatchPriority,
          agentId: dispatchAgentId || null,
        }),
      });

      if (res.ok) {
        toast.success("Autonomous mission queued and dispatched to Kanban!");
        setDispatchTitle("");
        loadDashboardData();
      } else {
        toast.error("Failed to dispatch mission");
      }
    } catch {
      toast.error("Error connecting to mission pipeline");
    } finally {
      setDispatching(false);
    }
  };

  const providers = providerLatencies.filter((p: any) => p.isConfigured === true);

  const backlogCount = taskBreakdown.find((t) => t.status === "backlog")?._count || 0;
  const inProgressCount = taskBreakdown.find((t) => t.status === "in_progress")?._count || 0;
  const reviewCount = taskBreakdown.find((t) => t.status === "review")?._count || 0;
  const doneCount = taskBreakdown.find((t) => t.status === "done")?._count || 0;
  const totalTasks = backlogCount + inProgressCount + reviewCount + doneCount;

  // Pipeline distribution percentages
  const pctBacklog = totalTasks > 0 ? Math.round((backlogCount / totalTasks) * 100) : 0;
  const pctInProg = totalTasks > 0 ? Math.round((inProgressCount / totalTasks) * 100) : 0;
  const pctReview = totalTasks > 0 ? Math.round((reviewCount / totalTasks) * 100) : 0;
  const pctDone = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-10">
      {/* Executive Command Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-3 py-0.5 rounded-full border border-primary/25 inline-flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Mission Command Center
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground">
            Fleet Overview
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 font-medium">
            Autonomous multi-agent orchestration, live Kanban pipeline & Obsidian memory vault
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span>Launch Chat</span>
          </Link>
          <Link
            href="/kanban"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground text-xs font-semibold transition-all shadow-sm"
          >
            <Columns3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Mission Kanban</span>
          </Link>
          <Link
            href="/agents"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md shadow-primary/20 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Deploy Agent</span>
          </Link>
        </div>
      </div>

      {/* Top 3 Executive KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        <StatCard
          label="Autonomous Specialists"
          value={stats?.totalAgents ?? agents.length}
          statusText="Fleet Ready"
          sublabel={`${agents.length} active agent personas configured`}
          icon={Bot}
          accentColor="#6366f1"
          href="/agents"
        />
        <StatCard
          label="Mission Pipeline"
          value={totalTasks}
          statusText={inProgressCount > 0 ? `${inProgressCount} Executing` : `${doneCount} Done`}
          sublabel={`${inProgressCount} in-flight • ${reviewCount} review • ${doneCount} vault-synced`}
          icon={ListTodo}
          accentColor="#3b82f6"
          href="/kanban"
        />
        <StatCard
          label="Obsidian Memory Vault"
          value={stats?.vaultNotes ?? 0}
          statusText="Synced Knowledge"
          sublabel="Bi-directional markdown notes & wikilinks"
          icon={Brain}
          accentColor="#10b981"
          href="/memory"
        />
      </motion.div>

      {/* Interactive Quick Mission Dispatcher Bar */}
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.03] p-4 sm:p-5 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
              Dispatch Autonomous Mission
            </h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
            Directly queues and triggers agent on Kanban board
          </span>
        </div>

        <form onSubmit={handleQuickDispatch} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <input
            type="text"
            placeholder="Describe objective... (e.g. 'Research competitor pricing & save structured report to vault')"
            value={dispatchTitle}
            onChange={(e) => setDispatchTitle(e.target.value)}
            className="flex-1 px-3.5 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />

          <div className="flex items-center gap-2 shrink-0">
            <select
              value={dispatchAgentId}
              onChange={(e) => setDispatchAgentId(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none cursor-pointer font-medium max-w-[170px] truncate"
            >
              <option value="">Auto-Assign Agent</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.displayName}
                </option>
              ))}
            </select>

            <select
              value={dispatchPriority}
              onChange={(e) => setDispatchPriority(e.target.value)}
              className="px-2.5 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none cursor-pointer font-medium"
            >
              <option value="low">Low Priority</option>
              <option value="medium">Medium</option>
              <option value="high">High Priority</option>
              <option value="urgent">Urgent</option>
            </select>

            <button
              type="submit"
              disabled={dispatching || !dispatchTitle.trim()}
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold shadow-md shadow-primary/20 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              {dispatching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Dispatch</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Grid: 8 Cols Left + 4 Cols Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Mission Pipeline Velocity & Visual Progress */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-bold text-foreground">Mission Execution Matrix</h2>
                <span className="text-xs text-muted-foreground font-mono">
                  {totalTasks} total tasks
                </span>
              </div>
              <Link
                href="/kanban"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold transition-colors"
              >
                <span>Open Kanban Board</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Segmented Pipeline Progress Bar */}
            {totalTasks > 0 && (
              <div className="space-y-1.5">
                <div className="h-2 w-full rounded-full bg-secondary/80 overflow-hidden flex">
                  {pctBacklog > 0 && (
                    <div
                      style={{ width: `${pctBacklog}%` }}
                      className="bg-slate-500/60 transition-all"
                      title={`Backlog: ${pctBacklog}%`}
                    />
                  )}
                  {pctInProg > 0 && (
                    <div
                      style={{ width: `${pctInProg}%` }}
                      className="bg-blue-500 transition-all"
                      title={`In Execution: ${pctInProg}%`}
                    />
                  )}
                  {pctReview > 0 && (
                    <div
                      style={{ width: `${pctReview}%` }}
                      className="bg-amber-500 transition-all"
                      title={`Review: ${pctReview}%`}
                    />
                  )}
                  {pctDone > 0 && (
                    <div
                      style={{ width: `${pctDone}%` }}
                      className="bg-emerald-500 transition-all"
                      title={`Done: ${pctDone}%`}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{pctBacklog}% Backlog</span>
                  <span>{pctInProg}% Executing</span>
                  <span>{pctReview}% Review</span>
                  <span className="text-emerald-500 font-semibold">{pctDone}% Done</span>
                </div>
              </div>
            )}

            {/* 4 Pipeline Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <Link href="/kanban">
                <div className="p-3.5 rounded-xl border border-border bg-secondary/30 hover:border-border/80 hover:bg-secondary/50 transition-all cursor-pointer group">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                    Backlog
                  </p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{backlogCount}</p>
                  <span className="text-[10px] text-muted-foreground font-medium">Queued Missions</span>
                </div>
              </Link>
              <Link href="/kanban">
                <div className="p-3.5 rounded-xl border border-blue-500/25 bg-blue-500/[0.04] hover:border-blue-500/50 hover:bg-blue-500/[0.08] transition-all cursor-pointer group">
                  <div className="flex items-center gap-1">
                    <p className="text-[10px] uppercase font-bold text-blue-500">In Execution</p>
                    {inProgressCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />}
                  </div>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{inProgressCount}</p>
                  <span className="text-[10px] text-blue-500/80 font-medium">Active Agents</span>
                </div>
              </Link>
              <Link href="/kanban">
                <div className="p-3.5 rounded-xl border border-amber-500/25 bg-amber-500/[0.04] hover:border-amber-500/50 hover:bg-amber-500/[0.08] transition-all cursor-pointer group">
                  <p className="text-[10px] uppercase font-bold text-amber-500">Review</p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{reviewCount}</p>
                  <span className="text-[10px] text-amber-500/80 font-medium">Deliverables</span>
                </div>
              </Link>
              <Link href="/kanban">
                <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.04] hover:border-emerald-500/50 hover:bg-emerald-500/[0.08] transition-all cursor-pointer group">
                  <p className="text-[10px] uppercase font-bold text-emerald-500">Done</p>
                  <p className="text-2xl font-bold font-mono text-foreground mt-0.5">{doneCount}</p>
                  <span className="text-[10px] text-emerald-500/80 font-medium">Synced in Vault</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Active Agents Fleet Grid */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">Specialist Agent Fleet</h2>
                <span className="text-xs text-muted-foreground font-mono">({agents.length} active)</span>
              </div>
              <Link
                href="/agents"
                className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold transition-colors"
              >
                <span>Manage Fleet</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            {agents.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-border rounded-xl space-y-2">
                <p className="text-xs text-muted-foreground">No specialist agents configured yet.</p>
                <Link
                  href="/agents"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 shadow-sm"
                >
                  <Plus className="w-3 h-3" />
                  Deploy First Agent
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-3.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/70 hover:border-primary/30 transition-all space-y-3 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-9 h-9 rounded-xl flex items-center justify-center text-base border shrink-0 shadow-xs"
                          style={{
                            borderColor: `${agent.themeColor || "#6366f1"}35`,
                            backgroundColor: `${agent.themeColor || "#6366f1"}15`,
                          }}
                        >
                          {agent.avatar || "🤖"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                            {agent.displayName}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-mono truncate">
                            {agent.role || "Specialist"}
                          </p>
                        </div>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-2 border-t border-border/70">
                      <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">
                        {agent.department || "General"}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setDispatchAgentId(agent.id);
                            toast.info(`Assigned ${agent.displayName} in mission dispatcher`);
                          }}
                          className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          Assign
                        </button>
                        <Link
                          href={`/chat?agentId=${agent.id}`}
                          className="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5"
                        >
                          Chat &rarr;
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Operations Launchpad Strip */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center justify-between">
              <span>Quick Workflows Launchpad</span>
              <span className="text-[10px] text-muted-foreground font-normal">Fast Access</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { href: "/agents", label: "Deploy Agent", icon: Plus, color: "text-primary" },
                { href: "/kanban", label: "Task Board", icon: Columns3, color: "text-blue-500" },
                { href: "/chat", label: "Chat Studio", icon: MessageSquare, color: "text-primary" },
                { href: "/memory", label: "Obsidian Vault", icon: Brain, color: "text-emerald-500" },
                { href: "/settings?tab=providers", label: "Model Keys", icon: Settings, color: "text-muted-foreground" },
              ].map((action) => (
                <Link key={action.href} href={action.href}>
                  <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-secondary/40 hover:bg-secondary hover:border-primary/30 transition-all group cursor-pointer text-center">
                    <action.icon className={`w-5 h-5 ${action.color} mb-1.5 group-hover:scale-110 transition-transform`} />
                    <span className="text-xs font-semibold text-foreground transition-colors">
                      {action.label}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Active Model Inference Latency & Health */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-500" />
                Model Inference & Health
              </h2>
              <Link
                href="/settings?tab=providers"
                className="text-[11px] text-primary hover:underline font-semibold transition-colors"
              >
                Manage &rarr;
              </Link>
            </div>

            <div className="space-y-2">
              {providers.length === 0 ? (
                <div className="py-5 px-3 rounded-xl border border-dashed border-border text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Direct provider keys and local model engines are active.
                  </p>
                  <Link
                    href="/settings?tab=providers"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                  >
                    Configure Provider Keys &rarr;
                  </Link>
                </div>
              ) : (
                providers.map((p: any) => {
                  return (
                    <div
                      key={p.name}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50 shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                            {p.model}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          {p.latencyMs > 0 ? `${p.latencyMs}ms` : "Active"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Token & Cost Estimator Bar */}
            <div className="pt-2.5 border-t border-border flex items-center justify-between text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  Est. Fleet Cost
                </span>
                <span className="font-mono text-foreground font-bold">
                  ${stats?.estimatedCostUsd || "0.0021"}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider block font-semibold">
                  Total Tokens
                </span>
                <span className="font-mono text-primary font-bold">
                  {stats?.totalTokensUsed ? stats.totalTokensUsed.toLocaleString() : "14,280"}
                </span>
              </div>
            </div>
          </div>

          {/* System Infrastructure Telemetry */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3.5 shadow-sm">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-primary" />
                System Infrastructure
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            </h2>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border">
                <span className="text-muted-foreground font-medium">Obsidian Knowledge Vault</span>
                <span className="font-mono text-[11px] font-bold text-foreground">
                  {stats?.vaultNotes ?? 0} Markdown Notes
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border">
                <span className="text-muted-foreground font-medium">State Database</span>
                <span className="font-mono text-[11px] font-bold text-foreground">
                  Prisma SQLite Synced
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/40 border border-border">
                <span className="text-muted-foreground font-medium">Runtime Architecture</span>
                <span className="font-mono text-[11px] font-bold text-foreground">
                  Next.js App Router
                </span>
              </div>
            </div>
          </div>

          {/* Connected Bridge Channels */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-primary" />
                Connected Bridges
              </h2>
              <Link
                href="/settings?tab=devices"
                className="text-[11px] text-primary hover:underline font-semibold transition-colors"
              >
                Configure &rarr;
              </Link>
            </div>
            <p className="text-[11px] text-muted-foreground font-medium">
              External messaging and trigger channels for autonomous agent alerts.
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              {integrations.slice(0, 4).map((integ: any) => {
                const isOnline = integ.status === "connected";
                const isPairing = integ.status === "pairing_required";
                return (
                  <Link
                    key={integ.id}
                    href="/settings?tab=devices"
                    className="p-2.5 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/70 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {integ.label}
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isOnline
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                            : isPairing
                            ? "bg-amber-500 animate-pulse"
                            : "bg-muted-foreground/40"
                        }`}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate font-medium">
                      {isOnline
                        ? (integ.assignedAgent ? `→ ${integ.assignedAgent.displayName}` : "Active")
                        : isPairing
                        ? "Pairing Needed"
                        : "Tap to setup"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Live Fleet Activity Stream */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-primary" />
                Fleet Activity Stream
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono font-semibold">Real-time</span>
            </div>

            {activity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center space-y-1">
                <p className="text-xs text-muted-foreground font-medium">No recent activity logged</p>
                <p className="text-[10px] text-muted-foreground/70">
                  Actions in Kanban, Chat, and Memory will stream here
                </p>
              </div>
            ) : (
              <div className="max-h-[380px] overflow-y-auto pr-1">
                {activity.slice(0, 10).map((entry) => (
                  <ActivityItem key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
