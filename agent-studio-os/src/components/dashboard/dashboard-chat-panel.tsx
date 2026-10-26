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
  RotateCcw,
  Monitor,
  Eye,
  Zap,
  Kanban,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import { AgentDesktopModal } from "./agent-desktop-modal";
import type { DashboardAttachment } from "@/context/dashboard-chat-context";
export type { DashboardAttachment };

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
  attachments?: DashboardAttachment[];
}

interface DashboardChatPanelProps {
  isChatActive: boolean;
  activeAgent?: AgentProfile;
  currentSessionId?: string | null;
  chatMessages: DashboardChatMessage[];
  isChatSending: boolean;
  followUpInput?: string;
  setFollowUpInput?: (val: string) => void;
  onFollowUpSubmit?: (e: React.FormEvent) => void;
  onCloseChat: () => void;
  onClearChat?: () => void;
  onSendToKanban: (title?: string, desc?: string) => void;
  isFloating?: boolean;
}

export function DashboardChatPanel({
  isChatActive,
  activeAgent,
  currentSessionId,
  chatMessages,
  isChatSending,
  followUpInput = "",
  setFollowUpInput,
  onFollowUpSubmit,
  onCloseChat,
  onClearChat,
  onSendToKanban,
  isFloating = false,
}: DashboardChatPanelProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDesktopModalOpen, setIsDesktopModalOpen] = useState(false);
  const [desktopModalScreenshot, setDesktopModalScreenshot] = useState<string | null>(null);
  const [desktopModalActionTitle, setDesktopModalActionTitle] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const handleOpenDesktopViewer = (msg?: DashboardChatMessage) => {
    const screenshot =
      msg?.metadata?.screenshotUrl ||
      (msg?.metadata?.screenshotBase64
        ? `data:image/png;base64,${msg.metadata.screenshotBase64}`
        : null);

    const title = msg?.metadata?.target
      ? `Desktop Action: ${msg.metadata.target}`
      : msg?.content
      ? msg.content.split("\n")[0].replace(/^#*\s*/, "").replace(/[*]/g, "").trim()
      : "Agent Desktop Session";

    setDesktopModalScreenshot(screenshot);
    setDesktopModalActionTitle(title);
    setIsDesktopModalOpen(true);
  };

  // Auto-scroll to bottom of chat when new messages arrive
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatSending]);

  // Auto-open Desktop HUD once when agent runs a new desktop action
  const autoOpenedDesktopMsgIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (
        lastMsg.role === "assistant" &&
        lastMsg.id &&
        lastMsg.id !== autoOpenedDesktopMsgIdRef.current
      ) {
        const isDesktop =
          lastMsg.metadata?.actionType === "desktop_action" ||
          lastMsg.metadata?.hasScreenshot ||
          lastMsg.content.includes("**Desktop") ||
          lastMsg.content.includes("Desktop Action") ||
          lastMsg.content.includes("Desktop Automation") ||
          lastMsg.content.includes("Autonomous Task");
        if (isDesktop) {
          autoOpenedDesktopMsgIdRef.current = lastMsg.id;
          handleOpenDesktopViewer(lastMsg);
        }
      }
    }
  }, [chatMessages]);

  const handleCopyChat = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  return (
    <>
      <AnimatePresence>
        {isChatActive && (
        <motion.div
          initial={{ opacity: 0, y: isFloating ? 20 : 6, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: isFloating ? 20 : 6, scale: 0.99 }}
          transition={{ duration: 0.2 }}
          className={
            isFloating
              ? "fixed bottom-5 right-5 z-50 w-[95vw] sm:w-[460px] rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur-xl overflow-hidden transition-all divide-y divide-border"
              : "w-full flex-1 min-h-0 flex flex-col rounded-2xl border border-border/70 bg-card/50 backdrop-blur-sm overflow-hidden transition-all shadow-xs divide-y divide-border/60"
          }
        >
          {/* Minimalist Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-secondary/20 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-lg bg-secondary border border-border/80 flex items-center justify-center text-primary shrink-0 shadow-xs">
                <AgentAvatar avatar={activeAgent?.avatar} className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex items-center gap-2">
                <p className="text-xs font-semibold text-foreground truncate">
                  {activeAgent?.displayName || "Specialist"}
                </p>
                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground font-medium shrink-0 border border-border/50">
                  {activeAgent?.role || "Specialist"}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Active session" />
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {/* Live Desktop View Button */}
              <button
                type="button"
                onClick={() => handleOpenDesktopViewer()}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer flex items-center gap-1 text-xs"
                title="View live agent desktop"
              >
                <Monitor className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline text-[11px] font-medium">Desktop</span>
              </button>

              {/* Clear chat button */}
              {onClearChat && !isFloating && (
                <button
                  type="button"
                  onClick={onClearChat}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer text-xs flex items-center gap-1"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline text-[11px]">Clear</span>
                </button>
              )}

              {isFloating && (
                <button
                  type="button"
                  onClick={() => setIsMinimized((prev) => !prev)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer"
                  title={isMinimized ? "Expand chat" : "Minimize chat"}
                >
                  {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                </button>
              )}

              <Link
                href={`/chat?agentId=${activeAgent?.id || ""}${
                  currentSessionId ? `&sessionId=${currentSessionId}` : ""
                }`}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer flex items-center gap-1"
                title="Open in full screen workspace"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>

              <button
                type="button"
                onClick={onCloseChat}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition cursor-pointer"
                title="Close chat thread"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Chat Messages Stream */}
              <div
                ref={chatScrollRef}
                className={`p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 ${
                  isFloating ? "max-h-[380px]" : "min-h-[160px] max-h-[calc(100vh-270px)]"
                }`}
              >
                {chatMessages.length === 0 && (
                  <div className="text-center py-12 text-xs text-muted-foreground space-y-2 my-auto">
                    <span className="w-9 h-9 rounded-xl bg-secondary border border-border/80 flex items-center justify-center text-primary mx-auto shadow-xs">
                      <AgentAvatar avatar={activeAgent?.avatar} className="w-5 h-5" />
                    </span>
                    <p className="font-semibold text-foreground text-sm">
                      {activeAgent?.displayName || "Specialist"} is ready
                    </p>
                    <p className="text-muted-foreground text-xs max-w-xs mx-auto">
                      Type your prompt below and press Enter to start the conversation.
                    </p>
                  </div>
                )}

                {chatMessages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isDesktopAction =
                    !isUser &&
                    (msg.actionExecuted === "desktop_action" ||
                      msg.agentName === "Desktop Operator" ||
                      msg.content.includes("Desktop Action:") ||
                      msg.content.includes("Desktop Automation") ||
                      msg.content.includes("Desktop Screenshot") ||
                      msg.metadata?.actionType === "desktop_action" ||
                      Boolean(msg.metadata?.hasScreenshot));

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      {!isUser && (
                        <span className="w-7 h-7 rounded-lg bg-secondary border border-border/80 flex items-center justify-center text-primary shrink-0 mt-0.5 shadow-xs">
                          <AgentAvatar avatar={msg.agentAvatar || activeAgent?.avatar} className="w-4 h-4" />
                        </span>
                      )}

                      <div className={`space-y-1 ${isUser ? "max-w-[85%]" : "max-w-[92%] w-full"}`}>
                        {/* Header for assistant message */}
                        {!isUser && (
                          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-0.5 pb-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {msg.agentName || activeAgent?.displayName || "Specialist"}
                              </span>
                              {msg.actionExecuted === "execute_kanban" && (
                                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/20 inline-flex items-center gap-1">
                                  <Zap className="w-2.5 h-2.5" />
                                  <span>Task Executed</span>
                                </span>
                              )}
                              {msg.actionExecuted === "assign_task" && (
                                <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full border border-amber-500/20 inline-flex items-center gap-1">
                                  <Kanban className="w-2.5 h-2.5" />
                                  <span>Delegated</span>
                                </span>
                              )}
                              {isDesktopAction && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenDesktopViewer(msg)}
                                  className="text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-0.2 rounded-full border border-primary/25 flex items-center gap-1 transition cursor-pointer"
                                  title="View Agent Desktop"
                                >
                                  <Monitor className="w-2.5 h-2.5" />
                                  <span>Desktop Action</span>
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] font-mono opacity-60">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        )}

                        {/* Message content */}
                        <div
                          className={`rounded-lg text-xs sm:text-[13px] leading-relaxed relative group ${
                            isUser
                              ? "bg-primary text-primary-foreground font-medium rounded-br-xs px-3.5 py-2 shadow-2xs"
                              : "bg-card border border-border text-foreground p-3.5 sm:p-4 rounded-tl-xs"
                          }`}
                        >
                          {/* Attached files chips & visual image previews */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-col gap-2 mb-2">
                              {/* Inline preview cards for images */}
                              {msg.attachments.some((a) => a.type === "image" && a.content) && (
                                <div className="flex flex-wrap gap-2">
                                  {msg.attachments
                                    .filter((a) => a.type === "image" && a.content)
                                    .map((att) => (
                                      <div
                                        key={att.id}
                                        onClick={() => att.content && setPreviewImage({ url: att.content, name: att.name })}
                                        className="group relative rounded-lg overflow-hidden border border-border/80 max-w-[200px] cursor-pointer shadow-xs hover:border-primary/50 transition bg-black/10 dark:bg-black/40"
                                        title={`Click to preview ${att.name}`}
                                      >
                                        <img
                                          src={att.content}
                                          alt={att.name}
                                          className="max-h-36 object-contain rounded-lg transition group-hover:scale-105 duration-200"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-medium gap-1">
                                          <Eye className="w-3.5 h-3.5" />
                                          <span>View</span>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}

                              {/* Attachment Pills */}
                              <div className="flex flex-wrap gap-1.5">
                                {msg.attachments.map((att) => (
                                  <div
                                    key={att.id}
                                    onClick={() => {
                                      if (att.type === "image" && att.content) {
                                        setPreviewImage({ url: att.content, name: att.name });
                                      }
                                    }}
                                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium border ${
                                      isUser
                                        ? "bg-primary-foreground/15 border-primary-foreground/25 text-primary-foreground"
                                        : "bg-secondary/80 border-border/80 text-foreground"
                                    } ${att.type === "image" && att.content ? "cursor-pointer hover:opacity-90" : ""}`}
                                  >
                                    {att.type === "image" && att.content ? (
                                      <img src={att.content} alt={att.name} className="w-3.5 h-3.5 rounded object-cover" />
                                    ) : (
                                      <Paperclip className="w-3 h-3 opacity-70" />
                                    )}
                                    <span className="truncate max-w-[120px]">{att.name}</span>
                                    <span className="text-[10px] opacity-70 font-mono">
                                      ({(att.size / 1024).toFixed(0)}KB)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {!isUser ? (
                            <>
                              <div className="prose prose-xs dark:prose-invert max-w-none">
                                <MarkdownRenderer content={msg.content} />
                              </div>

                              {/* Dedicated Agent Desktop Action Callout */}
                              {isDesktopAction && (
                                <div className="mt-3 p-2.5 rounded-xl bg-background/60 border border-primary/25 flex items-center justify-between gap-3 shadow-2xs">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 shadow-2xs">
                                      <Monitor className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[11px] font-semibold text-foreground truncate">
                                        Agent Desktop Screen
                                      </p>
                                      <p className="text-[10px] text-muted-foreground truncate">
                                        {msg.metadata?.target ? `Target: ${msg.metadata.target}` : "View agent's live host display"}
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDesktopViewer(msg)}
                                    className="px-2.5 py-1 text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer active:scale-95"
                                    title="Show Agent Desktop"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Show Desktop</span>
                                  </button>
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="whitespace-pre-wrap">{msg.content}</div>
                          )}

                          {/* Subtle assistant message action footer */}
                          {!isUser && (
                            <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                              <div className="flex items-center gap-1.5 font-mono text-[10px] opacity-60">
                                {msg.latency && <span>{msg.latency}ms</span>}
                                {msg.latency && <span>•</span>}
                                <span>{msg.model || "auto"}</span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyChat(msg.id, msg.content)}
                                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  title="Copy response text"
                                >
                                  {copiedMessageId === msg.id ? (
                                    <>
                                      <Check className="w-3 h-3 text-emerald-500" />
                                      <span className="text-emerald-500 font-medium">Copied</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copy</span>
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
                                  className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50 font-medium transition cursor-pointer"
                                  title="Send deliverable to Kanban board"
                                >
                                  <Columns3 className="w-3 h-3" />
                                  <span>To Kanban</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Minimalist Loading / Thinking Indicator */}
                {isChatSending && (
                  <div className="flex gap-2.5 items-center text-xs text-muted-foreground pl-1 py-1">
                    <span className="w-7 h-7 rounded-lg bg-secondary border border-border/80 flex items-center justify-center text-primary shrink-0 shadow-xs">
                      <AgentAvatar avatar={activeAgent?.avatar} className="w-4 h-4" />
                    </span>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50">
                      <span className="inline-flex gap-1 items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                      </span>
                      <span className="text-xs text-foreground font-medium">
                        {activeAgent?.displayName || "Specialist"} is synthesizing...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating mode only: include self-contained input bar */}
              {isFloating && onFollowUpSubmit && setFollowUpInput && (
                <form onSubmit={onFollowUpSubmit} className="flex items-center gap-2 p-2.5 bg-secondary/10 border-t border-border">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={(e) => setFollowUpInput(e.target.value)}
                    placeholder={`Reply to ${activeAgent?.displayName || "agent"}...`}
                    disabled={isChatSending}
                    className="flex-1 bg-secondary/40 border border-border px-3 py-1.5 rounded-xl text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
                  />
                  <button
                    type="submit"
                    disabled={!followUpInput.trim() || isChatSending}
                    className="p-1.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>

    {/* Agent Desktop Live Modal */}
    <AgentDesktopModal
      isOpen={isDesktopModalOpen}
      onClose={() => setIsDesktopModalOpen(false)}
      initialScreenshotUrl={desktopModalScreenshot}
      actionTitle={desktopModalActionTitle}
    />

    {/* Full Screen Image Lightbox Modal */}
    {previewImage && (
      <div
        className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setPreviewImage(null)}
      >
        <div
          className="relative max-w-4xl max-h-[90vh] bg-card border border-border rounded-2xl shadow-2xl p-3 flex flex-col gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-2 px-1 border-b border-border/70">
            <span className="text-xs font-semibold text-foreground truncate max-w-md">
              {previewImage.name}
            </span>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 flex items-center justify-center min-h-[200px]">
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="max-h-[75vh] max-w-full object-contain rounded-xl shadow-md"
            />
          </div>
        </div>
      </div>
    )}
  </>
);
}
