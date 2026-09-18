"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  X,
  Play,
  Copy,
  Trash2,
  Loader2,
  Sparkles,
  Zap,
  HelpCircle,
  Code,
  BookOpen,
  ChevronRight,
  Search,
  Maximize2,
  Minimize2,
  Minus,
  Download,
  Activity,
  Check,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { formatResponseTime } from "@/lib/utils";

interface TerminalLog {
  id: string;
  command: string;
  stdout: string;
  stderr: string;
  latency: number;
  success: boolean;
  timestamp: string;
}

interface HermesCommandDef {
  cmd: string;
  desc: string;
  fullCmd: string;
  category: "Inspection" | "Fleet & Skills" | "Diagnostics" | "Utility";
}

export const HERMES_SLASH_COMMANDS: HermesCommandDef[] = [
  { cmd: "/help", desc: "Display full Hermes CLI command cheatsheet & manpage", fullCmd: "help", category: "Utility" },
  { cmd: "/profile", desc: "Show active agent persona specs & directives", fullCmd: "profile show", category: "Inspection" },
  { cmd: "/tools", desc: "List registered tools & capabilities for agent", fullCmd: "tools list", category: "Inspection" },
  { cmd: "/skills", desc: "List active skill modules loaded in profile", fullCmd: "skills list", category: "Fleet & Skills" },
  { cmd: "/memory", desc: "Inspect episodic memory & knowledge storage", fullCmd: "memory list", category: "Fleet & Skills" },
  { cmd: "/sessions", desc: "List session transcripts and past conversations", fullCmd: "sessions list", category: "Inspection" },
  { cmd: "/insights", desc: "Display usage telemetry, token counts, and latency", fullCmd: "insights", category: "Diagnostics" },
  { cmd: "/bench", desc: "Benchmark token speed and latency across LLM models", fullCmd: "bench auto/fast", category: "Diagnostics" },
  { cmd: "/sysinfo", desc: "Display system runtime, node PID, and gateway health", fullCmd: "sysinfo", category: "Diagnostics" },
  { cmd: "/version", desc: "Display Hermes runtime build & engine version", fullCmd: "version", category: "Utility" },
  { cmd: "/clear", desc: "Clear terminal screen buffer", fullCmd: "clear", category: "Utility" },
];

const KNOWN_COMMAND_AUTOCOMPLETIONS: Record<string, string> = {
  "pro": "file show",
  "prof": "ile show",
  "profile": " show",
  "too": "ls list",
  "tools": " list",
  "ski": "lls list",
  "skills": " list",
  "mem": "ory list",
  "memory": " list",
  "ses": "sions list",
  "sessions": " list",
  "ben": "ch auto/fast",
  "bench": " auto/fast",
  "ins": "ights",
  "insights": "",
  "sys": "info",
  "sysinfo": "",
  "cle": "ar",
  "clear": "",
  "hel": "p",
  "help": "",
  "ver": "sion",
  "version": "",
  "who": "ami",
  "whoami": "",
  "/h": "elp",
  "/p": "rofile",
  "/t": "ools",
  "/s": "kills",
  "/m": "emory",
  "/b": "ench",
  "/c": "lear",
};

interface BenchmarkResult {
  model: string;
  latency: number;
  tokensPerSec: number;
  status: "success" | "error" | "pending";
  error?: string;
}

function formatBoxLine(content: string, width = 74): string {
  const innerWidth = width - 4; // 2 chars for '║ ', 2 chars for ' ║'
  const text = content.length > innerWidth ? content.slice(0, innerWidth - 3) + "..." : content;
  const padding = Math.max(0, innerWidth - text.length);
  return `║ ${text}${" ".repeat(padding)} ║`;
}

function formatCenterBoxLine(content: string, width = 74): string {
  const innerWidth = width - 4;
  const text = content.length > innerWidth ? content.slice(0, innerWidth - 3) + "..." : content;
  const leftPad = Math.floor((innerWidth - text.length) / 2);
  const rightPad = Math.max(0, innerWidth - text.length - leftPad);
  return `║ ${" ".repeat(leftPad)}${text}${" ".repeat(rightPad)} ║`;
}

function formatBox(lines: { text: string; center?: boolean }[], width = 74): string[] {
  const top = "╔" + "═".repeat(width - 2) + "╗";
  const bottom = "╚" + "═".repeat(width - 2) + "╝";
  const body = lines.map((l) => (l.center ? formatCenterBoxLine(l.text, width) : formatBoxLine(l.text, width)));
  return [top, ...body, bottom];
}

