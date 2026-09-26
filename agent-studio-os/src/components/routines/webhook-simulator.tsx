"use client";

import { useState, useEffect, useCallback } from "react";
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
  Radio,
  Clock,
  Shield,
  Bot,
  Activity,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface WebhookSimulatorProps {
  agents?: AgentProfile[];
}

interface WebhookEndpoint {
  id: string;
  name: string;
  token: string;
  description?: string;
  agentId?: string | null;
  agentName?: string;
}

interface WebhookDeliveryLog {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  agent?: {
    id: string;
    displayName: string;
    avatar: string;
  } | null;
}

const DEFAULT_PAYLOAD = {
  title: "Automated Routine Trigger",
  description: "Routine triggered via authenticated webhook endpoint.",
  priority: "high",
};

export function WebhookSimulator({ agents }: WebhookSimulatorProps) {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [selectedEndpointToken, setSelectedEndpointToken] = useState<string>("default-secret");
  const [jsonPayload, setJsonPayload] = useState(
    JSON.stringify(DEFAULT_PAYLOAD, null, 2)
  );
  const [isSending, setIsSending] = useState(false);
  const [response, setResponse] = useState<{
    status: number;
    data: unknown;
    latency: number;
  } | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [deliveryLogs, setDeliveryLogs] = useState<WebhookDeliveryLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // Dynamic origin detection
  const [origin, setOrigin] = useState("http://localhost:3000");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const currentEndpointUrl = `${origin}/api/webhooks/${selectedEndpointToken}`;

  const fetchWebhookData = useCallback(async () => {
    try {
      setLoadingLogs(true);
      const res = await fetch("/api/webhooks");
      if (res.ok) {
        const data = await res.json();
        if (data.endpoints && data.endpoints.length > 0) {
          setEndpoints(data.endpoints);
        }
        if (data.recentDeliveries) {
          setDeliveryLogs(data.recentDeliveries);
        }
      }
    } catch (err) {
      console.error("Error fetching webhooks:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhookData();
  }, [fetchWebhookData]);

  const handleResetPayload = () => {
    setJsonPayload(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
    setResponse(null);
  };

  const handleCopyEndpoint = () => {
    navigator.clipboard.writeText(currentEndpointUrl);
    setCopiedUrl(true);
    toast.success("Webhook endpoint URL copied to clipboard");
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleCopyCurl = () => {
    const curlCommand = `curl -X POST "${currentEndpointUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${jsonPayload.replace(/\n/g, "").replace(/\s+/g, " ")}'`;
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    toast.success("cURL command copied to clipboard");
    setTimeout(() => setCopiedCurl(false), 2000);
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
      const res = await fetch(`/api/webhooks/${selectedEndpointToken}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Studio-Source": "webhook-center",
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
        toast.success("Inbound Webhook processed & task executed autonomously!");
        // Refresh delivery logs
        fetchWebhookData();
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
    <div className="space-y-6">
      {/* Top Banner: Real Inbound Webhook Status */}
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-6 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center text-xs">
                <Zap className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-foreground">
                Inbound Webhook Automation Engine
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live &amp; Active
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Production webhook gateways receive external triggers (GitHub, Zapier, IoT devices, cron) and invoke specialist agents with Obsidian vault syncing.
            </p>
          </div>

          {/* Active Endpoint Selector & Copy */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <select
                value={selectedEndpointToken}
                onChange={(e) => setSelectedEndpointToken(e.target.value)}
                className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-secondary/80 border border-border text-xs text-foreground font-medium outline-none focus:border-primary cursor-pointer pr-8 appearance-none"
              >
                <option value="default-secret">General Gateway (default-secret)</option>
                <option value="github-deploy">GitHub / CI/CD (github-deploy)</option>
                <option value="monitoring-alert">Monitoring &amp; Sentry (monitoring-alert)</option>
                {agents?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.avatar} {a.displayName} Direct Hook
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground absolute right-2.5 top-2.5 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/80 border border-border font-mono text-[11px] text-muted-foreground overflow-hidden flex-1 sm:flex-initial">
                <span className="text-primary font-bold">POST</span>
                <span className="truncate max-w-[220px]">{currentEndpointUrl}</span>
              </div>
              <button
                onClick={handleCopyEndpoint}
                className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-foreground transition-all cursor-pointer shrink-0"
                title="Copy Webhook URL"
              >
                {copiedUrl ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Two Column Console: Payload Editor + Live Response Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: JSON Payload Editor */}
          <div className="space-y-2.5 flex flex-col">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <Code2 className="w-3.5 h-3.5 text-primary" />
                Request Payload (JSON)
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopyCurl}
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer font-medium"
                >
                  {copiedCurl ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">cURL Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy cURL Command</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleResetPayload}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer font-medium"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-border bg-secondary/50 p-3 relative overflow-hidden flex flex-col min-h-[200px]">
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
              <span>{isSending ? "Executing Agent Pipeline..." : "Dispatch Inbound Webhook Event"}</span>
            </button>
          </div>

          {/* Right: Live Response Inspector */}
          <div className="space-y-2.5 flex flex-col">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="text-foreground">Live Execution Telemetry</span>
              {response && (
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold ${
                      response.status >= 200 && response.status < 300
                        ? "bg-emerald-500/15 text-emerald-400"
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
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>Agent execution complete &amp; synced to Obsidian Vault</span>
                  </div>
                  <pre className="text-foreground text-[11px] leading-relaxed overflow-x-auto p-3 rounded-lg bg-card border border-border max-h-[230px]">
                    {JSON.stringify(response.data, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-10 space-y-2">
                  <Zap className="w-8 h-8 opacity-25 text-primary" />
                  <p className="text-xs">
                    Dispatch an event to inspect response payload, latency, and agent outputs
                  </p>
                </div>
              )}

              {response && (
                <div className="pt-3 border-t border-border flex items-center justify-between text-xs">
                  <span className="text-muted-foreground text-[11px]">
                    Task queued and deliverable saved
                  </span>
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

      {/* Live Webhook Inbound Delivery History */}
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-xl p-5 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">
              Recent Webhook Inbound Deliveries &amp; Execution Logs
            </h3>
            <span className="text-[10px] text-muted-foreground font-mono px-2 py-0.5 rounded-full bg-secondary border border-border font-semibold">
              {deliveryLogs.length} events
            </span>
          </div>

          <button
            onClick={fetchWebhookData}
            disabled={loadingLogs}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loadingLogs ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {deliveryLogs.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-border space-y-2">
            <Radio className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-semibold text-foreground">No inbound webhooks recorded yet</p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Trigger a test webhook from the console above or configure your external system (GitHub, Zapier, cURL) to call your endpoint.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {deliveryLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/50 transition-colors text-xs gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{log.message}</p>
                    <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 opacity-60" />
                      {new Date(log.createdAt).toLocaleString()}
                      {log.agent && (
                        <>
                          <span>&bull;</span>
                          <span className="text-primary font-medium flex items-center gap-1">
                            <Bot className="w-3 h-3" />
                            {log.agent.displayName}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <a
                  href="/kanban"
                  className="px-2.5 py-1 rounded-lg border border-border hover:border-primary/40 bg-secondary/60 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all text-[11px] font-semibold flex items-center gap-1 shrink-0"
                >
                  <span>Kanban</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
