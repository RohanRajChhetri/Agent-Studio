"use client";

import { useState } from "react";
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
              <span>{vaultStats?.vaultPath || "C:\\Users\\rohan\\agent-studio\\memory"}</span>
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
    </motion.div>
  );
}
