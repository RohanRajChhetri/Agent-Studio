"use client";

import { useState } from "react";
import {
  Zap,
  Play,
  Copy,
  Check,
  RotateCcw,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Code2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface WebhookSimulatorProps {
  agents?: AgentProfile[];
}

const PAYLOAD_PRESETS = [
  {
    name: "DevOps Health Alert",
    payload: {
      title: "Production Latency Spike Alert",
      description: "Gateway response time exceeded 450ms threshold in us-east region. Audit docker container logs and memory pool.",
      agent: "vulcan-devops",
      priority: "high",
    },
  },
  {
    name: "Security Vulnerability Scan",
    payload: {
      title: "Zero-Day CVE Dependency Alert",
      description: "Audit npm packages for prototype pollution and supply-chain vulnerabilities in authentication handler.",
      agent: "cipher-security",
      priority: "high",
    },
  },
  {
    name: "Market Research Brief",
    payload: {
      title: "Daily Competitor & Market Scan",
      description: "Scan latest competitor releases, pricing changes, and top AI developer tooling trends. Generate a bulleted synthesis in shared memory.",
      agent: "athena-researcher",
      priority: "medium",
    },
  },
];

export function WebhookSimulator({ agents: _agents }: WebhookSimulatorProps) {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [jsonPayload, setJsonPayload] = useState(
    JSON.stringify(PAYLOAD_PRESETS[0].payload, null, 2)
  );
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    data: unknown;
    latency: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const endpointUrl = "http://localhost:3000/api/webhooks/default-secret";

  const handleApplyPreset = (idx: number) => {
    setSelectedPreset(idx);
    setJsonPayload(JSON.stringify(PAYLOAD_PRESETS[idx].payload, null, 2));
    setResponse(null);
  };

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(endpointUrl);
    setCopied(true);
    toast.success("Webhook endpoint URL copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendWebhook = async () => {
    let parsedBody: Record<string, unknown>;
    try {
      parsedBody = JSON.parse(jsonPayload);
    } catch {
      toast.error("Invalid JSON payload format");
      return;
    }

    setIsSending(true);
    const start = Date.now();

    try {
      const res = await fetch("/api/webhooks/default-secret", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Studio-Source": "simulator",
        },
        body: JSON.stringify(parsedBody),
      });

      const latency = Date.now() - start;
      const data = await res.json().catch(() => ({}));

      setResponse({
        status: res.status,
        data,
        latency,
      });

      if (res.ok) {
        toast.success("Inbound Webhook received & task queued on Kanban!");
      } else {
        const errorMsg = (data as { error?: string })?.error || "Unknown error";
        toast.error(`Webhook rejected (${res.status}): ${errorMsg}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to trigger webhook";
      setResponse({
        status: 500,
        data: { error: message },
        latency: Date.now() - start,
      });
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-sm">
      {/* Header Info */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center text-xs">
              <Zap className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Inbound Webhook &amp; Payload Simulator
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Test external integrations (GitHub webhooks, Zapier, cron jobs, cURL) and watch the autonomous pipeline trigger in real time.
          </p>
        </div>

        {/* Endpoint URL Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border font-mono text-[11px] text-muted-foreground overflow-hidden">
            <span className="text-primary font-bold">POST</span>
            <span className="truncate max-w-[280px]">{endpointUrl}</span>
          </div>
          <button
            onClick={handleCopyEndpoint}
            className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all cursor-pointer"
            title="Copy URL"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Preset Pickers */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-foreground uppercase tracking-wider block">
          Preset Mission Templates:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {PAYLOAD_PRESETS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => handleApplyPreset(idx)}
              className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                selectedPreset === idx
                  ? "bg-primary/15 text-primary border-primary/40 font-semibold shadow-sm"
                  : "bg-secondary/40 text-muted-foreground border-border hover:bg-secondary/60 hover:text-foreground"
              }`}
            >
              <span>{preset.name}</span>
              <Sparkles className="w-3.5 h-3.5 opacity-60" />
            </button>
          ))}
        </div>
      </div>

      {/* Two Column Console: Payload Editor + Live Response Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: JSON Payload Editor */}
        <div className="space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5 text-foreground">
              <Code2 className="w-3.5 h-3.5 text-primary" />
              Request Body (JSON)
            </span>
            <button
              onClick={() => handleApplyPreset(selectedPreset)}
              className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>

          <div className="flex-1 rounded-xl border border-border bg-secondary/50 p-3 relative overflow-hidden flex flex-col">
            <textarea
              value={jsonPayload}
              onChange={(e) => setJsonPayload(e.target.value)}
              rows={9}
              className="w-full h-full bg-transparent font-mono text-xs text-foreground outline-none resize-none leading-relaxed"
              placeholder="Paste or write JSON payload here..."
            />
          </div>

          <button
            onClick={handleSendWebhook}
            disabled={isSending}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isSending ? "Dispatching Webhook..." : "Dispatch Inbound Webhook Event"}</span>
          </button>
        </div>

        {/* Right: Live Response Inspector */}
        <div className="space-y-2.5 flex flex-col">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span className="text-foreground">Live Telemetry &amp; Gateway Response</span>
            {response && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-md font-bold ${
                    response.status >= 200 && response.status < 300
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {response.status} {response.status === 200 || response.status === 201 ? "OK" : "ERR"}
                </span>
                <span>{response.latency}ms</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[220px] rounded-xl border border-border bg-secondary/50 p-4 font-mono text-xs overflow-auto flex flex-col justify-between">
            {response ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Webhook event accepted &amp; pipeline started</span>
                </div>
                <pre className="text-foreground text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-card border border-border">
                  {JSON.stringify(response.data, null, 2)}
                </pre>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10 space-y-2">
                <Zap className="w-8 h-8 opacity-25 text-primary" />
                <p className="text-xs">Click &quot;Dispatch Inbound Webhook Event&quot; to test payload routing</p>
              </div>
            )}

            {response && (
              <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">Task automatically added to Autonomous Kanban</span>
                <a
                  href="/kanban"
                  className="flex items-center gap-1 text-primary hover:underline font-semibold"
                >
                  <span>View on Kanban</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
