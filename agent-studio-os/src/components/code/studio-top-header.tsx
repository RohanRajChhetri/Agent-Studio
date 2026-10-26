"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder,
  FolderPlus,
  Plus,
  RotateCcw,
  Monitor,
  Tablet,
  Smartphone,
  Columns2,
  MessageSquare,
  Eye,
  ChevronDown,
  ExternalLink,
  Edit2,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { OpenIdeMenu } from "./open-ide-menu";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { playClickSound } from "@/lib/sound-effects";

interface StudioTopHeaderProps {
  selectedProject: string;
  projects: WorkspaceProjectInfo[];
  onSelectProject: (name: string) => void;
  onNewConversation: () => void;
  onNewProject: () => void;
  onOpenBuiltInIde: () => void;
  onExportZip: () => void;
  onReloadPreview: () => void;
  onEditProject?: (name: string) => void;
  onDeleteProject?: (name: string) => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  activeViewMode: "split" | "chat" | "preview";
  onChangeViewMode: (mode: "split" | "chat" | "preview") => void;
  previewViewport: "desktop" | "tablet" | "mobile";
  onChangePreviewViewport: (vp: "desktop" | "tablet" | "mobile") => void;
  isGenerating?: boolean;
}

export function StudioTopHeader({
  selectedProject,
  projects,
  onSelectProject,
  onNewConversation,
  onNewProject,
  onOpenBuiltInIde,
  onExportZip,
  onReloadPreview,
  onEditProject,
  onDeleteProject,
  isSidebarOpen = false,
  onToggleSidebar,
  activeViewMode,
  onChangeViewMode,
  previewViewport,
  onChangePreviewViewport,
  isGenerating = false,
}: StudioTopHeaderProps) {
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const projectPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        projectPickerRef.current &&
        !projectPickerRef.current.contains(e.target as Node)
      ) {
        setShowProjectPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-[var(--card)]/90 backdrop-blur-md border-b border-[var(--border)] px-4 flex items-center justify-between select-none shrink-0 z-30">
      {/* ─── LEFT: TITLE, BADGE & PROJECT SWITCHER ─── */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
            title={isSidebarOpen ? "Hide sidebar" : "Show projects & conversations sidebar"}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>
        )}

        <div className="flex items-center gap-2">
          <h1 className="font-semibold text-sm text-[var(--foreground)] tracking-tight">
            Code Studio
          </h1>
        </div>

        <div className="h-5 w-px bg-[var(--border)] mx-1 hidden sm:block" />

        {/* Project Selector Dropdown & Quick Actions */}
        <div className="flex items-center gap-1">
          <div className="relative" ref={projectPickerRef}>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setShowProjectPicker((prev) => !prev);
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--background)] hover:bg-[var(--accent)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
            >
              <Folder className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span className="font-semibold truncate max-w-[140px]">
                {selectedProject || "workspace"}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--muted-foreground)]" />
            </button>

            <AnimatePresence>
              {showProjectPicker && (
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 2, scale: 0.96 }}
                  className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl z-50 space-y-0.5 text-left"
                >
                  <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] border-b border-[var(--border)] mb-1">
                    <span>Projects ({projects.length})</span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectPicker(false);
                        onNewProject();
                      }}
                      className="flex items-center gap-1 text-[var(--primary)] hover:underline capitalize font-sans"
                    >
                      <Plus className="w-3 h-3" />
                      <span>New</span>
                    </button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5">
                    {projects.map((p) => {
                      const isSelected = p.name === selectedProject;
                      return (
                        <div
                          key={p.name}
                          onClick={() => {
                            onSelectProject(p.name);
                            setShowProjectPicker(false);
                          }}
                          className={`group w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                              : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                            <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`} />
                            <span className="truncate">{p.name}</span>
                            {p.fileCount > 0 && (
                              <span className="text-[10px] text-[var(--muted-foreground)] opacity-60 font-mono">
                                ({p.fileCount})
                              </span>
                            )}
                          </div>

                          {/* Quick row actions: Edit & Delete */}
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 shrink-0">
                            {onEditProject && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowProjectPicker(false);
                                  onEditProject(p.name);
                                }}
                                className="p-1 rounded hover:bg-[var(--accent)] hover:text-indigo-400 text-[var(--muted-foreground)] transition cursor-pointer"
                                title={`Rename "${p.name}"`}
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {onDeleteProject && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowProjectPicker(false);
                                  onDeleteProject(p.name);
                                }}
                                className="p-1 rounded hover:bg-rose-500/15 hover:text-rose-400 text-[var(--muted-foreground)] transition cursor-pointer"
                                title={`Delete "${p.name}"`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Quick Header Edit & Delete Buttons for the currently active project */}
          {selectedProject && onEditProject && (
            <button
              type="button"
              onClick={() => onEditProject(selectedProject)}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/10 transition cursor-pointer"
              title={`Rename active project "${selectedProject}"`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}

          {selectedProject && onDeleteProject && (
            <button
              type="button"
              onClick={() => onDeleteProject(selectedProject)}
              className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition cursor-pointer"
              title={`Delete active project "${selectedProject}"`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── RIGHT: VIEW TOGGLES & OPEN IDE MENU ─── */}
      <div className="flex items-center gap-2">
        {/* View mode switcher */}
        <div className="hidden sm:flex items-center gap-0.5 p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangeViewMode("split");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              activeViewMode === "split"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Split: Chat & Live Product"
          >
            <Columns2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Split</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangeViewMode("chat");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              activeViewMode === "chat"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Chat Only"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Chat</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onChangeViewMode("preview");
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
              activeViewMode === "preview"
                ? "bg-[var(--accent)] text-[var(--foreground)] font-semibold shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
            title="Live Product Canvas"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Product</span>
          </button>
        </div>

        {/* Reload Preview button */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onReloadPreview();
          }}
          disabled={isGenerating}
          className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
          title="Reload Preview (Ctrl+R)"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? "animate-spin" : ""}`} />
        </button>

        {/* New Conversation Button */}
        <button
          type="button"
          onClick={() => {
            playClickSound();
            onNewConversation();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
          title="Start New Conversation (Ctrl+N)"
        >
          <Plus className="w-3.5 h-3.5 text-[var(--primary)]" />
          <span className="hidden sm:inline">New Chat</span>
        </button>

        {/* Open IDE dropdown button (prominent action) */}
        <OpenIdeMenu
          selectedProject={selectedProject}
          onOpenBuiltInIde={onOpenBuiltInIde}
          onExportZip={onExportZip}
        />
      </div>
    </header>
  );
}
