"use client";

import { useState, useRef, useEffect } from "react";
import {
  Code,
  ExternalLink,
  FolderOpen,
  Download,
  Laptop,
  ChevronDown,
  Sparkles,
  Loader2,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { playClickSound, playTaskCompletedSound } from "@/lib/sound-effects";

interface OpenIdeMenuProps {
  selectedProject: string;
  onOpenBuiltInIde: () => void;
  onExportZip?: () => void;
}

export function OpenIdeMenu({
  selectedProject,
  onOpenBuiltInIde,
  onExportZip,
}: OpenIdeMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLaunching, setIsLaunching] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLaunchExternal = async (editor: "vscode" | "cursor" | "explorer") => {
    setIsLaunching(editor);
    playClickSound();

    try {
      const res = await fetch("/api/code/open-ide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectName: selectedProject,
          editor,
        }),
      });

      const data = await res.json();

      if (data.success) {
        playTaskCompletedSound();
        const editorName =
          editor === "vscode" ? "VS Code" : editor === "cursor" ? "Cursor" : "File Explorer";

        if (data.commandSuccess) {
          toast.success(`Launched ${editorName} for "${selectedProject}"`);
        } else if (data.protocolUrl) {
          // Fallback to browser protocol handler
          window.location.href = data.protocolUrl;
          toast.info(`Opening ${editorName} via protocol link...`);
        } else {
          toast.success(`Opened project location in ${editorName}`);
        }
      } else {
        toast.error(data.error || `Could not open ${editor}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger IDE launch");
    } finally {
      setIsLaunching(null);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Primary Open IDE Pill Button matching screenshot */}
      <button
        type="button"
        onClick={() => {
          playClickSound();
          setIsOpen((prev) => !prev);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] text-xs font-medium text-[var(--foreground)] transition-all cursor-pointer shadow-xs hover:border-[var(--primary)]/40 group"
        title="Open Project in an IDE"
      >
        <Code className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors" />
        <span className="font-sans font-medium text-[12px] tracking-tight">Open IDE</span>
        <ChevronDown
          className={`w-3 h-3 text-[var(--muted-foreground)] transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-xl backdrop-blur-xl z-50 space-y-0.5 text-left"
          >
            <div className="px-2.5 py-1.5 border-b border-[var(--border)] mb-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] block">
                Target Project
              </span>
              <span className="text-xs font-semibold text-[var(--foreground)] truncate block">
                {selectedProject}
              </span>
            </div>

            {/* Launch in VS Code */}
            <button
              type="button"
              onClick={() => handleLaunchExternal("vscode")}
              disabled={isLaunching !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20">
                {isLaunching === "vscode" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Code className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium leading-none mb-0.5">Open in VS Code</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">Local editor on host</div>
              </div>
            </button>

            {/* Launch in Cursor */}
            <button
              type="button"
              onClick={() => handleLaunchExternal("cursor")}
              disabled={isLaunching !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 group-hover:bg-purple-500/20">
                {isLaunching === "cursor" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium leading-none mb-0.5">Open in Cursor</div>
                <div className="text-[10px] text-[var(--muted-foreground)]">AI code editor</div>
              </div>
            </button>

            {/* In-Browser Built-in IDE Drawer */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenBuiltInIde();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer text-left group"
            >
              <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20">
                <Laptop className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium leading-none mb-0.5">
                  Built-in Code Studio
                </div>
                <div className="text-[10px] text-[var(--muted-foreground)]">
                  In-browser files & editor
                </div>
              </div>
            </button>

            <div className="h-px bg-[var(--border)] my-1" />

            {/* Reveal in Explorer */}
            <button
              type="button"
              onClick={() => handleLaunchExternal("explorer")}
              disabled={isLaunching !== null}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer text-left"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Reveal in File Explorer</span>
            </button>

            {/* Download Project ZIP */}
            {onExportZip && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onExportZip();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer text-left"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Project ZIP</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
