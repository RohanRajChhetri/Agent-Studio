"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key,
  RefreshCw,
  Save,
  Loader2,
  Trash2,
  FolderOpen,
  CheckCircle,
  XCircle,
  Zap,
  AlertTriangle,
  Eye,
  EyeOff,
  TestTube,
  Info,
  Search,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";
import { DevicesTab } from "./devices-tab";

interface ProviderInfo {
  provider: string;
  envVar: string;
  label: string;
  isSet: boolean;
  masked: string;
  models?: readonly string[];
}

interface ModelEntry {
  id: string;
  owned_by?: string;
}

interface AgentSimple {
  id: string;
  displayName: string;
  avatar: string;
}

interface VaultStats {
  vaultPath: string;
  noteCount: number;
  graphStats: {
    nodes: number;
    edges: number;
    communities: number;
  };
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("providers");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [agents, setAgents] = useState<AgentSimple[]>([]);
  const [omnirouteOnline, setOmnirouteOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Sync activeTab with URL ?tab= parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["providers", "devices", "models", "vault"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  // API Key management state
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [keyTestStatus, setKeyTestStatus] = useState<
    Record<string, { success: boolean; latency?: number; error?: string }>
  >({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  // Model inspection state
  const [modelSearch, setModelSearch] = useState("");
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latency: number; error?: string }>
  >({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Vault stats state
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [syncingVault, setSyncingVault] = useState(false);
  const [copiedVaultPath, setCopiedVaultPath] = useState(false);

  const fetchData = async () => {
    try {
      const [providersRes, modelsRes, agentsRes, vaultRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models"),
        fetch("/api/agents"),
        fetch("/api/vault?action=stats"),
      ]);

      if (providersRes.ok) {
        setProviders(await providersRes.json());
      }

      if (modelsRes.ok) {
        const modelsData = await modelsRes.json();
        const seen = new Set<string>();
        const deduped: ModelEntry[] = [];
        for (const m of modelsData.models || []) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            deduped.push(m);
          }
        }
        setModels(deduped);
        setOmnirouteOnline(Boolean(modelsData.online));
      }

      if (agentsRes.ok) {
        const agentsData = await agentsRes.json();
        const rawAgents = Array.isArray(agentsData) ? agentsData : (agentsData.agents || []);
        setAgents(
          rawAgents.map((a: any) => ({
            id: a.id,
            displayName: a.displayName,
            avatar: a.avatar || "🤖",
          }))
        );
      }

      if (vaultRes.ok) {
        setVaultStats(await vaultRes.json());
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshModels = async () => {
    setRefreshingModels(true);
    try {
      const res = await fetch(`/api/models?refresh=true&t=${Date.now()}`);
      if (res.ok) {
        const modelsData = await res.json();
        const seen = new Set<string>();
        const deduped: ModelEntry[] = [];
        for (const m of modelsData.models || []) {
          if (!seen.has(m.id)) {
            seen.add(m.id);
            deduped.push(m);
          }
        }
        setModels(deduped);
        setOmnirouteOnline(Boolean(modelsData.online));
        toast.success(`Discovered ${deduped.length} available models`);
      } else {
        toast.error("Failed to query models from router");
      }
    } catch (err) {
      console.error("Error refreshing models:", err);
      toast.error("Error querying models");
    } finally {
      setRefreshingModels(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam && ["providers", "devices", "models", "vault", "danger"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const saveKey = async (provider: string, envVar: string) => {
    const value = keyInputs[envVar];
    if (!value || !value.trim()) {
      toast.error("Please enter a valid key");
      return;
    }

    setSavingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", provider, envVar, value: value.trim() }),
      });

      if (res.ok) {
        toast.success(`Saved API key for ${provider}`);
        setKeyInputs((prev) => ({ ...prev, [envVar]: "" }));
        await fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to save key");
      }
    } catch {
      toast.error("Network error saving key");
    } finally {
      setSavingKey(null);
    }
  };

  const deleteKey = async (envVar: string) => {
    if (!confirm(`Are you sure you want to remove ${envVar}?`)) return;

    setDeletingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", envVar }),
      });

      if (res.ok) {
        toast.success(`Removed ${envVar}`);
        await fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to remove key");
      }
    } catch {
      toast.error("Network error deleting key");
    } finally {
      setDeletingKey(null);
    }
  };

  const testKey = async (provider: string, envVar: string) => {
    setTestingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          provider,
          envVar,
          value: keyInputs[envVar] || undefined,
        }),
      });

