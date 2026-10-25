"use client";

import { useState } from "react";
import {
  Folder,
  FileCode,
  FileText,
  FilePlus,
  FolderPlus,
  Search,
  ChevronRight,
  ChevronDown,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Code,
  Globe,
  Database,
  Image,
} from "lucide-react";
import type { FileTreeNode } from "@/lib/project-filesystem";

interface CodeSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  fileTree: FileTreeNode[];
  activeFilePath: string;
  onSelectFile: (node: FileTreeNode) => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onDeleteFile: (path: string) => void;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "html":
    case "htm":
      return <Globe className="w-3.5 h-3.5 text-orange-500 shrink-0" />;
    case "css":
    case "scss":
      return <Code className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    case "js":
    case "jsx":
      return <FileCode className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    case "ts":
    case "tsx":
      return <FileCode className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
    case "py":
      return <FileCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    case "json":
    case "yaml":
    case "yml":
      return <Database className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
    case "png":
    case "jpg":
    case "svg":
      return <Image className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />;
  }
}

export function CodeSidebar({
  isOpen,
  onToggle,
  fileTree,
  activeFilePath,
  onSelectFile,
  onNewFile,
  onNewFolder,
  onDeleteFile,
}: CodeSidebarProps) {
  const [search, setSearch] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    root: true,
  });

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="fixed top-16 left-2 z-20 p-2 rounded-xl bg-card border border-border shadow-md text-muted-foreground hover:text-foreground transition cursor-pointer"
        title="Open File Explorer (Ctrl+B)"
      >
        <PanelLeftOpen className="w-4 h-4" />
      </button>
    );
  }

  const renderTree = (nodes: FileTreeNode[], depth = 0) => {
    return nodes
      .filter((n) => !search || n.name.toLowerCase().includes(search.toLowerCase()))
      .map((node) => {
        if (node.isDirectory) {
          const isExpanded = expandedFolders[node.path] ?? true;
          return (
            <div key={node.path} className="space-y-0.5">
              <div
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                onClick={() => toggleFolder(node.path)}
                className="flex items-center justify-between py-1.5 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition cursor-pointer group"
              >
                <div className="flex items-center gap-1.5 truncate">
                  {isExpanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <Folder className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
                  <span className="truncate">{node.name}</span>
                </div>
              </div>

              {isExpanded && node.children && (
                <div>{renderTree(node.children, depth + 1)}</div>
              )}
            </div>
          );
        }

        const isActive = activeFilePath === node.path;
        return (
          <div
            key={node.path}
            style={{ paddingLeft: `${depth * 12 + 16}px` }}
            onClick={() => onSelectFile(node)}
            className={`flex items-center justify-between py-1 px-2 rounded-lg text-xs font-mono transition cursor-pointer group ${
              isActive
                ? "bg-primary/10 text-primary font-semibold border-l-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              {getFileIcon(node.name)}
              <span className="truncate">{node.name}</span>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(node.path);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-500 rounded transition"
              title="Delete file"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        );
      });
  };

  return (
    <aside className="w-64 border-r border-border bg-card/60 backdrop-blur-xs flex flex-col shrink-0 select-none">
      {/* Sidebar Header */}
      <div className="h-10 px-3 border-b border-border/80 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNewFile}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="New File"
          >
            <FilePlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onNewFolder}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition"
            title="Collapse Sidebar (Ctrl+B)"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="p-2 border-b border-border/60">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-8 pr-2.5 py-1 rounded-lg bg-background border border-border text-xs outline-none focus:border-primary font-mono placeholder:font-sans"
          />
        </div>
      </div>

      {/* Tree View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {fileTree.length > 0 ? (
          renderTree(fileTree)
        ) : (
          <div className="p-4 text-center text-xs text-muted-foreground">No files in project</div>
        )}
      </div>
    </aside>
  );
}
