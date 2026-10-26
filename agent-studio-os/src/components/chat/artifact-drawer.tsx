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
        className="w-80 md:w-96 lg:w-[480px] border-l border-white/10 bg-zinc-950/95 backdrop-blur-2xl flex flex-col z-20 shrink-0 h-full shadow-2xl relative text-zinc-100"
      >
        {/* Header */}
        <div className="p-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 text-zinc-200 border border-white/10 flex items-center justify-center shrink-0">
              <Code2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-semibold text-zinc-100 truncate">{artifact.title}</h4>
              <span className="text-[10px] text-zinc-400 font-mono uppercase">
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
              className="p-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Copy Code"
            >
              {copiedArtifact ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
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
              className="p-1.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              title="Download Artifact"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Run Sandbox Button */}
            <button
              onClick={() => onRunCode(artifact.msgId, artifact.code, artifact.language)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
            >
              <Play className="w-3 h-3 fill-black text-black" />
              <span>Run</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors ml-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Code / Diagram Viewer */}
        {artifact.language === "mermaid" ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-black">
            <div className="px-4 py-2 bg-zinc-900/60 border-b border-white/10 flex items-center justify-between text-xs text-zinc-300">
              <span className="font-semibold flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                Mermaid Diagram Visualizer
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Flowchart / Graph</span>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="p-4 rounded-xl border border-white/10 bg-zinc-950 text-xs">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Diagram Nodes & Flow
                </div>
                <div className="space-y-2 font-mono text-[11px] text-zinc-300">
                  {artifact.code
                    .split("\n")
                    .filter((l) => l.trim() && !l.trim().startsWith("%%"))
                    .map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded-lg bg-zinc-900 border border-white/5"
                      >
                        <span className="w-5 h-5 rounded-md bg-zinc-800 text-zinc-200 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-zinc-200 break-all">{line}</span>
                      </div>
                    ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Mermaid Definition Source
                </div>
                <pre className="p-3 rounded-xl bg-zinc-900 border border-white/5 text-xs font-mono text-zinc-400 overflow-x-auto whitespace-pre">
                  {artifact.code}
                </pre>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-auto p-4 bg-black font-mono text-xs text-zinc-200 leading-relaxed whitespace-pre selection:bg-zinc-800">
            <code>{artifact.code}</code>
          </div>
        )}

        {/* Terminal Output Footer */}
        {codeOutputs[artifact.msgId] && (
          <div className="border-t border-white/10 p-3 bg-zinc-950 text-xs font-mono max-h-48 overflow-y-auto">
            <div className="text-[10px] text-zinc-500 mb-1 flex justify-between">
              <span>TERMINAL OUTPUT</span>
              <span>{formatResponseTime(codeOutputs[artifact.msgId].time)}</span>
            </div>

            {codeOutputs[artifact.msgId].stdout && (
              <pre className="text-zinc-200 whitespace-pre-wrap">
                {codeOutputs[artifact.msgId].stdout}
              </pre>
            )}
            {codeOutputs[artifact.msgId].stderr && (
              <pre className="text-rose-400 whitespace-pre-wrap">
                {codeOutputs[artifact.msgId].stderr}
              </pre>
            )}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
