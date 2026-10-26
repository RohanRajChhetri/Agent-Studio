"use client";

import { useState } from "react";
import {
  FileText,
  Copy,
  Check,
  Download,
  BookOpen,
  Edit3,
  Code,
  Save,
  Pencil,
  Trash2,
  Loader2,
  ChevronRight,
  Clock,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playTaskCompletedSound } from "@/lib/sound-effects";

interface NoteMetadataBarProps {
  selectedPath: string;
  content: string;
  modifiedAt?: string;
  editorTab: "preview" | "edit" | "raw";
  onTabChange: (tab: "preview" | "edit" | "raw") => void;
  onSave?: () => void;
  saving?: boolean;
  onRename?: () => void;
  onDelete?: () => void;
}

export function NoteMetadataBar({
  selectedPath,
  content,
  modifiedAt,
  editorTab,
  onTabChange,
  onSave,
  saving = false,
  onRename,
  onDelete,
}: NoteMetadataBarProps) {
  const [copied, setCopied] = useState(false);

  // Path segments for breadcrumbs
  const pathParts = selectedPath ? selectedPath.split("/").filter(Boolean) : [];
  const fileName = pathParts.length > 0 ? pathParts[pathParts.length - 1] : "";
  const folderParts = pathParts.slice(0, pathParts.length - 1);

  // Calculate text metrics
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;
  const readingTimeMin = Math.max(1, Math.ceil(words / 200));

  const handleCopy = async () => {
    try {
      playClickSound();
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Markdown copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy note content");
    }
  };

  const handleDownload = () => {
    try {
      playTaskCompletedSound();
      const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName || "note.md";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${fileName}`);
    } catch {
      toast.error("Failed to export note");
    }
  };

  const formattedDate = modifiedAt
    ? new Date(modifiedAt).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="px-4 py-2 border-b border-border bg-card/80 backdrop-blur-xs flex items-center justify-between gap-3 shrink-0 h-14 select-none">
      {/* Left: Breadcrumbs & Meta */}
      <div className="flex flex-col min-w-0 flex-1 overflow-hidden pr-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
          <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-mono text-muted-foreground">vault</span>
          {folderParts.map((part, index) => (
            <span key={index} className="flex items-center gap-1 font-mono text-[11px] shrink-0">
              <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
              <span className="hover:text-foreground transition-colors">{part}</span>
            </span>
          ))}
          <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
          <span className="font-mono text-xs font-semibold text-foreground truncate">
            {fileName}
          </span>
        </div>

        {/* Note Statistics row */}
        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5 font-mono truncate">
          <span>{words} words</span>
          <span>•</span>
          <span>{chars} chars</span>
          <span>•</span>
          <span>~{readingTimeMin} min read</span>
          {formattedDate && (
            <>
              <span>•</span>
              <span className="flex items-center gap-1 truncate">
                <Clock className="w-2.5 h-2.5 opacity-60 shrink-0" />
                Updated {formattedDate}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right: Actions & Tab Switchers */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Quick Utility: Copy Markdown */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy Markdown content to clipboard"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
          <span className="hidden xl:inline">{copied ? "Copied" : "Copy"}</span>
        </button>

        {/* Quick Utility: Export / Download .md */}
        <button
          type="button"
          onClick={handleDownload}
          title="Download as .md file"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden xl:inline">Export</span>
        </button>

        {/* View mode tabs: Preview, Edit, Raw */}
        <div className="flex items-center gap-0.5 p-1 rounded-xl bg-secondary/80 border border-border">
          <button
            type="button"
            onClick={() => {
              playClickSound();
              onTabChange("preview");
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              editorTab === "preview"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onTabChange("edit");
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              editorTab === "edit"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              onTabChange("raw");
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              editorTab === "raw"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Raw</span>
          </button>
        </div>

        {/* Save button when in Edit mode */}
        {editorTab === "edit" && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-semibold disabled:opacity-50 transition-all shadow-xs cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save</span>
          </button>
        )}

        {/* Rename & Delete single item */}
        {onRename && (
          <button
            type="button"
            onClick={onRename}
            title="Rename note"
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-amber-400 hover:bg-secondary transition-colors cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete note"
            className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
