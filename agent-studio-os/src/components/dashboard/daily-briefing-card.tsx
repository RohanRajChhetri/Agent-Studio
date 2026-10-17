"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
  Sparkles,
  Volume2,
  VolumeX,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle2,
  Loader2,
  Columns3,
  AlertCircle,
  X,
  Eye,
  EyeOff,
  Bot,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

interface KanbanStats {
  total: number;
  backlog: number;
  inProgress: number;
  review: number;
  done: number;
  highPriority: number;
  hasTasks: boolean;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    agentName: string | null;
  }>;
}

interface BriefingData {
  exists: boolean;
  date: string;
  path?: string;
  content?: string;
  kanbanStats?: KanbanStats;
  isOutOfSync?: boolean;
}

interface DailyBriefingCardProps {
  isChatActive?: boolean;
}

export function DailyBriefingCard({ isChatActive = false }: DailyBriefingCardProps) {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  // Telegram Setup Modal State
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [tgBotToken, setTgBotToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [isDetectingChatId, setIsDetectingChatId] = useState(false);
  const [isSavingTelegram, setIsSavingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{
    configured: boolean;
    hasToken: boolean;
    hasChatId: boolean;
    botUsername?: string;
  } | null>(null);

  const fetchBriefing = async () => {
    try {
      const res = await fetch("/api/routines/briefing");
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setLoading(false);
    }
  };

  const checkTelegramStatus = async () => {
    try {
      const res = await fetch("/api/integrations/telegram");
      if (res.ok) {
        const data = await res.json();
        setTelegramStatus({
          configured: data.configured,
          hasToken: data.hasToken,
          hasChatId: data.hasChatId,
          botUsername: data.config?.botUsername,
        });
        if (data.config?.botToken && !tgBotToken) {
          setTgBotToken(data.config.botToken);
        }
        if (data.config?.chatId && !tgChatId) {
          setTgChatId(data.config.chatId);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchBriefing();
    checkTelegramStatus();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/routines/briefing", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setBriefing({
          exists: true,
          date: data.date,
          path: data.path,
          content: data.content,
          kanbanStats: data.kanbanStats,
          isOutOfSync: false,
        });
        setIsExpanded(true);
        toast.success("Executive Briefing synchronized with your live Kanban board!");
      } else {
        toast.error(data.error || "Failed to generate briefing");
      }
    } catch {
      toast.error("Network error generating briefing");
    } finally {
      setGenerating(false);
    }
  };

  const toggleSpeech = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      toast.error("Text-to-speech is not supported in this browser");
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!briefing?.content) return;

    const cleanText = briefing.content
      .replace(/[#*`_>\[\]]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .slice(0, 1800);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const handleSendToTelegram = async () => {
    if (!briefing?.content) return;

    // If telegram isn't configured, open modal directly for quick setup
    if (!telegramStatus?.hasToken || !telegramStatus?.hasChatId) {
      setShowTelegramModal(true);
      return;
    }

    setIsSendingTelegram(true);
    try {
      const res = await fetch("/api/integrations/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_briefing",
          message: briefing.content,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("🌅 Daily Executive Briefing dispatched to your Telegram!");
      } else if (data.notConfigured) {
        setShowTelegramModal(true);
        toast.info(data.error || "Please configure your Telegram bot credentials.");
      } else {
        toast.error(data.error || "Failed to send to Telegram");
      }
    } catch {
      toast.error("Network error sending briefing to Telegram");
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const handleAutoDetectChatId = async () => {
    if (!tgBotToken.trim()) {
      toast.error("Please enter a Telegram Bot Token first");
      return;
    }

    setIsDetectingChatId(true);
    try {
      const res = await fetch("/api/integrations/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "auto_detect_chat_id",
          token: tgBotToken.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.chatId) {
        setTgChatId(data.chatId);
        toast.success(`Chat ID detected: ${data.chatId} (${data.username ? `@${data.username}` : data.firstName || "Telegram User"})`);
      } else {
        toast.error(data.error || "No recent messages found. Please send /start to your bot in Telegram first.");
      }
    } catch {
      toast.error("Failed to auto-detect chat ID");
    } finally {
      setIsDetectingChatId(false);
    }
  };

  const handleSaveAndSendTelegram = async () => {
    if (!tgBotToken.trim()) {
      toast.error("Please enter your Telegram Bot Token");
      return;
    }

    setIsSavingTelegram(true);
    try {
      // 1. Save Telegram configuration
      const saveRes = await fetch("/api/integrations/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_config",
          token: tgBotToken.trim(),
          chatId: tgChatId.trim() || undefined,
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok || !saveData.success) {
        toast.error(saveData.error || "Failed to validate Telegram bot token");
        return;
      }

      await checkTelegramStatus();

      // 2. Dispatch briefing if content exists
      if (briefing?.content) {
        const sendRes = await fetch("/api/integrations/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_briefing",
            token: tgBotToken.trim(),
            chatId: tgChatId.trim() || undefined,
            message: briefing.content,
          }),
        });
        const sendData = await sendRes.json();
        if (sendRes.ok && sendData.success) {
          toast.success("🌅 Briefing saved & successfully dispatched to Telegram!");
          setShowTelegramModal(false);
        } else {
          toast.info("Telegram configuration saved! Send /start to your bot on Telegram to receive briefings.");
          setShowTelegramModal(false);
        }
      } else {
        toast.success("Telegram configuration saved successfully!");
        setShowTelegramModal(false);
      }
    } catch {
      toast.error("Error saving Telegram configuration");
    } finally {
      setIsSavingTelegram(false);
    }
  };

  if (loading || isChatActive) return null;

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const kanban = briefing?.kanbanStats;

  return (
    <>
      <div className="w-full rounded-xl border border-border/70 bg-card/60 hover:bg-card/90 p-3 sm:p-3.5 transition-all shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title and Telemetry Badges */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Sun className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs sm:text-sm font-semibold text-foreground">
                  Daily Briefing
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium border border-border">
                  {todayStr}
                </span>

                {/* Real-time Kanban Board Telemetry Badge */}
                {kanban && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border flex items-center gap-1 font-medium ${
                      kanban.hasTasks
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    <Columns3 className="w-3 h-3" />
                    {kanban.hasTasks ? (
                      <span>{kanban.total} Tasks</span>
                    ) : (
                      <span>Clean Slate</span>
                    )}
                  </span>
                )}

                {/* Out of Sync Warning Pill */}
                {briefing?.isOutOfSync && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer flex items-center gap-1"
                    title="Kanban tasks have changed since this briefing was generated. Click to sync."
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${generating ? "animate-spin" : ""}`} />
                    <span>Sync</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5">
            {briefing?.exists ? (
              <>
                <button
                  onClick={toggleSpeech}
                  className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    isSpeaking
                      ? "bg-amber-500 text-white border-amber-600"
                      : "border-border bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                  title={isSpeaking ? "Pause audio narration" : "Listen to morning briefing (TTS)"}
                >
                  {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  <span className="hidden sm:inline">{isSpeaking ? "Pause" : "Listen"}</span>
                </button>

                <button
                  onClick={handleSendToTelegram}
                  disabled={isSendingTelegram}
                  className={`p-2 rounded-xl border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    telegramStatus?.hasToken && telegramStatus?.hasChatId
                      ? "border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400"
                      : "border-border bg-secondary hover:bg-secondary/80 text-foreground"
                  }`}
                  title={
                    telegramStatus?.hasToken && telegramStatus?.hasChatId
                      ? `Send briefing to Telegram (${telegramStatus.botUsername ? `@${telegramStatus.botUsername}` : "Connected"})`
                      : "Connect Telegram bot to receive daily executive briefings"
                  }
                >
                  {isSendingTelegram ? (
                    <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                  ) : (
                    <Send className="w-4 h-4 text-sky-500" />
                  )}
                  <span className="hidden sm:inline">
                    {telegramStatus?.hasToken && telegramStatus?.hasChatId ? "Telegram" : "Connect TG"}
                  </span>
                </button>

                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  title="Regenerate today's briefing with live Kanban data"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${generating ? "animate-spin text-primary" : "text-muted-foreground"}`}
                  />
                  <span className="hidden sm:inline">Sync</span>
                </button>

                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition cursor-pointer"
                >
                  <span>{isExpanded ? "Collapse" : "Read Briefing"}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Kanban & Workforce...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Morning Briefing</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Expanded Briefing Document Viewer */}
        <AnimatePresence>
          {isExpanded && briefing?.content && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden mt-4 pt-4 border-t border-border/80"
            >
              <div className="p-4 sm:p-6 rounded-xl bg-secondary/30 border border-border/70 max-h-[500px] overflow-y-auto">
                <MarkdownRenderer content={briefing.content} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mt-3 px-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Synced to Obsidian Vault:{" "}
                  <code className="font-mono text-[11px] text-foreground">{briefing.path}</code>
                </span>

                <div className="flex items-center gap-3">
                  <a
                    href="/kanban"
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <Columns3 className="w-3 h-3" />
                    <span>Open Kanban Board</span>
                  </a>
                  <span className="text-border">•</span>
                  <a
                    href="/memory"
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>Open in 3D Galaxy</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Telegram Setup & Quick Dispatch Modal */}
      <AnimatePresence>
        {showTelegramModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl space-y-4 relative"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center border border-sky-500/20">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Telegram Executive Dispatch
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Deliver daily executive briefings and critical updates directly to Telegram
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTelegramModal(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 pt-2">
                {/* Bot Token Input */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>1. Telegram Bot Token</span>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline flex items-center gap-0.5 text-[10px]"
                    >
                      <span>Create via @BotFather</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <div className="relative">
                    <input
                      type={showToken ? "text" : "password"}
                      value={tgBotToken}
                      onChange={(e) => setTgBotToken(e.target.value)}
                      placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Chat ID Input */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
                    <span>2. Telegram Chat ID</span>
                    <span className="text-[10px] text-muted-foreground">Personal ID or @channel</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tgChatId}
                      onChange={(e) => setTgChatId(e.target.value)}
                      placeholder="e.g. 123456789 or click Auto-Detect"
                      className="flex-1 px-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={handleAutoDetectChatId}
                      disabled={isDetectingChatId || !tgBotToken.trim()}
                      className="px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Send /start to your bot in Telegram first, then click here to automatically detect your Chat ID"
                    >
                      {isDetectingChatId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                      )}
                      <span>Auto-Detect</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    💡 Tip: Open Telegram, search for your bot, send <code className="bg-secondary px-1 py-0.5 rounded font-mono">/start</code>, and click <strong>Auto-Detect</strong>!
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowTelegramModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-secondary transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAndSendTelegram}
                  disabled={isSavingTelegram || !tgBotToken.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-md shadow-primary/20 transition cursor-pointer disabled:opacity-50"
                >
                  {isSavingTelegram ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving & Dispatching...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Save & Dispatch Briefing</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
