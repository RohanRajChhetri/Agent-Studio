"use client";

import React from "react";
import { CodeDiffViewer } from "./code-diff-viewer";

export interface CodeEditorViewProps {
  activeArtifactTab: "code" | "split" | "preview";
  isDiffMode: boolean;
  activeTab: {
    originalContent?: string;
    path: string;
  };
  currentFilePath: string;
  code: string;
  lineCount: number;
  fontSize: number;
  wordWrap: boolean;
  previewViewport: "desktop" | "tablet" | "mobile";
  previewHtml: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onCodeChange: (val: string) => void;
  onSaveToProject: () => void;
  onRevertActiveFile: () => void;
  onEditorKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onCursorUpdate: (e: any) => void;
}

export function CodeEditorView({
  activeArtifactTab,
  isDiffMode,
  activeTab,
  currentFilePath,
  code,
  lineCount,
  fontSize,
  wordWrap,
  previewViewport,
  previewHtml,
  textareaRef,
  iframeRef,
  onCodeChange,
  onSaveToProject,
  onRevertActiveFile,
  onEditorKeyDown,
  onCursorUpdate,
}: CodeEditorViewProps) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      {isDiffMode ? (
        /* Local Diff Viewer */
        <CodeDiffViewer
          originalCode={activeTab.originalContent || ""}
          currentCode={code}
          filename={currentFilePath}
          onAccept={onSaveToProject}
          onRevert={onRevertActiveFile}
          onCurrentCodeChange={onCodeChange}
        />
      ) : activeArtifactTab === "code" ? (
        /* Full Editor View */
        <div className="flex-1 min-h-0 flex overflow-hidden font-mono text-[13px] bg-[var(--card)]">
          {/* Line Numbers */}
          <div className="w-12 py-3 bg-[var(--card)] border-r border-[var(--border)]/50 text-right pr-3 select-none text-[var(--muted-foreground)]/40 shrink-0 overflow-hidden leading-[1.65]">
            {Array.from({ length: Math.min(lineCount, 600) }).map((_, i) => (
              <div key={i} className="text-[11.5px]">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Textarea Code Input */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => onCodeChange(e.target.value)}
            onKeyDown={onEditorKeyDown}
            onKeyUp={onCursorUpdate}
            onClick={onCursorUpdate}
            onSelect={onCursorUpdate}
            spellCheck={false}
            style={{ fontSize: `${fontSize}px` }}
            className={`flex-1 p-3 bg-transparent text-[var(--foreground)] outline-none resize-none leading-[1.65] font-mono overflow-auto scrollbar-thin selection:bg-[var(--primary)]/20 ${
              wordWrap ? "whitespace-pre-wrap" : "whitespace-pre"
            }`}
          />
        </div>
      ) : activeArtifactTab === "split" ? (
        /* Split View: Editor Left + Sandboxed Preview Right */
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
          {/* Left: Code Editor */}
          <div className="flex-1 min-w-0 flex overflow-hidden font-mono text-[12.5px] bg-[var(--card)]">
            <div className="w-10 py-3 bg-[var(--card)] border-r border-[var(--border)]/50 text-right pr-2 select-none text-[var(--muted-foreground)]/40 shrink-0 overflow-hidden leading-[1.6]">
              {Array.from({ length: Math.min(lineCount, 300) }).map((_, i) => (
                <div key={i} className="text-[11px]">
                  {i + 1}
                </div>
              ))}
            </div>
            <textarea
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              onKeyDown={onEditorKeyDown}
              onKeyUp={onCursorUpdate}
              onClick={onCursorUpdate}
              onSelect={onCursorUpdate}
              spellCheck={false}
              style={{ fontSize: `${fontSize}px` }}
              className="flex-1 p-3 bg-transparent text-[var(--foreground)] outline-none resize-none leading-[1.6] font-mono overflow-auto scrollbar-thin selection:bg-[var(--primary)]/20 whitespace-pre"
            />
          </div>

          {/* Right: Live Sandboxed Preview */}
          <div className="flex-1 min-w-0 relative bg-neutral-950 p-2 overflow-auto flex items-center justify-center">
            <div
              className={`transition-all duration-300 bg-white ${
                previewViewport === "mobile"
                  ? "w-[375px] h-[95%] shadow-2xl rounded-2xl border border-neutral-800 overflow-hidden"
                  : previewViewport === "tablet"
                  ? "w-[768px] h-[95%] shadow-2xl rounded-xl border border-neutral-800 overflow-hidden"
                  : "w-full h-full shadow-sm rounded-lg overflow-hidden"
              }`}
            >
              <iframe
                ref={iframeRef}
                title="Live Sandbox Preview Split"
                srcDoc={previewHtml}
                sandbox="allow-scripts allow-modals allow-forms"
                className="w-full h-full border-none bg-white"
              />
            </div>
          </div>
        </div>
      ) : (
        /* Full Sandboxed Live Preview */
        <div className="flex-1 min-h-0 relative bg-neutral-950 p-3 overflow-auto flex items-center justify-center">
          <div
            className={`transition-all duration-300 bg-white ${
              previewViewport === "mobile"
                ? "w-[375px] h-[95%] shadow-2xl rounded-2xl border border-neutral-800 overflow-hidden"
                : previewViewport === "tablet"
                ? "w-[768px] h-[95%] shadow-2xl rounded-xl border border-neutral-800 overflow-hidden"
                : "w-full h-full shadow-sm rounded-lg overflow-hidden"
            }`}
          >
            <iframe
              ref={iframeRef}
              title="Live Sandbox Preview"
              srcDoc={previewHtml}
              sandbox="allow-scripts allow-modals allow-forms"
              className="w-full h-full border-none bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
