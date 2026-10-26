"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Zap,
  Clock,
  DollarSign,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  BarChart3,
  Layers,
  Sparkles,
  Bot,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";

interface AnalyticsData {
  totalMessages: number;
  totalTokens: number;
  avgLatencyMs: number;
  estimatedCostUsd: number;
  tasks: {
    backlog: number;
    in_progress: number;
    review: number;
    done: number;
    total: number;
  };
  topModels: Array<{
    name: string;
    count: number;
    tokens: number;
    avgLatency: number;
  }>;
  activityLogsCount: number;
}

export function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = useCallback(async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const res = await fetch("/api/analytics");
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.metrics) {
          setData(json.metrics);
          if (showToast) toast.success("Analytics metrics refreshed");
        }
      }
    } catch (err) {
      console.warn("Failed to fetch analytics:", err);
      if (showToast) toast.error("Failed to refresh analytics");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-muted-foreground space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-xs">Computing real-time workspace metrics & telemetry...</p>
      </div>
    );
  }

  const completionRate =
    data && data.tasks.total > 0
      ? Math.round((data.tasks.done / data.tasks.total) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* ─── TOP KPI SUMMARY CARDS ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens Card */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Tokens</span>
            <span className="p-2 rounded-xl bg-primary/10 text-primary">
              <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {data?.totalTokens.toLocaleString() || "0"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">tokens</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Processed across {data?.totalMessages || 0} agent turns
          </p>
        </div>

        {/* Estimated Cost Card */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Estimated Cost</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              ${data?.estimatedCostUsd.toFixed(4) || "0.0000"}
            </span>
            <span className="text-xs text-emerald-500 font-bold">USD</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Based on active provider pricing tiers
          </p>
        </div>

        {/* Avg Latency Card */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Avg Latency</span>
            <span className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {data?.avgLatencyMs || 0}
            </span>
            <span className="text-xs text-muted-foreground font-mono">ms</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Mean response time across active LLM routers
          </p>
        </div>

        {/* Task Velocity Card */}
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Task Completion</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-500">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">{completionRate}%</span>
            <span className="text-xs text-muted-foreground font-mono">
              ({data?.tasks.done || 0}/{data?.tasks.total || 0})
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {data?.tasks.in_progress || 0} in progress • {data?.tasks.review || 0} in review
          </p>
        </div>
      </div>

      {/* ─── MODEL DISTRIBUTION & TELEMETRY ─── */}
      <div className="p-5 rounded-2xl bg-card border border-border shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              <span>Model Routing Telemetry & Consumption</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              Active models invoked by the Omniroute Primary Brain and cascading fallback gateway.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {data?.topModels && data.topModels.length > 0 ? (
          <div className="space-y-3 pt-2">
            {data.topModels.map((m) => {
              const maxTokens = Math.max(...data.topModels.map((x) => x.tokens), 1);
              const percentage = Math.round((m.tokens / maxTokens) * 100);

              return (
                <div
                  key={m.name}
                  className="p-3 rounded-xl bg-secondary/30 border border-border/70 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 font-mono font-bold text-[11px]">
                        {m.name}
                      </span>
                      <span className="text-muted-foreground font-mono text-[11px]">
                        {m.count} request{m.count === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono">
                      <span className="text-foreground font-semibold">
                        {m.tokens.toLocaleString()} tokens
                      </span>
                      {m.avgLatency > 0 && (
                        <span className="text-cyan-500 font-bold">
                          {formatResponseTime(m.avgLatency)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Visual Consumption Bar */}
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No model consumption records found yet. Run an agent or chat turn to view telemetry.
          </div>
        )}
      </div>

      {/* ─── KANBAN WORKFLOW VELOCITY SUMMARY ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground">Backlog</span>
          <p className="text-xl font-black text-foreground">{data?.tasks.backlog || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-amber-500">In Progress</span>
          <p className="text-xl font-black text-foreground">{data?.tasks.in_progress || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-cyan-500">Review</span>
          <p className="text-xl font-black text-foreground">{data?.tasks.review || 0}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-secondary/20 border border-border text-center space-y-1">
          <span className="text-[10px] uppercase font-bold text-emerald-500">Completed</span>
          <p className="text-xl font-black text-emerald-500">{data?.tasks.done || 0}</p>
        </div>
      </div>
    </div>
  );
}
