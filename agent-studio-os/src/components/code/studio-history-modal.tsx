"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  History,
  Search,
  MessageSquare,
  Clock,
  Trash2,
  Download,
  ArrowRight,
  X,
  Folder,
  FileCode,
  Sparkles,
  Bot,
  User,
  Check,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useProjectBuilder, type CodeMessage } from "@/context/project-builder-context";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { playClickSound, playWarningSound } from "@/lib/sound-effects";
import { toast } from "sonner";

interface StudioHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: WorkspaceProjectInfo[];
  selectedProject: string;
  onSelectProject: (name: string) => void;
}

interface ConversationSummary {
  projectName: string;
  messages: CodeMessage[];
  messageCount: number;
  lastMessageTime: string | null;
  lastTimestamp: number;
  initialPrompt: string;
  latestPrompt: string;
  filesGeneratedCount: number;
}

function formatRelativeTime(timestamp: number | string | null): string {
  if (!timestamp) return "Never";
  const date = typeof timestamp === "number" ? new Date(timestamp) : new Date(timestamp);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StudioHistoryModal({
  isOpen,
  onClose,
  projects,
  selectedProject,
  onSelectProject,
}: StudioHistoryModalProps) {
  const {
    allMessagesMap,
    getProjectMessages,
    loadProjectMessagesFromDisk,
    clearProjectMessages,
  } = useProjectBuilder();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [confirmClearProject, setConfirmClearProject] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus search on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 80);
      setConfirmClearProject(null);
    } else {
      setSearchQuery("");
      setFilterProject("all");
    }
  }, [isOpen]);

  // Pre-load disk messages for all available projects if not yet in memory
  useEffect(() => {
    if (!isOpen) return;
    projects.forEach((p) => {
      if (!allMessagesMap[p.name] || allMessagesMap[p.name].length === 0) {
        loadProjectMessagesFromDisk(p.name);
      }
    });
  }, [isOpen, projects, allMessagesMap, loadProjectMessagesFromDisk]);

  // Build aggregated conversation summaries across all projects
  const conversationList: ConversationSummary[] = useMemo(() => {
    // Collect all projects from both projects array and allMessagesMap keys
    const allProjNames = Array.from(
      new Set([...projects.map((p) => p.name), ...Object.keys(allMessagesMap)])
    );

    const summaries: ConversationSummary[] = [];

    for (const projName of allProjNames) {
      const msgs = allMessagesMap[projName] || getProjectMessages(projName) || [];
      if (msgs.length === 0) continue;

      const userMsgs = msgs.filter((m) => m.role === "user");
      const initialPrompt = userMsgs[0]?.content || msgs[0]?.content || "";
      const latestPrompt = userMsgs[userMsgs.length - 1]?.content || msgs[msgs.length - 1]?.content || "";

      let filesGenerated = 0;
      let latestTime = 0;

      for (const m of msgs) {
        if (m.createdFiles && m.createdFiles.length > 0) {
          filesGenerated += m.createdFiles.length;
        }
        const t = m.createdAt ? new Date(m.createdAt).getTime() : 0;
        if (t > latestTime) latestTime = t;
      }

      summaries.push({
        projectName: projName,
        messages: msgs,
        messageCount: msgs.length,
        lastMessageTime: latestTime > 0 ? new Date(latestTime).toISOString() : null,
        lastTimestamp: latestTime,
        initialPrompt,
        latestPrompt,
        filesGeneratedCount: filesGenerated,
      });
    }

    // Sort by latest message first
    return summaries.sort((a, b) => b.lastTimestamp - a.lastTimestamp);
  }, [projects, allMessagesMap, getProjectMessages]);

  // Filter conversations by search query & project filter
  const filteredList = useMemo(() => {
    return conversationList.filter((item) => {
      if (filterProject !== "all" && item.projectName !== filterProject) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const matchProject = item.projectName.toLowerCase().includes(q);
      const matchLatest = item.latestPrompt.toLowerCase().includes(q);
      const matchInitial = item.initialPrompt.toLowerCase().includes(q);
      const matchAnyMsg = item.messages.some((m) => m.content.toLowerCase().includes(q));

      return matchProject || matchLatest || matchInitial || matchAnyMsg;
    });
  }, [conversationList, searchQuery, filterProject]);

  const handleResume = (projName: string) => {
    playClickSound();
    onSelectProject(projName);
    onClose();
    toast.success(`Resumed conversation in "${projName}"`);
  };

  const handleExport = (item: ConversationSummary) => {
    playClickSound();
    const transcript = `# Conversation History: ${item.projectName}\nExported: ${new Date().toLocaleString()}\n\n---\n\n` +
      item.messages
        .map((m) => {
          const author = m.role === "user" ? "### User" : "### Assistant (Agent Studio)";
          const time = m.createdAt ? ` _(${new Date(m.createdAt).toLocaleTimeString()})_` : "";
          const files = m.createdFiles && m.createdFiles.length > 0
            ? `\n\n*Created Files (${m.createdFiles.length}):*\n` + m.createdFiles.map((f) => `- \`${f.path}\``).join("\n")
            : "";
          return `${author}${time}\n\n${m.content}${files}\n\n---\n`;
        })
        .join("\n");

    const blob = new Blob([transcript], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.projectName}-chat-history.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported conversation transcript for "${item.projectName}"`);
  };

  const handleClearHistory = (projName: string) => {
    playWarningSound();
    clearProjectMessages(projName);
    setConfirmClearProject(null);
    toast.success(`Cleared conversation history for "${projName}"`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md">
        {/* Backdrop click to close */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="relative w-full max-w-2xl max-h-[85vh] bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden z-10"
        >
          {/* ─── HEADER ─── */}
          <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center border border-[var(--primary)]/20 shadow-xs">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--foreground)] tracking-tight">
                  Conversation History
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Browse, search, and resume past development sessions across your projects
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ─── SEARCH & FILTER TOOLBAR ─── */}
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--background)] flex flex-col sm:flex-row gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search conversations, prompts, code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-[var(--card)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:border-[var(--primary)] transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Project Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
              <button
                type="button"
                onClick={() => setFilterProject("all")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                  filterProject === "all"
                    ? "bg-[var(--primary)] text-white shadow-xs"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                All Projects ({conversationList.length})
              </button>

              {projects.slice(0, 5).map((p) => {
                const count = (allMessagesMap[p.name] || []).length;
                if (count === 0) return null;
                return (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => setFilterProject(p.name)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium shrink-0 transition cursor-pointer ${
                      filterProject === p.name
                        ? "bg-[var(--primary)] text-white shadow-xs"
                        : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <Folder className="w-3 h-3 opacity-70" />
                    <span className="truncate max-w-[100px]">{p.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ─── CONVERSATIONS LIST ─── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2.5 divide-y divide-[var(--border)]/40">
            {filteredList.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] border border-[var(--border)] flex items-center justify-center text-[var(--muted-foreground)] mb-3">
                  <MessageSquare className="w-6 h-6 opacity-60" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--foreground)] mb-1">
                  {searchQuery ? "No matching conversations found" : "No conversation history yet"}
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-sm">
                  {searchQuery
                    ? `Try searching for different keywords or clear the search filter.`
                    : "When you interact with the autonomous coder in a project, your chat history and file generation history will be tracked here."}
                </p>
              </div>
            ) : (
              filteredList.map((item) => {
                const isSelected = item.projectName === selectedProject;
                const isConfirming = confirmClearProject === item.projectName;

                return (
                  <div
                    key={item.projectName}
                    className={`pt-2.5 first:pt-0 group rounded-xl p-3 border transition-all ${
                      isSelected
                        ? "border-[var(--primary)]/40 bg-[var(--primary)]/5"
                        : "border-[var(--border)] bg-[var(--card)]/60 hover:bg-[var(--accent)]/50 hover:border-[var(--border)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-[var(--accent)] border border-[var(--border)] text-[var(--primary)] shrink-0">
                          <Folder className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-sm font-semibold text-[var(--foreground)] truncate">
                          {item.projectName}
                        </span>
                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full bg-[var(--primary)]/15 text-[var(--primary)] text-[10px] font-semibold">
                            Active
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-full bg-[var(--accent)] text-[var(--muted-foreground)] text-[10px] font-mono">
                          {item.messageCount} msg{item.messageCount === 1 ? "" : "s"}
                        </span>
                        {item.filesGeneratedCount > 0 && (
                          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20">
                            <FileCode className="w-3 h-3" />
                            {item.filesGeneratedCount} file{item.filesGeneratedCount === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                          <Clock className="w-3 h-3 opacity-60" />
                          {formatRelativeTime(item.lastTimestamp)}
                        </span>
                      </div>
                    </div>

                    {/* Latest prompt snippet */}
                    <div className="text-xs text-[var(--muted-foreground)] line-clamp-2 bg-[var(--background)]/60 p-2.5 rounded-lg border border-[var(--border)]/50 font-sans mb-3">
                      <span className="font-semibold text-[var(--foreground)] mr-1">Latest prompt:</span>
                      &ldquo;{item.latestPrompt || item.initialPrompt}&rdquo;
                    </div>

                    {/* Actions Row */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      {isConfirming ? (
                        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-lg">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          <span className="text-xs text-rose-300">Clear chat history?</span>
                          <button
                            type="button"
                            onClick={() => handleClearHistory(item.projectName)}
                            className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded text-[11px] font-medium transition cursor-pointer"
                          >
                            Yes, Clear
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmClearProject(null)}
                            className="px-2 py-0.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleExport(item)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)] transition cursor-pointer"
                            title="Export chat as Markdown transcript"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Export</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setConfirmClearProject(item.projectName)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-rose-400/80 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            title="Clear conversation messages"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Clear</span>
                          </button>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleResume(item.projectName)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white text-xs font-semibold shadow-xs transition cursor-pointer group-hover:scale-[1.02]"
                      >
                        <span>Resume Conversation</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* ─── FOOTER ─── */}
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--card)]/90 backdrop-blur-md flex items-center justify-between text-xs text-[var(--muted-foreground)] shrink-0">
            <span>
              Showing {filteredList.length} of {conversationList.length} conversation{conversationList.length === 1 ? "" : "s"}
            </span>
            <kbd className="text-[10px] font-mono px-2 py-1 rounded bg-[var(--accent)] border border-[var(--border)]">
              Esc to close
            </kbd>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
