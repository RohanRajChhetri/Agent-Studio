"use client";

import { useState, useRef, useEffect } from "react";
import {
  Terminal,
  AlertTriangle,
  XCircle,
  Info,
  Trash2,
  ChevronDown,
  ChevronUp,
  Play,
  RotateCcw,
  Sparkles,
  Maximize2,
  Minimize2,
  Copy,
  Check,
} from "lucide-react";

export interface ConsoleEntry {
  id: string;
  level: "log" | "warn" | "error" | "info" | "eval" | "build";
  message: string;
  timestamp: number;
}

interface CodeConsoleDrawerProps {
  entries: ConsoleEntry[];
  onClear: () => void;
  onRunEval: (code: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  fileList?: string[];
  activeProject: string;
  onAutoFixError?: (errorText: string) => void;
  isFixing?: boolean;
}

export function CodeConsoleDrawer({
  entries,
  onClear,
  onRunEval,
  isOpen,
  onToggleOpen,
  fileList = [],
  activeProject,
  onAutoFixError,
  isFixing,
}: CodeConsoleDrawerProps) {
  const [activeTab, setActiveTab] = useState<"console" | "terminal" | "build">("console");
  const [filterLevel, setFilterLevel] = useState<"all" | "error" | "warn" | "log">("all");
  const [replInput, setReplInput] = useState("");
  const [termHistory, setTermHistory] = useState<string[]>([
    `Agent Studio OS Terminal v1.0.0 [Ready]`,
    `Connected to workspace: agent-workspace/${activeProject}`,
    `Type "help" for a list of available emulator commands.`,
  ]);
  const [termInput, setTermInput] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const termScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, activeTab]);

  useEffect(() => {
    if (termScrollRef.current) {
      termScrollRef.current.scrollTop = termScrollRef.current.scrollHeight;
    }
  }, [termHistory, activeTab]);

  const errorCount = entries.filter((e) => e.level === "error").length;
  const warnCount = entries.filter((e) => e.level === "warn").length;

  const filteredEntries = entries.filter((entry) => {
    if (activeTab === "build") return entry.level === "build";
    if (activeTab === "console" && entry.level === "build") return false;
    if (filterLevel === "all") return true;
    if (filterLevel === "error") return entry.level === "error";
    if (filterLevel === "warn") return entry.level === "warn";
    if (filterLevel === "log") return entry.level === "log" || entry.level === "info" || entry.level === "eval";
    return true;
  });

  const handleReplSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replInput.trim()) return;
    onRunEval(replInput.trim());
    setReplInput("");
  };

  const handleTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = termInput.trim();
    if (!cmd) return;

    setTermHistory((prev) => [...prev, `$ ${cmd}`]);
    setTermInput("");

    const parts = cmd.split(" ");
    const command = parts[0].toLowerCase();

    if (command === "clear" || command === "cls") {
      setTermHistory([]);
      return;
    }

    if (command === "help") {
      setTermHistory((prev) => [
        ...prev,
        "Available commands:",
        "  help                 Show this help message",
        "  ls / dir             List project files",
        "  status               Show project & agent build status",
        "  build                Trigger project preview rebuild",
        "  echo <text>          Print text to console",
        "  pwd                  Print current working directory",
        "  clear / cls          Clear terminal output",
      ]);
      return;
    }

    if (command === "ls" || command === "dir") {
      if (fileList.length === 0) {
        setTermHistory((prev) => [...prev, "(no files found in workspace)"]);
      } else {
        setTermHistory((prev) => [
          ...prev,
          `Files in ${activeProject}:`,
          ...fileList.map((f) => `  📄 ${f}`),
        ]);
      }
      return;
    }

    if (command === "pwd") {
      setTermHistory((prev) => [...prev, `/agent-workspace/${activeProject}`]);
      return;
    }

    if (command === "status") {
      setTermHistory((prev) => [
        ...prev,
        `Workspace: ${activeProject}`,
        `Total Files: ${fileList.length}`,
        `Console Errors: ${errorCount}`,
        `Sandbox State: Active (Sandboxed iframe)`,
      ]);
      return;
    }

    if (command === "echo") {
      setTermHistory((prev) => [...prev, parts.slice(1).join(" ")]);
      return;
    }

    if (command === "build") {
      setTermHistory((prev) => [
        ...prev,
        "✨ Bundling project files (HTML/CSS/JS)... Done in 42ms.",
      ]);
      return;
    }

    setTermHistory((prev) => [
      ...prev,
      `Command not found: "${command}". Type "help" for a list of commands.`,
    ]);
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!isOpen) {
    return (
      <div className="border-t border-[var(--border)] bg-[var(--card)] px-4 py-1.5 flex items-center justify-between shrink-0 select-none text-[11.5px]">
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer font-medium"
        >
          <Terminal className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span>Console & Terminal</span>
          {errorCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[10px] font-mono">
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
          {warnCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[10px] font-mono">
              {warnCount} warning{warnCount > 1 ? "s" : ""}
            </span>
          )}
        </button>

        <button
          onClick={onToggleOpen}
          className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition rounded cursor-pointer"
          title="Open Console Drawer"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`border-t border-[var(--border)] bg-[var(--card)] flex flex-col shrink-0 transition-all duration-200 select-none ${
        isExpanded ? "h-[360px]" : "h-[210px]"
      }`}
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[var(--border)] shrink-0 bg-[var(--card)]/90 backdrop-blur-xs">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab("console")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition cursor-pointer ${
              activeTab === "console"
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-500" />
            <span>Console</span>
            {errorCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500/15 text-red-500 text-[10px] font-mono font-semibold">
                {errorCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition cursor-pointer ${
              activeTab === "terminal"
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <span className="font-mono text-xs text-[var(--primary)] font-bold">&gt;_</span>
            <span>Shell Terminal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("build")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11.5px] font-medium transition cursor-pointer ${
              activeTab === "build"
                ? "bg-[var(--muted)] text-[var(--foreground)]"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Build Logs</span>
          </button>
        </div>

        {/* Console Filters & Actions */}
        <div className="flex items-center gap-1.5">
          {activeTab === "console" && (
            <div className="flex items-center bg-[var(--muted)]/60 rounded-md p-0.5 text-[10.5px]">
              <button
                type="button"
                onClick={() => setFilterLevel("all")}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer ${
                  filterLevel === "all" ? "bg-[var(--card)] text-[var(--foreground)] font-semibold shadow-xs" : "text-[var(--muted-foreground)]"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterLevel("error")}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  filterLevel === "error" ? "bg-[var(--card)] text-red-500 font-semibold shadow-xs" : "text-[var(--muted-foreground)]"
                }`}
              >
                Errors ({errorCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterLevel("warn")}
                className={`px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                  filterLevel === "warn" ? "bg-[var(--card)] text-amber-500 font-semibold shadow-xs" : "text-[var(--muted-foreground)]"
                }`}
              >
                Warnings ({warnCount})
              </button>
            </div>
          )}

          {onAutoFixError && errorCount > 0 && (
            <button
              type="button"
              disabled={isFixing}
              onClick={() => {
                const errorLines = entries
                  .filter((e) => e.level === "error")
                  .map((e) => e.message)
                  .join("\n");
                onAutoFixError(errorLines);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 hover:border-amber-500 text-amber-500 dark:text-amber-300 text-[11px] font-semibold transition cursor-pointer shadow-xs disabled:opacity-50"
              title="Autonomous Agent Diagnoses & Patches Code"
            >
              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
              <span>{isFixing ? "Fixing..." : `Auto-Fix (${errorCount})`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={activeTab === "terminal" ? () => setTermHistory([]) : onClear}
            className="p-1 text-[var(--muted-foreground)] hover:text-red-500 rounded transition cursor-pointer"
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded transition cursor-pointer"
            title={isExpanded ? "Collapse height" : "Expand height"}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            onClick={onToggleOpen}
            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded transition cursor-pointer"
            title="Hide drawer"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 min-h-0 flex flex-col font-mono text-[11.5px] bg-[var(--background)]">
        {activeTab === "terminal" ? (
          /* Shell Terminal View */
          <div className="flex-1 min-h-0 flex flex-col p-2 bg-neutral-950 text-emerald-400">
            <div ref={termScrollRef} className="flex-1 overflow-y-auto space-y-1 scrollbar-thin pr-1 select-text">
              {termHistory.map((line, idx) => (
                <div key={idx} className="leading-relaxed break-all">
                  {line}
                </div>
              ))}
            </div>
            <form onSubmit={handleTerminalSubmit} className="flex items-center gap-2 pt-1 border-t border-neutral-800">
              <span className="text-emerald-500 font-bold select-none">&gt;</span>
              <input
                type="text"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
                placeholder="type command (e.g. ls, help, status, build)..."
                className="flex-1 bg-transparent text-emerald-300 placeholder:text-neutral-600 outline-none text-[11.5px] font-mono"
              />
            </form>
          </div>
        ) : (
          /* Console / Build Logs View */
          <div className="flex-1 min-h-0 flex flex-col">
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin select-text">
              {filteredEntries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]/50 text-[11.5px]">
                  <span>No {filterLevel !== "all" ? filterLevel : ""} logs captured yet</span>
                </div>
              ) : (
                filteredEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-start justify-between gap-2 px-2 py-1 rounded transition group ${
                      entry.level === "error"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : entry.level === "warn"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        : entry.level === "eval"
                        ? "bg-purple-500/10 text-purple-300"
                        : entry.level === "build"
                        ? "bg-sky-500/10 text-sky-300"
                        : "text-[var(--foreground)] hover:bg-[var(--muted)]/50"
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <span className="shrink-0 mt-0.5">
                        {entry.level === "error" ? (
                          <XCircle className="w-3.5 h-3.5 text-red-500" />
                        ) : entry.level === "warn" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        ) : entry.level === "build" ? (
                          <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                        ) : (
                          <Info className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        )}
                      </span>
                      <span className="break-all whitespace-pre-wrap leading-relaxed">{entry.message}</span>
                    </div>

                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <span className="text-[10px] text-[var(--muted-foreground)]">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                      <button
                        onClick={() => handleCopyMessage(entry.id, entry.message)}
                        className="p-0.5 hover:text-[var(--foreground)] text-[var(--muted-foreground)] transition cursor-pointer"
                        title="Copy message"
                      >
                        {copiedId === entry.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Interactive JS REPL Bar for Sandbox */}
            {activeTab === "console" && (
              <form onSubmit={handleReplSubmit} className="flex items-center gap-2 px-2.5 py-1.5 border-t border-[var(--border)] bg-[var(--card)] shrink-0">
                <span className="text-[var(--primary)] font-bold select-none text-[12px]">&gt;</span>
                <input
                  type="text"
                  value={replInput}
                  onChange={(e) => setReplInput(e.target.value)}
                  placeholder="Evaluate JavaScript in live sandbox preview (e.g. document.title, 2+2, alert('hi'))..."
                  className="flex-1 bg-transparent text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]/60 outline-none text-[11.5px] font-mono"
                />
                <button
                  type="submit"
                  disabled={!replInput.trim()}
                  className="px-2 py-0.5 rounded bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-40 transition text-[11px] font-sans font-medium flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3 h-3" />
                  <span>Eval</span>
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
