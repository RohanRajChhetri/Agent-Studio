"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  Smartphone,
  Eye,
  EyeOff,
  Send,
  CheckCircle2,
  RefreshCw,
  XCircle,
  MessageSquare,
  Radio,
  Copy,
  ExternalLink,
  Shield,
  Zap,
  Globe,
  Sliders,
  Check,
  Power,
  Hash,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

interface AgentSimple {
  id: string;
  displayName: string;
  avatar: string;
}

export function DevicesTab({ agents: initialAgents = [] }: { agents?: AgentSimple[] }) {
  const [agents, setAgents] = useState<AgentSimple[]>(initialAgents);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(initialAgents[0]?.id || "");
  const [refreshingAgents, setRefreshingAgents] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<"all" | "active" | "messaging" | "developer">("all");

  // Fetch agents independently on mount or when refreshed
  const fetchAgentsList = useCallback(async () => {
    setRefreshingAgents(true);
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        const raw = Array.isArray(data) ? data : (data.agents || []);
        const mapped: AgentSimple[] = raw.map((a: any) => ({
          id: a.id,
          displayName: a.displayName,
          avatar: a.avatar || "🤖",
        }));
        if (mapped.length > 0) {
          setAgents(mapped);
          setSelectedAgentId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0].id));
        }
      }
    } catch (err) {
      console.error("Error fetching agents in DevicesTab:", err);
    } finally {
      setRefreshingAgents(false);
    }
  }, []);

  // Sync if initialAgents changes
  useEffect(() => {
    if (initialAgents && initialAgents.length > 0) {
      setAgents(initialAgents);
      setSelectedAgentId((prev) => (prev && initialAgents.some((a) => a.id === prev) ? prev : initialAgents[0].id));
    } else {
      fetchAgentsList();
    }
  }, [initialAgents, fetchAgentsList]);

  // All channel configs for the selected agent
  const [channelConfigs, setChannelConfigs] = useState<Record<string, any>>({});
  const [channelStatuses, setChannelStatuses] = useState<Record<string, any>>({});
  const [showTokens, setShowTokens] = useState<Record<string, boolean>>({});

  // WhatsApp specific states
  const [whatsappConfig, setWhatsappConfig] = useState<any>({});
  const [waPairing, setWaPairing] = useState(false);
  const [waQrDataUrl, setWaQrDataUrl] = useState<string | null>(null);

  // Testing states
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; details?: any }>>({});
  const [savingPlatform, setSavingPlatform] = useState<string | null>(null);

  // Fetch all integrations for the selected agent
  const fetchAgentIntegrations = async (agentId: string) => {
    setLoading(true);
    try {
      const [integRes, waRes, tgRes] = await Promise.all([
        fetch(`/api/integrations?agentId=${agentId}`),
        fetch(`/api/integrations/whatsapp?agentId=${agentId}`),
        fetch(`/api/integrations/telegram?agentId=${agentId}`),
      ]);

      if (integRes.ok) {
        const data = await integRes.json();
        const configs: Record<string, any> = {};
        const statuses: Record<string, any> = {};

        for (const item of data) {
          configs[item.id] = {
            enabled: item.currentEnabled ?? false,
            ...(item.currentConfig || {}),
          };
          statuses[item.id] = item.status;
        }

        setChannelConfigs(configs);
        setChannelStatuses(statuses);
      }

      if (waRes.ok) {
        const waData = await waRes.json();
        setWhatsappConfig(waData);
      }

      if (tgRes.ok) {
        const tgData = await tgRes.json();
        if (tgData.config?.botToken) {
          // Pre-test saved bot token to show bot handle
          fetch("/api/integrations/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ platform: "telegram", config: { botToken: tgData.config.botToken } }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.success && d.details?.username) {
                setTestResults((prev) => ({
                  ...prev,
                  telegram: { success: true, message: `@${d.details.username}`, details: d.details },
                }));
              }
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("Error fetching agent integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync selectedAgentId when agents load
  useEffect(() => {
    if ((!selectedAgentId || !agents.some((a) => a.id === selectedAgentId)) && agents.length > 0) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  // Load integrations whenever selected agent changes
  useEffect(() => {
    if (selectedAgentId) {
      fetchAgentIntegrations(selectedAgentId);
    }
  }, [selectedAgentId]);

  // WhatsApp QR pairing status poller
  useEffect(() => {
    if (!waQrDataUrl || whatsappConfig?.hasSession) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/integrations/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_status", agentId: selectedAgentId }),
        });
        const data = await res.json();
        if (data.hasSession || data.state?.status === "connected") {
          setWaQrDataUrl(null);
          toast.success("WhatsApp paired successfully!");
          fetchAgentIntegrations(selectedAgentId);
        }
      } catch {}
    }, 2500);
    return () => clearInterval(interval);
  }, [waQrDataUrl, whatsappConfig?.hasSession, selectedAgentId]);

  // Update specific channel field in local state
  const handleConfigChange = (platform: string, field: string, value: any) => {
    setChannelConfigs((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        [field]: value,
      },
    }));
  };

  // Save channel config to database
  const handleSaveChannel = async (platform: string) => {
    setSavingPlatform(platform);
    const cfg = channelConfigs[platform] || {};
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          agentId: selectedAgentId,
          enabled: cfg.enabled ?? true,
          config: cfg,
        }),
      });

      if (res.ok) {
        toast.success(`${platform.toUpperCase()} configuration saved!`);

        // If telegram, trigger poller start
        if (platform === "telegram" && cfg.botToken) {
          fetch("/api/integrations/telegram", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "start_poller" }),
          }).catch(() => {});
        }

        fetchAgentIntegrations(selectedAgentId);
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || `Failed to save ${platform}`);
      }
    } catch {
      toast.error(`Error saving ${platform}`);
    } finally {
      setSavingPlatform(null);
    }
  };

  // Test connection for a channel
  const handleTestChannel = async (platform: string) => {
    setTestingPlatform(platform);
    const cfg = channelConfigs[platform] || {};

    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          config: cfg,
        }),
      });
      const data = await res.json();

      if (data.success) {
        const msg = data.details?.statusText || data.details?.username || "Connection verified successfully";
        setTestResults((prev) => ({
          ...prev,
          [platform]: { success: true, message: msg, details: data.details },
        }));
        toast.success(`Connected to ${platform}: ${msg}`);
      } else {
        setTestResults((prev) => ({
          ...prev,
          [platform]: { success: false, message: data.error || "Connection failed" },
        }));
        toast.error(data.error || `Failed to verify ${platform}`);
      }
    } catch {
      toast.error(`Failed to reach ${platform} verification service`);
    } finally {
      setTestingPlatform(null);
    }
  };

  // WhatsApp Pair Handler
  const startWaPair = async (force = false) => {
    setWaPairing(true);
    if (force) setWaQrDataUrl(null);
    try {
      const res = await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_pair",
          agentId: selectedAgentId,
          mode: "self-chat",
          force,
        }),
      });
      const data = await res.json();
      if (data.status === "qr_ready" && data.qrDataUrl) {
        setWaQrDataUrl(data.qrDataUrl);
        toast.info("Scan the QR code with WhatsApp on your phone");
      } else if (data.status === "connected") {
        toast.success("WhatsApp already connected for this agent");
        fetchAgentIntegrations(selectedAgentId);
      } else {
        toast.error(data.error || "Failed to start WhatsApp pairing");
      }
    } catch {
      toast.error("Failed to start pairing");
    } finally {
      setWaPairing(false);
    }
  };

  const clearWaSession = async () => {
    try {
      await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_session", agentId: selectedAgentId }),
      });
      setWaQrDataUrl(null);
      toast.success("WhatsApp disconnected and session reset");
      fetchAgentIntegrations(selectedAgentId);
    } catch {
      toast.error("Failed to disconnect WhatsApp");
    }
  };

  const toggleWaService = async (action: "start" | "stop") => {
    try {
      await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: action === "start" ? "start_service" : "stop_service",
          agentId: selectedAgentId,
        }),
      });
      toast.success(`WhatsApp service ${action}ed`);
      fetchAgentIntegrations(selectedAgentId);
    } catch {
      toast.error("Failed to toggle service");
    }
  };

  if (!agents || agents.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground bg-card/60 rounded-2xl border border-border space-y-4">
        <Smartphone className="w-10 h-10 mx-auto text-muted-foreground/60" />
        <div>
          <p className="font-semibold text-foreground text-base">No Agents Found</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Create an agent first on the Agents page to connect devices and communication channels (WhatsApp, Telegram, Discord, Slack, Signal, Webhooks).
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={fetchAgentsList}
            disabled={refreshingAgents}
            className="px-4 py-2 rounded-xl text-xs font-medium border border-border bg-secondary/50 hover:bg-secondary text-foreground flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingAgents ? "animate-spin" : ""}`} />
            {refreshingAgents ? "Refreshing..." : "Refresh Agents"}
          </button>
          <Link
            href="/agents"
            className="px-4 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Agent
          </Link>
        </div>
      </div>
    );
  }

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const activeChannelCount = Object.values(channelConfigs).filter((c) => c?.enabled).length;

  return (
    <div className="space-y-6">
      {/* Agent Selector Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card/80 backdrop-blur-xl p-5 rounded-2xl border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider">
              Channel Router
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {activeChannelCount} of 7 Channels Active
            </span>
          </div>
          <h2 className="text-base font-bold text-foreground">
            Devices &amp; Communication Channels
          </h2>
          <p className="text-xs text-muted-foreground">
            Connect external chat apps, messaging bots, and inbound webhooks directly to your autonomous agents.
          </p>
        </div>

        {/* Agent Picker & Quick Actions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-secondary/50 p-1.5 rounded-xl border border-border">
            <span className="text-xs font-medium text-muted-foreground pl-2">Active Agent:</span>
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-1.5 text-foreground text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.avatar || "🤖"} {a.displayName}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={fetchAgentsList}
              disabled={refreshingAgents}
              title="Refresh agent list"
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshingAgents ? "animate-spin" : ""}`} />
            </button>
          </div>
          <Link
            href="/agents"
            className="px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Agent</span>
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-secondary/50 border border-border rounded-xl w-fit text-xs">
        {[
          { id: "all", label: "All Channels (7)" },
          { id: "messaging", label: "Messaging (Telegram / WhatsApp / Signal)" },
          { id: "developer", label: "Enterprise (Discord / Slack / Webhook)" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterCategory(tab.id as any)}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
              filterCategory === tab.id
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. WHATSAPP PERSONAL (QR Pairing) */}
          {(filterCategory === "all" || filterCategory === "messaging") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center text-xl font-bold">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">WhatsApp Personal</h3>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 border ${
                          whatsappConfig?.hasSession
                            ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}
                      >
                        {whatsappConfig?.hasSession ? (
                          <>
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            Connected
                          </>
                        ) : (
                          "Pairing Required"
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Baileys bridge: link your personal WhatsApp via QR code
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.whatsapp?.enabled ?? whatsappConfig?.hasSession)}
                    onChange={(e) => handleConfigChange("whatsapp", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                </label>
              </div>

              {whatsappConfig?.hasSession ? (
                <div className="p-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-foreground font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span>Linked Device Active for {selectedAgent.displayName}</span>
                    </div>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Port: {whatsappConfig.service?.bridgePort || 3001}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      onClick={() => toggleWaService(whatsappConfig.service?.bridgeRunning ? "stop" : "start")}
                      className="flex-1 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-500 dark:text-emerald-400 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                    >
                      {whatsappConfig.service?.bridgeRunning ? "Stop Service" : "Start WhatsApp Bridge"}
                    </button>
                    <button
                      onClick={() => startWaPair(true)}
                      disabled={waPairing}
                      className="px-3 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-medium cursor-pointer"
                    >
                      {waPairing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Re-Pair"}
                    </button>
                    <button
                      onClick={clearWaSession}
                      className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl text-xs font-semibold cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-center p-3 rounded-xl bg-secondary/30 border border-border">
                  {waQrDataUrl ? (
                    <div className="flex flex-col items-center gap-3 py-2">
                      <img
                        src={waQrDataUrl}
                        alt="WhatsApp QR Code"
                        className="w-44 h-44 rounded-xl bg-white p-2 border shadow-md"
                      />
                      <p className="text-xs text-muted-foreground">
                        Open WhatsApp on phone &rarr; <b>Linked Devices</b> &rarr; <b>Link a Device</b> &rarr; Scan QR
                      </p>
                      <button
                        onClick={() => setWaQrDataUrl(null)}
                        className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                      >
                        Cancel QR
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <p className="text-xs text-muted-foreground">
                        Click below to generate a fresh QR code and link this agent to your phone.
                      </p>
                      <button
                        onClick={() => startWaPair(false)}
                        disabled={waPairing}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                      >
                        {waPairing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Smartphone className="w-4 h-4" />}
                        <span>{waPairing ? "Generating QR Code..." : "Generate Pairing QR"}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 2. TELEGRAM BOT */}
          {(filterCategory === "all" || filterCategory === "messaging") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center text-xl font-bold">
                    <Send className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">Telegram Bot</h3>
                      {testResults.telegram?.success ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          {testResults.telegram.message}
                        </span>
                      ) : channelConfigs.telegram?.botToken ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/30 font-medium">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-medium">
                          Not Setup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Direct bidirectional bot bridge for {selectedAgent.displayName}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.telegram?.enabled)}
                    onChange={(e) => handleConfigChange("telegram", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary" />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Telegram Bot Token</span>
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
                    >
                      <span>Get from @BotFather</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showTokens.telegram ? "text" : "password"}
                      value={channelConfigs.telegram?.botToken || ""}
                      onChange={(e) => handleConfigChange("telegram", "botToken", e.target.value)}
                      placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowTokens((prev) => ({ ...prev, telegram: !prev.telegram }))
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showTokens.telegram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestChannel("telegram")}
                    disabled={testingPlatform === "telegram" || !channelConfigs.telegram?.botToken}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === "telegram" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Test Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("telegram")}
                    disabled={savingPlatform === "telegram" || !channelConfigs.telegram?.botToken}
                    className="flex-1 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === "telegram" ? "Saving..." : "Save & Start Poller"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. DISCORD BOT */}
          {(filterCategory === "all" || filterCategory === "developer") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xl font-bold">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">Discord Bot</h3>
                      {testResults.discord?.success ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      ) : channelConfigs.discord?.botToken ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 font-medium">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-medium">
                          Not Setup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Connect server guilds &amp; private DMs
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.discord?.enabled)}
                    onChange={(e) => handleConfigChange("discord", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500" />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Discord Bot Token</span>
                    <a
                      href="https://discord.com/developers/applications"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Developer Portal</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showTokens.discord ? "text" : "password"}
                      value={channelConfigs.discord?.botToken || ""}
                      onChange={(e) => handleConfigChange("discord", "botToken", e.target.value)}
                      placeholder="Discord Bot Token from application settings"
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokens((prev) => ({ ...prev, discord: !prev.discord }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showTokens.discord ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestChannel("discord")}
                    disabled={testingPlatform === "discord" || !channelConfigs.discord?.botToken}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === "discord" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Test Discord</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("discord")}
                    disabled={savingPlatform === "discord" || !channelConfigs.discord?.botToken}
                    className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === "discord" ? "Saving..." : "Save Discord Bot"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 4. SLACK BOT */}
          {(filterCategory === "all" || filterCategory === "developer") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center text-xl font-bold">
                    <Hash className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">Slack App</h3>
                      {testResults.slack?.success ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      ) : channelConfigs.slack?.botToken ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 font-medium">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-medium">
                          Not Setup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Workspace app with slash commands &amp; mentions
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.slack?.enabled)}
                    onChange={(e) => handleConfigChange("slack", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                    <span>Bot User OAuth Token (xoxb-...)</span>
                    <a
                      href="https://api.slack.com/apps"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-amber-500 hover:underline flex items-center gap-0.5"
                    >
                      <span>Slack App Console</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </label>
                  <div className="relative mt-1.5">
                    <input
                      type={showTokens.slack ? "text" : "password"}
                      value={channelConfigs.slack?.botToken || ""}
                      onChange={(e) => handleConfigChange("slack", "botToken", e.target.value)}
                      placeholder="xoxb-your-slack-bot-token"
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokens((prev) => ({ ...prev, slack: !prev.slack }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showTokens.slack ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestChannel("slack")}
                    disabled={testingPlatform === "slack" || !channelConfigs.slack?.botToken}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === "slack" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Test Slack</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("slack")}
                    disabled={savingPlatform === "slack" || !channelConfigs.slack?.botToken}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === "slack" ? "Saving..." : "Save Slack App"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 5. WHATSAPP CLOUD API (Meta Business) */}
          {(filterCategory === "all" || filterCategory === "messaging") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-500 border border-teal-500/20 flex items-center justify-center text-xl font-bold">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">WhatsApp Cloud API</h3>
                      {testResults.whatsapp_cloud?.success ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Verified
                        </span>
                      ) : channelConfigs.whatsapp_cloud?.accessToken ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-500 border border-teal-500/30 font-medium">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-medium">
                          Not Setup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Official Meta WhatsApp Business Cloud API
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.whatsapp_cloud?.enabled)}
                    onChange={(e) => handleConfigChange("whatsapp_cloud", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Phone Number ID</label>
                    <input
                      type="text"
                      value={channelConfigs.whatsapp_cloud?.phoneNumberId || ""}
                      onChange={(e) => handleConfigChange("whatsapp_cloud", "phoneNumberId", e.target.value)}
                      placeholder="e.g. 104829381920391"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Verify Token</label>
                    <input
                      type="text"
                      value={channelConfigs.whatsapp_cloud?.verifyToken || ""}
                      onChange={(e) => handleConfigChange("whatsapp_cloud", "verifyToken", e.target.value)}
                      placeholder="Custom verify token"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Permanent Access Token</label>
                  <div className="relative mt-1">
                    <input
                      type={showTokens.whatsapp_cloud ? "text" : "password"}
                      value={channelConfigs.whatsapp_cloud?.accessToken || ""}
                      onChange={(e) => handleConfigChange("whatsapp_cloud", "accessToken", e.target.value)}
                      placeholder="EAAG... Meta Graph API System User Token"
                      className="w-full pl-3 pr-10 py-2.5 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowTokens((prev) => ({ ...prev, whatsapp_cloud: !prev.whatsapp_cloud }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showTokens.whatsapp_cloud ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestChannel("whatsapp_cloud")}
                    disabled={testingPlatform === "whatsapp_cloud" || !channelConfigs.whatsapp_cloud?.accessToken}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {testingPlatform === "whatsapp_cloud" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Verify Token</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("whatsapp_cloud")}
                    disabled={savingPlatform === "whatsapp_cloud" || !channelConfigs.whatsapp_cloud?.accessToken}
                    className="flex-1 py-2 bg-teal-600 hover:bg-teal-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingPlatform === "whatsapp_cloud" ? "Saving..." : "Save Cloud API"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 6. WEBHOOK & AUTOMATION TRIGGERS */}
          {(filterCategory === "all" || filterCategory === "developer") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20 flex items-center justify-center text-xl font-bold">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">Inbound Webhook</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Active
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      HTTP POST endpoint for CI/CD, GitHub, or custom triggers
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={channelConfigs.webhook?.enabled !== false}
                    onChange={(e) => handleConfigChange("webhook", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500" />
                </label>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block">Webhook Endpoint URL</label>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input
                      type="text"
                      readOnly
                      value={
                        typeof window !== "undefined"
                          ? `${window.location.origin}/api/webhooks/default-secret?agent=${selectedAgent.displayName.toLowerCase().replace(/\s+/g, "-")}`
                          : `/api/webhooks/default-secret?agent=${selectedAgent.displayName.toLowerCase().replace(/\s+/g, "-")}`
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none select-all"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const url = `${window.location.origin}/api/webhooks/default-secret?agent=${selectedAgent.displayName.toLowerCase().replace(/\s+/g, "-")}`;
                        navigator.clipboard.writeText(url);
                        toast.success("Webhook URL copied to clipboard!");
                      }}
                      className="px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground">Secret Token (Header: x-webhook-token)</label>
                  <input
                    type="text"
                    value={channelConfigs.webhook?.secret || "default-secret"}
                    onChange={(e) => handleConfigChange("webhook", "secret", e.target.value)}
                    placeholder="Custom webhook token"
                    className="w-full mt-1.5 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/webhooks/default-secret", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            prompt: `Automated ping to agent ${selectedAgent.displayName}`,
                            agentName: selectedAgent.displayName,
                          }),
                        });
                        if (res.ok) {
                          toast.success("Test webhook ping delivered successfully!");
                        } else {
                          toast.error("Webhook test failed.");
                        }
                      } catch {
                        toast.error("Failed to fire test webhook.");
                      }
                    }}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Send Test Ping</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("webhook")}
                    disabled={savingPlatform === "webhook"}
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    {savingPlatform === "webhook" ? "Saving..." : "Save Webhook"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 7. SIGNAL MESSENGER */}
          {(filterCategory === "all" || filterCategory === "messaging") && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center text-xl font-bold">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-foreground">Signal Messenger</h3>
                      {channelConfigs.signal?.account ? (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
                          Configured
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border font-medium">
                          Not Setup
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Encrypted messaging via signal-cli REST gateway
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(channelConfigs.signal?.enabled)}
                    onChange={(e) => handleConfigChange("signal", "enabled", e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-secondary peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500" />
                </label>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Signal Phone Number</label>
                    <input
                      type="text"
                      value={channelConfigs.signal?.account || ""}
                      onChange={(e) => handleConfigChange("signal", "account", e.target.value)}
                      placeholder="+1234567890"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground">Gateway REST URL</label>
                    <input
                      type="text"
                      value={channelConfigs.signal?.gatewayUrl || "http://localhost:8080"}
                      onChange={(e) => handleConfigChange("signal", "gatewayUrl", e.target.value)}
                      placeholder="http://localhost:8080"
                      className="w-full mt-1 px-3 py-2 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleTestChannel("signal")}
                    disabled={testingPlatform === "signal"}
                    className="flex-1 py-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {testingPlatform === "signal" ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    <span>Check Gateway</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSaveChannel("signal")}
                    disabled={savingPlatform === "signal"}
                    className="flex-1 py-2 bg-blue-600 hover:bg-blue-600/90 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                  >
                    {savingPlatform === "signal" ? "Saving..." : "Save Signal"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