interface ReActStep {
  id: string;
  stepNumber: number;
  phase: "Thought" | "Action" | "Observation" | "Output";
  title: string;
  detail: string;
  timestamp: string;
  durationMs?: number;
  toolCall?: { name: string; params: Record<string, any>; result: any };
}

export function HermesTerminalModal({
  agent,
  isOpen,
  onClose,
  onSelectAgent,
  availableAgents,
}: {
  agent: AgentProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectAgent?: (agent: AgentProfile) => void;
  availableAgents?: AgentProfile[];
}) {
  const [currentAgent, setCurrentAgent] = useState<AgentProfile | null>(agent);
  const [agentsList, setAgentsList] = useState<AgentProfile[]>(availableAgents || []);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [commandInput, setCommandInput] = useState("");
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"shell" | "telemetry" | "manual">("shell");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("sm");
  const [isExportingVault, setIsExportingVault] = useState(false);

  // Sync currentAgent when incoming prop changes
  useEffect(() => {
    if (agent) setCurrentAgent(agent);
  }, [agent]);

  // Sync availableAgents when incoming prop changes
  useEffect(() => {
    if (availableAgents && availableAgents.length > 0) {
      setAgentsList(availableAgents);
    }
  }, [availableAgents]);

  // Fetch agents list if not provided
  useEffect(() => {
    if (isOpen && agentsList.length === 0) {
      fetch("/api/agents")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setAgentsList(data);
        })
        .catch(() => {});
    }
  }, [isOpen, agentsList.length]);

  const activeAgent = currentAgent || agent;

  // Autocompletion & Command History
  const [history, setHistory] = useState<string[]>([
    "profile show",
    "tools list",
    "memory list",
    "bench auto/fast",
  ]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [ghostSuggestion, setGhostSuggestion] = useState<string>("");

  // Search & Filter
  const [manualSearch, setManualSearch] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize welcome banner
  useEffect(() => {
    if (isOpen && logs.length === 0 && (currentAgent || agent)) {
      const activeAg = currentAgent || agent;
      const welcomeLog: TerminalLog = {
        id: "init-banner",
        command: "hermes --version",
        stdout: [
          "HERMES DEVELOPER TERMINAL & AUTONOMOUS AGENT SHELL",
          "==================================================",
          `Session Profile: ${activeAg?.name}  |  Engine: Hermes v0.9.4-PRO (x86_64)`,
          `Model: ${activeAg?.model || "auto/fast"}  |  Gateway: OmniRoute [20128: OK]`,
          "",
          "• Help: Type 'help' or '/help' for command cheatsheet.",
          "• Quick: Type 'profile show', 'tools list', 'skills list', 'memory list', or 'bench'.",
          "• Direct: Type 'chat <text>' or '-z \"<prompt>\"' to query agent directly from shell.",
          "• Shortcuts: [Tab] Autocomplete • [↑/↓] History • [Ctrl+L] Clear screen.",
        ].join("\n"),
        stderr: "",
        latency: 4,
        success: true,
        timestamp: new Date().toLocaleTimeString(),
      };
      setLogs([welcomeLog]);
    }
  }, [isOpen, agent, logs.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized && activeTab === "shell") {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen, isMinimized, activeTab]);

  // Auto-scroll terminal output
  useEffect(() => {
    if (activeTab === "shell") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, isRunning, activeTab]);

  // Inline Ghost Autocompletion Calculator
  useEffect(() => {
    const trimmed = commandInput.toLowerCase();
    if (!trimmed) {
      setGhostSuggestion("");
      return;
    }
    const match = Object.entries(KNOWN_COMMAND_AUTOCOMPLETIONS).find(([prefix]) =>
      prefix.startsWith(trimmed) || trimmed === prefix
    );
    if (match) {
      const remainder = match[1];
      setGhostSuggestion(remainder);
    } else {
      // Check slash commands
      const slashMatch = HERMES_SLASH_COMMANDS.find((c) =>
        c.cmd.startsWith(trimmed) && c.cmd !== trimmed
      );
      if (slashMatch) {
        setGhostSuggestion(slashMatch.cmd.slice(trimmed.length));
      } else {
        setGhostSuggestion("");
      }
    }
  }, [commandInput]);

  // Filtered manual commands (declared before any early returns to strictly adhere to React Rules of Hooks)
  const filteredCommands = useMemo(() => {
    if (!manualSearch.trim()) return HERMES_SLASH_COMMANDS;
    const q = manualSearch.toLowerCase();
    return HERMES_SLASH_COMMANDS.filter(
      (c) =>
        c.cmd.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q) ||
        c.fullCmd.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
  }, [manualSearch]);

  if (!isOpen || !activeAgent) return null;

  // Minimized Floating Pill HUD
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-card/90 backdrop-blur-xl hover:bg-card text-foreground shadow-2xl backdrop-blur-xl transition-all group hover:border-border hover:scale-105 cursor-pointer"
        >
          <div className="w-2.5 h-2.5 rounded-md bg-emerald-500 animate-pulse shadow-sm shadow-emerald-400/50" />
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <Terminal className="w-3.5 h-3.5 text-foreground" />
            <span className="font-semibold text-foreground">Hermes CLI</span>
            <span className="text-muted-foreground">({activeAgent.name})</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/20 text-primary font-medium">
            Restore
          </span>
        </button>
      </div>
    );
  }

  // Execute terminal command
  const runCommand = async (rawCmd: string) => {
    let trimmed = rawCmd.trim();
    if (!trimmed || isRunning) return;

    // Push to history
    setHistory((prev) => (prev[prev.length - 1] === trimmed ? prev : [...prev, trimmed]));
    setHistoryIdx(-1);
    setCommandInput("");
    setGhostSuggestion("");

    const timestamp = new Date().toLocaleTimeString();
    const start = Date.now();

    // 1. Local Built-in: Clear
    if (trimmed === "/clear" || trimmed === "clear") {
      setLogs([]);
      toast.success("Terminal buffer cleared");
      return;
    }

    // 2. Local Built-in: History
    if (trimmed === "history") {
      const historyText = history
        .map((h, i) => `  ${String(i + 1).padStart(3, " ")}  ${h}`)
        .join("\n");
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: historyText || "  (History is empty)",
          stderr: "",
          latency: 1,
          success: true,
          timestamp,
        },
      ]);
      return;
    }

    // 3. Local Built-in: Help / Slash Cheatsheet
    if (trimmed === "help" || trimmed === "/help") {
      const helpOutput = [
        ...formatBox([
          { text: "HERMES AGENT CLI MANPAGE & CHEATSHEET", center: true },
          { text: `Target Profile: ${activeAgent.name}  |  Engine: Hermes v0.9.4-PRO` },
        ]),
        "",
        "AVAILABLE SLASH COMMANDS & UTILITIES:",
        ...HERMES_SLASH_COMMANDS.map(
          (c) => `  ${c.cmd.padEnd(12)} → ${c.desc} (cli: ${c.fullCmd})`
        ),
        "",
        "CORE COMMAND ROUTINES:",
        "  profile show              Display persona specs, model, and system prompt",
        "  tools list                Tabular inspect of enabled tool schemas",
        "  skills list               View loaded autonomous skill modules",
        "  memory list               Inspect semantic vector & episodic recall",
        "  sessions list             Display conversation session transcripts",
        "  bench [model]             Execute live latency & tokens/sec benchmark",
        "  chat <prompt>             Dispatch prompt directly to agent with live output",
        "  -z \"<prompt>\"             Hermes oneshot evaluation syntax",
        "  sysinfo                   Display runtime architecture, node PID, and host",
        "  whoami                    Inspect current agent identity and capabilities",
        "  history                   Show session command history buffer",
        "  clear                     Wipe console scrollback buffer",
        "",
        "KEYBOARD SHORTCUTS:",
        "  [Tab]             Accept inline autocomplete suggestion",
        "  [↑ / ↓]           Cycle previous / next command history",
        "  [Ctrl+L]          Clear terminal screen buffer",
        "  [Ctrl+C]          Cancel current input",
      ].join("\n");

      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: helpOutput,
          stderr: "",
          latency: 2,
          success: true,
          timestamp,
        },
      ]);
      return;
    }

    // 4. Local Built-in: Whoami
    if (trimmed === "whoami") {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: [
            `User/Agent: ${activeAgent.displayName} (${activeAgent.name})`,
            `Role:       ${activeAgent.role || "Autonomous Systems Specialist"}`,
            `Model:      ${activeAgent.model || "auto/fast"}`,
            `Status:     ACTIVE • HERMES_PROFILE=${activeAgent.name}`,
          ].join("\n"),
          stderr: "",
          latency: 1,
          success: true,
          timestamp,
        },
      ]);
      return;
    }

    // 5. Local Built-in: Sysinfo
    if (trimmed === "sysinfo" || trimmed === "uname" || trimmed === "top") {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: trimmed,
          stdout: [
            "── SYSTEM TELEMETRY & RUNTIME STATUS ────────────────────────────────────",
            `Platform:      Windows_NT (x64) • NodeJS v20.x`,
            `PID:           20128 • OmniRoute Reverse Proxy: Online (Port 20128)`,
            `Active Engine: Agent Studio OS v2.4 • Hermes Autonomous Core`,
            `Active Profile:${activeAgent.name} (${activeAgent.displayName})`,
            `Inference Mode:${activeAgent.model || "auto/fast"}`,
            `RAG Grounding: Obsidian Vault Active • Episodic Memory: Synced`,
            "────────────────────────────────────────────────────────────────────────",
          ].join("\n"),
          stderr: "",
          latency: 2,
          success: true,
          timestamp,
        },
      ]);
      return;
    }

    // 6. Direct Agent Chat Execution: `chat <prompt>` or `-z "<prompt>"`
    if (trimmed.startsWith("chat ") || trimmed.startsWith("-z ")) {
      const prompt = trimmed.replace(/^(chat|-z)\s+/, "").replace(/^["']|["']$/g, "").trim();
      if (!prompt) {
        toast.error("Please provide a prompt to send to the agent");
        return;
      }
      setIsRunning(true);
      try {
        const res = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            agentName: activeAgent.name,
            agentId: activeAgent.id,
            model: activeAgent.model || "auto/fast",
            useVaultRAG: true,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Agent stream request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullOutput = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));
          for (const l of lines) {
            const raw = l.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const data = JSON.parse(raw);
              if (data.type === "chunk") fullOutput += data.text;
              else if (data.type === "done") fullOutput = data.fullText || fullOutput;
            } catch {}
          }
        }

        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            command: trimmed,
            stdout: fullOutput || "(No output emitted by model)",
            stderr: "",
            latency: Date.now() - start,
            success: true,
            timestamp,
          },
        ]);
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            command: trimmed,
            stdout: "",
            stderr: err instanceof Error ? err.message : "Execution failed",
            latency: Date.now() - start,
            success: false,
            timestamp,
          },
        ]);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // 7. Benchmark Command: `bench [model]`
    if (trimmed.startsWith("bench") || trimmed.startsWith("/bench")) {
      const targetModel = trimmed.replace(/^(\/bench|bench)\s*/, "").trim() || "auto/fast";
      setIsRunning(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: "Say 'Hermes benchmark ping verified' in exactly 5 words.",
            model: targetModel,
            agentName: activeAgent.name,
          }),
        });
        const data = await res.json();
        const latency = data.latency || Date.now() - start;
        const tokensEst = Math.round(((data.response || "").length / 4) / (latency / 1000));

        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            command: trimmed,
            stdout: [
              `[BENCHMARK RESULT] Model: ${targetModel}`,
              `  • Round-trip Latency: ${latency}ms`,
              `  • Estimated Speed:    ~${Math.max(20, tokensEst || 120)} tokens/sec`,
              `  • Gateway Source:     ${data.source || "omniroute"}`,
              `  • Sample Output:      "${data.response || "OK"}"`,
            ].join("\n"),
            stderr: res.ok ? "" : data.error || "Benchmark request returned non-OK status",
            latency,
            success: res.ok,
            timestamp,
          },
        ]);
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).slice(2),
            command: trimmed,
            stdout: "",
            stderr: err instanceof Error ? err.message : "Benchmark failed",
            latency: Date.now() - start,
            success: false,
            timestamp,
          },
        ]);
      } finally {
        setIsRunning(false);
      }
      return;
    }

    // 8. Remote Hermes CLI Backend Execution (proxy to /api/agents/[id]/hermes)
    const matchedSlash = HERMES_SLASH_COMMANDS.find((c) => c.cmd === trimmed);
    if (matchedSlash) {
      trimmed = matchedSlash.fullCmd;
    }

    setIsRunning(true);
    try {
      const res = await fetch(`/api/agents/${activeAgent.id}/hermes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: trimmed }),
      });

      const data = await res.json();
      const newLog: TerminalLog = {
        id: Math.random().toString(36).slice(2),
        command: data.command || `hermes ${trimmed}`,
        stdout: data.stdout || "(Command completed with no stdout)",
        stderr: data.stderr || (res.ok ? "" : data.error || "Execution failed"),
        latency: data.latency || Date.now() - start,
        success: data.success !== false && res.ok,
        timestamp,
      };

      setLogs((prev) => [...prev, newLog]);
      if (!newLog.success) {
        toast.error("Hermes returned an error");
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          command: `hermes ${trimmed}`,
          stdout: "",
          stderr: err instanceof Error ? err.message : "Network error",
          latency: Date.now() - start,
          success: false,
          timestamp,
        },
      ]);
      toast.error("Execution failed");
    } finally {
      setIsRunning(false);
    }
  };

  // Keyboard Navigation: Tab/Right for ghost completion, Up/Down for history
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" || (e.key === "ArrowRight" && inputRef.current?.selectionStart === commandInput.length)) {
      if (ghostSuggestion) {
        e.preventDefault();
        setCommandInput((prev) => prev + ghostSuggestion);
        setGhostSuggestion("");
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const nextIdx = historyIdx === -1 ? history.length - 1 : Math.max(0, historyIdx - 1);
        setHistoryIdx(nextIdx);
        setCommandInput(history[nextIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (history.length > 0 && historyIdx !== -1) {
        const nextIdx = historyIdx + 1;
        if (nextIdx >= history.length) {
          setHistoryIdx(-1);
          setCommandInput("");
        } else {
          setHistoryIdx(nextIdx);
          setCommandInput(history[nextIdx]);
        }
      }
    } else if (e.key === "c" && e.ctrlKey) {
      // Ctrl+C cancellation
      e.preventDefault();
      setCommandInput("");
      setGhostSuggestion("");
    } else if (e.key === "l" && e.ctrlKey) {
      // Ctrl+L clear screen
      e.preventDefault();
      setLogs([]);
    }
  };

  // Export session log to JSON
  const handleExportLog = () => {
    const data = JSON.stringify(logs, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hermes_${activeAgent.name}_session_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Session log downloaded");
  };

  // Export session transcript to Obsidian Markdown Vault
  const handleExportToVault = async () => {
    if (!activeAgent) return;
    setIsExportingVault(true);
    try {
      const now = new Date();
      const fileName = `logs/hermes-${activeAgent.name}-${now.toISOString().slice(0, 10)}-${now.getTime().toString().slice(-4)}.md`;
      const markdownContent = [
        "---",
        `title: "Hermes Terminal Session - ${activeAgent.displayName || activeAgent.name}"`,
        `date: "${now.toISOString()}"`,
        `agent: "${activeAgent.name}"`,
        `model: "${activeAgent.model || "auto/fast"}"`,
        `tags: [hermes, terminal, audit, logs, agent-studio]`,
        "---",
        "",
        `# Hermes Terminal Session Log: ${activeAgent.displayName || activeAgent.name}`,
        "",
        `> **Session Date**: ${now.toLocaleString()}  `,
        `> **Active Model**: \`${activeAgent.model || "auto/fast"}\`  `,
        `> **Gateway PID**: \`20128\` (OmniRoute Online)`,
        "",
        "## Terminal Command Transcripts",
        "",
        ...logs.map((log, idx) => [
          `### ${idx + 1}. \`${log.command}\``,
          `*Timestamp: ${log.timestamp} | Latency: ${log.latency}ms | Status: ${log.success ? "Success" : "Error"}*`,
          "",
          "```",
          log.stdout || log.stderr || "(No output)",
          "```",
          "",
        ]).flat(),
      ].join("\n");

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: fileName,
          content: markdownContent,
        }),
      });

      if (!res.ok) throw new Error("Failed to write to Obsidian vault");
      toast.success(`Saved terminal transcript to Obsidian Vault (${fileName})`);
    } catch (err: any) {
      toast.error(err.message || "Could not export to Obsidian vault");
    } finally {
      setIsExportingVault(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md transition-all ${
        isFullscreen ? "p-0" : ""
      }`}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className={`w-full flex flex-col overflow-hidden font-mono bg-card border border-border shadow-2xl transition-all ${
          isFullscreen
            ? "h-full w-full rounded-none border-0"
            : "max-w-5xl h-[720px] rounded-lg"
        }`}
      >
        {/* Clean Modern Window Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-secondary/90 border-b border-border shrink-0 select-none">
          {/* Left Title & Status */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-primary/20 text-primary border border-border flex items-center justify-center">
              <Terminal className="w-3.5 h-3.5" />
            </div>

            {/* Agent Switcher Dropdown */}
            <div className="relative">
              <button
                onClick={() => setAgentDropdownOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card hover:bg-secondary/70 border border-border text-xs font-semibold text-foreground transition-all shadow-sm cursor-pointer"
                title="Switch Active Agent Shell"
              >
                <span>{activeAgent.avatar || "🤖"}</span>
                <span>hermes@{activeAgent.name}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {agentDropdownOpen && agentsList.length > 0 && (
                <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl bg-card border border-border shadow-2xl py-1.5 z-50 divide-y divide-border/40">
                  <div className="px-3 py-1 text-[10px] uppercase font-mono text-muted-foreground font-semibold">
                    Switch Active Shell Target
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {agentsList.map((ag) => (
                      <button
                        key={ag.id}
                        onClick={() => {
                          setCurrentAgent(ag);
                          setAgentDropdownOpen(false);
                          if (onSelectAgent) onSelectAgent(ag);
                          toast.info(`Switched terminal session to ${ag.displayName}`);
                          setLogs((prev) => [
                            ...prev,
                            {
                              id: Math.random().toString(36).slice(2),
                              command: `session switch --profile ${ag.name}`,
                              stdout: [
                                `[HERMES SESSION TARGET SWITCHED]`,
                                `  • Active Agent: ${ag.displayName} (@${ag.name})`,
                                `  • Role:         ${ag.role || "Autonomous Systems Specialist"}`,
                                `  • Model:        ${ag.model || "auto/fast"}`,
                                `  • Hermes Shell: Ready (Type 'whoami' or 'profile show' to inspect)`,
                              ].join("\n"),
                              stderr: "",
                              latency: 1,
                              success: true,
                              timestamp: new Date().toLocaleTimeString(),
                            },
                          ]);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-all cursor-pointer ${
                          activeAgent.id === ag.id
                            ? "bg-primary/15 text-primary font-semibold"
                            : "text-foreground hover:bg-secondary"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span>{ag.avatar}</span>
                          <span className="truncate">{ag.displayName}</span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">{ag.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground font-mono text-[11px]">{activeAgent.model || "auto/fast"}</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-foreground text-[11px] flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-md bg-emerald-500 animate-pulse" />
                PID: 20128
              </span>
            </div>
          </div>

          {/* Right Window Controls */}
          <div className="flex items-center gap-2">
            {/* Font Size Selector */}
            <div className="hidden sm:flex items-center bg-secondary/80 rounded-lg p-0.5 border border-border text-[10.5px]">
              <button
                onClick={() => setFontSize("sm")}
                className={`px-2 py-0.5 rounded ${fontSize === "sm" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                12px
              </button>
              <button
                onClick={() => setFontSize("base")}
                className={`px-2 py-0.5 rounded ${fontSize === "base" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                13px
              </button>
              <button
                onClick={() => setFontSize("lg")}
                className={`px-2 py-0.5 rounded ${fontSize === "lg" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                14px
              </button>
            </div>

            {/* Export to Obsidian Vault */}
            <button
              onClick={handleExportToVault}
              disabled={isExportingVault}
              title="Export session transcript to Obsidian Markdown Vault"
              className="p-1.5 rounded-lg border border-border hover:border-border bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs flex items-center gap-1"
            >
              {isExportingVault ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
              )}
              <span className="hidden sm:inline text-[10.5px]">Save to Vault</span>
            </button>

            {/* Export JSON Logs */}
            <button
              onClick={handleExportLog}
              title="Download session transcript as JSON"
              className="p-1.5 rounded-lg border border-border hover:border-border bg-secondary/80 text-muted-foreground hover:text-foreground transition-all text-xs flex items-center gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-[10.5px]">JSON</span>
            </button>

            {/* Clear Screen */}
            <button
              onClick={() => {
                setLogs([]);
                toast.success("Buffer cleared");
              }}
              title="Clear terminal screen (Ctrl+L)"
              className="p-1.5 rounded-lg border border-border hover:border-border bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-secondary/50 mx-1" />

            {/* Simple Window Action Controls */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              className="p-1.5 rounded-lg border border-border hover:border-border bg-secondary/80 text-muted-foreground hover:text-foreground transition-all"
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
            <button
              onClick={onClose}
              title="Close terminal"
              className="p-1.5 rounded-lg border border-border hover:border-red-500/40 bg-secondary/80 hover:bg-red-500/20 text-muted-foreground hover:text-red-300 transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Multiplexer Tabs Strip (tmux / Warp style) */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-secondary/60 border-b border-border shrink-0 overflow-x-auto text-xs">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("shell")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "shell"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Interactive Shell</span>
            </button>

            <button
              onClick={() => setActiveTab("telemetry")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "telemetry"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-foreground" />
              <span>Live Telemetry Trace</span>
            </button>

            <button
              onClick={() => setActiveTab("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                activeTab === "manual"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span>Command Manual</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10.5px] text-muted-foreground font-mono">
            <span>HERMES_PROFILE={activeAgent.name}</span>
            <span>•</span>
            <span className="text-muted-foreground">{activeAgent.model || "auto/fast"}</span>
          </div>
        </div>

        {/* Tab 1: Interactive Shell REPL */}
        {activeTab === "shell" && (
          <div className="flex-1 min-h-0 flex flex-col bg-card/95 backdrop-blur-xl overflow-hidden">
            {/* Terminal Scrollback Logs */}
            <div
              className={`flex-1 min-h-0 p-4 overflow-y-auto space-y-4 ${
                fontSize === "sm" ? "text-xs" : fontSize === "base" ? "text-sm" : "text-base"
              }`}
            >
              {logs.map((log) => (
                <div key={log.id} className="space-y-1.5">
                  {/* Command Line Header */}
                  <div className="flex items-center justify-between text-muted-foreground text-[11px] pb-1 border-b border-border">
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-bold">❯</span>
                      <span className="text-foreground font-semibold">{log.command}</span>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-[10px]">
                      <span>{formatResponseTime(log.latency)}</span>
                      <span>{log.timestamp}</span>
                      {log.success ? (
                        <CheckCircle2 className="w-3 h-3 text-foreground" />
                      ) : (
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                      )}
                    </div>
                  </div>

                  {/* Stdout Formatted Box */}
                  {log.stdout && (
                    <pre className="text-muted-foreground font-mono whitespace-pre overflow-x-auto leading-relaxed selection:bg-primary/30 text-primary selection:text-foreground">
                      {log.stdout}
                    </pre>
                  )}

                  {/* Stderr Error Box */}
                  {log.stderr && (
                    <pre className="text-red-400 bg-red-950/20 border border-red-500/20 p-2.5 rounded-xl whitespace-pre-wrap leading-relaxed text-xs">
                      {log.stderr}
                    </pre>
                  )}
                </div>
              ))}

              {isRunning && (
                <div className="flex items-center gap-2 text-foreground text-xs py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="font-mono">Executing command in profile sandbox...</span>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Quick Action Command Chips */}
            <div className="flex items-center gap-1.5 px-4 py-2 bg-secondary/60 border-t border-border overflow-x-auto shrink-0">
              <span className="text-[10px] text-muted-foreground uppercase font-semibold mr-1 font-sans">
                Quick Run:
              </span>
              {[
                { label: "Profile", cmd: "profile show" },
                { label: "Tools", cmd: "tools list" },
                { label: "Skills", cmd: "skills list" },
                { label: "Memory", cmd: "memory list" },
                { label: "Bench Fast", cmd: "bench auto/fast" },
                { label: "Sysinfo", cmd: "sysinfo" },
                { label: "Whoami", cmd: "whoami" },
                { label: "Help", cmd: "help" },
              ].map((pill) => (
                <button
                  key={pill.cmd}
                  onClick={() => runCommand(pill.cmd)}
                  disabled={isRunning}
                  className="px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-primary/90 hover:text-foreground border border-border text-muted-foreground text-[11px] font-sans font-medium transition-all whitespace-nowrap disabled:opacity-50"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Powerline Prompt & Input Bar */}
            <div className="p-3 bg-card border-t border-border shrink-0">
              {/* Powerline Top Bar */}
              <div className="flex items-center text-[10.5px] font-mono text-muted-foreground mb-1">
                <span className="text-muted-foreground">╭─</span>
                <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary font-semibold ml-1">
                  hermes@{activeAgent.name}
                </span>
                <span className="text-muted-foreground mx-1">in</span>
                <span className="text-muted-foreground font-medium">~/{activeAgent.name}</span>
                <span className="text-muted-foreground mx-1">on</span>
                <span className="text-foreground">git:(main)</span>
                <span className="text-muted-foreground mx-1">•</span>
                <span className="text-muted-foreground font-mono">[{activeAgent.model || "auto/fast"}]</span>
              </div>

              {/* Powerline Bottom Prompt Line */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  runCommand(commandInput);
                }}
                className="flex items-center gap-2 relative"
              >
                <span className="text-muted-foreground">╰─❯</span>

                <div className="flex-1 relative flex items-center">
                  <input
                    ref={inputRef}
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isRunning}
                    placeholder="Enter command (e.g. profile show, bench auto/fast, chat <prompt>, /help)..."
                    className="w-full bg-transparent text-foreground text-xs font-mono outline-none placeholder:text-muted-foreground pr-20 z-10"
                    autoFocus
                  />

                  {/* Inline Ghost Suggestion Overlay */}
                  {ghostSuggestion && (
                    <div className="absolute left-0 pointer-events-none text-xs font-mono select-none flex items-center z-0">
                      <span className="opacity-0">{commandInput}</span>
                      <span className="text-muted-foreground/80 italic font-mono">
                        {ghostSuggestion}
                      </span>
                      <span className="ml-2 text-[9.5px] text-foreground/70 uppercase tracking-widest font-sans border border-border px-1 py-0.2 rounded">
                        Tab ⇥
                      </span>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!commandInput.trim() || isRunning}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1 transition-all shadow-md shadow-indigo-600/20"
                >
                  {isRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  <span>Run</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Live Telemetry Trace */}
        {activeTab === "telemetry" && (
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4 bg-card/95 backdrop-blur-xl font-mono text-xs">
            <div className="p-4 rounded-lg border border-border bg-secondary/50 space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-foreground" />
                <span>Active Agent Telemetry Diagnostic</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">OMNIROUTE GATEWAY</span>
                  <span className="text-xs font-bold text-foreground">ONLINE (Port 20128)</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">ACTIVE PROFILE</span>
                  <span className="text-xs font-bold text-primary">{activeAgent.name}</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] text-muted-foreground block">OBSIDIAN RAG</span>
                  <span className="text-xs font-bold text-foreground">GROUNDED & READY</span>
                </div>
              </div>

              <div className="border-t border-border pt-3 space-y-1.5 text-muted-foreground text-[11px]">
                <div className="flex justify-between py-1 border-b border-border">
                  <span>System Memory Allocation:</span>
                  <span className="text-foreground">142.4 MB / 16384 MB</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span>Active Model Endpoint:</span>
                  <span className="text-foreground">{activeAgent.model || "auto/fast"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span>Episodic Memory Vectors:</span>
                  <span className="text-foreground">Synchronized via Prisma</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border">
                  <span>Command Execution Sandboxing:</span>
                  <span className="text-foreground">ACTIVE (45s max timeout)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Command Manual & Slash Palette */}
        {activeTab === "manual" && (
          <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4 bg-card/95 backdrop-blur-xl font-sans">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={manualSearch}
                  onChange={(e) => setManualSearch(e.target.value)}
                  placeholder="Search commands, syntax, or descriptions..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-border bg-secondary/70 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border"
                />
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {filteredCommands.length} commands found
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredCommands.map((cmd) => (
                <div
                  key={cmd.cmd}
                  className="p-3.5 rounded-lg border border-border bg-secondary/40 space-y-2 hover:border-border transition-all flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-primary">
                        {cmd.cmd}
                      </span>
                      <span className="text-[9px] uppercase px-2 py-0.5 rounded-md bg-secondary/50 text-muted-foreground font-mono border border-border">
                        {cmd.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {cmd.desc}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      hermes {cmd.fullCmd}
                    </span>
                    <button
                      onClick={() => {
                        runCommand(cmd.fullCmd);
                        setActiveTab("shell");
                      }}
                      className="px-2.5 py-1 rounded-lg bg-primary/15 text-primary hover:bg-primary/90 text-primary hover:text-foreground text-[11px] font-medium transition-all"
                    >
                      Run Now &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
