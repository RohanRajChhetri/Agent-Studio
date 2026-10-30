"use client";

import { useMemo } from "react";
import {
  Brain,
  FileText,
  Folder,
  Sparkles,
  ExternalLink,
  Plus,
  FolderPlus,
  Clock,
  ArrowUpRight,
  Share2,
  HardDrive,
  CheckCircle2,
} from "lucide-react";
import type { VaultFile } from "@/types";
import type { GalaxyData } from "@/lib/vault";
import { playClickSound } from "@/lib/sound-effects";

interface MemoryEmptyDashboardProps {
  files: VaultFile[];
  galaxyData: GalaxyData | null;
  onSelectNote: (path: string) => void;
  onNewNote: () => void;
  onNewFolder: () => void;
  onSync: () => void;
  onOpenObsidian: () => void;
}

interface FlatNote {
  name: string;
  relativePath: string;
  modifiedAt?: string;
  size?: number;
}

export function MemoryEmptyDashboard({
  files,
  galaxyData,
  onSelectNote,
  onNewNote,
  onNewFolder,
  onSync,
  onOpenObsidian,
}: MemoryEmptyDashboardProps) {
  // Flatten all markdown notes recursively and sort by modifiedAt descending
  const { allNotes, topFolders } = useMemo(() => {
    const notes: FlatNote[] = [];
    const folders: string[] = [];

    const traverse = (items: VaultFile[]) => {
      for (const item of items) {
        if (item.isDirectory) {
          folders.push(item.name);
          if (item.children) traverse(item.children);
        } else if (item.name.endsWith(".md") || !item.isDirectory) {
          notes.push({
            name: item.name,
            relativePath: item.relativePath,
            modifiedAt: item.modifiedAt,
            size: item.size,
          });
        }
      }
    };

    traverse(files);

    notes.sort((a, b) => {
      const timeA = a.modifiedAt ? new Date(a.modifiedAt).getTime() : 0;
      const timeB = b.modifiedAt ? new Date(b.modifiedAt).getTime() : 0;
      return timeB - timeA;
    });

    return { allNotes: notes, topFolders: folders };
  }, [files]);

  const recentNotes = allNotes.slice(0, 6);
  const totalNotes = allNotes.length;
  const totalFolders = topFolders.length;
  const totalConnections = galaxyData?.links?.length || 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                Live Obsidian Vault
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                agent-workspace/memory
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Knowledge Base & Memory Vault
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Shared cross-agent intelligence, design specifications, and automated research notes.
              Select any document on the left or launch an action below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onNewNote();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Note</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onOpenObsidian();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-foreground text-xs font-medium transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              <span>Open in Obsidian</span>
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-xl border border-border bg-card/80 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Notes</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{totalNotes}</div>
          <div className="text-[11px] text-muted-foreground">Markdown documents</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/80 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Folders & Categories</span>
            <Folder className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{totalFolders}</div>
          <div className="text-[11px] text-muted-foreground">Organized workspaces</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/80 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Knowledge Links</span>
            <Share2 className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-foreground font-mono">{totalConnections}</div>
          <div className="text-[11px] text-muted-foreground">Cross-referenced wikilinks</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/80 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Sync Protocol</span>
            <HardDrive className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-sm font-semibold text-foreground pt-1.5 truncate">
            Obsidian Local Vault
          </div>
          <div className="text-[11px] text-muted-foreground">Bidirectional real-time</div>
        </div>
      </div>

      {/* Recently Updated Notes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Recently Modified Notes</h3>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            {recentNotes.length} of {totalNotes}
          </span>
        </div>

        {recentNotes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center space-y-2">
            <FileText className="w-8 h-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-sm font-medium text-foreground">No notes in the vault yet</p>
            <p className="text-xs text-muted-foreground">
              Click &quot;Create Note&quot; or &quot;New Folder&quot; to build your autonomous knowledge base.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentNotes.map((note, idx) => {
              const formattedTime = note.modifiedAt
                ? new Date(note.modifiedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })
                : "Recently";

              return (
                <div
                  key={note.relativePath || `note-${note.name}-${idx}`}
                  onClick={() => {
                    playClickSound();
                    onSelectNote(note.relativePath);
                  }}
                  className="group relative flex flex-col justify-between p-3.5 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-secondary/40 transition-all cursor-pointer shadow-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0 group-hover:scale-110 transition-transform" />
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                          {note.name.replace(/\.md$/, "")}
                        </span>
                      </div>
                      <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>
                    <p className="font-mono text-[11px] text-muted-foreground truncate">
                      {note.relativePath}
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-[10.5px] font-mono text-muted-foreground pt-3 border-t border-border/40 mt-3">
                    <span>{formattedTime}</span>
                    {note.size !== undefined && (
                      <span>{(note.size / 1024).toFixed(1)} KB</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Action Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onNewFolder();
          }}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/50 text-left transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <FolderPlus className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">New Folder</div>
            <div className="text-[11px] text-muted-foreground">Create categorized subfolder</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            playClickSound();
            onSync();
          }}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/50 text-left transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">Sync Knowledge</div>
            <div className="text-[11px] text-muted-foreground">Ingest custom context &amp; tags</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            playClickSound();
            onOpenObsidian();
          }}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-secondary/50 text-left transition-colors cursor-pointer group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-foreground">Obsidian App</div>
            <div className="text-[11px] text-muted-foreground">Launch desktop native vault</div>
          </div>
        </button>
      </div>
    </div>
  );
}
