"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sun,
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
  X,
  Eye,
  EyeOff,
  Bot,
  Share2,
  Copy,
  Mail,
  Zap,
  AlertCircle,
  FileText,
  LayoutDashboard,
  ArrowRight,
  Check,
  CheckSquare,
  Sparkles,
  TrendingUp,
  Link as LinkIcon,
  Play,
  Pause,
  Download,
  Printer,
  Search,
  Filter,
  CheckCheck,
  ArrowUpRight,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Activity,
  Clock,
  Info,
  Target,
  Layers,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import {
  playTaskCompletedSound,
  playClickSound,
  playTaskStartedSound,
} from "@/lib/sound-effects";

export interface KanbanStats {
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

export interface FleetStats {
  total: number;
  online: number;
  busy: number;
  idle: number;
  offline: number;
  agents: Array<{
    id: string;
    displayName: string;
    role: string;
    department: string;
    status: string;
    avatar: string;
  }>;
}

export interface RoutineStats {
  total: number;
  enabled: number;
  daily: number;
  items: Array<{
    id: string;
    title: string;
    type: string;
    time: string | null;
    enabled: boolean;
    agentName: string | null;
  }>;
}

export interface ComprehensiveTelemetry {
  kanban: KanbanStats;
  fleet: FleetStats;
  routines: RoutineStats;
  activity: {
    recentCount: number;
    items: Array<{
      id: string;
      type: string;
      message: string;
      createdAt: string;
    }>;
  };
}

interface BriefingData {
  exists: boolean;
  date: string;
  path?: string;
  content?: string;
  telemetry?: ComprehensiveTelemetry;
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
  const [viewMode, setViewMode] = useState<"dashboard" | "document">("dashboard");
  const [activeStage, setActiveStage] = useState<"all" | "review" | "in_progress" | "backlog">("all");
  
  // Search & Filter State for Interactive Task Matrix
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<"all" | "urgent" | "high">("all");

  // Interactive Live Approval State
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [isBatchApproving, setIsBatchApproving] = useState(false);

