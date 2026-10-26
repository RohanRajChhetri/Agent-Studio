"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Folder,
  Plus,
  Code,
  Sparkles,
  Zap,
  RotateCcw,
  Download,
  Laptop,
  Maximize2,
  X,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { playClickSound } from "@/lib/sound-effects";

interface StudioCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  projects: WorkspaceProjectInfo[];
  selectedProject: string;
  onSelectProject: (name: string) => void;
  onNewConversation: () => void;
  onNewProject: () => void;
  onOpenBuiltInIde: () => void;
  onReloadPreview: () => void;
  onExportZip: () => void;
}

export function StudioCommandPalette({
  isOpen,
  onClose,
  projects,
  selectedProject,
  onSelectProject,
  onNewConversation,
  onNewProject,
  onOpenBuiltInIde,
  onReloadPreview,
  onExportZip,
}: StudioCommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  const actions = useMemo(() => {
    return [
      {
        id: "new-conv",
        label: "New Conversation",
        shortcut: "Ctrl+N",
        icon: Plus,
        run: onNewConversation,
      },
      {
        id: "new-proj",
        label: "New Project",
        shortcut: "Ctrl+Shift+N",
        icon: Folder,
        run: onNewProject,
      },
      {
        id: "built-in-ide",
        label: "Open Built-in Code Studio",
        shortcut: "Ctrl+I",
        icon: Code,
        run: onOpenBuiltInIde,
      },
      {
        id: "reload",
        label: "Reload Preview",
        shortcut: "Ctrl+R",
        icon: RotateCcw,
        run: onReloadPreview,
      },
      {
        id: "export-zip",
        label: `Export "${selectedProject}" as ZIP`,
        icon: Download,
        run: onExportZip,
      },
    ];
  }, [selectedProject, onNewConversation, onNewProject, onOpenBuiltInIde, onReloadPreview, onExportZip]);

  const filteredProjects = useMemo(() => {
    if (!query.trim()) return projects;
    const q = query.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions;
    const q = query.toLowerCase();
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, actions, or commands..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent outline-none text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-3 scrollbar-none">
          {/* Projects */}
          {filteredProjects.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                Projects
              </div>
              <div className="space-y-0.5">
                {filteredProjects.map((p) => (
                  <div
                    key={p.name}
                    onClick={() => {
                      playClickSound();
                      onSelectProject(p.name);
                      onClose();
                    }}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition cursor-pointer ${
                      p.name === selectedProject
                        ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                        : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder className="w-3.5 h-3.5" />
                      <span>{p.name}</span>
                    </div>
                    {p.name === selectedProject && (
                      <span className="text-[10px] text-[var(--primary)] font-mono">Current</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          {filteredActions.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                Actions
              </div>
              <div className="space-y-0.5">
                {filteredActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <div
                      key={action.id}
                      onClick={() => {
                        playClickSound();
                        action.run();
                        onClose();
                      }}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                        <span>{action.label}</span>
                      </div>
                      {action.shortcut && (
                        <kbd className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-60">
                          {action.shortcut}
                        </kbd>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
