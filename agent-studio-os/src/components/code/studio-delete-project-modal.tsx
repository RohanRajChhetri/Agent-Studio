"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, AlertTriangle, X, Loader2, Folder } from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playWarningSound } from "@/lib/sound-effects";

interface StudioDeleteProjectModalProps {
  isOpen: boolean;
  projectName: string;
  fileCount?: number;
  onClose: () => void;
  onDeleteSuccess: (deletedName: string) => void;
}

export function StudioDeleteProjectModal({
  isOpen,
  projectName,
  fileCount,
  onClose,
  onDeleteSuccess,
}: StudioDeleteProjectModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_project",
          name: projectName,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to delete project");
      }

      toast.success(`Project "${projectName}" deleted`);
      onDeleteSuccess(projectName);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete project");
      playWarningSound();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="w-full max-w-md rounded-2xl border border-rose-500/20 bg-[var(--card)] p-6 shadow-2xl relative text-left"
        >
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)] tracking-tight">
                Delete Project
              </h2>
              <p className="text-xs text-rose-400 font-medium">
                This action is permanent and cannot be undone
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              Are you sure you want to permanently delete the project{" "}
              <span className="font-semibold text-[var(--foreground)] font-mono">
                "{projectName}"
              </span>
              ? All files and code inside the workspace will be permanently erased.
            </p>

            {/* Folder Details Pill */}
            <div className="p-3 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)] space-y-1">
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--foreground)]">
                <Folder className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span className="truncate font-semibold">{projectName}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>Path: agent-workspace/{projectName}</span>
                {typeof fileCount === "number" && (
                  <span>{fileCount} {fileCount === 1 ? "file" : "files"}</span>
                )}
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-semibold text-white shadow-md shadow-rose-600/30 transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
