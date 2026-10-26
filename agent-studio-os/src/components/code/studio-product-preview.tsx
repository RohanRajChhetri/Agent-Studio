"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  RotateCcw,
  ExternalLink,
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  Loader2,
  Sparkles,
  Globe,
  Terminal,
  Folder,
  FileCode,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Play,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/project-filesystem";
import { playClickSound } from "@/lib/sound-effects";

interface ConsoleLogEntry {
  id: string;
  level: "log" | "warn" | "error" | "info" | "eval";
  message: string;
  timestamp: number;
}

interface StudioProductPreviewProps {
  selectedProject: string;
  previewHtml: string;
  onReload: () => void;
  previewViewport: "desktop" | "tablet" | "mobile";
  onChangePreviewViewport: (vp: "desktop" | "tablet" | "mobile") => void;
  isGenerating?: boolean;
  fileTree?: FileTreeNode[];
  onOpenFile?: (path: string) => void;
}

function flattenFileTree(nodes: FileTreeNode[], basePath = ""): Array<{ path: string; name: string; size?: number }> {
  const result: Array<{ path: string; name: string; size?: number }> = [];
  for (const n of nodes) {
    if (!n.isDirectory) {
      result.push({ path: n.path, name: n.name, size: n.size });
    }
    if (n.isDirectory && n.children) {
      result.push(...flattenFileTree(n.children, basePath));
    }
  }
  return result;
}

