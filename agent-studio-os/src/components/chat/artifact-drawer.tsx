"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Code2, Copy, Download, Play, X, Check, Layers } from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";

export interface ChatArtifact {
  title: string;
  language: string;
  code: string;
  msgId: string;
}

interface ArtifactDrawerProps {
  artifact: ChatArtifact | null;
  onClose: () => void;
  onRunCode: (msgId: string, code: string, lang: string) => void;
  codeOutputs: Record<string, { stdout: string; stderr: string; time: number }>;
}

export function ArtifactDrawer({
  artifact,
  onClose,
  onRunCode,
  codeOutputs,
}: ArtifactDrawerProps) {
  const [copiedArtifact, setCopiedArtifact] = useState(false);

  if (!artifact) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ x: "100%", opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-80 md:w-96 lg:w-[480px] border-l border-border bg-card/95 backdrop-blur-2xl flex flex-col z-20 shrink-0 h-full shadow-2xl relative"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary border border-border flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-foreground truncate">{artifact.title}</h4>
              <span className="text-[10px] text-muted-foreground font-mono uppercase">
                {artifact.language}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Copy Button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(artifact.code);
                setCopiedArtifact(true);
                setTimeout(() => setCopiedArtifact(false), 2000);
                toast.success("Artifact copied to clipboard");
              }}
              className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Copy Code"
            >
              {copiedArtifact ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>

            {/* Download Button */}
            <button
              onClick={() => {
                const blob = new Blob([artifact.code], { type: "text/plain" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${artifact.title}.${
                  artifact.language === "python"
                    ? "py"
                    : artifact.language === "typescript"
                    ? "ts"
                    : "txt"
                }`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("Artifact downloaded");
              }}
              className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Download Artifact"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Run Sandbox Button */}
            <button
              onClick={() => onRunCode(artifact.msgId, artifact.code, artifact.language)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all shadow-sm cursor-pointer"
            >
              <Play className="w-3 h-3" />
              <span>Run</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code / Diagram Viewer */}
        {artifact.language === "mermaid" ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-card">
            <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center justify-between text-xs text-primary">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-foreground" />
                Mermaid Diagram Visualizer
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Flowchart / Graph</span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="p-4 rounded-xl border border-border bg-primary/5 text-xs">
                <div className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">
                  Diagram Nodes & Flow
                </div>
                <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                  {artifact.code
                    .split("\n")
                    .filter((l) => l.trim() && !l.trim().startsWith("%%"))
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border"
                      >
                        <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-foreground break-all">{line}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Mermaid Definition Source
                </div>
                <pre className="p-3 rounded-xl bg-secondary/50 border border-border text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre">
                  {artifact.code}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 bg-card font-mono text-xs text-foreground leading-relaxed whitespace-pre selection:bg-primary/30">
            <code>{artifact.code}</code>
          </div>
        )}

        {/* Terminal Output Footer */}
        {codeOutputs[artifact.msgId] && (
          <div className="border-t border-border p-3 bg-secondary/60 text-xs font-mono max-h-48 overflow-y-auto">
            <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
              <span>TERMINAL OUTPUT</span>
              <span>{formatResponseTime(codeOutputs[artifact.msgId].time)}</span>
            </div>

            {codeOutputs[artifact.msgId].stdout && (
              <pre className="text-foreground whitespace-pre-wrap">
                {codeOutputs[artifact.msgId].stdout}
              </pre>
            )}
            {codeOutputs[artifact.msgId].stderr && (
              <pre className="text-red-400 whitespace-pre-wrap">
                {codeOutputs[artifact.msgId].stderr}
              </pre>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
