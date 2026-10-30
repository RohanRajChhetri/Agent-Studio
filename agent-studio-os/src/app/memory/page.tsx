"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  FilePlus,
  ChevronRight,
  ChevronDown,
  Save,
  Plus,
  Loader2,
  RefreshCw,
  Search,
  X,
  Sparkles,
  ExternalLink,
  Copy,
  Edit3,
  Eye,
  Trash2,
  Pencil,
  BookOpen,
  Code,
  AlertTriangle,
  FolderTree,
  Share2,
  CheckSquare,
  Square,
  ListChecks,
} from "lucide-react";
import { toast } from "sonner";
import type { VaultFile } from "@/types";
import type { GalaxyData } from "@/lib/vault";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { ObsidianGraph } from "@/components/memory/obsidian-graph";
import { useTheme } from "@/components/theme-provider";
import {
  VaultBatchDeleteModal,
  type BatchItem,
} from "@/components/memory/vault-batch-delete-modal";
import { MarkdownFormattingToolbar } from "@/components/memory/markdown-formatting-toolbar";
import { NoteMetadataBar } from "@/components/memory/note-metadata-bar";
import { MemoryEmptyDashboard } from "@/components/memory/memory-empty-dashboard";
import {
  playClickSound,
  playWarningSound,
  playTaskCompletedSound,
} from "@/lib/sound-effects";

interface FileTreeNodeProps {
  file: VaultFile;
  depth: number;
  selectedPath: string;
  onSelect: (path: string) => void;
  onCreateSubfolder: (parentPath: string) => void;
  onCreateNoteInFolder: (folderPath: string) => void;
  onRename: (path: string, isFolder: boolean, currentName: string) => void;
  onDelete: (path: string, isFolder: boolean, name: string) => void;
  isSelectMode?: boolean;
  selectedItemPaths?: Set<string>;
  onToggleSelect?: (item: BatchItem) => void;
  forceExpand?: boolean;
}

