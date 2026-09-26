"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  Bot,
  Brain,
  Columns3,
  CalendarClock,
  MessageSquare,
  Settings,
  Mic,
  Coins,
  Sun,
  Moon,
  Crown,
  Sparkles,
  ArrowRight,
  X,
  FileText,
  ListTodo,
  Layers,
  Plus,
  Zap,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import type { AgentProfile, TaskItem } from "@/types";

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVoice: () => void;
  onOpenCostTracker: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenVoice,
  onOpenCostTracker,
}: CommandPaletteProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Fetch agents and tasks for instant omni-search
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    setSelectedIndex(0);

    Promise.all([
      fetch("/api/agents").then((r) => r.json()).catch(() => []),
      fetch("/api/tasks").then((r) => r.json()).catch(() => []),
    ]).then(([agentsData, tasksData]) => {
      setAgents(Array.isArray(agentsData) ? agentsData : agentsData.agents || []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
    });
  }, [isOpen]);

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard, category: "Navigation" },
    { label: "Autonomous Agents", href: "/agents", icon: Bot, category: "Navigation" },
    { label: "Kanban Board", href: "/kanban", icon: Columns3, category: "Navigation" },
    { label: "Memory Galaxy Vault", href: "/memory", icon: Brain, category: "Navigation" },
    { label: "Scheduled Routines", href: "/routines", icon: CalendarClock, category: "Navigation" },
    { label: "Chat & Debates", href: "/chat", icon: MessageSquare, category: "Navigation" },
    { label: "Settings & MCP Hub", href: "/settings", icon: Settings, category: "Navigation" },
  ];

  const actionItems = [
    {
      id: "briefing",
      label: "Generate Daily Morning Briefing",
      desc: "Proactive synthesis of tasks, wins & priorities with audio narration",
      icon: Sun,
      category: "Quick Actions",
      perform: async () => {
        onClose();
        toast.promise(fetch("/api/routines/briefing", { method: "POST" }).then((r) => r.json()), {
          loading: "Synthesizing executive morning briefing...",
          success: "Briefing created & saved to Obsidian Vault!",
          error: "Failed to generate briefing",
        });
        router.push("/");
      },
    },
    {
      id: "braindump",
      label: "Voice & Text Brain Dump",
      desc: "Dictate raw thoughts & auto-decompose into Kanban tickets",
      icon: Brain,
      category: "Quick Actions",
      perform: () => {
        onClose();
        router.push("/?dump=true");
      },
    },
    {
      id: "packs",
      label: "Deploy Agent Starter Packs",
      desc: "1-Click deploy specialized fleets (Solopreneurs, Researchers, Creators)",
      icon: Sparkles,
      category: "Quick Actions",
      perform: () => {
        onClose();
        router.push("/agents?packs=true");
      },
    },
    {
      id: "voice",
      label: "Start Gemini Live Voice Session",
      desc: "Real-time bidirectional speech conversation (Alt+V)",
      icon: Mic,
      category: "Quick Actions",
      perform: () => {
        onClose();
        onOpenVoice();
      },
    },
    {
      id: "telemetry",
      label: "View Token & Cost Tracker",
      desc: "Token consumption, provider pricing & spend (Alt+C)",
      icon: Coins,
      category: "Quick Actions",
      perform: () => {
        onClose();
        onOpenCostTracker();
      },
    },
    {
      id: "theme",
      label: `Switch to ${theme === "dark" ? "Light" : "Dark"} Mode`,
      desc: "Toggle application appearance theme",
      icon: theme === "dark" ? Sun : Moon,
      category: "Quick Actions",
      perform: () => {
        setTheme(theme === "dark" ? "light" : "dark");
        onClose();
      },
    },
    {
      id: "a2a",
      label: "Launch A2A Chain of Command Mission",
      desc: "Decompose mission across agent hierarchy",
      icon: Crown,
      category: "Quick Actions",
      perform: () => {
        onClose();
        router.push("/agents");
      },
    },
    {
      id: "pipeline",
      label: "Autonomous Pipeline DAG Builder",
      desc: "Sequential specialist feature delivery pipeline",
      icon: Layers,
      category: "Quick Actions",
      perform: () => {
        onClose();
        router.push("/agents?tab=pipeline");
      },
    },
    {
      id: "new-task",
      label: "Create New Kanban Task",
      desc: "Define title, priority, instructions and auto-assign specialist",
      icon: Plus,
      category: "Quick Actions",
      perform: () => {
        onClose();
        router.push("/kanban?new=true");
      },
    },
    {
      id: "sync-vault",
      label: "Sync Obsidian Vault & Galaxy Graph",
      desc: "Refresh markdown notes and 3D force physics graph",
      icon: Brain,
      category: "Quick Actions",
      perform: async () => {
        onClose();
        toast.promise(fetch("/api/vault").then((r) => r.json()), {
          loading: "Syncing Obsidian Vault notes...",
          success: "Vault synchronized with 3D Knowledge Galaxy!",
          error: "Failed to sync vault",
        });
      },
    },
  ];

  // Filtered matching items
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actionItems;
    const q = query.toLowerCase();
    return actionItems.filter(
      (a) => a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q)
    );
  }, [query, actionItems]);

  const filteredNav = useMemo(() => {
    if (!query.trim()) return navItems;
    const q = query.toLowerCase();
    return navItems.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  const filteredAgents = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return agents.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        (a.role && a.role.toLowerCase().includes(q))
    ).slice(0, 4);
  }, [query, agents]);

  const filteredTasks = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return tasks.filter((t) => t.title.toLowerCase().includes(q)).slice(0, 4);
  }, [query, tasks]);

  // Combined selectable list for keyboard navigation in EXACT visual rendering order:
  // 1. Actions -> 2. Nav -> 3. Agents -> 4. Tasks
  const allSelectableItems = useMemo(() => {
    const list: Array<{ type: string; id: string; action: () => void }> = [];
    filteredActions.forEach((a) =>
      list.push({
        type: "action",
        id: a.id,
        action: a.perform,
      })
    );
    filteredNav.forEach((n) =>
      list.push({
        type: "nav",
        id: n.href,
        action: () => {
          onClose();
          router.push(n.href);
        },
      })
    );
    filteredAgents.forEach((ag) =>
      list.push({
        type: "agent",
        id: ag.id,
        action: () => {
          onClose();
          router.push(`/chat?agentId=${ag.id}`);
        },
      })
    );
    filteredTasks.forEach((tk) =>
      list.push({
        type: "task",
        id: tk.id,
        action: () => {
          onClose();
          router.push("/kanban");
        },
      })
    );
    return list;
  }, [filteredActions, filteredNav, filteredAgents, filteredTasks, onClose, router]);

  // Reset selectedIndex within bounds when results change
  useEffect(() => {
    if (selectedIndex >= allSelectableItems.length) {
      setSelectedIndex(0);
    }
  }, [allSelectableItems.length, selectedIndex]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % Math.max(1, allSelectableItems.length));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev <= 0 ? Math.max(0, allSelectableItems.length - 1) : prev - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (allSelectableItems[selectedIndex]) {
          allSelectableItems[selectedIndex].action();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedIndex, allSelectableItems, onClose]);

  if (!isOpen) return null;

  let currentGlobalIdx = 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xl rounded-2xl border border-border bg-card text-foreground shadow-2xl overflow-hidden flex flex-col max-h-[560px]"
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-secondary/20 shrink-0">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Type a command, page, agent, or task..."
              className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-secondary text-muted-foreground border border-border">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3 divide-y divide-border/50">
            {/* Quick Actions */}
            {filteredActions.length > 0 && (
              <div className="pt-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 block">
                  Quick Actions
                </span>
                <div className="space-y-0.5">
                  {filteredActions.map((act) => {
                    const itemIdx = currentGlobalIdx++;
                    const isSelected = selectedIndex === itemIdx;

                    return (
                      <button
                        key={act.id}
                        onClick={act.perform}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer text-left group ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30 text-foreground"
                            : "hover:bg-secondary/70 border border-transparent text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg ${isSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"}`}>
                            <act.icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">
                              {act.label}
                            </span>
                            <span className="text-[11px] text-muted-foreground block truncate">
                              {act.desc}
                            </span>
                          </div>
                        </div>
                        <ArrowRight className={`w-3.5 h-3.5 text-muted-foreground transition shrink-0 ${isSelected ? "opacity-100 text-primary" : "opacity-0 group-hover:opacity-100"}`} />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Navigation Pages */}
            {filteredNav.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 block">
                  Navigation
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {filteredNav.map((nav) => {
                    const itemIdx = currentGlobalIdx++;
                    const isSelected = selectedIndex === itemIdx;

                    return (
                      <button
                        key={nav.href}
                        onClick={() => {
                          onClose();
                          router.push(nav.href);
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                        className={`flex items-center gap-2.5 p-2 rounded-xl text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30 text-foreground"
                            : "hover:bg-secondary/70 border border-transparent text-foreground"
                        }`}
                      >
                        <nav.icon className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <span className="font-medium">{nav.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Matching Agents */}
            {filteredAgents.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 block">
                  Agents ({filteredAgents.length})
                </span>
                <div className="space-y-0.5">
                  {filteredAgents.map((ag) => {
                    const itemIdx = currentGlobalIdx++;
                    const isSelected = selectedIndex === itemIdx;

                    return (
                      <button
                        key={ag.id}
                        onClick={() => {
                          onClose();
                          router.push(`/chat?agentId=${ag.id}`);
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30 text-foreground"
                            : "hover:bg-secondary/70 border border-transparent text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">{ag.avatar || "🤖"}</span>
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">
                              {ag.displayName}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground font-mono">
                              {ag.role}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10.5px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                          Open Chat
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Matching Tasks */}
            {filteredTasks.length > 0 && (
              <div className="pt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1 block">
                  Tasks ({filteredTasks.length})
                </span>
                <div className="space-y-0.5">
                  {filteredTasks.map((tk) => {
                    const itemIdx = currentGlobalIdx++;
                    const isSelected = selectedIndex === itemIdx;

                    return (
                      <button
                        key={tk.id}
                        onClick={() => {
                          onClose();
                          router.push("/kanban");
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 border border-primary/30 text-foreground"
                            : "hover:bg-secondary/70 border border-transparent text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <ListTodo className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="font-medium truncate">{tk.title}</span>
                        </div>
                        <span className="text-[10px] font-mono uppercase bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                          {tk.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="px-4 py-2 border-t border-border bg-secondary/30 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-3">
              <span>Use <kbd className="font-mono">↑</kbd> <kbd className="font-mono">↓</kbd> to navigate</span>
              <span><kbd className="font-mono">↵</kbd> to select</span>
            </div>
            <span>Press <kbd className="font-mono">Ctrl+K</kbd> anywhere</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
