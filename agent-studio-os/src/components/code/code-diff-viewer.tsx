"use client";

import { useMemo, useState } from "react";
import { Check, X, ArrowLeftRight, Edit3, Eye, RotateCcw, Copy } from "lucide-react";
import { toast } from "sonner";

interface CodeDiffViewerProps {
  originalCode: string;
  currentCode: string;
  filename: string;
  onRevert?: () => void;
  onAccept?: () => void;
  onCurrentCodeChange?: (newCode: string) => void;
}

export function CodeDiffViewer({
  originalCode,
  currentCode,
  filename,
  onRevert,
  onAccept,
  onCurrentCodeChange,
}: CodeDiffViewerProps) {
  const [rightViewMode, setRightViewMode] = useState<"edit" | "compare">("edit");

  const diffLines = useMemo(() => {
    const orig = originalCode.split("\n");
    const curr = currentCode.split("\n");

    const maxLen = Math.max(orig.length, curr.length);
    const result: Array<{
      origNum: number | null;
      currNum: number | null;
      origLine: string | null;
      currLine: string | null;
      type: "same" | "modified" | "added" | "deleted";
    }> = [];

    for (let i = 0; i < maxLen; i++) {
      const o = orig[i];
      const c = curr[i];

      if (o === undefined) {
        result.push({ origNum: null, currNum: i + 1, origLine: null, currLine: c, type: "added" });
      } else if (c === undefined) {
        result.push({ origNum: i + 1, currNum: null, origLine: o, currLine: null, type: "deleted" });
      } else if (o === c) {
        result.push({ origNum: i + 1, currNum: i + 1, origLine: o, currLine: c, type: "same" });
      } else {
        result.push({ origNum: i + 1, currNum: i + 1, origLine: o, currLine: c, type: "modified" });
      }
    }

    return result;
  }, [originalCode, currentCode]);

  const addedCount = diffLines.filter((l) => l.type === "added" || l.type === "modified").length;
  const deletedCount = diffLines.filter((l) => l.type === "deleted" || l.type === "modified").length;
  const currLineCount = currentCode.split("\n").length;

  return (
    <div className="flex-1 min-h-0 flex flex-col font-mono text-[12.5px] bg-[var(--background)] overflow-hidden">
      {/* Diff Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--card)] shrink-0 select-none">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--foreground)] truncate">
            <ArrowLeftRight className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
            <span className="truncate">{filename}</span>
          </span>
          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span className="text-emerald-500 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">+{addedCount}</span>
            <span className="text-red-500 font-medium bg-red-500/10 px-1.5 py-0.5 rounded">-{deletedCount}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* View mode toggle on right pane */}
          <div className="flex items-center bg-[var(--muted)] p-0.5 rounded-lg text-[11px] border border-[var(--border)]">
            <button
              type="button"
              onClick={() => setRightViewMode("edit")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                rightViewMode === "edit"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Edit3 className="w-3 h-3 text-emerald-500" />
              <span>Edit Version</span>
            </button>
            <button
              type="button"
              onClick={() => setRightViewMode("compare")}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md font-medium transition cursor-pointer ${
                rightViewMode === "compare"
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-xs"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              <Eye className="w-3 h-3 text-sky-500" />
              <span>Diff Highlights</span>
            </button>
          </div>

          {onRevert && (
            <button
              type="button"
              onClick={onRevert}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--border)] text-[11.5px] font-medium text-[var(--muted-foreground)] hover:text-red-500 hover:border-red-500/30 transition cursor-pointer"
              title="Revert to original"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden sm:inline">Revert</span>
            </button>
          )}

          {onAccept && (
            <button
              type="button"
              onClick={onAccept}
              className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--primary)] text-white text-[11.5px] font-medium hover:opacity-90 transition cursor-pointer shadow-xs"
              title="Accept and save changes"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save & Accept</span>
            </button>
          )}
        </div>
      </div>

      {/* Side-by-Side Diff View */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-[var(--border)] overflow-hidden">
        {/* Left: Original / Saved on Disk */}
        <div className="flex-1 min-w-0 flex flex-col bg-red-950/5 overflow-hidden">
          <div className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--card)]/90 border-b border-[var(--border)] text-[10.5px] font-semibold text-[var(--muted-foreground)] uppercase flex items-center justify-between shrink-0">
            <span className="text-red-400 font-medium">Original / Saved on Disk</span>
            <span className="text-[10px] text-[var(--muted-foreground)]/60 font-mono">Read-only reference</span>
          </div>
          <div className="flex-1 overflow-auto py-2 scrollbar-thin select-text">
            {diffLines.map((line, i) => (
              <div
                key={`orig-${i}`}
                className={`flex leading-[1.65] px-2 ${
                  line.type === "deleted" || line.type === "modified"
                    ? "bg-red-500/15 text-red-400"
                    : "text-[var(--muted-foreground)]/80"
                }`}
              >
                <span className="w-9 text-right pr-3 select-none text-[var(--muted-foreground)]/30 shrink-0">
                  {line.origNum ?? " "}
                </span>
                <span className="whitespace-pre overflow-x-auto">{line.origLine ?? " "}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Current / Edited Version (Editable) */}
        <div className="flex-1 min-w-0 flex flex-col bg-[var(--card)] overflow-hidden">
          <div className="sticky top-0 z-10 px-3 py-1.5 bg-[var(--card)]/90 border-b border-[var(--border)] text-[10.5px] font-semibold text-[var(--foreground)] uppercase flex items-center justify-between shrink-0">
            <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Current / Edited Version</span>
              <span className="text-[10px] text-emerald-500/70 font-normal">
                {rightViewMode === "edit" ? "(Editable)" : "(Annotated)"}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(currentCode);
                toast.success("Current version copied");
              }}
              className="p-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
              title="Copy current code"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          {rightViewMode === "edit" ? (
            /* Live Interactive Editable Textarea */
            <div className="flex-1 min-h-0 flex font-mono text-[12.5px] overflow-hidden">
              <div className="w-10 py-2 bg-[var(--card)] border-r border-[var(--border)]/50 text-right pr-2 select-none text-[var(--muted-foreground)]/40 shrink-0 overflow-hidden leading-[1.65]">
                {Array.from({ length: Math.min(currLineCount, 600) }).map((_, i) => (
                  <div key={i} className="text-[11px]">{i + 1}</div>
                ))}
              </div>
              <textarea
                value={currentCode}
                onChange={(e) => onCurrentCodeChange?.(e.target.value)}
                spellCheck={false}
                placeholder="Type or modify code here..."
                className="flex-1 p-2 bg-transparent text-[var(--foreground)] outline-none resize-none leading-[1.65] font-mono overflow-auto scrollbar-thin selection:bg-[var(--primary)]/20 whitespace-pre"
              />
            </div>
          ) : (
            /* Highlighted Diff Lines */
            <div className="flex-1 overflow-auto py-2 scrollbar-thin select-text bg-emerald-950/5">
              {diffLines.map((line, i) => (
                <div
                  key={`curr-${i}`}
                  className={`flex leading-[1.65] px-2 ${
                    line.type === "added" || line.type === "modified"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  <span className="w-9 text-right pr-3 select-none text-[var(--muted-foreground)]/30 shrink-0">
                    {line.currNum ?? " "}
                  </span>
                  <span className="whitespace-pre overflow-x-auto">{line.currLine ?? " "}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
