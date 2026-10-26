"use client";

import React, { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { useProjectBuilder } from "@/context/project-builder-context";
import {
  Code2,
  Loader2,
  CheckCircle2,
  ExternalLink,
  X,
  Sparkles,
  FolderGit2,
} from "lucide-react";

export function GlobalAgentTaskTracker() {
  const router = useRouter();
  const pathname = usePathname();
  const { isLoaded, isSignedIn } = useAuth();
  const {
    isGenerating,
    buildingProject,
    buildingPrompt,
    latestResult,
    isTrackerVisible,
    dismissTracker,
  } = useProjectBuilder();

  const [showFinishedNotice, setShowFinishedNotice] = useState(false);

  useEffect(() => {
    if (!isGenerating && latestResult?.success) {
      setShowFinishedNotice(true);
      const timer = setTimeout(() => {
        setShowFinishedNotice(false);
      }, 12000);
      return () => clearTimeout(timer);
    }
  }, [isGenerating, latestResult]);

  // If not logged in, NEVER show the background process tracker
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  // If nothing is generating and no finished notice, don't render
  if (!isGenerating && !showFinishedNotice) {
    return null;
  }

  // If user explicitly dismissed the banner
  if (!isTrackerVisible && !showFinishedNotice) {
    return null;
  }

  // On the /code page, use a compact inline style that doesn't obstruct the layout
  const isCodePage = pathname === "/code";

  const handleNavigateToCode = () => {
    const targetProject = buildingProject || latestResult?.projectName;
    if (targetProject) {
      router.push(`/code?project=${encodeURIComponent(targetProject)}`);
    } else {
      router.push("/code");
    }
  };

  const handleDismiss = () => {
    dismissTracker();
    setShowFinishedNotice(false);
  };

  // ─── Code Page: compact toast-like bar at the bottom ───
  if (isCodePage) {
    return (
      <aside
        aria-label="Agent background task status"
        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-in slide-in-from-bottom-3 fade-in duration-200"
      >
        <div
          className={`flex items-center gap-3 pl-3.5 pr-2 py-2 rounded-full border shadow-lg backdrop-blur-xl ${
            isGenerating
              ? "bg-[var(--card)]/95 border-[var(--primary)]/25 shadow-[var(--primary)]/8"
              : "bg-[var(--card)]/95 border-emerald-500/25 shadow-emerald-500/8"
          }`}
        >
          {/* Status indicator */}
          {isGenerating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--primary)] shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          )}

          {/* Message */}
          <span className="text-[12.5px] font-medium text-[var(--foreground)] max-w-[280px] truncate">
            {isGenerating
              ? `Building ${buildingProject || "project"}...`
              : `${latestResult?.createdFiles?.length || 0} files created`}
          </span>

          {/* Subtle separator */}
          <div className="w-px h-3.5 bg-[var(--border)]" />

          {/* Dismiss */}
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors rounded-full hover:bg-[var(--muted)] cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </aside>
    );
  }

  // ─── Other Pages: full notification card ───
  return (
    <aside
      aria-label="Agent background task status"
      className="fixed bottom-6 right-6 z-50 max-w-sm sm:max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-auto"
    >
      <div className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl p-4 shadow-2xl ring-1 ring-[var(--border)]">
        {/* Accent bar */}
        <div
          className={`absolute top-0 left-0 right-0 h-[3px] ${
            isGenerating
              ? "bg-gradient-to-r from-[var(--primary)] via-blue-500 to-indigo-500 animate-pulse"
              : "bg-gradient-to-r from-emerald-500 to-teal-400"
          }`}
        />

        <div className="flex items-start gap-3">
          {/* Status Icon */}
          <div
            className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              isGenerating
                ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                : "bg-emerald-500/10 text-emerald-500"
            }`}
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0 pr-6">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[var(--primary)]" />
                {isGenerating ? "Building Project" : "Build Complete"}
              </span>
              {buildingProject && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[var(--muted)] px-1.5 py-0.5 text-[10px] font-mono font-medium text-[var(--foreground)]">
                  <FolderGit2 className="h-2.5 w-2.5 text-[var(--muted-foreground)]" />
                  {buildingProject}
                </span>
              )}
            </div>

            <p className="mt-1 text-[13px] font-medium text-[var(--foreground)] truncate">
              {isGenerating
                ? buildingPrompt || "Generating project architecture..."
                : `Created ${latestResult?.createdFiles?.length || 0} files successfully`}
            </p>

            <p className="mt-0.5 text-[11.5px] text-[var(--muted-foreground)] flex items-center gap-1.5">
              {isGenerating ? (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                  Safe to navigate — runs in the background.
                </>
              ) : (
                <>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Ready to preview in Code Studio.
                </>
              )}
            </p>

            {/* Action Buttons */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={handleNavigateToCode}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:opacity-90 transition cursor-pointer"
              >
                <Code2 className="h-3.5 w-3.5" />
                Open in Code Studio
              </button>

              <button
                type="button"
                onClick={handleDismiss}
                className="inline-flex items-center rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors p-1 rounded-md hover:bg-[var(--muted)] cursor-pointer"
            aria-label="Close notification"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
