"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare, Users, ArrowRight } from "lucide-react";

export interface ConferenceEvent {
  id: string;
  type: "delegation" | "execution" | "synthesis" | "speaking" | "complete" | "thinking" | "error" | "phase";
  fromAgent: string;
  fromAvatar: string;
  toAgent?: string;
  toAvatar?: string;
  message: string;
  timestamp: string;
}

export interface ConferenceLiveStreamProps {
  events: ConferenceEvent[];
  isExecuting: boolean;
  showTranscript: boolean;
  streamRef: React.RefObject<HTMLDivElement | null>;
  onToggleTranscript: () => void;
}

export const getEventColor = (t: string) =>
  ({
    delegation: "border-l-amber-500 bg-amber-500/5",
    execution: "border-l-blue-500 bg-blue-500/5",
    synthesis: "border-l-purple-500 bg-purple-500/5",
    speaking: "border-l-primary bg-primary/5",
    complete: "border-l-emerald-500 bg-emerald-500/5",
    thinking: "border-l-slate-500 bg-slate-500/5",
    error: "border-l-red-500 bg-red-500/5",
    phase: "border-l-violet-500 bg-violet-500/5",
  }[t] || "border-l-border");

export const getEventIcon = (t: string) =>
  ({
    delegation: "📤",
    execution: "⚡",
    synthesis: "🧠",
    speaking: "💬",
    complete: "✅",
    thinking: "🤔",
    error: "❌",
    phase: "🔷",
  }[t] || "•");

export function ConferenceLiveStream({
  events,
  isExecuting,
  showTranscript,
  streamRef,
  onToggleTranscript,
}: ConferenceLiveStreamProps) {
  return (
    <div className="notion-card p-5 flex flex-col min-h-0 border border-border/80 shadow-sm">
      <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span>Live Deliberation Stream</span>
          {events.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border font-mono">
              {events.length} events
            </span>
          )}
        </h3>
        {events.length > 0 && (
          <button
            type="button"
            onClick={onToggleTranscript}
            className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition cursor-pointer ${
              showTranscript
                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                : "border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            {showTranscript ? "Rich Stream" : "Raw Log"}
          </button>
        )}
      </div>

      <div
        ref={streamRef}
        className="flex-1 space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin pr-1"
      >
        {events.length === 0 && !isExecuting && (
          <div className="text-center py-20 text-muted-foreground">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center">
              <Users className="w-6 h-6 opacity-30 text-primary" />
            </div>
            <p className="text-xs font-medium text-foreground">A2A Council Chamber Ready</p>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
              Launch a mission above to watch council members delegate, execute, and deliberate in real time.
            </p>
          </div>
        )}

        {showTranscript ? (
          <div className="space-y-1 font-mono text-[11px] p-2 bg-secondary/30 rounded-lg border border-border">
            {events.map((evt, i) => (
              <div
                key={evt.id}
                className="flex gap-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded px-1 transition"
              >
                <span className="w-5 text-right shrink-0 opacity-40">{i + 1}</span>
                <span className="w-16 shrink-0 font-medium">
                  {new Date(evt.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span
                  className={`w-18 shrink-0 uppercase font-bold text-[10px] ${
                    evt.type === "complete"
                      ? "text-emerald-500"
                      : evt.type === "delegation"
                      ? "text-amber-500"
                      : evt.type === "execution"
                      ? "text-blue-500"
                      : evt.type === "synthesis"
                      ? "text-purple-500"
                      : ""
                  }`}
                >
                  {evt.type}
                </span>
                <span className="text-foreground shrink-0 font-semibold">{evt.fromAgent}</span>
                {evt.toAgent && (
                  <>
                    <span>→</span>
                    <span className="text-foreground font-semibold">{evt.toAgent}</span>
                  </>
                )}
                <span className="truncate opacity-75">{evt.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {events.map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex gap-2.5 p-2.5 rounded-xl border-l-2 ${getEventColor(evt.type)}`}
              >
                <span className="text-sm shrink-0 mt-0.5">{getEventIcon(evt.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <span>{evt.fromAvatar}</span>
                    <span className="font-bold text-foreground">{evt.fromAgent}</span>
                    {evt.toAgent && (
                      <>
                        <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        <span>{evt.toAvatar}</span>
                        <span className="font-bold text-foreground">{evt.toAgent}</span>
                      </>
                    )}
                    <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {evt.message}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
