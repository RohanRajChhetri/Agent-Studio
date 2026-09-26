"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Plus,
  Bot,
  Brain,
  Layers,
  Columns3,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface DecomposedSubtask {
  id: string;
  title: string;
  description: string;
  agentId: string | null;
  agentName: string;
  agentAvatar: string;
  priority: "urgent" | "high" | "medium" | "low";
}

interface BrainDumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentProfile[];
  onTasksCreated?: () => void;
}

export function BrainDumpModal({
  isOpen,
  onClose,
  agents,
  onTasksCreated,
}: BrainDumpModalProps) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [subtasks, setSubtasks] = useState<DecomposedSubtask[]>([]);
  const recognitionRef = useRef<any>(null);
  const baseTextRef = useRef<string>("");

  // Clean up recognition on unmount or close
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // Ignore abort errors on cleanup
        }
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors
        }
      }
      setIsListening(false);
      return;
    }

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("Speech recognition is not supported in this browser. Please type your thoughts.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      // Snapshot the current text so speech appends accurately without duplication
      baseTextRef.current = text.trim();

      recognition.onstart = () => {
        setIsListening(true);
        toast.info("🎙️ Listening... Speak naturally to stream your thoughts");
      };

      recognition.onresult = (event: any) => {
        // Collect cumulative transcript of the current session across all results
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }

        const base = baseTextRef.current;
        const newText = base
          ? `${base} ${fullTranscript.trim()}`
          : fullTranscript.trim();

        setText(newText);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please check microphone permissions.");
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      setIsListening(false);
    }
  };

  const handleDecompose = async () => {
    if (!text.trim()) {
      toast.error("Please type or speak your thoughts first");
      return;
    }

    setIsDecomposing(true);
    try {
      const res = await fetch("/api/tasks/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: text.slice(0, 80),
          description: text,
          agents,
        }),
      });

      const data = await res.json();
      if (res.ok && data.subtasks && data.subtasks.length > 0) {
        setSubtasks(data.subtasks);
        toast.success(`Thought auto-decomposed into ${data.subtasks.length} actionable tickets!`);
      } else {
        toast.error(data.error || "Decomposition failed");
      }
    } catch {
      toast.error("Network error during task decomposition");
    } finally {
      setIsDecomposing(false);
    }
  };

  const handleCommitToKanban = async () => {
    if (subtasks.length === 0) return;
    setIsCommitting(true);

    try {
      // 1. Create each task in Kanban
      let createdCount = 0;
      for (const st of subtasks) {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: st.title,
            description: st.description || `Origin: Brain Dump memo`,
            priority: st.priority,
            agentId: st.agentId,
            status: "backlog",
          }),
        });
        createdCount++;
      }

      // 2. Archive raw brain dump into Obsidian Vault
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 16);
      await fetch("/api/vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `BrainDump_${timestamp}`,
          folder: "braindumps",
          tags: ["braindump", "quick-capture", "raw-thought"],
          content: `# 🧠 Quick Capture Brain Dump (${new Date().toLocaleString()})\n\n### Raw Thought Stream\n${text}\n\n---\n\n### Decomposed & Assigned Tickets (${createdCount})\n${subtasks
            .map((st, i) => `${i + 1}. **${st.title}** [${st.priority.toUpperCase()}] → Assigned to ${st.agentAvatar} ${st.agentName}\n   *${st.description}*`)
            .join("\n\n")}`,
        }),
      });

      toast.success(`${createdCount} tasks created on Kanban & archived to Obsidian Vault!`);
      if (onTasksCreated) onTasksCreated();
      onClose();
      setText("");
      setSubtasks([]);
    } catch {
      toast.error("Failed to commit tasks to Kanban");
    } finally {
      setIsCommitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl rounded-2xl border border-border bg-card text-foreground shadow-2xl p-5 sm:p-6 space-y-4 max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Voice & Thought Brain Dump
                </h3>
                <p className="text-xs text-muted-foreground">
                  Speak or type a stream of consciousness — AI decomposes it into tickets & assigns specialists
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Input Box */}
          <div className="space-y-2 shrink-0">
            <div className="relative">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="e.g., We need to fix the stripe webhook race condition by Thursday, write a draft for the launch newsletter, and audit database latency..."
                rows={4}
                className="w-full p-3.5 rounded-xl border border-border bg-secondary/30 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
              />

              <div className="absolute right-3 bottom-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                    isListening
                      ? "bg-rose-500 text-white animate-pulse"
                      : "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                  }`}
                  title={isListening ? "Stop listening" : "Dictate with microphone"}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-primary" />}
                  <span>{isListening ? "Listening..." : "Dictate"}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground font-mono">
                {text.length} characters
              </span>

              <button
                type="button"
                onClick={handleDecompose}
                disabled={isDecomposing || !text.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition cursor-pointer disabled:opacity-50"
              >
                {isDecomposing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Decomposing & Matching Agents...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Deconstruct into Tickets</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Decomposed Subtasks Preview List */}
          {subtasks.length > 0 && (
            <div className="flex-1 overflow-y-auto space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Columns3 className="w-3.5 h-3.5 text-primary" />
                  Generated Specialist Tickets ({subtasks.length})
                </span>
                <span className="text-[10px] text-muted-foreground">Ready to queue to Kanban</span>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {subtasks.map((st, idx) => (
                  <div
                    key={st.id || idx}
                    className="p-3 rounded-xl border border-border bg-secondary/20 flex items-start justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{st.title}</span>
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-secondary border border-border font-bold">
                          {st.priority}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{st.description}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-lg bg-card border border-border">
                      <span className="text-sm">{st.agentAvatar}</span>
                      <span className="font-semibold text-[11px] text-foreground">{st.agentName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer Commitment Actions */}
          {subtasks.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
              <button
                type="button"
                onClick={() => setSubtasks([])}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Clear Tickets
              </button>

              <button
                type="button"
                onClick={handleCommitToKanban}
                disabled={isCommitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-lg shadow-primary/25 transition cursor-pointer disabled:opacity-50"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deploying to Kanban...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Commit All ({subtasks.length}) to Kanban & Vault</span>
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
