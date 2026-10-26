"use client";

import { useState, useMemo } from "react";
import {
  Plus,
  History,
  Folder,
  FolderPlus,
  Settings,
  MoreVertical,
  Trash2,
  Edit2,
  Copy,
  Download,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Search,
  Check,
  Code,
  FolderKanban,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { playClickSound } from "@/lib/sound-effects";

interface StudioSidebarProps {
  isOpen: boolean;
  projects: WorkspaceProjectInfo[];
  selectedProject: string;
  onSelectProject: (name: string) => void;
  onNewConversation: () => void;
  onNewProject: () => void;
  onOpenHistory: () => void;
  onOpenSettings?: () => void;
  onEditProject?: (name: string) => void;
  onDeleteProject?: (name: string) => void;
  onExportZip?: (name: string) => void;
  conversationSnippets?: Record<string, Array<{ id: string; title: string; timeAgo: string }>>;
}

export function StudioSidebar({
  isOpen,
  projects,
  selectedProject,
  onSelectProject,
  onNewConversation,
  onNewProject,
  onOpenHistory,
  onOpenSettings,
  onEditProject,
  onDeleteProject,
  onExportZip,
  conversationSnippets = {},
}: StudioSidebarProps) {
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    [selectedProject]: true,
  });
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);

  const toggleProjectExpand = (projName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedProjects((prev) => ({
      ...prev,
      [projName]: !prev[projName],
    }));
  };

  const filteredProjects = useMemo(() => {
    if (!projectSearchQuery.trim()) return projects;
    const query = projectSearchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(query));
  }, [projects, projectSearchQuery]);

  if (!isOpen) return null;

  return (
    <aside className="w-64 bg-[var(--card)] border-r border-[var(--border)] flex flex-col h-full select-none shrink-0 z-10">
      {/* ─── TOP PRIMARY ACTION: + NEW CONVERSATION ─── */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onNewConversation();
          }}
          className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] text-[13px] font-medium text-[var(--foreground)] transition-all cursor-pointer shadow-xs hover:border-[var(--primary)]/40 group"
        >
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
            <span>New Conversation</span>
          </div>
          <kbd className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-60">
            Ctrl+N
          </kbd>
        </button>
      </div>

      {/* ─── SECONDARY NAVIGATION ITEMS ─── */}
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onOpenHistory();
          }}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/60 transition cursor-pointer border border-transparent hover:border-[var(--border)] group"
          title="Open Conversation History"
        >
          <div className="flex items-center gap-2.5">
            <History className="w-4 h-4 text-[var(--primary)] group-hover:scale-105 transition-transform" />
            <span>Conversation History</span>
          </div>
          <span className="text-[10px] font-mono text-[var(--muted-foreground)] opacity-60">
            Ctrl+H
          </span>
        </button>
      </div>

      <div className="h-px bg-[var(--border)] mx-3 my-1" />

      {/* ─── PROJECTS SECTION HEADER ─── */}
      <div className="px-3 pt-2 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
          Projects
        </span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onNewProject}
            className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
            title="Create New Project"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Project Search Bar if > 4 projects */}
      {projects.length > 4 && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs">
            <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
            <input
              type="text"
              placeholder="Filter projects..."
              value={projectSearchQuery}
              onChange={(e) => setProjectSearchQuery(e.target.value)}
              className="w-full bg-transparent outline-none text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)]"
            />
          </div>
        </div>
      )}

      {/* ─── PROJECTS LIST & NESTED CONVERSATIONS ─── */}
      <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-none">
        {filteredProjects.map((project) => {
          const isSelected = project.name === selectedProject;
          const isExpanded = expandedProjects[project.name] ?? isSelected;
          const threads = conversationSnippets[project.name] || [];

          return (
            <div key={project.name} className="space-y-0.5">
              {/* Project Folder Row */}
              <div
                onClick={() => {
                  playClickSound();
                  onSelectProject(project.name);
                  setExpandedProjects((prev) => ({ ...prev, [project.name]: true }));
                }}
                className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  isSelected
                    ? "bg-[var(--primary)]/10 text-[var(--foreground)] font-semibold"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/50"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={(e) => toggleProjectExpand(project.name, e)}
                    className="p-0.5 hover:text-[var(--foreground)] text-[var(--muted-foreground)]"
                  >
                    <ChevronRight
                      className={`w-3 h-3 transition-transform duration-150 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  <Folder
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"
                    }`}
                  />
                  <span className="truncate text-[12.5px]">{project.name}</span>
                </div>

                {/* Project Menu Trigger */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectMenuOpen(projectMenuOpen === project.name ? null : project.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
                  >
                    <MoreVertical className="w-3 h-3" />
                  </button>

                  {/* Project Dropdown */}
                  <AnimatePresence>
                    {projectMenuOpen === project.name && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1 shadow-2xl z-50 text-left space-y-0.5"
                      >
                        {onEditProject && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectMenuOpen(null);
                              onEditProject(project.name);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-indigo-400 transition cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Rename Project</span>
                          </button>
                        )}
                        {onExportZip && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectMenuOpen(null);
                              onExportZip(project.name);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export ZIP</span>
                          </button>
                        )}
                        {onDeleteProject && project.name !== "workspace" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setProjectMenuOpen(null);
                              onDeleteProject(project.name);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Delete Project</span>
                          </button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Nested Conversation Threads (Matching Antigravity screenshot) */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="pl-7 pr-1 space-y-0.5 overflow-hidden"
                  >
                    {threads.length > 0 ? (
                      threads.map((thread) => (
                        <div
                          key={thread.id}
                          onClick={() => {
                            playClickSound();
                            onSelectProject(project.name);
                          }}
                          className="flex items-center justify-between px-2 py-1 rounded-md text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/40 transition cursor-pointer truncate group"
                        >
                          <span className="truncate pr-1">{thread.title}</span>
                          <span className="text-[10px] font-mono text-[var(--muted-foreground)]/60 shrink-0">
                            {thread.timeAgo}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="px-2 py-1 text-[11px] text-[var(--muted-foreground)]/50 italic">
                        No conversations yet
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* ─── BOTTOM FOOTER: SETTINGS ─── */}
      <div className="p-2 border-t border-[var(--border)] shrink-0">
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onOpenSettings?.();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]/60 transition cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[var(--muted-foreground)]" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}
