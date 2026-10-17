"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FolderOpen,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Loader2,
  FileText,
  Network,
  Brain,
  Layers,
  ShieldCheck,
  FolderTree,
  Bot,
  ArrowUpRight,
  Archive,
  Download,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export interface VaultStats {
  vaultPath: string;
  noteCount: number;
  graphStats: {
    nodes: number;
    edges: number;
    communities: number;
  };
}

interface VaultTabProps {
  vaultStats: VaultStats | null;
  onSyncVault: () => Promise<void>;
  onOpenObsidian: () => Promise<void>;
  syncingVault: boolean;
}

export function VaultTab({
  vaultStats,
  onSyncVault,
  onOpenObsidian,
  syncingVault,
}: VaultTabProps) {
  const [copiedPath, setCopiedPath] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch("/api/backup");
      if (res.ok) {
        const data = await res.json();
        setSnapshots(data.snapshots || []);
      }
    } catch {
      // ignore
    } finally {
      setLoadingSnapshots(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  const handleCreateSnapshot = async () => {
    setCreatingSnapshot(true);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Backup archive "${data.snapshot.fileName}" created!`);
        fetchSnapshots();
      } else {
        toast.error("Failed to create snapshot");
      }
    } catch {
      toast.error("Error creating backup archive");
    } finally {
      setCreatingSnapshot(false);
    }
  };

  const handleDeleteSnapshot = async (fileName: string) => {
    try {
      const res = await fetch("/api/backup", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      if (res.ok) {
        toast.success("Snapshot removed");
        setSnapshots((prev) => prev.filter((s) => s.fileName !== fileName));
      }
    } catch {
      toast.error("Failed to delete snapshot");
    }
  };

  const handleCopyPath = () => {
    if (vaultStats?.vaultPath) {
      navigator.clipboard.writeText(vaultStats.vaultPath);
      setCopiedPath(true);
      toast.success("Vault directory path copied to clipboard");
      setTimeout(() => setCopiedPath(false), 2000);
    }
  };

  const memoryDomains = [
    {
      folder: "Executive/",
      title: "Daily Executive Briefings",
      agent: "Executive Agent",
      desc: "Morning digests, cross-fleet summaries, and prioritized blockers.",
      badge: "Briefings",
    },
    {
      folder: "Research/",
      title: "Research Dossiers & Web Insights",
      agent: "Research Agent",
      desc: "Synthesized web citations, competitor teardowns, and technology evaluations.",
      badge: "Knowledge",
    },
    {
      folder: "Architecture/",
      title: "Engineering Specs & Code Artifacts",
      agent: "Coder Agent",
      desc: "API schemas, database migration logs, and component contracts.",
      badge: "Code",
    },
    {
      folder: "Tasks/",
      title: "Kanban Task Deliverables",
      agent: "Reviewer & Autonomous Fleet",
      desc: "Human-in-the-loop review notes, completion proofs, and test results.",
      badge: "Deliverables",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Obsidian Hero Banner */}
      <div className="rounded-2xl border border-border bg-card p-6 space-y-5 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-500 border border-purple-500/20 flex items-center justify-center shrink-0">
              <FolderOpen className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">Obsidian Shared Memory Vault</h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  Local Markdown Engine
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Single source of truth for episodic memory, documentation, research findings, and task artifacts. All autonomous agents read and write directly to this folder, allowing bidirectional cross-referencing and Obsidian Graph visualization.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
            <button
              onClick={onOpenObsidian}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open in Obsidian</span>
            </button>

            <button
              onClick={onSyncVault}
              disabled={syncingVault}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer disabled:opacity-50"
            >
              {syncingVault ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <Sparkles className="w-3.5 h-3.5 text-purple-500" />}
              <span>{syncingVault ? "Synchronizing..." : "Sync & Re-index"}</span>
            </button>
          </div>
        </div>

        {/* Local Directory Selector */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Local Vault Storage Directory
            </label>
            <span className="text-[10.5px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
              Directory Verified
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 p-2.5 rounded-xl bg-secondary/60 border border-border font-mono text-xs text-foreground select-all break-all flex items-center gap-2">
              <FolderTree className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span>{vaultStats?.vaultPath || "~/agent-studio/memory"}</span>
            </div>
            <button
              onClick={handleCopyPath}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition cursor-pointer shrink-0"
              title="Copy path"
            >
              {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copiedPath ? "Copied" : "Copy"}</span>
            </button>
          </div>
        </div>

        {/* Realtime Metrics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Total Notes</span>
              <FileText className="w-4 h-4 text-purple-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.noteCount ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Formatted Markdown documents</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Knowledge Graph Links</span>
              <Network className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.graphStats?.edges ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Bidirectional [[wikilinks]] indexed</p>
          </div>

          <div className="p-4 rounded-xl border border-border bg-secondary/30 space-y-1">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-[10.5px] uppercase tracking-wider font-semibold">Context Clusters</span>
              <Brain className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold font-mono text-foreground">{vaultStats?.graphStats?.communities ?? 0}</p>
            <p className="text-[10.5px] text-muted-foreground">Louvain modularity clusters</p>
          </div>
        </div>
      </div>

      {/* Fleet Memory Domain Map */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-foreground">Fleet Memory Partition Map</h4>
          <p className="text-xs text-muted-foreground">
            How autonomous agents structure knowledge within the Obsidian vault hierarchy
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {memoryDomains.map((dom) => (
            <div
              key={dom.folder}
              className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-2 hover:border-purple-500/40 transition"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                  {dom.folder}
                </span>
                <span className="text-[10.5px] text-muted-foreground font-mono flex items-center gap-1">
                  <Bot className="w-3 h-3 text-muted-foreground" />
                  {dom.agent}
                </span>
              </div>
              <h5 className="text-xs font-semibold text-foreground">{dom.title}</h5>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{dom.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Database & Vault Snapshots / Backups */}
      <div className="space-y-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Archive className="w-4 h-4 text-primary" />
              Automated Snapshots & Disaster Recovery
            </h4>
            <p className="text-xs text-muted-foreground">
              One-click complete backups of SQLite state, agent profiles, tasks, and markdown vault notes.
            </p>
          </div>
          <button
            onClick={handleCreateSnapshot}
            disabled={creatingSnapshot}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition disabled:opacity-50 cursor-pointer shadow-sm shrink-0"
          >
            {creatingSnapshot ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Archive className="w-3.5 h-3.5" />
            )}
            <span>{creatingSnapshot ? "Archiving..." : "Create Snapshot"}</span>
          </button>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          {loadingSnapshots ? (
            <div className="py-6 flex items-center justify-center text-muted-foreground text-xs gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Checking backup archives...</span>
            </div>
          ) : snapshots.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground space-y-1">
              <Archive className="w-8 h-8 text-muted-foreground/30 mx-auto" />
              <p className="text-xs font-medium">No snapshots created yet</p>
              <p className="text-[11px] text-muted-foreground">
                Click &quot;Create Snapshot&quot; to export a complete portable archive.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => (
                <div
                  key={snap.fileName}
                  className="p-3 rounded-xl bg-secondary/50 border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Archive className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-foreground truncate">{snap.fileName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(snap.sizeBytes / 1024).toFixed(1)} KB • {new Date(snap.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={snap.downloadUrl}
                      download={snap.fileName}
                      className="p-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                      title="Download archive"
                    >
                      <Download className="w-3.5 h-3.5 text-primary" />
                    </a>
                    <button
                      onClick={() => handleDeleteSnapshot(snap.fileName)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition cursor-pointer"
                      title="Delete archive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
