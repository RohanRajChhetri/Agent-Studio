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

  // Completed State: Sleek collapsed pill with expand option (Pure Monochrome)
  if (!state.isStreaming && state.phase === "completed") {
    return (
      <div className="my-2 select-none">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/10 bg-zinc-950/80 hover:bg-zinc-900 hover:border-white/20 text-zinc-300 hover:text-white text-[11px] font-medium transition-all shadow-xs cursor-pointer"
        >
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Brain className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
            <span className="font-semibold text-zinc-100">Thought for {elapsedSec}s</span>
          </div>

          <span className="text-zinc-700">|</span>

          <span className="text-[10px] text-zinc-400">
            {state.totalIterations || 3} iterations
          </span>

          {state.tokenCount > 0 && (
            <>
              <span className="text-zinc-700">|</span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {state.tokenCount} tokens
              </span>
            </>
          )}

          <ChevronDown
            className={`w-3 h-3 text-zinc-400 transition-transform duration-200 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </button>

        {isExpanded && (
          <div className="mt-2 p-3.5 rounded-2xl border border-white/10 bg-zinc-950/90 backdrop-blur-xl text-xs space-y-3 animate-in fade-in-50 duration-200">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-2 border-b border-white/10">
              <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Reasoning Loop Execution Trace
              </span>
              <span className="font-mono text-[10px] text-zinc-400">
                {state.model || "Autonomous Specialist"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Thinking Time</span>
                <span className="font-mono font-semibold text-zinc-100">{elapsedSec}s</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Tokens Generated</span>
                <span className="font-mono font-semibold text-zinc-100">{state.tokenCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Generation Speed</span>
                <span className="font-mono font-semibold text-zinc-100">{tokSpeed} tok/s</span>
              </div>
            </div>

            {state.thoughtText && (
              <div className="space-y-1">
                <span className="text-[10.5px] font-semibold text-zinc-400">Reasoning Internal Monologue</span>
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-white/5 font-mono text-[11px] text-zinc-300 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                  {state.thoughtText}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Active Live Streaming Readout (Monochrome OLED)
  return (
    <div className="my-2.5 rounded-2xl border border-white/15 bg-zinc-950/90 backdrop-blur-xl p-3.5 shadow-xl transition-all text-xs animate-in fade-in duration-200">
      {/* Top Telemetry Bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Pulsing Live Beacon */}
          <div className="relative flex items-center justify-center shrink-0">
            <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-white/20 opacity-75" />
            <div className="relative w-6 h-6 rounded-lg bg-zinc-900 border border-white/20 flex items-center justify-center text-white">
              <Brain className="w-3.5 h-3.5 animate-pulse" />
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold text-zinc-100 tracking-tight text-[11.5px]">
                Reasoning Loop
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-zinc-900 border border-white/10 text-zinc-300 font-mono font-bold">
                Iteration {state.iteration} / {state.totalIterations}
              </span>
              <span className="text-[11px] text-zinc-400 truncate hidden sm:inline">
                • {state.phaseLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Live Stopwatch */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 font-mono text-[11px] text-zinc-200 font-semibold">
            <Clock className="w-3 h-3 text-zinc-400 animate-spin" style={{ animationDuration: "3s" }} />
            <span>{elapsedSec}s</span>
          </div>

          {/* Live Receiving Stream Status */}
          <div className="hidden xs:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-900 border border-white/10 text-emerald-400 font-mono text-[10.5px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Streaming</span>
            {state.tokenCount > 0 && <span>({state.tokenCount} tok)</span>}
          </div>

          {/* Toggle details */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
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
      <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-white/10">
        {iterations.map((step) => (
          <div
            key={step.num}
            className={`p-2 rounded-xl border transition-all ${
              step.active
                ? "border-white/30 bg-zinc-900 text-white shadow-xs"
                : step.completed
                ? "border-white/10 bg-zinc-950 text-zinc-400"
                : "border-white/5 bg-transparent opacity-40"
            }`}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] font-mono font-semibold">
                Step {step.num}
              </span>
              {step.completed ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              ) : step.active ? (
                <Loader2 className="w-3 h-3 text-white animate-spin" />
              ) : (
                <div className="w-2.5 h-2.5 rounded-full border border-zinc-700" />
              )}
            </div>
            <div className="font-medium text-[11px] truncate text-zinc-200">
              {step.title}
            </div>
            <div className="text-[9.5px] text-zinc-500 truncate hidden md:block">
              {step.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Expanded Live Telemetry & Thoughts */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2.5 animate-in fade-in-50 duration-200">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>Receiving chunk stream via SSE</span>
            </span>
            <span className="font-mono text-[10px] text-zinc-300">
              {tokSpeed > 0 ? `${tokSpeed} tok/s` : "Receiving tokens..."}
            </span>
          </div>

          {state.thoughtText && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-semibold text-zinc-400">
                <span>Model Internal Thought Stream</span>
                <span className="text-[9.5px] font-mono font-normal text-zinc-500">Live</span>
              </div>
              <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 font-mono text-[11px] text-zinc-300 max-h-36 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                {state.thoughtText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
