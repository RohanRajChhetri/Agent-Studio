"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  X,
  ChevronUp,
  ChevronDown,
  Terminal,
  ExternalLink,
  Volume2,
  VolumeX,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

interface ActivityEvent {
  id: string;
  agentName: string;
  agentAvatar: string;
  action: string;
  target: string;
  timestamp: string;
  type: "routine" | "kanban" | "vault" | "terminal";
  link?: string;
}

const SAMPLE_EVENTS: ActivityEvent[] = [
  {
    id: "evt-1",
    agentName: "Vulcan DevOps",
    agentAvatar: "🛠️",
    action: "Completed container audit",
    target: "Docker health verified (0 errors)",
    timestamp: "Just now",
    type: "routine",
    link: "/kanban",
  },
  {
    id: "evt-2",
    agentName: "Athena Researcher",
    agentAvatar: "🦉",
    action: "Synchronized market brief",
    target: "Saved to Obsidian Vault [[swarms/market-scan.md]]",
    timestamp: "2m ago",
    type: "vault",
    link: "/memory",
  },
  {
    id: "evt-3",
    agentName: "Cipher Security",
    agentAvatar: "🛡️",
    action: "Inspected dependency tree",
    target: "All 42 packages hardened",
    timestamp: "5m ago",
    type: "kanban",
    link: "/kanban",
  },
];

interface AgentItem {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  role?: string;
  model?: string;
  status: string;
  department?: string;
}

