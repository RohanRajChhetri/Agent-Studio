"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Folder,
  FileText,
  Clock,
  Layers,
  Users,
  Download,
  Printer,
  Kanban,
  ExternalLink,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import type { A2AHierarchyExecutionResult } from "@/types/a2a";

export interface ConferenceArtifactBannerProps {
  result: A2AHierarchyExecutionResult | null;
  copiedFile: boolean;
  isDispatchingKanban: boolean;
  dispatchedCount: number | null;
  onPrint: () => void;
  onDispatchToKanban: () => void;
  onCopyPath: () => void;
}

export function ConferenceArtifactBanner({
  result,
  copiedFile,
  isDispatchingKanban,
  dispatchedCount,
  onPrint,
  onDispatchToKanban,
  onCopyPath,
}: ConferenceArtifactBannerProps) {
  if (!result) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg p-4 border border-border bg-card shadow-2xs"
    >
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
            <code className="text-xs font-mono px-2 py-0.5 rounded-sm bg-secondary border border-border text-primary font-bold">
              {result.dedicatedFolder || "agent-workspace/conference/"}
            </code>
            <span className="text-xs font-semibold font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-sm border border-emerald-500/20">
              Consensus Fulfilled
            </span>
          </div>

          {result.conferenceFile && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="w-3.5 h-3.5 text-blue-500" />
              <span className="font-mono text-foreground font-medium truncate">
                {result.conferenceFile.fileName}
              </span>
              {result.conferenceFile.size > 0 && (
                <span className="text-[11px] opacity-70">
                  ({Math.round(result.conferenceFile.size / 1024)} KB)
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-primary" />
              {Math.round(result.totalLatencyMs / 1000)}s duration
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3 text-amber-500" />
              {result.totalSubtasks} subtasks executed
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 text-blue-500" />
              {result.executionTree?.subordinates?.length || 0} specialists reports
            </span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {result.conferenceFile && (
            <a
              href={result.conferenceFile.fileUrl}
              download={result.conferenceFile.fileName}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
          )}

          <button
            type="button"
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>PDF Briefing</span>
          </button>

          {/* Dispatch to Kanban */}
          <button
            type="button"
            onClick={onDispatchToKanban}
            disabled={isDispatchingKanban || dispatchedCount !== null}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition shadow-2xs cursor-pointer ${
              dispatchedCount !== null
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
          >
            {isDispatchingKanban ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : dispatchedCount !== null ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Kanban className="w-3.5 h-3.5" />
            )}
            <span>
              {dispatchedCount !== null
                ? `Dispatched (${dispatchedCount})`
                : "Dispatch to Kanban"}
            </span>
          </button>

          <Link
            href="/code"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-muted transition shadow-2xs cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open in Code</span>
          </Link>

          <button
            type="button"
            onClick={onCopyPath}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card hover:bg-muted transition shadow-2xs cursor-pointer"
          >
            {copiedFile ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedFile ? "Copied" : "Copy Path"}</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
