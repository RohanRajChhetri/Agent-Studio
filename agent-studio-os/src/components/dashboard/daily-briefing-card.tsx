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
  BookOpen,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

interface BriefingData {
  exists: boolean;
  date: string;
  path?: string;
  content?: string;
}

export function DailyBriefingCard() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

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

  useEffect(() => {
    fetchBriefing();
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
        });
        setIsExpanded(true);
        toast.success("Executive Morning Briefing generated & saved to Obsidian Vault!");
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

    // Clean markdown symbols for natural reading
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
    setIsSendingTelegram(true);
    try {
      const res = await fetch("/api/integrations/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `🌅 *Agent Studio OS — Daily Briefing*\n\n${briefing.content.slice(0, 3000)}`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Briefing dispatched to Telegram!");
      } else {
        toast.info("Telegram not configured yet. Configure bot in Settings → Webhooks.");
      }
    } catch {
      toast.error("Failed to send to Telegram");
    } finally {
      setIsSendingTelegram(false);
    }
  };

  if (loading) return null;

  const todayStr = new Date().toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="w-full rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-card to-card p-4 sm:p-5 shadow-xs transition-all">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Title and Badge */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-foreground">
                Daily Executive Briefing
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold border border-amber-500/20">
                {todayStr}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {briefing?.exists
                ? "Synthesized from your active Kanban tasks, completed wins & agent fleet readiness"
                : "Kickstart your day with an automated proactive synthesis of tasks & priorities"}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
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
                className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="Send briefing to your Telegram"
              >
                {isSendingTelegram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-sky-500" />}
                <span className="hidden sm:inline">Telegram</span>
              </button>

              <button
                onClick={handleGenerate}
                disabled={generating}
                className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="Regenerate today's briefing"
              >
                <RefreshCw className={`w-4 h-4 ${generating ? "animate-spin text-primary" : "text-muted-foreground"}`} />
                <span className="hidden sm:inline">Regenerate</span>
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
                  <span>Synthesizing Day...</span>
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

            <div className="flex items-center justify-between text-xs text-muted-foreground mt-3 px-1">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Synced to Obsidian Vault: <code className="font-mono text-[11px] text-foreground">{briefing.path}</code>
              </span>
              <a
                href="/memory"
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <span>Open in 3D Galaxy</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
