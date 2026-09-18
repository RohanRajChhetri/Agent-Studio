"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Radio,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";


interface TelemetryState {
  online: boolean;
  latency: number;
  modelCount: number;
  models: string[];
  lastChecked: Date | null;
}

export function OmnirouteTelemetry({ collapsed }: { collapsed: boolean }) {
  const [telemetry, setTelemetry] = useState<TelemetryState>({
    online: false,
    latency: 0,
    modelCount: 0,
    models: [],
    lastChecked: null,
  });
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const checkTelemetry = useCallback(async () => {
    setChecking(true);
    const start = Date.now();
    try {
      const res = await fetch("/api/models");
      const elapsed = Date.now() - start;
      if (res.ok) {
        const data = await res.json();
        const modelList = (data.data || []).map((m: any) => m.id);
        setTelemetry({
          online: data.online ?? true,
          latency: elapsed,
          modelCount: modelList.length,
          models: modelList.slice(0, 8),
          lastChecked: new Date(),
        });
      } else {
        setTelemetry((prev) => ({
          ...prev,
          online: false,
          latency: elapsed,
          lastChecked: new Date(),
        }));
      }
    } catch {
      setTelemetry((prev) => ({
        ...prev,
        online: false,
        latency: 0,
        lastChecked: new Date(),
      }));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkTelemetry();
    const interval = setInterval(checkTelemetry, 15000);
    return () => clearInterval(interval);
  }, [checkTelemetry]);

  return (
    <>
      <div className="px-3 py-2">
        <button
          onClick={() => setShowModal(true)}
          className={`w-full rounded-xl border transition-all text-left flex items-center p-2 group border-border bg-secondary/40 hover:bg-secondary/60 hover:border-primary/30 ${
            collapsed ? "justify-center" : "justify-between"
          }`}
          title="Multi-Model Gateway & Telemetry"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative shrink-0 flex items-center justify-center">
              <span className="w-2 h-2 rounded-full bg-primary/80" />
            </div>

            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-foreground tracking-tight truncate">
                    Model Gateway
                  </span>
                </div>
                <p className="text-[9.5px] text-muted-foreground font-mono truncate">
                  {telemetry.online
                    ? `${telemetry.modelCount} models • :20128`
                    : "Direct API • Ready"}
                </p>
              </div>
            )}
          </div>

          {!collapsed && (
            <Activity className="w-3 h-3 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          )}
        </button>
      </div>

      {/* Telemetry Detail Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-lg p-5 shadow-2xl space-y-4"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Model Gateway Telemetry</h4>
                    <p className="text-[10px] text-muted-foreground font-mono">Hybrid LLM Orchestration</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 rounded-xl border border-border bg-secondary/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">ROUTING ENGINE</span>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-xs font-bold text-foreground">
                      {telemetry.online ? "Cascade (:20128)" : "Universal Direct"}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-border bg-secondary/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">GATEWAY LATENCY</span>
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-xs font-mono font-bold text-foreground">
                      {telemetry.latency > 0 ? formatResponseTime(telemetry.latency) : "Direct Fast"}
                    </span>
                  </div>
                </div>


                <div className="p-3 rounded-xl border border-border bg-secondary/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">PORT & ENDPOINT</span>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    127.0.0.1:20128
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-border bg-secondary/50 space-y-1">
                  <span className="text-[10px] text-muted-foreground font-medium">ACTIVE MODELS</span>
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-xs font-mono font-bold text-foreground">
                      {telemetry.modelCount} Available
                    </span>
                  </div>
                </div>
              </div>

              {/* Models List Preview */}
              {telemetry.models.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">ROUTED MODELS</span>
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                    {telemetry.models.map((m) => (
                      <span
                        key={m}
                        className="px-2 py-0.5 rounded-md border border-border bg-secondary text-[10px] font-mono text-muted-foreground"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 border-t border-border flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {telemetry.lastChecked
                    ? `Checked ${telemetry.lastChecked.toLocaleTimeString()}`
                    : ""}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await checkTelemetry();
                      toast.success("Telemetry refreshed");
                    }}
                    disabled={checking}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${checking ? "animate-spin text-foreground" : ""}`}
                    />
                    <span>Ping Test</span>
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
