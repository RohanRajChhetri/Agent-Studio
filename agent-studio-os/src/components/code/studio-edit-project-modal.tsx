"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Edit3, Folder, X, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { playClickSound, playWarningSound } from "@/lib/sound-effects";

interface StudioEditProjectModalProps {
  isOpen: boolean;
  projectName: string;
  onClose: () => void;
  onRenameSuccess: (oldName: string, newName: string) => void;
}

export function StudioEditProjectModal({
  isOpen,
  projectName,
  onClose,
  onRenameSuccess,
}: StudioEditProjectModalProps) {
  const [newName, setNewName] = useState(projectName || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setNewName(projectName || "");
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, projectName]);

  if (!isOpen) return null;

  const cleanSlug = newName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cleanSlug) {
      setError("Project name cannot be empty");
      playWarningSound();
      return;
    }

    if (cleanSlug === projectName) {
      onClose();
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await fetch("/api/filesystem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename_project",
          oldName: projectName,
          newName: cleanSlug,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to rename project");
      }

      toast.success(`Project renamed to "${cleanSlug}"`);
      onRenameSuccess(projectName, cleanSlug);
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to rename project");
      playWarningSound();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl relative text-left"
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
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Edit3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)] tracking-tight">
                Rename Project
              </h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                Update the workspace directory name
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current name */}
            <div>
              <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5">
                Current Name
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--accent)]/50 border border-[var(--border)] text-xs text-[var(--foreground)] font-mono">
                <Folder className="w-3.5 h-3.5 text-[var(--muted-foreground)] shrink-0" />
                <span className="truncate">{projectName}</span>
              </div>
            </div>

            {/* New Name */}
            <div>
              <label className="block text-xs font-medium text-[var(--foreground)] mb-1.5">
                New Project Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    if (error) setError(null);
                  }}
                  autoFocus
                  placeholder="e.g. analytics-dashboard"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-xs text-[var(--foreground)] transition font-mono"
                />
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)] mt-1.5">
                Workspace path:{" "}
                <span className="font-mono text-[var(--foreground)]">
                  agent-workspace/{cleanSlug || "..."}
                </span>
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-xs text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl border border-[var(--border)] hover:bg-[var(--accent)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !cleanSlug}
                onClick={() => playClickSound()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white shadow-md shadow-indigo-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Renaming...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
