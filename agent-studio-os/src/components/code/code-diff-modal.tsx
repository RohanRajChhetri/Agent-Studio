"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitCommit,
  Check,
  X,
  FileCode,
  Sparkles,
  ArrowRight,
  Columns,
  AlignLeft,
  ChevronRight,
  Layers,
} from "lucide-react";

export interface FileDiffItem {
  path: string;
  originalContent: string;
  modifiedContent: string;
}

interface CodeDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  diffs: FileDiffItem[];
  onApplyAll: (appliedDiffs: FileDiffItem[]) => void;
  onApplySingle?: (diff: FileDiffItem) => void;
  title?: string;
  agentReasoning?: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

function computeSimpleDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const result: DiffLine[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldLine === newLine) {
      result.push({
        type: "unchanged",
        content: oldLine,
        oldLineNumber: oldIdx + 1,
        newLineNumber: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    } else {
      // Line modified or added/removed
      if (oldIdx < oldLines.length && !newLines.includes(oldLine)) {
        result.push({
          type: "removed",
          content: oldLine,
          oldLineNumber: oldIdx + 1,
        });
        oldIdx++;
      } else if (newIdx < newLines.length && !oldLines.includes(newLine)) {
        result.push({
          type: "added",
          content: newLine,
          newLineNumber: newIdx + 1,
        });
        newIdx++;
      } else {
        // Fallback replacement
        if (oldIdx < oldLines.length) {
          result.push({
            type: "removed",
            content: oldLines[oldIdx],
            oldLineNumber: oldIdx + 1,
          });
          oldIdx++;
        }
        if (newIdx < newLines.length) {
          result.push({
            type: "added",
            content: newLines[newIdx],
            newLineNumber: newIdx + 1,
          });
          newIdx++;
        }
      }
    }
  }

  return result;
}

export function CodeDiffModal({
  isOpen,
  onClose,
  diffs,
  onApplyAll,
  onApplySingle,
  title = "Review Proposed Agent Changes",
  agentReasoning,
}: CodeDiffModalProps) {
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);
  const [viewMode, setViewMode] = useState<"side-by-side" | "unified">("side-by-side");

  const currentDiff = diffs[selectedFileIdx] || diffs[0];

  const diffLines = useMemo(() => {
    if (!currentDiff) return [];
    return computeSimpleDiff(currentDiff.originalContent || "", currentDiff.modifiedContent || "");
  }, [currentDiff]);

  const stats = useMemo(() => {
    const added = diffLines.filter((l) => l.type === "added").length;
    const removed = diffLines.filter((l) => l.type === "removed").length;
    return { added, removed };
  }, [diffLines]);

  if (!isOpen || diffs.length === 0) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-5xl h-[85vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                <GitCommit className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <span>{title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                    {diffs.length} {diffs.length === 1 ? "file" : "files"}
                  </span>
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-2 mt-0.5">
                  <span className="text-emerald-500 font-semibold">+{stats.added} lines</span>
                  <span>•</span>
                  <span className="text-red-500 font-semibold">-{stats.removed} lines</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center p-0.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)] text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("side-by-side")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                    viewMode === "side-by-side"
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Split</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("unified")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition ${
                    viewMode === "unified"
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Unified</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Reasoning / Explanation Banner */}
          {agentReasoning && (
            <div className="px-6 py-2.5 bg-primary/5 border-b border-primary/20 flex items-start gap-2.5 text-xs text-foreground/90 shrink-0">
              <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-semibold text-primary">Autonomous Fix Diagnosis: </span>
                {agentReasoning}
              </div>
            </div>
          )}

          {/* Body: File Selector & Diff Viewer */}
          <div className="flex-1 flex overflow-hidden">
            {/* Multi-file sidebar */}
            {diffs.length > 1 && (
              <div className="w-56 border-r border-[var(--border)] bg-[var(--secondary)]/40 p-3 overflow-y-auto shrink-0 flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 pb-1">
                  Changed Files
                </span>
                {diffs.map((d, idx) => (
                  <button
                    key={d.path}
                    type="button"
                    onClick={() => setSelectedFileIdx(idx)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono text-left transition ${
                      idx === selectedFileIdx
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileCode className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{d.path}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Main Diff Content Container */}
            <div className="flex-1 overflow-auto p-4 bg-black/90 font-mono text-xs">
              {viewMode === "side-by-side" ? (
                <div className="grid grid-cols-2 gap-4 h-full">
                  {/* Left: Original */}
                  <div className="border border-red-500/20 rounded-xl overflow-hidden flex flex-col bg-red-950/10">
                    <div className="px-3 py-2 bg-red-950/30 border-b border-red-500/20 text-red-400 font-semibold text-[11px] flex items-center justify-between">
                      <span>Original Version</span>
                      <span>{currentDiff.originalContent.split("\n").length} lines</span>
                    </div>
                    <div className="p-3 overflow-auto flex-1 font-mono text-[11.5px] leading-relaxed text-zinc-300">
                      {currentDiff.originalContent ? (
                        <pre className="whitespace-pre">{currentDiff.originalContent}</pre>
                      ) : (
                        <div className="text-zinc-500 italic p-4 text-center">(New file created)</div>
                      )}
                    </div>
                  </div>

                  {/* Right: Modified */}
                  <div className="border border-emerald-500/20 rounded-xl overflow-hidden flex flex-col bg-emerald-950/10">
                    <div className="px-3 py-2 bg-emerald-950/30 border-b border-emerald-500/20 text-emerald-400 font-semibold text-[11px] flex items-center justify-between">
                      <span>Proposed Agent Edit</span>
                      <span>{currentDiff.modifiedContent.split("\n").length} lines</span>
                    </div>
                    <div className="p-3 overflow-auto flex-1 font-mono text-[11.5px] leading-relaxed text-emerald-100">
                      <pre className="whitespace-pre">{currentDiff.modifiedContent}</pre>
                    </div>
                  </div>
                </div>
              ) : (
                /* Unified View */
                <div className="border border-border rounded-xl overflow-hidden bg-black/60">
                  <div className="px-4 py-2 border-b border-border bg-muted/30 text-xs font-semibold text-muted-foreground flex justify-between">
                    <span>{currentDiff.path}</span>
                    <span>Unified Diff</span>
                  </div>
                  <div className="p-2 overflow-auto text-[11.5px] leading-relaxed font-mono">
                    {diffLines.map((line, i) => (
                      <div
                        key={i}
                        className={`flex items-start px-2 py-0.5 rounded ${
                          line.type === "added"
                            ? "bg-emerald-500/20 text-emerald-300 font-medium"
                            : line.type === "removed"
                            ? "bg-red-500/20 text-red-300 line-through opacity-80"
                            : "text-zinc-400"
                        }`}
                      >
                        <span className="w-10 text-right pr-3 select-none text-zinc-600 shrink-0">
                          {line.newLineNumber || line.oldLineNumber || ""}
                        </span>
                        <span className="w-4 select-none shrink-0 font-bold">
                          {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                        </span>
                        <span className="whitespace-pre flex-1">{line.content}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-[var(--border)] bg-[var(--card)] shrink-0">
            <span className="text-xs text-muted-foreground">
              Reviewing file <code className="font-semibold text-foreground">{currentDiff?.path}</code>
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-border text-xs font-medium hover:bg-muted text-foreground transition"
              >
                Discard Changes
              </button>

              {onApplySingle && diffs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onApplySingle(currentDiff)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition"
                >
                  Apply This File Only
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  onApplyAll(diffs);
                  onClose();
                }}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
              >
                <Check className="w-4 h-4" />
                <span>Accept & Apply Changes</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
