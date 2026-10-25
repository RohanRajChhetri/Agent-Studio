"use client";

import { useState } from "react";
import {
  FolderKanban,
  Plus,
  RotateCcw,
  Save,
  Loader2,
  Code2,
  Columns2,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Search,
  AlignLeft,
  Copy,
  ChevronDown,
  Sparkles,
  MessageSquarePlus,
  FolderPlus,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";

interface CodeHeaderProps {
  selectedProject: string;
  projects: WorkspaceProjectInfo[];
  onSelectProject: (name: string) => void;
  onNewSession: () => void;
  onNewProject: () => void;
  onDeleteProject: () => void;
  activeArtifactTab: "code" | "split" | "preview";
  onChangeArtifactTab: (tab: "code" | "split" | "preview") => void;
  activeFilePath?: string;
  isDirty?: boolean;
  isSaving?: boolean;
  onSaveFile: () => void;
  onReloadPreview: () => void;
  onFormatCode: () => void;
  onCopyCode: () => void;
  onToggleSearch: () => void;
  previewViewport: "desktop" | "tablet" | "mobile";
  onChangePreviewViewport: (vp: "desktop" | "tablet" | "mobile") => void;
  isGenerating?: boolean;
}

export function CodeHeader({
  selectedProject,
  projects,
  onSelectProject,
  onNewSession,
  onNewProject,
  onDeleteProject,
  activeArtifactTab,
  onChangeArtifactTab,
  activeFilePath = "index.html",
  isDirty = false,
  isSaving = false,
  onSaveFile,
  onReloadPreview,
  onFormatCode,
  onCopyCode,
  onToggleSearch,
  previewViewport,
  onChangePreviewViewport,
  isGenerating = false,
}: CodeHeaderProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <header className="h-14 border-b border-border bg-card/95 backdrop-blur-md px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 select-none z-30">
      {/* ─── LEFT: Project Selector & Actions ─── */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Project Selector Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDropdown((prev) => !prev)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xs font-semibold text-foreground transition cursor-pointer max-w-[200px] sm:max-w-[260px] truncate"
            title="Switch Workspace Project"
          >
            <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{selectedProject}</span>
            <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0 ml-0.5" />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1.5 w-64 rounded-2xl border border-border bg-card shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="p-1.5">
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filter workspaces..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary"
                  autoFocus
                />
              </div>

              <div className="max-h-48 overflow-y-auto space-y-0.5 py-1">
                {filteredProjects.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      onSelectProject(p.name);
                      setShowDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition ${
                      p.name === selectedProject
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="truncate">{p.name}</span>
                    <span className="text-[10px] opacity-70 ml-2">{p.fileCount} files</span>
                  </button>
                ))}
                {filteredProjects.length === 0 && (
                  <div className="p-3 text-center text-xs text-muted-foreground">No projects found</div>
                )}
              </div>

              <div className="border-t border-border pt-1.5 mt-1 flex items-center justify-between gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowDropdown(false);
                    onNewProject();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Workspace</span>
                </button>
                {selectedProject !== "default-project" && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      onDeleteProject();
                    }}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* New Session Button */}
        <button
          type="button"
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition cursor-pointer shrink-0"
          title="Start fresh conversation session in this project"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">New Session</span>
        </button>

        {/* New Project Button */}
        <button
          type="button"
          onClick={onNewProject}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0"
          title="Scaffold brand new project workspace"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden md:inline">New Project</span>
        </button>
      </div>

      {/* ─── CENTER: Segmented View Switcher ─── */}
      <div className="flex items-center bg-secondary/60 p-1 rounded-xl border border-border/80 shadow-xs shrink-0">
        <button
          type="button"
          onClick={() => onChangeArtifactTab("code")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeArtifactTab === "code"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Show Code Editor"
        >
          <Code2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Code</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeArtifactTab("split")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeArtifactTab === "split"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Side-by-Side Split View"
        >
          <Columns2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Split</span>
        </button>

        <button
          type="button"
          onClick={() => onChangeArtifactTab("preview")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
            activeArtifactTab === "preview"
              ? "bg-card text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground"
          }`}
          title="Live Interactive Preview"
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Preview</span>
        </button>
      </div>

      {/* ─── RIGHT: Actions & Quick Tools ─── */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Active file & dirty indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground font-mono bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40">
          <span className="truncate max-w-[140px]">{activeFilePath}</span>
          {isDirty && <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved changes" />}
        </div>

        {/* Viewport switchers if preview is visible */}
        {(activeArtifactTab === "preview" || activeArtifactTab === "split") && (
          <div className="hidden sm:flex items-center bg-secondary/50 p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onChangePreviewViewport("desktop")}
              className={`p-1 rounded transition ${
                previewViewport === "desktop" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
              title="Desktop viewport"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangePreviewViewport("tablet")}
              className={`p-1 rounded transition ${
                previewViewport === "tablet" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
              title="Tablet viewport"
            >
              <Tablet className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onChangePreviewViewport("mobile")}
              className={`p-1 rounded transition ${
                previewViewport === "mobile" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground"
              }`}
              title="Mobile viewport"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Reload Preview button */}
        {(activeArtifactTab === "preview" || activeArtifactTab === "split") && (
          <button
            type="button"
            onClick={onReloadPreview}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Reload live preview"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Format Code button */}
        {activeArtifactTab !== "preview" && (
          <button
            type="button"
            onClick={onFormatCode}
            className="hidden sm:inline-flex p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Format active document (Shift+Alt+F)"
          >
            <AlignLeft className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Search button */}
        {activeArtifactTab !== "preview" && (
          <button
            type="button"
            onClick={onToggleSearch}
            className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Find & Replace (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Save button */}
        <button
          type="button"
          onClick={onSaveFile}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 shadow-xs transition cursor-pointer"
          title="Save file changes (Ctrl+S)"
        >
          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span className="hidden sm:inline">Save</span>
        </button>
      </div>
    </header>
  );
}
