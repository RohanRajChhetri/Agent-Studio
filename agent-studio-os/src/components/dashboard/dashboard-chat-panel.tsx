"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Send,
  Loader2,
  X,
  Copy,
  Check,
  ExternalLink,
  Columns3,
  Minus,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

export interface DashboardChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentAvatar?: string;
  latency?: number;
  model?: string;
  createdAt: string;
  actionExecuted?: string;
  task?: any;
  metadata?: Record<string, any>;
}

interface DashboardChatPanelProps {
  isChatActive: boolean;
  activeAgent?: AgentProfile;
  currentSessionId?: string | null;
  chatMessages: DashboardChatMessage[];
  isChatSending: boolean;
  followUpInput: string;
  setFollowUpInput: (val: string) => void;
  onFollowUpSubmit: (e: React.FormEvent) => void;
  onCloseChat: () => void;
  onSendToKanban: (title?: string, desc?: string) => void;
  isFloating?: boolean;
}

export function DashboardChatPanel({
  isChatActive,
  activeAgent,
  currentSessionId,
  chatMessages,
  isChatSending,
  followUpInput,
  setFollowUpInput,
  onFollowUpSubmit,
  onCloseChat,
  onSendToKanban,
  isFloating = false,
}: DashboardChatPanelProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatSending]);

  const handleCopyChat = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <AnimatePresence>
      {isChatActive && (
        <motion.div
          initial={{ opacity: 0, y: isFloating ? 20 : -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isFloating ? 20 : -8, scale: 0.98 }}
          className={
            isFloating
              ? "fixed bottom-5 right-5 z-50 w-[95vw] sm:w-[480px] md:w-[520px] rounded-2xl border border-border bg-card/98 shadow-2xl backdrop-blur-xl overflow-hidden transition-all divide-y divide-border"
              : "mt-4 rounded-2xl border border-border bg-card shadow-xl backdrop-blur-md overflow-hidden transition-all divide-y divide-border"
          }
        >
          {/* Chat Panel Header */}
          <div className="flex items-center justify-between p-3.5 bg-secondary/25">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative shrink-0">
                <span className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-sm shadow-xs">
                  {activeAgent?.avatar || "🤖"}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-foreground truncate">
                    {activeAgent?.displayName || "Specialist Agent"}
                  </p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground font-medium shrink-0">
                    {activeAgent?.department || activeAgent?.role || "Specialist"}
                  </span>
                  {isFloating && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
                      Persistent
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 truncate">
                  <span className="text-emerald-500 font-semibold">● Active</span>
                  <span>•</span>
                  <span>Memory Vault Synced</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isFloating && (
                <button
                  type="button"
                  onClick={() => setIsMinimized((prev) => !prev)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                  title={isMinimized ? "Expand chat" : "Minimize chat"}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                </button>
              )}

              <Link
                href={`/chat?agentId=${activeAgent?.id || ""}${
                  currentSessionId ? `&sessionId=${currentSessionId}` : ""
                }`}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-primary hover:bg-[#e6f3fe] transition border border-primary/20"
                title="Open in full screen Chat Workspace"
              >
                <span>Full Screen</span>
                <ExternalLink className="w-3 h-3" />
              </Link>

              <button
                type="button"
                onClick={onCloseChat}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                title="Close chat (will remain open until you close it)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Chat Messages Body */}
              <div
                ref={chatScrollRef}
                className={`p-4 sm:p-5 space-y-4 overflow-y-auto scrollbar-thin ${
                  isFloating ? "max-h-[380px]" : "max-h-[440px]"
                }`}
              >
            {chatMessages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                >
                  {!isUser && (
                    <span className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-xs">
                      {msg.agentAvatar || activeAgent?.avatar || "🤖"}
                    </span>
                  )}

                  <div className={`space-y-1.5 ${isUser ? "max-w-[80%]" : "max-w-[90%] w-full"}`}>
                    {!isUser && (
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground">
                            {msg.agentName || activeAgent?.displayName || "Specialist"}
                          </span>
                          {msg.actionExecuted === "execute_kanban" && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                              <span>⚡</span>
                              <span>Task Executed</span>
                            </span>
                          )}
                          {msg.actionExecuted === "assign_task" && (
                            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                              <span>📋</span>
                              <span>Task Delegated</span>
                            </span>
                          )}
                          {msg.actionExecuted === "approve_task" && (
                            <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 inline-flex items-center gap-1">
                              <span>✅</span>
                              <span>Approved</span>
                            </span>
                          )}
                          {msg.actionExecuted === "direct_task" && (
                            <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20 inline-flex items-center gap-1">
                              <span>🚀</span>
                              <span>Autonomous Work</span>
                            </span>
                          )}
                          {msg.actionExecuted === "search_web" && (
                            <span className="text-[10px] font-semibold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 inline-flex items-center gap-1">
                              <span>🌐</span>
                              <span>Web Search</span>
                            </span>
                          )}
                          {msg.actionExecuted === "execute_code" && (
                            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                              <span>💻</span>
                              <span>Code Executed</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-mono opacity-70">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    )}

                    <div
                      className={`rounded-2xl p-4 text-xs sm:text-[13px] leading-relaxed relative group shadow-xs ${
                        isUser
                          ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                          : "bg-secondary/40 border border-border text-foreground"
                      }`}
                    >
                      {!isUser ? (
                        <div className="prose prose-xs dark:prose-invert max-w-none">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}

                      {!isUser && (
                        <div className="mt-3 pt-2.5 border-t border-border/80 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground font-mono">
                          <div className="flex items-center gap-1.5">
                            {msg.latency && <span>{msg.latency}ms</span>}
                            {msg.latency && <span>•</span>}
                            <span>{msg.model || "auto"}</span>
                          </div>

                          <div className="flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleCopyChat(msg.id, msg.content)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                              title="Copy response text"
                            >
                              {copiedMessageId === msg.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400 font-semibold font-sans">
                                    Copied
                                  </span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span className="font-sans">Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const snippetTitle =
                                  msg.content
                                    .split("\n")[0]
                                    .replace(/^#*\s*/, "")
                                    .slice(0, 60) || "Agent Deliverable";
                                onSendToKanban(snippetTitle, msg.content);
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border border-border font-semibold font-sans transition cursor-pointer"
                              title="Send this deliverable as a Kanban task"
                            >
                              <Columns3 className="w-3 h-3" />
                              <span>Send to Kanban</span>
                            </button>

                            {(msg.actionExecuted === "execute_kanban" || msg.actionExecuted === "assign_task") && (
                              <Link
                                href="/kanban"
                                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold font-sans hover:bg-primary/90 transition cursor-pointer"
                              >
                                <Columns3 className="w-3 h-3" />
                                <span>Open Kanban</span>
                              </Link>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Generating Response Skeleton */}
            {isChatSending && (
              <div className="flex gap-3 items-center pl-1 text-xs text-muted-foreground">
                <span className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center text-sm shrink-0 shadow-xs animate-pulse">
                  {activeAgent?.avatar || "🤖"}
                </span>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-secondary/40 border border-border">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span className="font-medium text-foreground">
                    {activeAgent?.displayName || "Specialist"} is synthesizing response...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Follow-up input form */}
          <form onSubmit={onFollowUpSubmit} className="flex items-center gap-2 p-3 bg-secondary/15">
            <input
              type="text"
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              placeholder={`Reply to ${activeAgent?.displayName || "agent"}... (Press Enter)`}
              disabled={isChatSending}
              className="flex-1 bg-secondary/50 border border-border px-3.5 py-2 rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition"
            />

            {followUpInput.trim() && (
              <button
                type="button"
                onClick={() => {
                  onSendToKanban(followUpInput);
                  setFollowUpInput("");
                }}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer"
                title="Send follow-up as a task to Kanban"
              >
                <Columns3 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">To Kanban</span>
              </button>
            )}

            <button
              type="submit"
              disabled={!followUpInput.trim() || isChatSending}
              className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition cursor-pointer shrink-0 shadow-xs"
              title="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