  // Interactive Audio State
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechSpeed, setSpeechSpeed] = useState<1.0 | 1.25 | 1.5>(1.0);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);
  const hasAutoTriggered = useRef(false);

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

  // Close share menu on click outside
  useEffect(() => {
    if (!showShareMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as Node)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  const handleGenerate = async (silentAuto: boolean = false) => {
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
          telemetry: data.telemetry,
          kanbanStats: data.kanbanStats || data.telemetry?.kanban,
          isOutOfSync: false,
        });
        if (!silentAuto) {
          setIsExpanded(true);
          toast.success("Executive Briefing synchronized!");
        }
      } else {
        if (!silentAuto) {
          toast.error(data.error || "Failed to generate briefing");
        }
      }
    } catch {
      if (!silentAuto) {
        toast.error("Network error generating briefing");
      }
    } finally {
      setGenerating(false);
    }
  };

  const fetchBriefing = async () => {
    try {
      const res = await fetch("/api/routines/briefing");
      if (res.ok) {
        const data = await res.json();
        setBriefing(data);

        // Auto-generation fallback: if briefing does not exist yet today, auto-trigger with skeleton
        if (!data.exists && !hasAutoTriggered.current) {
          hasAutoTriggered.current = true;
          handleGenerate(true);
        }
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
      .replace(/[#*`_>\[\]|]/g, " ")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 2000);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = speechSpeed;
    utterance.pitch = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  const cycleSpeechSpeed = () => {
    const nextSpeed = speechSpeed === 1.0 ? 1.25 : speechSpeed === 1.25 ? 1.5 : 1.0;
    setSpeechSpeed(nextSpeed);
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setTimeout(toggleSpeech, 100);
    }
  };

  // Interactive Live Sign-Off Action with Sound Effect
  const handleApproveTask = async (taskId: string, title: string) => {
    setApprovingIds((prev) => new Set(prev).add(taskId));
    try {
      const res = await fetch(`/api/tasks/${taskId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        playTaskCompletedSound();
        toast.success(`Signed off: "${title}" moved to Done!`);
        setApprovedIds((prev) => new Set(prev).add(taskId));

        // Live update briefing state
        setBriefing((prev) => {
          if (!prev) return prev;
          const currentKanban = prev.telemetry?.kanban || prev.kanbanStats;
          if (!currentKanban) return prev;
          const updatedTasks = currentKanban.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "done" } : t
          );
          const updatedStats: KanbanStats = {
            ...currentKanban,
            review: Math.max(0, currentKanban.review - 1),
            done: currentKanban.done + 1,
            tasks: updatedTasks,
          };
          return {
            ...prev,
            kanbanStats: updatedStats,
            telemetry: prev.telemetry
              ? { ...prev.telemetry, kanban: updatedStats }
              : undefined,
          };
        });
      } else {
        toast.error(data.error || "Failed to approve deliverable");
      }
    } catch {
      toast.error("Network error approving deliverable");
    } finally {
      setApprovingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // Batch Sign Off All Review Deliverables
  const handleApproveAllReviewTasks = async (pendingReviewTasks: Array<{ id: string; title: string }>) => {
    if (pendingReviewTasks.length === 0) return;
    setIsBatchApproving(true);
    const ids = pendingReviewTasks.map((t) => t.id);
    setApprovingIds(new Set(ids));
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/tasks/${id}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "approve" }),
          })
        )
      );
      playTaskCompletedSound();
      toast.success(`Executive Sign-Off complete! All ${ids.length} deliverables marked as Done.`);
      setApprovedIds((prev) => new Set([...prev, ...ids]));

      setBriefing((prev) => {
        if (!prev) return prev;
        const currentKanban = prev.telemetry?.kanban || prev.kanbanStats;
        if (!currentKanban) return prev;
        const updatedTasks = currentKanban.tasks.map((t) =>
          ids.includes(t.id) ? { ...t, status: "done" } : t
        );
        const updatedStats: KanbanStats = {
          ...currentKanban,
          review: 0,
          done: currentKanban.done + ids.length,
          tasks: updatedTasks,
        };
        return {
          ...prev,
          kanbanStats: updatedStats,
          telemetry: prev.telemetry
            ? { ...prev.telemetry, kanban: updatedStats }
            : undefined,
        };
      });
    } catch {
      toast.error("Error signing off all deliverables");
    } finally {
      setIsBatchApproving(false);
      setApprovingIds(new Set());
    }
  };

  // Start Task (Transition Backlog -> In Progress)
  const handleStartTask = async (taskId: string, title: string) => {
    playTaskStartedSound();
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "in_progress" }),
      });
      if (res.ok) {
        toast.success(`Initiative deployed: "${title}" is now In Progress!`);
        setBriefing((prev) => {
          if (!prev) return prev;
          const currentKanban = prev.telemetry?.kanban || prev.kanbanStats;
          if (!currentKanban) return prev;
          const updatedTasks = currentKanban.tasks.map((t) =>
            t.id === taskId ? { ...t, status: "in_progress" } : t
          );
          const updatedStats: KanbanStats = {
            ...currentKanban,
            backlog: Math.max(0, currentKanban.backlog - 1),
            inProgress: currentKanban.inProgress + 1,
            tasks: updatedTasks,
          };
          return {
            ...prev,
            kanbanStats: updatedStats,
            telemetry: prev.telemetry
              ? { ...prev.telemetry, kanban: updatedStats }
              : undefined,
          };
        });
      }
    } catch {
      toast.error("Failed to start task");
    }
  };

  // Bulletproof clipboard copy helper
  const copyTextFallback = (text: string): boolean => {
    try {
      const el = document.createElement("textarea");
      el.value = text;
      el.setAttribute("readonly", "");
      el.style.position = "fixed";
      el.style.left = "-9999px";
      el.style.top = "-9999px";
      document.body.appendChild(el);
      el.focus();
      el.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(el);
      return successful;
    } catch {
      return false;
    }
  };

  const handleCopyToClipboard = async () => {
    if (!briefing?.content) return;
    playClickSound();
    let copied = false;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(briefing.content);
        copied = true;
      }
    } catch {}
    if (!copied) {
      copied = copyTextFallback(briefing.content);
    }
    if (copied) {
      toast.success("Executive Briefing copied to clipboard!");
      setShowShareMenu(false);
    } else {
      toast.error("Could not copy automatically. Please select text manually.");
    }
  };

  const handleDownloadMarkdown = () => {
    if (!briefing?.content) return;
    playClickSound();
    try {
      const blob = new Blob([briefing.content], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Daily_Briefing_${briefing.date}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded Daily_Briefing_${briefing.date}.md`);
      setShowShareMenu(false);
    } catch {
      toast.error("Failed to download briefing file");
    }
  };

  const handleSystemShare = async () => {
    if (!briefing?.content) return;
    playClickSound();
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `Daily Executive Briefing — ${briefing.date}`,
          text: briefing.content.slice(0, 500) + "...",
          url: window.location.href,
        });
        setShowShareMenu(false);
        return;
      } catch (err: any) {
        if (err.name === "AbortError") {
          setShowShareMenu(false);
          return;
        }
      }
    }
    await handleCopyToClipboard();
  };

  const handlePrint = () => {
    playClickSound();
    setShowShareMenu(false);
    window.print();
  };

  const handleCopyLink = async () => {
    playClickSound();
    let copied = false;
    const url = window.location.origin;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        copied = true;
      }
    } catch {}
    if (!copied) {
      copied = copyTextFallback(url);
    }
    if (copied) {
      toast.success("Workspace link copied to clipboard!");
      setShowShareMenu(false);
    } else {
      toast.error("Failed to copy link");
    }
  };

  const handleSendToTelegram = async () => {
    if (!briefing?.content) return;
    setShowShareMenu(false);

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
        toast.success("Executive Briefing dispatched to Telegram!");
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

  const handleEmailBriefing = () => {
    if (!briefing?.content) return;
    const subject = encodeURIComponent(`Daily Executive Briefing — ${briefing.date}`);
    const body = encodeURIComponent(briefing.content);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    setShowShareMenu(false);
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
        toast.success(
          `Chat ID detected: ${data.chatId} (${data.username ? `@${data.username}` : data.firstName || "Telegram User"})`
        );
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
          toast.success("Briefing saved & dispatched to Telegram!");
          setShowTelegramModal(false);
        } else {
          toast.info("Telegram configured! Send /start to your bot on Telegram to receive briefings.");
          setShowTelegramModal(false);
        }
      } else {
        toast.success("Telegram configuration saved!");
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

  const kanban = briefing?.telemetry?.kanban || briefing?.kanbanStats;
  const fleet = briefing?.telemetry?.fleet;

  // Extract Review Gate tasks
  const reviewTasks = (kanban?.tasks || []).filter((t) => t.status === "review" && !approvedIds.has(t.id));
  const inProgressTasks = (kanban?.tasks || []).filter((t) => t.status === "in_progress");
  const backlogTasks = (kanban?.tasks || []).filter((t) => t.status === "backlog" || t.status === "todo");
  const doneTasks = (kanban?.tasks || []).filter((t) => t.status === "done" || approvedIds.has(t.id));

  // Filter tasks based on active interactive stage
  const displayedTasks = (kanban?.tasks || []).filter((t) => {
    if (activeStage === "review") return t.status === "review" && !approvedIds.has(t.id);
    if (activeStage === "in_progress") return t.status === "in_progress";
    if (activeStage === "backlog") return t.status === "backlog" || t.status === "todo";
    return true;
  });

  // Extract Strategic Directive text
  let directiveText = "";
  if (briefing?.content) {
    const match = briefing.content.match(/###?\s*1?\.?\s*(?:Executive Summary|Strategic Directive)[\s\S]*?\n+([\s\S]*?)(?=\n+---|\n+##|$)/i);
    if (match && match[1]) {
      directiveText = match[1].replace(/^[>\s*-]+/gm, "").trim();
    }
  }
  if (!directiveText) {
    if (kanban && kanban.review > 0) {
      directiveText = `Review Gate clearance is currently the primary operational priority. ${kanban.review} completed deliverables await executive sign-off to unblock downstream velocity for your ${fleet?.online || 26} online specialists.`;
    } else {
      directiveText = `Operational pipeline is flowing smoothly with ${kanban?.total || 0} active tickets tracked. All systems clear for execution.`;
    }
  }

  // Calculate percentage distribution
  const totalTasksCount = (kanban?.total || 0) || 1;
  const backlogPct = Math.round((backlogTasks.length / totalTasksCount) * 100);
  const reviewPct = Math.round((reviewTasks.length / totalTasksCount) * 100);
  const donePct = Math.round((doneTasks.length / totalTasksCount) * 100);
  const inProgressPct = Math.round((inProgressTasks.length / totalTasksCount) * 100);

  return (
    <>
      {/* Root Card Container with explicit relative z-30 positioning so dropdown is never clipped */}
      <div className="w-full rounded-2xl border border-border bg-card px-3.5 py-2.5 transition-all shadow-xs relative z-30">
        {/* Top Header Row — STRICT SINGLE LAYER (No overflow-hidden, no wrapping) */}
        <div className="flex items-center justify-between gap-2.5 sm:gap-4 flex-nowrap relative">
          {/* Left: Old Sun Icon, Title, Date Badge, and Tasks Badge ONLY */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            {/* Old Sun Icon */}
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
              <Sun className="w-3.5 h-3.5" />
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <h3 className="text-xs sm:text-sm font-bold text-foreground tracking-tight whitespace-nowrap">
                Daily Briefing
              </h3>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-semibold border border-border/80 whitespace-nowrap">
                {todayStr}
              </span>
            </div>

            {/* Tasks Badge ONLY (Strictly no specialists badge) */}
            {kanban && (
              <div
                title={`${kanban.total} Tasks tracked: ${kanban.review} awaiting review, ${kanban.inProgress} in progress, ${kanban.backlog} backlog`}
                className={`text-[10.5px] font-mono px-2 py-0.5 rounded border flex items-center gap-1.5 font-medium whitespace-nowrap shrink-0 ${
                  kanban.review > 0
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                    : "bg-secondary text-foreground border-border"
                }`}
              >
                <Columns3 className="w-3 h-3 text-muted-foreground" />
                <span>{kanban.total} Tasks</span>
                {kanban.review > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-500/25 text-amber-800 dark:text-amber-200 font-bold text-[9.5px]">
                    {kanban.review} Review
                  </span>
                )}
              </div>
            )}

          </div>

          {/* Right: Actions Row */}
          <div className="flex items-center gap-1.5 shrink-0">
            {briefing?.exists ? (
              <>
                {/* Working Share Dropdown (Multi-Channel Export, NO TTS) */}
                <div className="relative" ref={shareMenuRef}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowShareMenu((prev) => !prev);
                    }}
                    className="p-1.5 px-2.5 rounded-lg border border-border bg-secondary hover:bg-muted-highlight text-foreground text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                    title="Share or export briefing"
                  >
                    <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="hidden sm:inline">Share</span>
                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                  </button>

                  <AnimatePresence>
                    {showShareMenu && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 6 }}
                        transition={{ duration: 0.12 }}
                        className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-border bg-popover/95 backdrop-blur-md p-1.5 shadow-2xl z-50 space-y-0.5"
                      >
                        {/* 1. Copy Clean Markdown */}
                        <button
                          onClick={handleCopyToClipboard}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer"
                        >
                          <Copy className="w-4 h-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">Copy Markdown</p>
                            <p className="text-[10px] text-muted-foreground truncate">Clipboard with fallback</p>
                          </div>
                        </button>

                        {/* 2. Download Markdown File */}
                        <button
                          onClick={handleDownloadMarkdown}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer"
                        >
                          <Download className="w-4 h-4 text-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">Download .md File</p>
                            <p className="text-[10px] text-muted-foreground truncate">Save directly to disk</p>
                          </div>
                        </button>

                        {/* 3. System Share (if supported) */}
                        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                          <button
                            onClick={handleSystemShare}
                            className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer"
                          >
                            <Share2 className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">Device Share...</p>
                              <p className="text-[10px] text-muted-foreground truncate">Native share sheet</p>
                            </div>
                          </button>
                        )}

                        {/* 4. Telegram Dispatch */}
                        <button
                          onClick={handleSendToTelegram}
                          disabled={isSendingTelegram}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer disabled:opacity-50"
                        >
                          {isSendingTelegram ? (
                            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                          ) : (
                            <Send className="w-4 h-4 text-sky-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">Send to Telegram</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {telegramStatus?.configured ? `@${telegramStatus.botUsername || "Bot"}` : "Configure bot"}
                            </p>
                          </div>
                        </button>


                        {/* 6. Share via Email */}
                        <button
                          onClick={handleEmailBriefing}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer"
                        >
                          <Mail className="w-4 h-4 text-amber-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">Share via Email</p>
                            <p className="text-[10px] text-muted-foreground truncate">Launch mail client</p>
                          </div>
                        </button>

                        {/* 7. Copy Link */}
                        <button
                          onClick={handleCopyLink}
                          className="w-full flex items-center gap-2.5 px-2.5 py-2 text-xs rounded-lg hover:bg-secondary text-foreground text-left transition cursor-pointer"
                        >
                          <LinkIcon className="w-4 h-4 text-rose-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">Copy Link</p>
                            <p className="text-[10px] text-muted-foreground truncate">Workspace URL</p>
                          </div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Single Unified Sync / Refresh Button */}
                <button
                  onClick={() => handleGenerate()}
                  disabled={generating}
                  className={`p-1.5 px-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                    briefing?.isOutOfSync
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                      : "border-border bg-secondary hover:bg-muted-highlight text-foreground"
                  }`}
                  title={
                    briefing?.isOutOfSync
                      ? "Tasks updated since last briefing. Click to synchronize."
                      : "Resynthesize briefing with live workspace data"
                  }
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      generating
                        ? "animate-spin text-primary"
                        : briefing?.isOutOfSync
                        ? "text-amber-500"
                        : "text-muted-foreground"
                    }`}
                  />
                  <span className="hidden sm:inline">Sync</span>
                  {briefing?.isOutOfSync && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  )}
                </button>

                {/* Read / Collapse Toggle Button */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold shadow-xs transition cursor-pointer"
                >
                  <span>{isExpanded ? "Collapse" : "Read Briefing"}</span>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </>
            ) : (
              <button
                onClick={() => handleGenerate()}
                disabled={generating}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-primary hover:opacity-90 text-primary-foreground font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate Briefing</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Skeleton Loader during Generation */}
        <AnimatePresence>
          {generating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3 pt-3 border-t border-border/80 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  <span>Synthesizing Executive Intelligence Memorandum...</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">Grounding in database...</span>
              </div>

              {/* Shimmer Progress Track */}
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden relative">
                <motion.div
                  className="bg-primary h-full w-1/3 rounded-full"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              {/* Skeleton Mock Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                <div className="h-16 bg-secondary/60 rounded-xl animate-pulse" />
                <div className="h-16 bg-secondary/60 rounded-xl animate-pulse" />
                <div className="h-16 bg-secondary/60 rounded-xl animate-pulse" />
                <div className="h-16 bg-secondary/60 rounded-xl animate-pulse" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expanded Briefing Experience (Elite Interactive Cockpit & Executive Memo) */}
        <AnimatePresence>
          {isExpanded && briefing?.content && !generating && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-border/80 space-y-4"
            >
              {/* Executive Command Header */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 p-2.5 rounded-xl bg-secondary/40 border border-border/80">
                {/* Audio Narration Player */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={toggleSpeech}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSpeaking
                        ? "bg-amber-500 text-white shadow-xs"
                        : "bg-card border border-border text-foreground hover:bg-secondary"
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause Narration</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>Listen to Briefing</span>
                      </>
                    )}
                  </button>

                  {/* Dancing Audio Equalizer Animation */}
                  {isSpeaking && (
                    <div className="flex items-center gap-0.5 h-4 px-1.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                      <motion.span
                        animate={{ height: ["4px", "14px", "6px", "16px", "4px"] }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                        className="w-1 bg-amber-500 rounded-full"
                      />
                      <motion.span
                        animate={{ height: ["10px", "4px", "16px", "8px", "10px"] }}
                        transition={{ duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.1 }}
                        className="w-1 bg-amber-500 rounded-full"
                      />
                      <motion.span
                        animate={{ height: ["6px", "16px", "4px", "12px", "6px"] }}
                        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                        className="w-1 bg-amber-500 rounded-full"
                      />
                      <motion.span
                        animate={{ height: ["14px", "6px", "12px", "4px", "14px"] }}
                        transition={{ duration: 0.75, repeat: Infinity, ease: "easeInOut", delay: 0.15 }}
                        className="w-1 bg-amber-500 rounded-full"
                      />
                    </div>
                  )}

                  {/* Speed Toggle */}
                  <button
                    onClick={cycleSpeechSpeed}
                    className="text-[11px] font-mono px-2 py-1 rounded-md bg-card hover:bg-secondary border border-border text-foreground font-semibold cursor-pointer"
                    title="Change voice narration speed"
                  >
                    {speechSpeed}x
                  </button>
                </div>

                {/* View Switcher: Executive Overview vs Executive Memo */}
                <div className="flex items-center gap-1 p-0.5 bg-card rounded-lg border border-border">
                  <button
                    onClick={() => setViewMode("dashboard")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === "dashboard"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Executive Overview</span>
                  </button>
                  <button
                    onClick={() => setViewMode("document")}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      viewMode === "document"
                        ? "bg-primary text-primary-foreground shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Memorandum</span>
                  </button>
                </div>
              </div>

              {/* View 1: Minimal Executive Overview */}
              {viewMode === "dashboard" ? (
                <div className="space-y-3.5 max-h-[560px] overflow-y-auto pr-1">
                  {/* Chief of Staff Directive */}
                  <div className="p-3.5 rounded-xl border border-border/70 bg-card/40 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                      <span className="uppercase tracking-wider font-semibold">Chief of Staff Directive</span>
                      <span>{todayStr}</span>
                    </div>
                    <p className="text-xs text-foreground/90 leading-relaxed font-normal">
                      {directiveText}
                    </p>
                  </div>

                  {/* Minimal Workload Metric Strip */}
                  <div className="grid grid-cols-4 gap-2 p-2.5 rounded-xl bg-secondary/30 border border-border/50 text-center">
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Backlog</span>
                      <span className="text-base font-bold text-foreground mt-0.5 block">{backlogTasks.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">In Progress</span>
                      <span className="text-base font-bold text-foreground mt-0.5 block">{inProgressTasks.length}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Review</span>
                      <span className={`text-base font-bold mt-0.5 block ${reviewTasks.length > 0 ? "text-amber-500" : "text-foreground"}`}>
                        {reviewTasks.length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground block">Completed</span>
                      <span className="text-base font-bold text-emerald-500 mt-0.5 block">{doneTasks.length}</span>
                    </div>
                  </div>

                  {/* Review Gate Decision Deck (when tasks exist) or subtle status (when clean) */}
                  {reviewTasks.length > 0 ? (
                    <div className="p-3 rounded-xl border border-border/70 bg-card/40 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-foreground flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                          <span>Review Gate ({reviewTasks.length})</span>
                        </span>
                        {reviewTasks.length > 1 && (
                          <button
                            onClick={() => handleApproveAllReviewTasks(reviewTasks)}
                            disabled={isBatchApproving}
                            className="text-xs text-primary hover:underline font-medium cursor-pointer disabled:opacity-50"
                          >
                            Sign Off All
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-border/40">
                        {reviewTasks.map((task) => {
                          const isApproving = approvingIds.has(task.id);
                          const isApproved = approvedIds.has(task.id);
                          return (
                            <div key={task.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{task.title}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{task.agentName || "Specialist"}</p>
                              </div>
                              <button
                                onClick={() => handleApproveTask(task.id, task.title)}
                                disabled={isApproving || isApproved}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition shrink-0 cursor-pointer ${
                                  isApproved
                                    ? "bg-emerald-500 text-white border-emerald-500"
                                    : "bg-secondary hover:bg-secondary/80 text-foreground border-border"
                                }`}
                              >
                                {isApproved ? "Approved" : "Sign Off"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-secondary/20 border border-border/50 text-xs text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>Review gate is clear — zero pending approvals.</span>
                      </span>
                      <a href="/kanban" className="text-primary hover:underline font-medium">Kanban →</a>
                    </div>
                  )}

                  {/* Minimal Task Queue */}
                  <div className="p-3 rounded-xl border border-border/70 bg-card/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono uppercase tracking-wider font-semibold text-foreground">
                        Recent Tasks ({displayedTasks.length})
                      </span>
                      <div className="relative">
                        <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={taskSearchQuery}
                          onChange={(e) => setTaskSearchQuery(e.target.value)}
                          placeholder="Search..."
                          className="pl-6 pr-2 py-0.5 text-xs rounded-md bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary w-28 sm:w-36"
                        />
                      </div>
                    </div>

                    <div className="divide-y divide-border/40 max-h-[200px] overflow-y-auto pr-1">
                      {displayedTasks
                        .filter((t) => {
                          if (taskSearchQuery.trim()) {
                            const q = taskSearchQuery.toLowerCase();
                            return t.title.toLowerCase().includes(q) || (t.agentName || "").toLowerCase().includes(q);
                          }
                          return true;
                        })
                        .slice(0, 8)
                        .map((t) => {
                          const isApproved = approvedIds.has(t.id);
                          return (
                            <div key={t.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">{t.title}</p>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {t.status.replace("_", " ")} • {t.agentName || "Specialist"}
                                </span>
                              </div>
                              {t.status === "review" && !isApproved ? (
                                <button
                                  onClick={() => handleApproveTask(t.id, t.title)}
                                  className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500 hover:bg-amber-600 text-white transition shrink-0 cursor-pointer"
                                >
                                  Sign Off
                                </button>
                              ) : (t.status === "backlog" || t.status === "todo") ? (
                                <button
                                  onClick={() => handleStartTask(t.id, t.title)}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-secondary hover:bg-secondary/80 border border-border transition shrink-0 cursor-pointer"
                                >
                                  Start
                                </button>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                /* View 2: Minimal Executive Memorandum Viewer */
                <div className="rounded-xl border border-border bg-card p-4 sm:p-6 shadow-inner max-h-[540px] overflow-y-auto">
                  <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm">
                    <MarkdownRenderer content={briefing.content} />
                  </div>
                </div>
              )}

              {/* Bottom Sync Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground px-1 pt-1">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Obsidian Vault Synced:{" "}
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
                      Deliver daily executive briefings directly to your Telegram bot
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
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                      )}
                      <span>Auto-Detect</span>
                    </button>
                  </div>
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-1">
                    <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>
                      <strong>Tip:</strong> Open Telegram, search for your bot, send{" "}
                      <code className="bg-secondary px-1 py-0.5 rounded font-mono">/start</code>, and click{" "}
                      <strong>Auto-Detect</strong>!
                    </span>
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