      const data = await res.json();
      setKeyTestStatus((prev) => ({ ...prev, [envVar]: data }));
      if (data.success) {
        toast.success(`${provider} verification passed (${formatResponseTime(data.latency)})`);
      } else {
        toast.error(data.error || `${provider} key validation failed`);
      }
    } catch {
      setKeyTestStatus((prev) => ({
        ...prev,
        [envVar]: { success: false, error: "Network error testing key" },
      }));
      toast.error("Network error testing key");
    } finally {
      setTestingKey(null);
    }
  };

  const testModel = async (modelId: string) => {
    setTestingModel(modelId);
    try {
      const res = await fetch("/api/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId }),
      });

      const data = await res.json();
      setTestResults((prev) => ({ ...prev, [modelId]: data }));
      if (data.success) {
        toast.success(`${modelId}: ${formatResponseTime(data.latency)}`);
      } else {
        toast.error(`${modelId}: ${data.error || "Model test failed"}`);
      }
    } catch {
      setTestResults((prev) => ({
        ...prev,
        [modelId]: { success: false, latency: 0, error: "Request failed" },
      }));
    } finally {
      setTestingModel(null);
    }
  };

  const handleSyncVault = async () => {
    setSyncingVault(true);
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      });
      if (res.ok) {
        toast.success("Obsidian shared vault synchronized");
        const statsRes = await fetch("/api/vault?action=stats");
        if (statsRes.ok) setVaultStats(await statsRes.json());
      } else {
        toast.error("Failed to sync vault");
      }
    } catch {
      toast.error("Network error syncing vault");
    } finally {
      setSyncingVault(false);
    }
  };

  const handleOpenObsidian = async () => {
    try {
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "open_obsidian" }),
      });
      const data = await res.json();
      if (data.success || data.opened) {
        toast.success(data.message || "Opened Obsidian Desktop");
      } else if (data.uri) {
        window.location.href = data.uri;
        toast.info("Triggered Obsidian desktop protocol");
      } else {
        toast.error(data.error || "Failed to open Obsidian");
      }
    } catch {
      toast.error("Failed to open Obsidian");
    }
  };

  const handleCopyVaultPath = () => {
    if (vaultStats?.vaultPath) {
      navigator.clipboard.writeText(vaultStats.vaultPath);
      setCopiedVaultPath(true);
      toast.success("Vault directory path copied");
      setTimeout(() => setCopiedVaultPath(false), 2000);
    }
  };

  const tabs = [
    { id: "providers", label: "Providers & API Keys", icon: Key },
    { id: "devices", label: "Devices & Channels", icon: Smartphone },
    { id: "models", label: "Available Models", icon: Zap },
    { id: "vault", label: "Shared Memory Vault", icon: FolderOpen },
    { id: "danger", label: "Diagnostics & Reset", icon: AlertTriangle },
  ];

  const filteredModels = models.filter((m) =>
    m.id.toLowerCase().includes(modelSearch.toLowerCase())
  );

  const groupedModels = filteredModels.reduce<Record<string, ModelEntry[]>>((acc, m) => {
    const group = m.owned_by || "Available Routes";
    if (!acc[group]) acc[group] = [];
    acc[group].push(m);
    return acc;
  }, {});

  const sortedGroups = Object.keys(groupedModels).sort((a, b) => {
    if (a === "Available Routes") return 1;
    return a.localeCompare(b);
  });

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5 w-full">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-border inline-flex items-center gap-1.5">
            <Key className="w-3 h-3" />
            Configuration Hub
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage model provider credentials, mobile messaging pairing, and local Obsidian vault storage
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-secondary/60 border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-card text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Providers Tab */}
      {activeTab === "providers" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Providers Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {providers.map((provider) => (
              <div
                key={provider.envVar}
                className="rounded-xl border border-border bg-card p-5 space-y-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        provider.isSet
                          ? "bg-emerald-500 ring-2 ring-emerald-400/20"
                          : "bg-muted-foreground/30"
                      }`}
                    />
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{provider.label}</h3>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {provider.envVar}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {keyTestStatus[provider.envVar] && (
                      <span
                        className={`text-[11px] flex items-center gap-1 font-medium ${
                          keyTestStatus[provider.envVar].success
                            ? "text-emerald-500"
                            : "text-red-400"
                        }`}
                      >
                        {keyTestStatus[provider.envVar].success ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <XCircle className="w-3 h-3" />
                        )}
                        <span>
                          {keyTestStatus[provider.envVar].success
                            ? `Verified (${formatResponseTime(keyTestStatus[provider.envVar].latency)})`
                            : "Invalid"}
                        </span>
                      </span>
                    )}

                    {provider.isSet && (
                      <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-1 rounded-md border border-border flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        {provider.masked}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showKeys[provider.envVar] ? "text" : "password"}
                      placeholder={
                        provider.isSet
                          ? "Enter new key to replace existing..."
                          : `Enter ${provider.label} API key...`
                      }
                      value={keyInputs[provider.envVar] || ""}
                      onChange={(e) =>
                        setKeyInputs((prev) => ({
                          ...prev,
                          [provider.envVar]: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-xs font-mono text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary pr-10"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowKeys((prev) => ({
                          ...prev,
                          [provider.envVar]: !prev[provider.envVar],
                        }))
                      }
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      {showKeys[provider.envVar] ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => saveKey(provider.provider, provider.envVar)}
                    disabled={savingKey === provider.envVar || !keyInputs[provider.envVar]?.trim()}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold disabled:opacity-40 transition-all cursor-pointer shadow-sm"
                  >
                    {savingKey === provider.envVar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5" />
                    )}
                    <span>Save</span>
                  </button>

                  <button
                    onClick={() => testKey(provider.provider, provider.envVar)}
                    disabled={testingKey === provider.envVar || (!provider.isSet && !keyInputs[provider.envVar]?.trim())}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground disabled:opacity-40 transition-all cursor-pointer"
                    title="Test key latency against provider endpoint"
                  >
                    {testingKey === provider.envVar ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <TestTube className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Test</span>
                  </button>

                  {provider.isSet && (
                    <button
                      onClick={() => deleteKey(provider.envVar)}
                      disabled={deletingKey === provider.envVar}
                      className="p-2 rounded-xl border border-border hover:border-red-500/40 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
                      title="Delete saved key"
                    >
                      {deletingKey === provider.envVar ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Devices & Channels Tab */}
      {activeTab === "devices" && (
        <div className="animate-in fade-in duration-300">
          <DevicesTab agents={agents} />
        </div>
      )}

      {/* Models Tab */}
      {activeTab === "models" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={modelSearch}
                onChange={(e) => setModelSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {filteredModels.length} models across {sortedGroups.length} categories
              </span>
              <button
                onClick={handleRefreshModels}
                disabled={refreshingModels}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs text-foreground cursor-pointer transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${refreshingModels ? "animate-spin text-primary" : ""}`} />
                <span>{refreshingModels ? "Refreshing..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {sortedGroups.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {sortedGroups.map((group) => {
                const groupModels = groupedModels[group];
                const isCollapsed = collapsedGroups[group];

                return (
                  <div key={group} className="rounded-xl border border-border bg-card overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                        <span className="text-xs font-semibold text-foreground capitalize">
                          {group}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-md">
                          {groupModels.length}
                        </span>
                      </div>
                    </button>

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-border divide-y divide-border">
                            {groupModels.map((m, index) => (
                              <div
                                key={`${m.id}-${index}`}
                                className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors"
                              >
                                <span className="text-xs font-mono text-muted-foreground truncate">
                                  {m.id}
                                </span>

                                <div className="flex items-center gap-2 shrink-0">
                                  {testResults[m.id] && (
                                    <span
                                      className={`text-[10px] flex items-center gap-1 font-medium ${
                                        testResults[m.id].success
                                          ? "text-emerald-500"
                                          : "text-red-400"
                                      }`}
                                    >
                                      {testResults[m.id].success ? (
                                        <CheckCircle className="w-3 h-3" />
                                      ) : (
                                        <XCircle className="w-3 h-3" />
                                      )}
                                      <span>{formatResponseTime(testResults[m.id].latency)}</span>
                                    </span>
                                  )}

                                  <button
                                    onClick={() => testModel(m.id)}
                                    disabled={testingModel === m.id}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-xs disabled:opacity-50 transition-all text-muted-foreground hover:text-foreground cursor-pointer"
                                  >
                                    {testingModel === m.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <TestTube className="w-3 h-3" />
                                    )}
                                    <span>Test</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
              <Zap className="w-8 h-8 opacity-40" />
              <p className="text-xs">No matching models found</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Shared Memory Vault Tab */}
      {activeTab === "vault" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary border border-border flex items-center justify-center">
                <FolderOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Obsidian Shared Memory Vault</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Single source of episodic memory and task deliverables synchronized across all autonomous agents
                </p>
              </div>
            </div>

            {/* Real Path Information Card */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">Local Vault Directory</label>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 rounded-xl bg-secondary border border-border font-mono text-xs text-foreground select-all break-all">
                  {vaultStats?.vaultPath || "C:\\Users\\rohan\\agent-studio\\memory"}
                </div>
                <button
                  onClick={handleCopyVaultPath}
                  className="flex items-center gap-1.5 px-3.5 py-3 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-all cursor-pointer"
                  title="Copy directory path"
                >
                  {copiedVaultPath ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  <span className="hidden sm:inline">{copiedVaultPath ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Vault Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 rounded-xl border border-border bg-secondary/40 space-y-1">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">Total Markdown Notes</span>
                <p className="text-lg font-bold font-mono text-foreground">{vaultStats?.noteCount ?? 0}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-secondary/40 space-y-1">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">Bi-directional Links</span>
                <p className="text-lg font-bold font-mono text-foreground">{vaultStats?.graphStats?.edges ?? 0}</p>
              </div>
              <div className="p-3.5 rounded-xl border border-border bg-secondary/40 space-y-1">
                <span className="text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">Context Clusters</span>
                <p className="text-lg font-bold font-mono text-foreground">{vaultStats?.graphStats?.communities ?? 0}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-border">
              <button
                onClick={handleOpenObsidian}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-sm transition-all cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Obsidian Desktop</span>
              </button>

              <button
                onClick={handleSyncVault}
                disabled={syncingVault}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                {syncingVault ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Synchronize & Verify Vault</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Diagnostics & Reset Tab */}
      {activeTab === "danger" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">System Cache & Diagnostic Reset</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If your agent fleet encounters runtime session cache desynchronization, you can refresh active state and reload provider latency pools safely without losing persistent Obsidian vault notes.
            </p>

            <div className="pt-2">
              <button
                onClick={() => {
                  fetchData();
                  toast.success("Runtime session refreshed and provider latency cache purged.");
                }}
                className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-semibold text-foreground transition-all cursor-pointer"
              >
                Refresh Runtime Cache
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
