"use client";

import { useState, useRef, useMemo } from "react";
import {
  X,
  Code,
  Save,
  FolderTree,
  Copy,
  Download,
  Loader2,
  FileCode,
  Folder,
  ChevronRight,
  Maximize2,
  Minimize2,
  FileText,
  FileJson,
  Globe,
  Palette,
  Terminal,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { FileTreeNode } from "@/lib/project-filesystem";
import { getLanguageForFile } from "./code-utils";
import { playClickSound, playTaskCompletedSound } from "@/lib/sound-effects";

function FileTypeIcon({ name }: { name: string }) {
  const meta = getLanguageForFile(name);
  switch (meta.id) {
    case "typescript":
    case "javascript":
    case "rust":
    case "go":
      return <FileCode className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "html":
      return <Globe className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "css":
      return <Palette className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "python":
    case "bash":
      return <Terminal className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "json":
      return <FileJson className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "sql":
      return <Database className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
    case "markdown":
    default:
      return <FileText className={`w-3.5 h-3.5 shrink-0 ${meta.color}`} />;
  }
}


interface EditorTab {
  path: string;
  name: string;
  content: string;
  originalContent: string;
  isDirty: boolean;
  language: string;
}

interface StudioIdeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProject: string;
  fileTree: FileTreeNode[];
  tabs: EditorTab[];
  activeTabPath: string;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string, e: React.MouseEvent) => void;
  onOpenFile: (path: string) => void;
  onCodeChange: (newContent: string) => void;
  onSaveFile: () => void;
  isSaving: boolean;
}

export function StudioIdeDrawer({
  isOpen,
  onClose,
  selectedProject,
  fileTree,
  tabs,
  activeTabPath,
  onSelectTab,
  onCloseTab,
  onOpenFile,
  onCodeChange,
  onSaveFile,
  isSaving,
}: StudioIdeDrawerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeTab = tabs.find((t) => t.path === activeTabPath) || tabs[0];
  const code = activeTab?.content || "";

  // Deduplicate tabs by path to prevent duplicate key collisions
  const uniqueTabs = useMemo(() => {
    const seen = new Set<string>();
    return tabs.filter((t) => {
      if (!t.path || seen.has(t.path)) return false;
      seen.add(t.path);
      return true;
    });
  }, [tabs]);

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes.map((node) => {
      const isExpanded = expandedFolders[node.path] ?? true;
      const fileMeta = getLanguageForFile(node.name);
      const isSelected = activeTabPath === node.path;

      if (node.isDirectory) {
        return (
          <div key={node.path} className="space-y-0.5">
            <div
              onClick={() => toggleFolder(node.path)}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className="flex items-center gap-1.5 py-1 px-2 rounded-md text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer select-none"
            >
              <ChevronRight
                className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
              <Folder className="w-3.5 h-3.5 text-amber-500/80" />
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      return (
        <div
          key={node.path}
          onClick={() => onOpenFile(node.path)}
          style={{ paddingLeft: `${depth * 12 + 20}px` }}
          className={`flex items-center gap-2 py-1 px-2 rounded-md text-xs font-mono transition cursor-pointer select-none ${
            isSelected
              ? "bg-[var(--primary)]/15 text-[var(--primary)] font-semibold"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
          }`}
        >
          <FileTypeIcon name={node.name} />
          <span className="truncate">{node.name}</span>
        </div>
      );
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.98 }}
        className={`w-full ${
          isFullscreen ? "h-full" : "h-[90vh] max-w-6xl"
        } rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl flex flex-col overflow-hidden`}
      >
        {/* Drawer Header */}
        <div className="h-11 bg-[var(--card)] border-b border-[var(--border)] px-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Code className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-xs font-semibold text-[var(--foreground)]">
              Built-in Code Studio
            </span>
            <span className="text-xs text-[var(--muted-foreground)] font-mono">
              ({selectedProject})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSaveFile}
              disabled={isSaving || !activeTab?.isDirty}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                activeTab?.isDirty
                  ? "bg-[var(--primary)] text-white hover:opacity-90 shadow-sm"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] opacity-60"
              }`}
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Save File</span>
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(code);
                toast.success("Code copied to clipboard");
              }}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
              title="Copy Code"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
              title="Close Code Studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Drawer Body: Sidebar + Tabs + Editor */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* File Explorer Tree */}
          <div className="w-60 bg-[var(--background)] border-r border-[var(--border)] flex flex-col shrink-0 overflow-y-auto p-2 scrollbar-none">
            <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
              Workspace Files
            </div>
            {fileTree.length > 0 ? (
              renderTree(fileTree)
            ) : (
              <div className="p-3 text-xs text-[var(--muted-foreground)] italic">
                No files in project yet.
              </div>
            )}
          </div>

          {/* Editor Area */}
          <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)]">
            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-[var(--border)] bg-[var(--muted)]/40 px-2 py-1 overflow-x-auto scrollbar-none shrink-0">
              {uniqueTabs.map((tab, idx) => {
                const isCurrent = tab.path === activeTabPath;
                const fileMeta = getLanguageForFile(tab.name);
                return (
                  <div
                    key={`${tab.path}-${idx}`}
                    onClick={() => onSelectTab(tab.path)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition cursor-pointer border ${
                      isCurrent
                        ? "bg-[var(--card)] text-[var(--foreground)] border-[var(--border)] font-semibold shadow-xs"
                        : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
                    }`}
                  >
                    <FileTypeIcon name={tab.name} />
                    <span className="truncate max-w-[120px]">{tab.name}</span>
                    {tab.isDirty && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    )}
                    {uniqueTabs.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => onCloseTab(tab.path, e)}
                        className="p-0.5 hover:bg-[var(--accent)] rounded text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition ml-1"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Code Textarea Editor */}
            <div className="flex-1 p-3 overflow-hidden relative">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                spellCheck={false}
                className="w-full h-full bg-transparent resize-none font-mono text-xs leading-relaxed text-[var(--foreground)] outline-none scrollbar-none"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