export function StudioProductPreview({
  selectedProject,
  previewHtml,
  onReload,
  previewViewport,
  onChangePreviewViewport,
  isGenerating = false,
  fileTree = [],
  onOpenFile,
}: StudioProductPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // DevTools Dock State
  const [showDevDock, setShowDevDock] = useState(false);
  const [activeDevTab, setActiveDevTab] = useState<"console" | "files">("console");
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLogEntry[]>([]);
  const [logFilter, setLogFilter] = useState<"all" | "error" | "warn">("all");
  const [replInput, setReplInput] = useState("");
  const [fileSearchQuery, setFileSearchQuery] = useState("");

  // Set subtle loading indicator when new preview content compiles
  useEffect(() => {
    if (previewHtml) {
      setIsLoading(true);
      const timer = setTimeout(() => setIsLoading(false), 200);
      return () => clearTimeout(timer);
    }
  }, [previewHtml]);

  // Listen for console bridge messages from the sandbox iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data && e.data.type === "preview-console") {
        const entry: ConsoleLogEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          level: e.data.level || "log",
          message: String(e.data.message || ""),
          timestamp: e.data.timestamp || Date.now(),
        };

        setConsoleLogs((prev) => [...prev.slice(-300), entry]);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Auto-scroll console to bottom when new logs arrive
  useEffect(() => {
    if (showDevDock && activeDevTab === "console") {
      consoleBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs, showDevDock, activeDevTab]);

  // Execute REPL expression inside sandbox iframe
  const handleRunRepl = (e?: React.FormEvent) => {
    e?.preventDefault();
    const code = replInput.trim();
    if (!code) return;

    // Echo input in console
    setConsoleLogs((prev) => [
      ...prev,
      {
        id: `repl-in-${Date.now()}`,
        level: "info",
        message: `> ${code}`,
        timestamp: Date.now(),
      },
    ]);

    setReplInput("");

    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: "preview-eval",
          code,
        },
        "*"
      );
    }
  };

  // Open preview in a new external browser tab
  const handleOpenExternal = () => {
    playClickSound();
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  // Counts
  const errorCount = consoleLogs.filter((l) => l.level === "error").length;
  const warnCount = consoleLogs.filter((l) => l.level === "warn").length;

  const filteredLogs = useMemo(() => {
    if (logFilter === "error") return consoleLogs.filter((l) => l.level === "error");
    if (logFilter === "warn") return consoleLogs.filter((l) => l.level === "warn" || l.level === "error");
    return consoleLogs;
  }, [consoleLogs, logFilter]);

  const flatFiles = useMemo(() => {
    return flattenFileTree(fileTree);
  }, [fileTree]);

  const filteredFiles = useMemo(() => {
    if (!fileSearchQuery.trim()) return flatFiles;
    const q = fileSearchQuery.toLowerCase();
    return flatFiles.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
  }, [flatFiles, fileSearchQuery]);

  return (
    <div
      className={`flex flex-col h-full bg-[var(--card)] border-l border-[var(--border)] overflow-hidden transition-all ${
        isFullscreen ? "fixed inset-0 z-50 bg-[var(--background)]" : ""
      }`}
    >
      {/* ─── PREVIEW CONTROLS TOP BAR ─── */}
      <div className="h-10 bg-[var(--card)]/90 backdrop-blur-md border-b border-[var(--border)] px-3 flex items-center justify-between select-none shrink-0">
        {/* Left: Project Preview URL bar */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] text-[11px] font-mono shrink-0">
            <Globe className="w-3.5 h-3.5 opacity-70" />
            <span className="truncate max-w-[180px]">/{selectedProject || "preview"}</span>
          </div>
        </div>

        {/* Center: Responsive Viewport Switcher */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangePreviewViewport("desktop");
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              previewViewport === "desktop"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Desktop View (Full Width)"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Desktop</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangePreviewViewport("tablet");
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              previewViewport === "tablet"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Tablet View (768px iPad)"
          >
            <Tablet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangePreviewViewport("mobile");
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              previewViewport === "mobile"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Mobile View (375px iPhone)"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Right: DevTools Toggle, Reload, External Popout, Fullscreen */}
        <div className="flex items-center gap-1">
          {/* DevTools Dock Toggle Pill */}
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setShowDevDock((prev) => !prev);
            }}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition cursor-pointer ${
              showDevDock
                ? "bg-[var(--primary)] text-white shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
            }`}
            title="Toggle Live Console & File Inspector"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span className="hidden md:inline">DevTools</span>
            {errorCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-mono font-bold">
                {errorCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onReload();
            }}
            disabled={isGenerating}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
            title="Reload Sandbox"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenExternal}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
            title="Open Live Product in New Window"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen((prev) => !prev)}
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Preview"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ─── LIVE PRODUCT APPLICATION CANVAS ─── */}
      <div className="flex-1 bg-[var(--background)] flex items-center justify-center p-3 sm:p-6 overflow-hidden relative min-h-0">
        {/* Unified Responsive Frame chassis */}
        <div
          className={`flex flex-col relative transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
            previewViewport === "mobile"
              ? "w-[375px] max-w-[95%] h-[680px] max-h-[95%] bg-neutral-900 rounded-[44px] border-[10px] border-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)]"
              : previewViewport === "tablet"
              ? "w-[768px] max-w-[95%] h-[95%] bg-neutral-900 rounded-[32px] border-[10px] border-neutral-900 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)]"
              : "w-full h-full bg-white rounded-xl shadow-xl border border-[var(--border)]"
          }`}
        >
          {previewViewport === "mobile" && (
            <div className="w-24 h-4 bg-neutral-900 rounded-full mx-auto my-1.5 shrink-0 z-20 flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-neutral-950/80 mr-3" />
              <span className="w-2 h-2 rounded-full bg-blue-950/60" />
            </div>
          )}

          {previewViewport === "tablet" && (
            <div className="w-2 h-2 rounded-full bg-neutral-700 mx-auto my-1 shrink-0 z-20" />
          )}

          {/* Iframe Viewport Container */}
          <div
            className={`flex-1 w-full bg-white relative overflow-hidden ${
              previewViewport === "mobile"
                ? "rounded-[28px]"
                : previewViewport === "tablet"
                ? "rounded-[20px]"
                : "rounded-xl"
            }`}
          >
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-black/10 backdrop-blur-[1px] flex items-center justify-center transition-opacity">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              key="studio-persistent-sandbox-iframe"
              title="Product Preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups"
              className="w-full h-full border-none bg-white"
              onLoad={() => setIsLoading(false)}
            />
          </div>

          {previewViewport === "mobile" && (
            <div className="w-28 h-1 bg-neutral-700 rounded-full mx-auto my-1.5 shrink-0 z-20" />
          )}
        </div>
      </div>

      {/* ─── INTEGRATED DEVTOOLS DOCK: CONSOLE & FILE INSPECTOR ─── */}
      {showDevDock && (
        <div className="h-56 bg-[var(--card)] border-t border-[var(--border)] flex flex-col shrink-0 select-none z-10 shadow-2xl">
          {/* Dock Header Tabs */}
          <div className="h-8 bg-[var(--background)] border-b border-[var(--border)] px-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveDevTab("console")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  activeDevTab === "console"
                    ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <Terminal className="w-3 h-3 text-[var(--primary)]" />
                <span>Console</span>
                {consoleLogs.length > 0 && (
                  <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                    ({consoleLogs.length})
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-400 text-[10px] font-mono font-semibold">
                    {errorCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveDevTab("files")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                  activeDevTab === "files"
                    ? "bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] shadow-xs"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                <FileCode className="w-3 h-3 text-emerald-400" />
                <span>Files</span>
                <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                  ({flatFiles.length})
                </span>
              </button>
            </div>

            {/* Right Tab Controls */}
            <div className="flex items-center gap-1.5">
              {activeDevTab === "console" && (
                <>
                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setLogFilter("all")}
                      className={`px-1.5 py-0.5 rounded ${
                        logFilter === "all" ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold" : "text-[var(--muted-foreground)]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilter("error")}
                      className={`px-1.5 py-0.5 rounded ${
                        logFilter === "error" ? "bg-rose-500/20 text-rose-400 font-semibold" : "text-[var(--muted-foreground)] hover:text-rose-400"
                      }`}
                    >
                      Errors ({errorCount})
                    </button>
                  </div>

                  <div className="h-3 w-px bg-[var(--border)]" />

                  <button
                    type="button"
                    onClick={() => setConsoleLogs([])}
                    className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded transition cursor-pointer"
                    title="Clear console logs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}

              {activeDevTab === "files" && (
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
                  <input
                    type="text"
                    placeholder="Filter files..."
                    value={fileSearchQuery}
                    onChange={(e) => setFileSearchQuery(e.target.value)}
                    className="pl-6 pr-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-[11px] w-32 focus:w-44 transition-all text-[var(--foreground)] outline-none"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowDevDock(false)}
                className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] rounded transition cursor-pointer"
                title="Collapse DevTools dock"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Dock Content Body */}
          <div className="flex-1 overflow-y-auto p-2 font-mono text-[11.5px] leading-relaxed bg-[var(--card)] scrollbar-thin">
            {activeDevTab === "console" ? (
              <div className="space-y-1">
                {filteredLogs.length === 0 ? (
                  <div className="text-[var(--muted-foreground)] py-6 text-center text-xs font-sans">
                    No console logs recorded. Output from <code>console.log()</code> and errors in your sandbox will stream here live.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isErr = log.level === "error";
                    const isWarn = log.level === "warn";
                    const isEval = log.level === "eval";
                    return (
                      <div
                        key={log.id}
                        className={`flex items-start gap-2 px-2 py-1 rounded select-text break-all ${
                          isErr
                            ? "bg-rose-500/10 text-rose-300 border-l-2 border-rose-500"
                            : isWarn
                            ? "bg-amber-500/10 text-amber-300 border-l-2 border-amber-500"
                            : isEval
                            ? "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-500"
                            : "text-[var(--foreground)] hover:bg-[var(--accent)]/40"
                        }`}
                      >
                        <span className="text-[10px] opacity-40 shrink-0 select-none">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        {isErr && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                        {isWarn && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                        {isEval && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />}
                        <span className="flex-1">{log.message}</span>
                      </div>
                    );
                  })
                )}
                <div ref={consoleBottomRef} />
              </div>
            ) : (
              /* Files Tab */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 font-sans">
                {filteredFiles.length === 0 ? (
                  <div className="col-span-full py-6 text-center text-xs text-[var(--muted-foreground)]">
                    No project files found.
                  </div>
                ) : (
                  filteredFiles.map((file) => (
                    <div
                      key={file.path}
                      onClick={() => onOpenFile?.(file.path)}
                      className="flex items-center justify-between p-2 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]/50 hover:bg-[var(--accent)]/50 transition cursor-pointer group"
                      title={`Open "${file.path}" in Code Studio`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileCode className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                        <span className="text-xs font-medium text-[var(--foreground)] truncate">
                          {file.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--muted-foreground)] group-hover:text-[var(--foreground)]">
                        {file.size !== undefined ? `${(file.size / 1024).toFixed(1)} KB` : "file"}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* REPL Input row at bottom of Console */}
          {activeDevTab === "console" && (
            <form
              onSubmit={handleRunRepl}
              className="h-8 bg-[var(--background)] border-t border-[var(--border)] px-2 flex items-center gap-1.5 shrink-0"
            >
              <span className="text-[var(--primary)] font-mono text-xs font-bold pl-1">&gt;</span>
              <input
                type="text"
                placeholder="Evaluate JavaScript in preview (e.g. document.title, window.innerWidth)..."
                value={replInput}
                onChange={(e) => setReplInput(e.target.value)}
                className="flex-1 bg-transparent border-none text-[11px] font-mono text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] outline-none"
              />
              <button
                type="submit"
                disabled={!replInput.trim()}
                className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--accent)] hover:bg-[var(--primary)] hover:text-white transition cursor-pointer disabled:opacity-40"
              >
                Run
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