function FileTreeNode({
  file,
  depth,
  selectedPath,
  onSelect,
  onCreateSubfolder,
  onCreateNoteInFolder,
  onRename,
  onDelete,
  isSelectMode = false,
  selectedItemPaths,
  onToggleSelect,
  forceExpand = false,
}: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isSelected = selectedPath === file.relativePath;
  const isChecked = selectedItemPaths?.has(file.relativePath) ?? false;
  const isEffectivelyExpanded = forceExpand ? true : expanded;

  if (file.isDirectory) {
    const childCount = file.children?.length ?? 0;

    return (
      <div className="group/dir">
        <div
          className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs hover:bg-secondary/50 transition-colors cursor-pointer select-none ${
            isChecked
              ? "bg-primary/10 text-foreground font-medium border border-primary/20"
              : isEffectivelyExpanded
              ? "text-foreground"
              : "text-muted-foreground"
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          onClick={() => {
            if (isSelectMode && onToggleSelect) {
              onToggleSelect({
                path: file.relativePath,
                isFolder: true,
                name: file.name,
              });
            } else {
              setExpanded(!expanded);
            }
          }}
        >
          <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
            {isSelectMode ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.({
                    path: file.relativePath,
                    isFolder: true,
                    name: file.name,
                  });
                }}
                className="p-0.5 hover:scale-110 transition-transform cursor-pointer shrink-0"
              >
                {isChecked ? (
                  <CheckSquare className="w-3.5 h-3.5 text-primary" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-muted-foreground/60" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(!expanded);
                }}
                className="p-0.5 hover:text-foreground text-muted-foreground shrink-0 cursor-pointer"
              >
                {isEffectivelyExpanded ? (
                  <ChevronDown className="w-3 h-3 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="w-3 h-3 shrink-0 text-muted-foreground" />
                )}
              </button>
            )}
            {isEffectivelyExpanded ? (
              <FolderOpen className="w-3.5 h-3.5 text-foreground shrink-0" />
            ) : (
              <Folder className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
            )}
            <span className="truncate font-medium">{file.name}</span>
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.2 rounded font-mono">
              {childCount}
            </span>
          </div>

          {/* Folder Action Buttons on Hover */}
          {!isSelectMode && (
            <div
              className="flex items-center gap-0.5 opacity-0 group-hover/dir:opacity-100 transition-opacity ml-1 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onCreateSubfolder(file.relativePath)}
                title="New subfolder"
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                <FolderPlus className="w-3 h-3" />
              </button>
              <button
                onClick={() => onCreateNoteInFolder(file.relativePath)}
                title="New note in folder"
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-emerald-300 transition-colors cursor-pointer"
              >
                <FilePlus className="w-3 h-3" />
              </button>
              <button
                onClick={() => onRename(file.relativePath, true, file.name)}
                title="Rename folder"
                className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-amber-300 transition-colors cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(file.relativePath, true, file.name)}
                title="Delete folder"
                className="p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {isEffectivelyExpanded && file.children && (
          <div>
            {file.children.map((child, idx) => (
              <FileTreeNode
                key={child.relativePath || `child-${child.name}-${depth}-${idx}`}
                file={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                onCreateSubfolder={onCreateSubfolder}
                onCreateNoteInFolder={onCreateNoteInFolder}
                onRename={onRename}
                onDelete={onDelete}
                isSelectMode={isSelectMode}
                selectedItemPaths={selectedItemPaths}
                onToggleSelect={onToggleSelect}
                forceExpand={forceExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => {
        if (isSelectMode && onToggleSelect) {
          onToggleSelect({
            path: file.relativePath,
            isFolder: false,
            name: file.name,
          });
        } else {
          onSelect(file.relativePath);
        }
      }}
      className={`group/file flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer select-none ${
        isChecked
          ? "bg-primary/15 text-primary font-medium border border-primary/30"
          : isSelected
          ? "bg-primary/15 text-primary font-medium border border-border"
          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
      }`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
        {isSelectMode ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect?.({
                path: file.relativePath,
                isFolder: false,
                name: file.name,
              });
            }}
            className="p-0.5 hover:scale-110 transition-transform cursor-pointer shrink-0"
          >
            {isChecked ? (
              <CheckSquare className="w-3.5 h-3.5 text-primary" />
            ) : (
              <Square className="w-3.5 h-3.5 text-muted-foreground/60" />
            )}
          </button>
        ) : (
          <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover/file:text-muted-foreground" />
        )}
        <span className="truncate">{file.name}</span>
      </div>

      {/* Note Action Buttons on Hover */}
      {!isSelectMode && (
        <div
          className="flex items-center gap-0.5 opacity-0 group-hover/file:opacity-100 transition-opacity ml-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onRename(file.relativePath, false, file.name)}
            title="Rename note"
            className="p-1 rounded hover:bg-secondary/50 text-muted-foreground hover:text-amber-300 transition-colors cursor-pointer"
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            onClick={() => onDelete(file.relativePath, false, file.name)}
            title="Delete note"
            className="p-1 rounded hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default function MemoryPage() {
  const { resolvedTheme } = useTheme();
  const [files, setFiles] = useState<VaultFile[]>([]);
  const [galaxyData, setGalaxyData] = useState<GalaxyData | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [content, setContent] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editorTab, setEditorTab] = useState<"preview" | "edit" | "raw">("preview");
  const [viewMode, setViewMode] = useState<"workspace" | "graph">("graph");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Batch multi-select state
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedBatchItems, setSelectedBatchItems] = useState<BatchItem[]>([]);
  const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");

  // Note modification timestamp & initial load guard
  const [modifiedAt, setModifiedAt] = useState<string | undefined>(undefined);
  const [hasInitialLoaded, setHasInitialLoaded] = useState(false);

  // Textarea ref for markdown formatting toolbar
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // New note modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [newNoteFolder, setNewNoteFolder] = useState("research");
  const [newNoteContent, setNewNoteContent] = useState("");

  // New folder modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderModalParent, setFolderModalParent] = useState("");

  // Rename modal
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{
    path: string;
    isFolder: boolean;
    name: string;
  } | null>(null);
  const [renameNewName, setRenameNewName] = useState("");

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    path: string;
    isFolder: boolean;
    name: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Knowledge Synchronization modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncTitle, setSyncTitle] = useState("");
  const [syncCategory, setSyncCategory] = useState("research");
  const [syncTags, setSyncTags] = useState("");
  const [syncContent, setSyncContent] = useState("");
  const [syncing, setSyncing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [filesRes, galaxyRes] = await Promise.all([
        fetch("/api/vault"),
        fetch("/api/vault?action=galaxy"),
      ]);

      if (filesRes.ok) {
        const filesJson = await filesRes.json();
        setFiles(Array.isArray(filesJson) ? filesJson : []);
      }

      if (galaxyRes.ok) {
        const gData: GalaxyData = await galaxyRes.json();
        if (gData && Array.isArray(gData.nodes)) {
          setGalaxyData(gData);

          // Auto select first file on initial load if none selected
          if (!hasInitialLoaded && !selectedPath && gData.nodes.length > 0) {
            loadFile(gData.nodes[0].path);
            setHasInitialLoaded(true);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching memory vault data:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedPath, hasInitialLoaded]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadFile = async (relPath: string) => {
    setSelectedPath(relPath);
    try {
      const res = await fetch(
        `/api/vault?action=read&path=${encodeURIComponent(relPath)}`
      );
      if (res.ok) {
        const data = await res.json();
        setContent(data.content);
        setEditedContent(data.content);
        setModifiedAt(data.modifiedAt);
      }
    } catch {
      toast.error("Failed to read note");
    }
  };

  const selectedItemPaths = useMemo(() => {
    return new Set(selectedBatchItems.map((i) => i.path));
  }, [selectedBatchItems]);

  const handleToggleBatchItem = useCallback((item: BatchItem) => {
    playClickSound();
    setSelectedBatchItems((prev) => {
      const exists = prev.some((i) => i.path === item.path);
      if (exists) {
        return prev.filter((i) => i.path !== item.path);
      } else {
        return [...prev, item];
      }
    });
  }, []);

  // Filter vault files recursively by name or path
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase().trim();

    const filterNode = (node: VaultFile): VaultFile | null => {
      const nameMatches =
        node.name.toLowerCase().includes(q) ||
        node.relativePath.toLowerCase().includes(q);

      if (node.isDirectory) {
        const filteredChildren = (node.children || [])
          .map(filterNode)
          .filter((child): child is VaultFile => child !== null);

        if (nameMatches || filteredChildren.length > 0) {
          return {
            ...node,
            children: filteredChildren,
          };
        }
        return null;
      }

      return nameMatches ? node : null;
    };

    return files
      .map(filterNode)
      .filter((n): n is VaultFile => n !== null);
  }, [files, searchQuery]);

  // Extract all visible batch items from current tree
  const visibleBatchItems = useMemo(() => {
    const items: BatchItem[] = [];
    const traverse = (list: VaultFile[]) => {
      for (const node of list) {
        items.push({
          path: node.relativePath,
          isFolder: !!node.isDirectory,
          name: node.name,
        });
        if (node.children) traverse(node.children);
      }
    };
    traverse(filteredFiles);
    return items;
  }, [filteredFiles]);

  const isAllSelected =
    visibleBatchItems.length > 0 &&
    visibleBatchItems.every((item) => selectedItemPaths.has(item.path));

  const handleToggleSelectAll = () => {
    playClickSound();
    if (isAllSelected) {
      setSelectedBatchItems([]);
    } else {
      setSelectedBatchItems(visibleBatchItems);
    }
  };

  const handleConfirmBatchDelete = async () => {
    if (selectedBatchItems.length === 0) return;
    setBatchDeleting(true);
    try {
      const res = await fetch("/api/vault", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: selectedBatchItems.map((i) => ({
            path: i.path,
            isFolder: i.isFolder,
          })),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.deletedCount || selectedBatchItems.length;
        playTaskCompletedSound();
        toast.success(`Successfully deleted ${count} ${count === 1 ? "item" : "items"}`);

        // Check if currently open note was inside deleted set
        const wasActiveDeleted = selectedBatchItems.some(
          (item) =>
            selectedPath === item.path ||
            (item.isFolder && selectedPath.startsWith(item.path + "/"))
        );

        if (wasActiveDeleted) {
          setSelectedPath("");
          setContent("");
          setEditedContent("");
          setModifiedAt(undefined);
        }

        setSelectedBatchItems([]);
        setIsSelectMode(false);
        setShowBatchDeleteModal(false);
        await fetchData();
      } else {
        toast.error(data.error || "Failed to batch delete selected items");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error deleting items");
    } finally {
      setBatchDeleting(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPath) return;
    setSaving(true);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: selectedPath,
          content: editedContent,
        }),
      });
      if (res.ok) {
        setContent(editedContent);
        setEditorTab("preview");
        toast.success("Saved to shared memory vault");
        fetchData();
      }
    } catch {
      toast.error("Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim()) {
      toast.error("Note title is required");
      return;
    }

    const cleanTitle = newNoteTitle.trim().replace(/[\\/:*?"<>|]/g, "-");
    const filename = `${newNoteFolder}/${cleanTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")}.md`;

    const initialContent =
      newNoteContent.trim() ||
      `---
title: "${newNoteTitle.trim().replace(/"/g, '\\"')}"
folder: "${newNoteFolder}"
date: "${new Date().toISOString()}"
tags: ["#${newNoteFolder.replace(/\//g, "-")}"]
---

# ${newNoteTitle.trim()}

Start writing notes, research findings, or agent context here. You can cross-reference other notes using [[wikilinks]].
`;

    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filename,
          content: initialContent,
        }),
      });

      if (res.ok) {
        toast.success(`Created ${filename}`);
        setShowNewModal(false);
        setNewNoteTitle("");
        setNewNoteContent("");
        await fetchData();
        loadFile(filename);
      }
    } catch {
      toast.error("Failed to create note");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Folder name is required");
      return;
    }
    const cleanName = newFolderName.trim().replace(/[\\:*?"<>|]/g, "-");
    const targetPath = folderModalParent
      ? `${folderModalParent}/${cleanName}`
      : cleanName;

    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_folder",
          path: targetPath,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Created folder: ${cleanName}`);
        setShowFolderModal(false);
        setNewFolderName("");
        setFolderModalParent("");
        fetchData();
      } else {
        toast.error(data.error || "Failed to create folder");
      }
    } catch {
      toast.error("Error creating folder");
    }
  };

  const handleRenameConfirm = async () => {
    if (!renameTarget || !renameNewName.trim()) return;
    const cleanNewName = renameNewName.trim().replace(/[\\:*?"<>|]/g, "-");

    // Compute the new relative path
    const parts = renameTarget.path.split("/");
    parts[parts.length - 1] = cleanNewName;
    const newPath = parts.join("/");

    if (newPath === renameTarget.path) {
      setShowRenameModal(false);
      return;
    }

    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename",
          oldPath: renameTarget.path,
          newPath: newPath,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Renamed to ${cleanNewName}`);
        setShowRenameModal(false);
        if (
          selectedPath === renameTarget.path ||
          selectedPath.startsWith(renameTarget.path + "/")
        ) {
          const updatedSelected = selectedPath.replace(renameTarget.path, newPath);
          setSelectedPath(updatedSelected);
        }
        fetchData();
      } else {
        toast.error(data.error || "Failed to rename");
      }
    } catch {
      toast.error("Error renaming path");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(
        `/api/vault?path=${encodeURIComponent(deleteTarget.path)}&isFolder=${deleteTarget.isFolder}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(
          `${deleteTarget.isFolder ? "Folder" : "Note"} deleted successfully`
        );
        setShowDeleteModal(false);
        if (
          selectedPath === deleteTarget.path ||
          selectedPath.startsWith(deleteTarget.path + "/")
        ) {
          setSelectedPath("");
          setContent("");
          setEditedContent("");
        }
        fetchData();
      } else {
        toast.error(data.error || "Failed to delete");
      }
    } catch {
      toast.error("Error deleting target");
    } finally {
      setDeleting(false);
    }
  };

  const handleSyncKnowledge = async () => {
    if (!syncTitle.trim() || !syncContent.trim()) {
      toast.error("Title and content are required for knowledge ingestion");
      return;
    }

    setSyncing(true);
    try {
      const res = await fetch("/api/vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: syncTitle.trim(),
          category: syncCategory,
          content: syncContent.trim(),
          tags: syncTags
            ? syncTags
                .split(",")
                .map((t) => t.trim().replace(/^#/, ""))
                .filter(Boolean)
            : undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Synchronized with vault: ${data.path}`);
        setShowSyncModal(false);
        setSyncTitle("");
        setSyncContent("");
        setSyncTags("");
        await fetchData();
        loadFile(data.path);
      } else {
        toast.error(data.error || "Failed to synchronize knowledge");
      }
    } catch {
      toast.error("Network error synchronizing knowledge");
    } finally {
      setSyncing(false);
    }
  };

  const handleOpenObsidian = async () => {
    toast.info("Launching desktop Obsidian...");
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_obsidian",
          path: selectedPath || undefined,
        }),
      });
      const data = await res.json();
      if (data.success || data.opened) {
        toast.success(
          data.message || "Obsidian opened! All agent notes are synchronized in real-time."
        );
      } else {
        const fallbackUri = data.uri || galaxyData?.obsidianUri;
        if (fallbackUri) {
          window.location.href = fallbackUri;
        }
      }
    } catch {
      if (galaxyData?.obsidianUri) {
        window.location.href = galaxyData.obsidianUri;
      }
    }
  };

  return (
    <div className="space-y-5 w-full">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Memory
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Shared knowledge base and interactive graph synchronized with Obsidian
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher: Workspace vs Obsidian Graph */}
          <div className="flex items-center p-0.5 rounded-lg border border-border bg-muted text-xs">
            <button
              onClick={() => setViewMode("workspace")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "workspace"
                  ? "bg-card text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>
            <button
              onClick={() => setViewMode("graph")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                viewMode === "graph"
                  ? "bg-card text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Obsidian Graph</span>
            </button>
          </div>

          {/* Open in Obsidian */}
          <button
            onClick={handleOpenObsidian}
            title="Open local Obsidian desktop app"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e6f3fe] text-[#0075de] hover:bg-[#d8ecfd] border border-[#0075de]/20 text-xs font-medium transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Obsidian</span>
          </button>

          {/* Synchronize Vault */}
          <button
            onClick={() => setShowSyncModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card text-foreground hover:bg-muted border border-border text-xs font-medium transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span>Sync Vault</span>
          </button>

          {/* New Folder */}
          <button
            onClick={() => {
              setFolderModalParent("");
              setNewFolderName("");
              setShowFolderModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card text-foreground hover:bg-muted border border-border text-xs font-medium transition-colors cursor-pointer"
          >
            <FolderPlus className="w-3.5 h-3.5 text-foreground" />
            <span>New Folder</span>
          </button>

          {/* New Note */}
          <button
            onClick={() => {
              setNewNoteFolder("research");
              setShowNewModal(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition-opacity cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : viewMode === "graph" ? (
        <div className="h-[calc(100vh-14rem)] min-h-[580px] w-full">
          <ObsidianGraph
            data={galaxyData}
            selectedPath={selectedPath}
            onSelectNote={(notePath) => {
              loadFile(notePath);
              setViewMode("workspace");
            }}
            isDark={resolvedTheme === "dark"}
          />
        </div>
      ) : (
        /* File Explorer & Human-Readable Markdown Preview / Editor Mode */
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-14rem)] min-h-[580px]">
          {/* File Tree Left Column */}
          <div className="md:col-span-4 lg:col-span-3 rounded-xl border border-border bg-card p-3 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-border">
              <div className="flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-foreground" />
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vault Explorer
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Select Mode Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setIsSelectMode(!isSelectMode);
                    if (isSelectMode) setSelectedBatchItems([]);
                  }}
                  title={isSelectMode ? "Exit select mode" : "Select multiple items to batch delete"}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    isSelectMode
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ListChecks className="w-3.5 h-3.5" />
                  <span>{isSelectMode ? "Done" : "Select"}</span>
                </button>

                <button
                  onClick={() => {
                    setFolderModalParent("");
                    setNewFolderName("");
                    setShowFolderModal(true);
                  }}
                  title="Create folder in root"
                  className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setNewNoteFolder("research");
                    setShowNewModal(true);
                  }}
                  title="Create new note"
                  className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <FilePlus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={fetchData}
                  title="Refresh files"
                  className="p-1 rounded-md hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Instant Search / Filter Bar */}
            <div className="relative mb-2 shrink-0">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Filter notes & folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Multi-Select Batch Action Bar */}
            <AnimatePresence>
              {isSelectMode && (
                <motion.div
                  key="batch-select-action-bar"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mb-2 p-2.5 rounded-xl bg-primary/10 border border-primary/20 space-y-2 shrink-0 overflow-hidden"
                >
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors cursor-pointer"
                    >
                      {isAllSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-primary" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
                    </button>
                    <span className="text-[11px] font-mono font-medium text-primary bg-primary/15 px-2 py-0.5 rounded-full border border-primary/20">
                      {selectedBatchItems.length} selected
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-primary/20">
                    <button
                      type="button"
                      onClick={() => {
                        playWarningSound();
                        setShowBatchDeleteModal(true);
                      }}
                      disabled={selectedBatchItems.length === 0}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete ({selectedBatchItems.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setIsSelectMode(false);
                        setSelectedBatchItems([]);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scrollable File List */}
            <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
              {filteredFiles.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-xs">
                  {searchQuery ? `No matching notes or folders found` : `No notes found in vault`}
                </div>
              ) : (
                filteredFiles.map((file, idx) => (
                  <FileTreeNode
                    key={file.relativePath || `file-${file.name}-${idx}`}
                    file={file}
                    depth={0}
                    selectedPath={selectedPath}
                    onSelect={loadFile}
                    onCreateSubfolder={(parent) => {
                      setFolderModalParent(parent);
                      setNewFolderName("");
                      setShowFolderModal(true);
                    }}
                    onCreateNoteInFolder={(folder) => {
                      setNewNoteFolder(folder);
                      setShowNewModal(true);
                    }}
                    onRename={(path, isFolder, currentName) => {
                      setRenameTarget({ path, isFolder, name: currentName });
                      setRenameNewName(currentName);
                      setShowRenameModal(true);
                    }}
                    onDelete={(path, isFolder, name) => {
                      setDeleteTarget({ path, isFolder, name });
                      setShowDeleteModal(true);
                    }}
                    isSelectMode={isSelectMode}
                    selectedItemPaths={selectedItemPaths}
                    onToggleSelect={handleToggleBatchItem}
                    forceExpand={Boolean(searchQuery.trim())}
                  />
                ))
              )}
            </div>
          </div>

          {/* Editor & Rendered Markdown Preview Right Column */}
          <div className="md:col-span-8 lg:col-span-9 rounded-xl border border-border bg-card flex flex-col overflow-hidden">
            {selectedPath ? (
              <>
                {/* Note Metadata Bar */}
                <NoteMetadataBar
                  selectedPath={selectedPath}
                  content={editorTab === "edit" ? editedContent : content}
                  modifiedAt={modifiedAt}
                  editorTab={editorTab}
                  onTabChange={(tab) => {
                    setEditorTab(tab);
                    if (tab === "edit") {
                      setEditedContent(content);
                    }
                  }}
                  onSave={handleSave}
                  saving={saving}
                  onRename={() => {
                    const parts = selectedPath.split("/");
                    const name = parts[parts.length - 1];
                    setRenameTarget({ path: selectedPath, isFolder: false, name });
                    setRenameNewName(name);
                    setShowRenameModal(true);
                  }}
                  onDelete={() => {
                    const parts = selectedPath.split("/");
                    const name = parts[parts.length - 1];
                    setDeleteTarget({ path: selectedPath, isFolder: false, name });
                    setShowDeleteModal(true);
                  }}
                />

                {/* Markdown Formatting Toolbar in Edit mode */}
                {editorTab === "edit" && (
                  <MarkdownFormattingToolbar
                    textareaRef={textareaRef}
                    content={editedContent}
                    onChange={setEditedContent}
                  />
                )}

                {/* Content Area: Preview vs Edit vs Raw */}
                <div className="flex-1 p-6 overflow-y-auto">
                  {editorTab === "preview" ? (
                    <div className="max-w-4xl mx-auto py-2">
                      <MarkdownRenderer content={content} />
                    </div>
                  ) : editorTab === "edit" ? (
                    <textarea
                      ref={textareaRef}
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      className="w-full h-full bg-transparent font-mono text-xs text-foreground outline-none resize-none leading-relaxed p-2"
                      placeholder="Type markdown content..."
                      autoFocus
                    />
                  ) : (
                    <pre className="font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed p-3 bg-secondary/50 rounded-xl border border-border">
                      {content}
                    </pre>
                  )}
                </div>
              </>
            ) : (
              <MemoryEmptyDashboard
                files={files}
                galaxyData={galaxyData}
                onSelectNote={loadFile}
                onNewNote={() => {
                  setNewNoteFolder("research");
                  setShowNewModal(true);
                }}
                onNewFolder={() => {
                  setFolderModalParent("");
                  setNewFolderName("");
                  setShowFolderModal(true);
                }}
                onSync={() => setShowSyncModal(true)}
                onOpenObsidian={handleOpenObsidian}
              />
            )}
          </div>
        </div>
      )}

      {/* New Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <motion.div
            key="new-folder-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-border flex items-center justify-center">
                    <FolderPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Create New Folder
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {folderModalParent
                        ? `Inside: /${folderModalParent}`
                        : "Inside: Vault Root"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Folder Name *
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="e.g. system-prompts, client-briefs"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowFolderModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create Folder</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rename Modal */}
      <AnimatePresence>
        {showRenameModal && renameTarget && (
          <motion.div
            key="rename-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-muted-foreground dark:text-muted-foreground">
                    <Pencil className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Rename {renameTarget.isFolder ? "Folder" : "Note"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground font-mono truncate max-w-xs">
                      {renameTarget.path}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    New Name *
                  </label>
                  <input
                    type="text"
                    value={renameNewName}
                    onChange={(e) => setRenameNewName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRenameConfirm();
                    }}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-amber-600"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowRenameModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRenameConfirm}
                  disabled={!renameNewName.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-amber-600/20"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Rename</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && deleteTarget && (
          <motion.div
            key="delete-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-lg border border-red-500/20 bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Delete {deleteTarget.isFolder ? "Folder" : "Note"}
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      This action cannot be undone
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-muted-foreground space-y-2">
                <p>
                  Are you sure you want to permanently delete:
                </p>
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 font-mono text-red-300 break-all">
                  {deleteTarget.path}
                </div>
                {deleteTarget.isFolder && (
                  <p className="flex items-center gap-1.5 text-amber-400 text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>All files and subdirectories inside this folder will also be deleted.</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deleting}
                  className="px-3.5 py-1.5 rounded-xl text-xs hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-foreground text-xs font-medium transition-all shadow-md shadow-red-600/20"
                >
                  {deleting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                  <span>Delete Permanently</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Note Modal */}
      <AnimatePresence>
        {showNewModal && (
          <motion.div
            key="new-note-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary border border-border flex items-center justify-center">
                    <FilePlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      New Memory Note
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Destination: /{newNoteFolder}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="e.g. Distributed Model Consensus"
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Folder / Category
                  </label>
                  <input
                    type="text"
                    value={newNoteFolder}
                    onChange={(e) => setNewNoteFolder(e.target.value)}
                    placeholder="e.g. research, concepts, tasks"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Initial Content (Optional)
                  </label>
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    rows={4}
                    placeholder="Start drafting notes or leave blank for default template with wikilinks..."
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-amber-600 resize-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowNewModal(false)}
                  className="px-3.5 py-1.5 rounded-xl text-xs hover:bg-secondary/50 text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateNote}
                  disabled={!newNoteTitle.trim()}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
                >
                  Create Note
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Knowledge Synchronization Modal */}
      <AnimatePresence>
        {showSyncModal && (
          <motion.div
            key="sync-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-lg border border-emerald-500/20 bg-secondary/95 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Synchronize Vault into Vault
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Auto-indexes content for RAG, cross-linking, and memory galaxy
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSyncModal(false)}
                  className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Document Title *
                  </label>
                  <input
                    type="text"
                    value={syncTitle}
                    onChange={(e) => setSyncTitle(e.target.value)}
                    placeholder="e.g. Q3 Autonomous Swarm Architecture"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground mb-1 block font-medium">
                      Vault Category
                    </label>
                    <select
                      value={syncCategory}
                      onChange={(e) => setSyncCategory(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs outline-none focus:border-emerald-500"
                    >
                      <option value="research">Research & Findings</option>
                      <option value="marketing">Marketing & Strategy</option>
                      <option value="concepts">Concepts & Architecture</option>
                      <option value="tasks">Tasks & Deliverables</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground mb-1 block font-medium">
                      Tags (comma separated)
                    </label>
                    <input
                      type="text"
                      value={syncTags}
                      onChange={(e) => setSyncTags(e.target.value)}
                      placeholder="rag, architecture, ai"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-muted-foreground mb-1 block font-medium">
                    Markdown or Raw Text Content *
                  </label>
                  <textarea
                    value={syncContent}
                    onChange={(e) => setSyncContent(e.target.value)}
                    rows={8}
                    placeholder="Paste research papers, meeting notes, code snippets, or documentation..."
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-xs outline-none focus:border-emerald-500 resize-none font-mono text-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowSyncModal(false)}
                  disabled={syncing}
                  className="px-3.5 py-1.5 rounded-xl text-xs hover:bg-secondary/50 text-muted-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSyncKnowledge}
                  disabled={syncing || !syncTitle.trim() || !syncContent.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium transition-all shadow-lg shadow-emerald-600/20"
                >
                  {syncing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synchronizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Synchronize Vault</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vault Batch Delete Confirmation Modal */}
      <VaultBatchDeleteModal
        isOpen={showBatchDeleteModal}
        onClose={() => setShowBatchDeleteModal(false)}
        onConfirm={handleConfirmBatchDelete}
        isDeleting={batchDeleting}
        selectedItems={selectedBatchItems}
      />
    </div>
  );
}
