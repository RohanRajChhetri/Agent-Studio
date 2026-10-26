"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Command,
  LayoutDashboard,
  Bot,
  Users,
  Brain,
  Columns3,
  Code,
  CalendarClock,
  MessageSquare,
  Settings,
  Mic,
  Coins,
  Play,
  ArrowRight,
  FolderSync,
  Sparkles,
  X,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { useDashboardChat } from "@/context/dashboard-chat-context";

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: "Navigation" | "Agents" | "Quick Action";
  icon: any;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [agents, setAgents] = useState<{ id: string; name: string; displayName: string; avatar: string; role: string }[]>([]);
  const { openAgentChat } = useDashboardChat();

  // Load agents for quick summoning
  useEffect(() => {
    fetch("/api/agents")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => {});
  }, []);

  // Global shortcut: Cmd+K, Ctrl+K, Cmd+/, or ?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTargetInput = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (
        ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "k" || e.key === "/")) ||
        (e.key === "?" && !isTargetInput)
      ) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    const handleCustomOpen = () => setIsOpen(true);

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomOpen);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomOpen);
    };
  }, [isOpen]);

  // Reset selection index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearch("");
  }, []);

  const commands: CommandItem[] = useMemo(() => {
    const navCommands: CommandItem[] = [
      {
        id: "nav-dashboard",
        title: "Go to Dashboard",
        subtitle: "Main operations overview & fleet status",
        category: "Navigation",
        icon: LayoutDashboard,
        action: () => { router.push("/"); close(); },
      },
      {
        id: "nav-agents",
        title: "Go to Agents Fleet",
        subtitle: "Configure autonomous agent workforce & roles",
        category: "Navigation",
        icon: Bot,
        action: () => { router.push("/agents"); close(); },
      },
      {
        id: "nav-workflows",
        title: "Go to Visual DAG Workflows",
        subtitle: "Design and execute multi-agent swarm DAG pipelines",
        category: "Navigation",
        icon: Workflow,
        action: () => { router.push("/workflows"); close(); },
      },
      {
        id: "nav-conference",
        title: "Go to Conference Room",
        subtitle: "Multi-agent roundtable discussion & deliberation",
        category: "Navigation",
        icon: Users,
        action: () => { router.push("/conference"); close(); },
      },
      {
        id: "nav-memory",
        title: "Go to Memory Vault",
        subtitle: "Obsidian 3D galaxy graph & knowledge base",
        category: "Navigation",
        icon: Brain,
        action: () => { router.push("/memory"); close(); },
      },
      {
        id: "nav-kanban",
        title: "Go to Kanban Workspace",
        subtitle: "Autonomous task queue, review & deliverables",
        category: "Navigation",
        icon: Columns3,
        action: () => { router.push("/kanban"); close(); },
      },
      {
        id: "nav-code",
        title: "Go to Code & Project Builder",
        subtitle: "Multi-file application scaffold & interactive preview",
        category: "Navigation",
        icon: Code,
        action: () => { router.push("/code"); close(); },
      },
      {
        id: "nav-routines",
        title: "Go to Routines & Cron",
        subtitle: "Scheduled autonomous briefing & automation jobs",
        category: "Navigation",
        icon: CalendarClock,
        action: () => { router.push("/routines"); close(); },
      },
      {
        id: "nav-chat",
        title: "Go to Chat Hub",
        subtitle: "Deep contextual conversation & threads",
        category: "Navigation",
        icon: MessageSquare,
        action: () => { router.push("/chat"); close(); },
      },
      {
        id: "nav-settings",
        title: "Go to Settings",
        subtitle: "Model providers, MCP servers & integrations",
        category: "Navigation",
        icon: Settings,
        action: () => { router.push("/settings"); close(); },
      },
    ];

    const actionCommands: CommandItem[] = [
      {
        id: "act-voice",
        title: "Launch Live Voice Cockpit",
        subtitle: "Talk directly with Gemini Live audio orb",
        category: "Quick Action",
        icon: Mic,
        shortcut: "Alt+V",
        action: () => {
          window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
          close();
        },
      },
      {
        id: "act-cost",
        title: "Open Token & Cost Telemetry",
        subtitle: "Inspect real-time token spend and latency",
        category: "Quick Action",
        icon: Coins,
        shortcut: "Alt+C",
        action: () => {
          router.push("/settings?tab=analytics");
          close();
        },
      },
      {
        id: "act-sync-vault",
        title: "Sync Obsidian Knowledge Vault",
        subtitle: "Re-index markdown notes, wikilinks and tasks",
        category: "Quick Action",
        icon: FolderSync,
        action: async () => {
          close();
          toast.promise(
            fetch("/api/vault/sync", { method: "POST" }),
            {
              loading: "Synchronizing Obsidian vault...",
              success: "Obsidian knowledge vault synced successfully!",
              error: "Failed to sync knowledge vault",
            }
          );
        },
      },
      {
        id: "act-run-kanban",
        title: "Execute Top Pending Kanban Task",
        subtitle: "Dispatch autonomous agent to solve first backlog item",
        category: "Quick Action",
        icon: Play,
        action: async () => {
          close();
          toast.info("Triggering autonomous Kanban task execution...");
          router.push("/kanban");
        },
      },
      {
        id: "act-shortcuts",
        title: "Keyboard Shortcuts Quick Reference",
        subtitle: "Cmd+K (Palette) · Cmd+/ (Help) · Alt+V (Code Split) · Alt+C (Chat) · Esc (Dismiss)",
        category: "Quick Action",
        icon: Sparkles,
        shortcut: "⌘/",
        action: () => {
          toast.info("Global Shortcuts: Cmd+K (Palette), Cmd+/ (Help), Alt+V (Code Split), Alt+C (Agent Chat), Esc (Close Modal/Drawer)");
        },
      },
    ];

    const agentCommands: CommandItem[] = agents.map((agent) => ({
      id: `agent-${agent.id}`,
      title: `Summon ${agent.displayName}`,
      subtitle: `${agent.role} · ${agent.name}`,
      category: "Agents",
      icon: Sparkles,
      action: () => {
        openAgentChat(agent as any);
        close();
      },
    }));

    return [...actionCommands, ...navCommands, ...agentCommands];
  }, [router, agents, close, openAgentChat]);

  const filteredCommands = useMemo(() => {
    if (!search.trim()) return commands;
    const q = search.toLowerCase();
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    );
  }, [commands, search]);

  const handleSelect = (item: CommandItem) => {
    item.action();
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (filteredCommands.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const current = filteredCommands[selectedIndex];
      if (current) handleSelect(current);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
          />

          {/* Dialog Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-2xl bg-card/95 border border-border/80 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-xl z-[101]"
          >
            {/* Header Search Box */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/80 bg-background/50">
              <Search className="w-5 h-5 text-muted-foreground shrink-0" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDownList}
                placeholder="Type a command, summon an agent, or search..."
                className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded-md">
                  ESC
                </kbd>
                <button
                  onClick={close}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Results List */}
            <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-border/20">
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No matching commands or agents found for &quot;{search}&quot;.
                </div>
              ) : (
                filteredCommands.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`p-1.5 rounded-lg shrink-0 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate flex items-center gap-2">
                            <span>{item.title}</span>
                            <span
                              className={`text-[9.5px] px-1.5 py-0.2 rounded font-mono ${
                                isSelected
                                  ? "bg-white/20 text-white"
                                  : "bg-secondary text-muted-foreground"
                              }`}
                            >
                              {item.category}
                            </span>
                          </div>
                          {item.subtitle && (
                            <p
                              className={`text-[11px] truncate ${
                                isSelected
                                  ? "text-white/80"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {item.shortcut && (
                          <kbd
                            className={`px-1.5 py-0.5 text-[9.5px] font-mono rounded ${
                              isSelected
                                ? "bg-white/20 text-white"
                                : "bg-muted text-muted-foreground border border-border"
                            }`}
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                        <ArrowRight
                          className={`w-3.5 h-3.5 transition-transform ${
                            isSelected
                              ? "translate-x-0.5 opacity-100"
                              : "opacity-0"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer Hotkey Tips */}
            <div className="px-4 py-2 bg-muted/40 border-t border-border flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[9.5px]">↑↓</kbd> Navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[9.5px]">↵</kbd> Select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[9.5px]">Esc</kbd> Close
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono text-[9.5px]">⌘K / ⌘/</kbd> Toggle
                </span>
              </div>
              <span className="font-mono text-[10px] hidden sm:inline">Agent Studio OS Cockpit</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
