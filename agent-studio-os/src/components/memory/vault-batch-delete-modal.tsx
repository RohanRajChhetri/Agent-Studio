"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Trash2, Folder, FileText, X, Loader2 } from "lucide-react";
import { playClickSound, playWarningSound } from "@/lib/sound-effects";

export interface BatchItem {
  path: string;
  isFolder: boolean;
  name: string;
}

interface VaultBatchDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
  selectedItems: BatchItem[];
}

export function VaultBatchDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
  selectedItems,
}: VaultBatchDeleteModalProps) {
  if (!isOpen) return null;

  const folderCount = selectedItems.filter((i) => i.isFolder).length;
  const noteCount = selectedItems.filter((i) => !i.isFolder).length;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-lg rounded-2xl border border-destructive/30 bg-card p-6 shadow-2xl space-y-4"
        >
          {/* Header */}
          <div className="flex items-start justify-between border-b border-border pb-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 border border-destructive/30 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Delete {selectedItems.length} Selected {selectedItems.length === 1 ? "Item" : "Items"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanent removal from your local knowledge vault
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              disabled={isDeleting}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Breakdown Alert */}
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-3.5 space-y-1.5 text-xs">
            <div className="font-semibold text-destructive flex items-center gap-1.5">
              <span>Warning: This action cannot be undone.</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              You are about to permanently delete{" "}
              <span className="font-semibold text-foreground">
                {noteCount > 0 && `${noteCount} ${noteCount === 1 ? "note" : "notes"}`}
                {noteCount > 0 && folderCount > 0 && " and "}
                {folderCount > 0 && `${folderCount} ${folderCount === 1 ? "folder" : "folders"}`}
              </span>
              . Any nested documents and subfolders inside selected directories will also be purged.
            </p>
          </div>

          {/* Selected Items Scroll List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground px-0.5">
              <span>Items to remove ({selectedItems.length}):</span>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-secondary/30 p-2 space-y-1 scrollbar-thin">
              {selectedItems.map((item) => (
                <div
                  key={item.path}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-card/60 border border-border/50 text-xs"
                >
                  {item.isFolder ? (
                    <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  ) : (
                    <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                  )}
                  <span className="font-mono text-[11.5px] text-foreground truncate flex-1">
                    {item.path}
                  </span>
                  <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                    {item.isFolder ? "Folder" : "Note"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                onClose();
              }}
              disabled={isDeleting}
              className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                playWarningSound();
                onConfirm();
              }}
              disabled={isDeleting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive hover:bg-destructive/90 text-destructive-foreground text-xs font-semibold shadow-md shadow-destructive/20 transition-all cursor-pointer disabled:opacity-60"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deleting items...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete {selectedItems.length} {selectedItems.length === 1 ? "Item" : "Items"}</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
