"use client";

import React, { useState, useEffect } from "react";
import {
  Brain,
  Sparkles,
  Cpu,
  Activity,
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Radio,
  Zap,
  Loader2,
  Layers,
} from "lucide-react";

export interface ReasoningState {
  isStreaming: boolean;
  elapsedMs: number;
  iteration: number;
  totalIterations: number;
  phase:
    | "init"
    | "context_grounding"
    | "reasoning_loop"
    | "streaming_tokens"
    | "tool_execution"
    | "completed";
  phaseLabel: string;
  tokenCount: number;
  tokensPerSec?: number;
  thoughtText?: string;
  model?: string;
}

interface ReasoningProgressIndicatorProps {
  state: ReasoningState;
  agentName?: string;
  defaultExpanded?: boolean;
}

export function ReasoningProgressIndicator({
  state,
  agentName,
  defaultExpanded = false,
}: ReasoningProgressIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Auto-expand when streaming starts if thought text arrives
  useEffect(() => {
    if (state.thoughtText && state.isStreaming) {
      setIsExpanded(true);
    }
  }, [state.thoughtText, state.isStreaming]);

  const elapsedSec = (state.elapsedMs / 1000).toFixed(1);
  const tokSpeed =
    state.tokensPerSec ??
    (state.elapsedMs > 500
      ? Math.round(state.tokenCount / (state.elapsedMs / 1000))
      : 0);

  const iterations = [
    {
      num: 1,
      title: "Context & Intent",
      desc: "Vault RAG & memory grounding",
      active: state.iteration === 1 && state.isStreaming,
      completed: state.iteration > 1 || !state.isStreaming,
    },
    {
      num: 2,
      title: "Reasoning Loop",
      desc: "Synthesizing logic & directives",
      active: state.iteration === 2 && state.isStreaming,
      completed: state.iteration > 2 || (!state.isStreaming && state.totalIterations <= 2),
    },
    {
      num: 3,
      title: "Receiving Stream",
      desc: "Live token stream generation",
      active:
        (state.iteration >= 3 || state.phase === "streaming_tokens") &&
        state.isStreaming,
      completed: !state.isStreaming,
    },
  ];

  // Completed State: Sleek collapsed pill with expand option
  if (!state.isStreaming && state.phase === "completed") {
    return (
      <div className="my-2 select-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border/80 bg-secondary/40 hover:bg-secondary/70 hover:border-border text-muted-foreground hover:text-foreground text-[11px] font-medium transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-primary">
            <Brain className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span className="font-semibold text-foreground">Thought for {elapsedSec}s</span>
          </div>

          <span className="text-border">|</span>

          <span className="text-[10px] text-muted-foreground">
            {state.totalIterations || 3} iterations
          </span>

          {state.tokenCount > 0 && (
            <>
              <span className="text-border">|</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {state.tokenCount} tokens
              </span>
            </>
          )}

          <ChevronDown
            className={`w-3 h-3 text-muted-foreground transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="mt-2 p-3 rounded-xl border border-border bg-card/80 backdrop-blur-md text-xs space-y-2.5 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pb-2 border-b border-border">
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                Reasoning Loop Execution Summary
              </span>
              <span className="font-mono text-[10px] text-primary">
                {state.model || "Autonomous Specialist"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Thinking Time</span>
                <span className="font-mono font-semibold text-foreground">{elapsedSec}s</span>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Tokens Generated</span>
                <span className="font-mono font-semibold text-foreground">{state.tokenCount}</span>
              </div>
              <div className="p-2 rounded-lg bg-secondary/50 border border-border/50">
                <span className="text-[10px] text-muted-foreground block">Average Speed</span>
                <span className="font-mono font-semibold text-foreground">{tokSpeed} tok/s</span>
              </div>
            </div>

            {state.thoughtText && (
              <div className="space-y-1">
                <span className="text-[10.5px] font-semibold text-muted-foreground">Reasoning Trace</span>
                <div className="p-2.5 rounded-lg bg-secondary/70 border border-border font-mono text-[11px] text-muted-foreground max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                  {state.thoughtText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Active Live Streaming Readout
  return (
    <div className="my-2.5 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-secondary/60 to-cyan-500/5 backdrop-blur-md p-3.5 shadow-md shadow-primary/5 transition-all text-xs animate-in fade-in duration-200">
      {/* Top Telemetry Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Pulsing Live Halo */}
          <div className="relative flex items-center justify-center shrink-0">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-primary/40 opacity-75" />
            <div className="relative w-6 h-6 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Brain className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-foreground tracking-tight text-[11.5px]">
                Reasoning Loop
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary font-mono font-bold">
                Iteration {state.iteration} / {state.totalIterations}
              </span>
              <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                • {state.phaseLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Stopwatch */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-secondary/80 border border-border font-mono text-[11px] text-foreground font-semibold">
            <Clock className="w-3 h-3 text-primary animate-spin" style={{ animationDuration: "3s" }} />
            <span>{elapsedSec}s</span>
          </div>

          {/* Live Receiving Stream Status */}
          <div className="hidden xs:flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono text-[10.5px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>Streaming</span>
            {state.tokenCount > 0 && <span>({state.tokenCount} tok)</span>}
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors cursor-pointer"
            title={isExpanded ? "Collapse telemetry" : "Expand telemetry"}
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isExpanded ? "rotate-180" : ""
              }`}
            />
          </button>
        </div>
      </div>

      {/* Progress Iteration Pipeline */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-border/50">
        {iterations.map((step) => (
          <div
            key={step.num}
            className={`p-2 rounded-lg border transition-all ${
              step.active
                ? "border-primary/40 bg-primary/10 shadow-xs"
                : step.completed
                ? "border-border/60 bg-secondary/40 text-muted-foreground"
                : "border-border/30 bg-transparent opacity-50"
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-mono font-semibold">
                Step {step.num}
              </span>
              {step.completed ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              ) : step.active ? (
                <Loader2 className="w-3 h-3 text-primary animate-spin" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full border border-border" />
              )}
            </div>
            <div className="font-medium text-[11px] truncate text-foreground">
              {step.title}
            </div>
            <div className="text-[9.5px] text-muted-foreground truncate hidden md:block">
              {step.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Live Telemetry & Thoughts */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-2.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span>Receiving chunk stream via SSE</span>
            </span>
            <span className="font-mono text-[10px]">
              {tokSpeed > 0 ? `${tokSpeed} tok/s` : "Receiving tokens..."}
            </span>
          </div>

          {state.thoughtText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-muted-foreground">
                <span>Model Internal Thought Stream</span>
                <span className="text-[9.5px] font-mono font-normal">Live</span>
              </div>
              <div className="p-2.5 rounded-lg bg-card/90 border border-primary/20 font-mono text-[11px] text-foreground/80 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap shadow-inner">
                {state.thoughtText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
