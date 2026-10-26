"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Monitor,
  X,
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Camera,
  Play,
  MousePointer,
  Keyboard,
  Layers,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";

export interface DesktopActionLogEntry {
  id: string;
  actionType: "launch" | "screenshot" | "click" | "type" | "compound" | "inspect" | "key" | "wait";
  title: string;
  target?: string;
  status: "success" | "failed";
  latency: number;
  screenshotUrl?: string;
  agentName: string;
  details?: string;
  timestamp: string;
}

interface DesktopActionLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLiveDesktop?: () => void;
}

export function DesktopActionLogModal({
  isOpen,
  onClose,
  onOpenLiveDesktop,
}: DesktopActionLogModalProps) {
  const [logs, setLogs] = useState<DesktopActionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [activePreviewImage, setActivePreviewImage] = useState<string | null>(null);

  const fetchLogs = useCallback(async (showToast = false) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/desktop/logs?t=${Date.now()}`);
      if (!res.ok) throw new Error("Failed to load desktop logs");
      const data = await res.json();
      setLogs(data.logs || []);
      if (showToast) toast.success("Desktop action logs refreshed");
    } catch (err: any) {
      console.warn("Error fetching desktop logs:", err);
      if (showToast) toast.error("Could not load desktop action logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (activePreviewImage) {
          setActivePreviewImage(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activePreviewImage, onClose]);

  const handleClearLogs = async () => {
    try {
      const res = await fetch("/api/tools/desktop/logs", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear logs");
      setLogs([]);
      toast.success("Desktop action logs cleared");
    } catch {
      toast.error("Failed to clear desktop logs");
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType !== "all" && log.actionType !== filterType) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = log.title.toLowerCase().includes(q);
        const matchTarget = log.target?.toLowerCase().includes(q);
        const matchDetails = log.details?.toLowerCase().includes(q);
        const matchAgent = log.agentName.toLowerCase().includes(q);
        return matchTitle || matchTarget || matchDetails || matchAgent;
      }
      return true;
    });
  }, [logs, filterType, searchQuery]);

  if (!isOpen) return null;

  const getActionBadge = (type: string) => {
    switch (type) {
      case "screenshot":
        return {
          icon: Camera,
          label: "Screenshot",
          color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        };
      case "launch":
        return {
          icon: Play,
          label: "Launch App",
          color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
        };
      case "compound":
        return {
          icon: Sparkles,
          label: "Compound Workflow",
          color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
        };
      case "click":
        return {
          icon: MousePointer,
          label: "Mouse Click",
          color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        };
      case "type":
        return {
          icon: Keyboard,
          label: "Keyboard Input",
          color: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
        };
      default:
        return {
          icon: Layers,
          label: type,
          color: "bg-secondary text-secondary-foreground border-border",
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl h-[85vh] max-h-[780px] flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-border bg-card/90 backdrop-blur-md flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Monitor className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
                  Desktop Action Log
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  {logs.length} events
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Audit trail of computer actions executed by agents via CUA Driver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenLiveDesktop && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLiveDesktop();
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-muted text-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
                title="Switch to Live Desktop Operator"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span>Open Live Desktop</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fetchLogs(true)}
              disabled={loading}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Refresh logs"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-primary" : ""}`} />
            </button>

            {logs.length > 0 && (
              <button
                type="button"
                onClick={handleClearLogs}
                className="p-2 rounded-xl text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Clear all action logs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="px-5 py-3 border-b border-border bg-muted/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* Search Input */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions, applications, targets..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Action Type Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
            {[
              { id: "all", label: "All" },
              { id: "screenshot", label: "Screenshots" },
              { id: "compound", label: "Compound" },
              { id: "launch", label: "Launches" },
              { id: "click", label: "Clicks" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterType(f.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  filterType === f.id
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log Entries List */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading && logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs font-medium">Loading desktop action history...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-muted-foreground">
                <Monitor className="w-6 h-6 opacity-60" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">No Desktop Actions Logged</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  {searchQuery || filterType !== "all"
                    ? "No actions matched your current search filters."
                    : "Desktop operations triggered by agents or human commands will appear here automatically with visual evidence."}
                </p>
              </div>
            </div>
          ) : (
            filteredLogs.map((log) => {
              const badge = getActionBadge(log.actionType);
              const BadgeIcon = badge.icon;

              return (
                <div
                  key={log.id}
                  className="p-3.5 rounded-xl border border-border bg-card hover:border-primary/30 transition-all space-y-2.5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold shrink-0 ${badge.color}`}
                      >
                        <BadgeIcon className="w-3.5 h-3.5" />
                        <span>{badge.label}</span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-foreground truncate">
                          {log.title}
                        </h4>
                        {log.target && (
                          <p className="text-[11px] text-muted-foreground truncate font-mono">
                            Target: <span className="text-foreground">{log.target}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Metadata & Status */}
                    <div className="flex items-center gap-2 shrink-0">
                      {log.latency > 0 && (
                        <span className="text-[10.5px] font-mono text-muted-foreground flex items-center gap-1 bg-secondary/80 px-2 py-0.5 rounded-md border border-border">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span>{log.latency}ms</span>
                        </span>
                      )}

                      <span
                        className={`inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-0.5 rounded-md border ${
                          log.status === "success"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {log.status === "success" ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                        )}
                        <span className="capitalize">{log.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Screenshot Thumbnail Preview if Available */}
                  {log.screenshotUrl && (
                    <div className="pt-1 flex items-center gap-3">
                      <div
                        onClick={() => setActivePreviewImage(log.screenshotUrl!)}
                        className="relative group rounded-lg overflow-hidden border border-border bg-black/40 cursor-pointer shrink-0"
                      >
                        <img
                          src={log.screenshotUrl}
                          alt="Screenshot Evidence"
                          className="w-32 h-20 object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-medium gap-1">
                          <Maximize2 className="w-3.5 h-3.5" />
                          <span>Zoom</span>
                        </div>
                      </div>

                      <div className="text-xs space-y-1 min-w-0">
                        <p className="font-medium text-foreground">Visual State Captured</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Primary display snapshot recorded at execution time
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setActivePreviewImage(log.screenshotUrl!)}
                            className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Maximize2 className="w-3 h-3" />
                            <span>Preview Full Screen</span>
                          </button>
                          <span className="text-muted-foreground">•</span>
                          <a
                            href={log.screenshotUrl}
                            download={`desktop-screenshot-${log.id}.png`}
                            className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom Footer Info */}
                  <div className="flex items-center justify-between text-[10.5px] text-muted-foreground pt-1 border-t border-border/50">
                    <span className="font-mono">
                      Operator: <span className="font-semibold text-foreground">{log.agentName}</span>
                    </span>
                    <span title={new Date(log.timestamp).toLocaleString()}>
                      {timeAgo(log.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-border bg-card/90 flex items-center justify-between text-xs text-muted-foreground shrink-0">
          <span>Connected to local Windows CUA native driver</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-secondary hover:bg-muted text-foreground font-medium border border-border transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>

      {/* Lightbox Screenshot Image Preview */}
      {activePreviewImage && (
        <div
          onClick={() => setActivePreviewImage(null)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-5xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black"
          >
            <div className="p-3 bg-zinc-950/90 border-b border-white/10 flex items-center justify-between gap-3 text-white">
              <span className="text-xs font-semibold">Desktop Screenshot Evidence</span>
              <div className="flex items-center gap-2">
                <a
                  href={activePreviewImage}
                  download="desktop-screenshot.png"
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition"
                  title="Download image"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setActivePreviewImage(null)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-300 hover:text-white transition"
                  title="Close preview"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={activePreviewImage}
              alt="Desktop Screenshot Full Preview"
              className="max-h-[80vh] w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