export function FleetActivityStream() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"stream" | "agents">("stream");
  const [events, setEvents] = useState<ActivityEvent[]>(SAMPLE_EVENTS);
  const [fleetAgents, setFleetAgents] = useState<AgentItem[]>([]);
  const [activeAgentCount, setActiveAgentCount] = useState(0);
  const [totalAgentCount, setTotalAgentCount] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Poll recent activity logs and active agent count from API
  useEffect(() => {
    const fetchRecentLogs = async () => {
      try {
        const res = await fetch("/api/dashboard");
        if (res.ok) {
          const data = await res.json();

          // Process fleet agents
          if (Array.isArray(data.fleetSummary) && data.fleetSummary.length > 0) {
            setFleetAgents(
              data.fleetSummary.map((f: any) => ({
                id: f.id,
                name: f.name,
                displayName: f.displayName,
                avatar: f.avatar || "🤖",
                role: f.role || "specialist",
                model: f.model || "auto/fast",
                status: f.status || "offline",
                department: f.department || "General",
              }))
            );
            const total = data.fleetSummary.length;
            const online = data.fleetSummary.filter(
              (a: any) => a.status === "online" || a.status === "busy"
            ).length;
            setTotalAgentCount(total);
            setActiveAgentCount(online > 0 ? online : total);
          } else if (data.stats?.totalAgents) {
            setTotalAgentCount(data.stats.totalAgents);
            setActiveAgentCount(data.stats.onlineAgents || data.stats.totalAgents);
          }

          const rawList = Array.isArray(data.activity)
            ? data.activity
            : Array.isArray(data.recentActivities)
            ? data.recentActivities
            : [];

          if (rawList.length > 0) {
            const agentMap = new Map<string, { displayName: string; avatar: string }>();
            if (Array.isArray(data.fleetSummary)) {
              data.fleetSummary.forEach((f: any) => {
                agentMap.set(f.id, { displayName: f.displayName, avatar: f.avatar || "🤖" });
              });
            }

            const formatRelTime = (dateStr: string) => {
              if (!dateStr) return "Just now";
              const diff = Date.now() - new Date(dateStr).getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 1) return "Just now";
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs}h ago`;
              return `${Math.floor(hrs / 24)}d ago`;
            };

            const mapped: ActivityEvent[] = rawList.slice(0, 10).map((a: any, idx: number) => {
              const matchedAgent = a.agentId ? agentMap.get(a.agentId) : null;
              const type =
                a.type === "llm_completion"
                  ? "routine"
                  : a.type === "task_moved"
                  ? "kanban"
                  : a.type === "vault_sync"
                  ? "vault"
                  : a.type === "device_connected" || a.type === "device_message"
                  ? "terminal"
                  : "terminal";

              const link =
                type === "vault" ? "/memory" : type === "routine" ? "/chat" : "/kanban";

              return {
                id: a.id || `act-${idx}`,
                agentName: matchedAgent?.displayName || a.agentName || "Autonomous Agent",
                agentAvatar: matchedAgent?.avatar || a.agentAvatar || "🤖",
                action:
                  a.type === "llm_completion"
                    ? "LLM Inference Completed"
                    : a.type === "device_connected"
                    ? "Device Bridge Active"
                    : a.message?.slice(0, 36) || "Executed step",
                target: a.message || a.target || "System Orchestrator",
                timestamp: formatRelTime(a.createdAt || a.timestamp),
                type,
                link,
              };
            });
            setEvents(mapped);
          }
        }
      } catch {
        // Retain current events on error
      }
    };

    fetchRecentLogs();
    const interval = setInterval(fetchRecentLogs, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40 font-sans select-none">
      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="w-80 sm:w-96 rounded-2xl border border-border bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden flex flex-col max-h-[500px]"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-border bg-secondary/70 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-foreground">
                    Fleet Telemetry Stream
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/15 text-primary border border-primary/20">
                    {activeAgentCount} Online
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setSoundEnabled(!soundEnabled);
                      toast.info(soundEnabled ? "Notifications muted" : "Notifications unmuted");
                    }}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title={soundEnabled ? "Mute notifications" : "Unmute notifications"}
                  >
                    {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Minimize"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Sub-tabs: Stream vs Agents Online */}
              <div className="flex items-center gap-1 bg-secondary/80 p-0.5 rounded-xl border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setTab("stream")}
                  className={`flex-1 py-1 px-2.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${
                    tab === "stream"
                      ? "bg-card text-foreground font-semibold shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Activity Stream ({events.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTab("agents")}
                  className={`flex-1 py-1 px-2.5 rounded-lg font-medium text-[11px] transition-all cursor-pointer ${
                    tab === "agents"
                      ? "bg-card text-foreground font-semibold shadow-sm border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Agents Online ({fleetAgents.length > 0 ? fleetAgents.length : totalAgentCount})
                </button>
              </div>
            </div>

            {/* Tab 1: Live Activity Stream */}
            {tab === "stream" && (
              <div className="p-3 overflow-y-auto space-y-2 flex-1 divide-y divide-border/30">
                {events.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground space-y-1">
                    <p>No recent activity events yet.</p>
                    <p className="text-[11px]">Chat with an agent or trigger a routine to stream live logs.</p>
                  </div>
                ) : (
                  events.map((evt) => (
                    <div key={evt.id} className="pt-2 first:pt-0 space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <span>{evt.agentAvatar}</span>
                          <span>{evt.agentName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {evt.timestamp}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed pl-5">
                        {evt.action}: <span className="text-foreground font-medium">{evt.target}</span>
                      </p>

                      {evt.link && (
                        <div className="pl-5 pt-0.5">
                          <Link
                            href={evt.link}
                            onClick={() => setIsOpen(false)}
                            className="inline-flex items-center gap-1 text-[10.5px] text-primary hover:underline font-medium"
                          >
                            <span>View Details</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Agents Online Fleet Roster */}
            {tab === "agents" && (
              <div className="p-3 overflow-y-auto space-y-2 flex-1">
                {fleetAgents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    No agents found in fleet.
                  </div>
                ) : (
                  fleetAgents.map((ag) => (
                    <div
                      key={ag.id}
                      className="p-2.5 rounded-xl border border-border bg-secondary/30 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base shrink-0">{ag.avatar}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground truncate">
                              {ag.displayName}
                            </span>
                            <span className="w-2 h-2 rounded-full shrink-0 bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                          </div>
                          <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                            {ag.role} &bull; {ag.model || "auto/fast"}
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/chat?agentId=${ag.id}`}
                        onClick={() => setIsOpen(false)}
                        className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[11px] font-semibold transition-all shrink-0"
                      >
                        Chat &rarr;
                      </Link>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-border bg-secondary/40 flex items-center justify-between text-[11px] font-mono text-muted-foreground">
              <span>OmniRoute Gateway Active</span>
              <Link
                href="/agents"
                onClick={() => setIsOpen(false)}
                className="text-primary hover:underline font-sans font-semibold text-xs"
              >
                Fleet Manager &rarr;
              </Link>
            </div>
          </motion.div>
        ) : (
          /* Minimized Floating Ticker Pill */
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-full border border-border bg-card/90 backdrop-blur-xl shadow-xl hover:bg-secondary/70 text-foreground transition-all cursor-pointer group"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>

            <div className="flex items-center gap-1.5 font-mono text-xs">
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span className="font-semibold text-foreground text-[11.5px]">Fleet Stream</span>
              <span className="text-muted-foreground text-[10.5px] hidden sm:inline">
                ({activeAgentCount > 0 ? activeAgentCount : fleetAgents.length} active)
              </span>
            </div>

            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
