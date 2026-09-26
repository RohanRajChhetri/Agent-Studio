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
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Cpu,
  Radio,
  Plus,
  Server,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatResponseTime } from "@/lib/utils";
import { WebhookSimulator } from "@/components/routines/webhook-simulator";
import type { MCPServerConfig } from "@/types/mcp";

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
      if (tabParam && ["providers", "models", "mcp", "webhooks", "vault", "danger"].includes(tabParam)) {
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

  // MCP Server state
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [loadingMcp, setLoadingMcp] = useState(false);
  const [testingMcpId, setTestingMcpId] = useState<string | null>(null);
  const [togglingMcpId, setTogglingMcpId] = useState<string | null>(null);
  const [showAddMcpModal, setShowAddMcpModal] = useState(false);
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpDesc, setNewMcpDesc] = useState("");
  const [newMcpTransport, setNewMcpTransport] = useState<"stdio" | "sse">("stdio");
  const [newMcpCommand, setNewMcpCommand] = useState("npx");
  const [newMcpArgs, setNewMcpArgs] = useState("");
  const [newMcpUrl, setNewMcpUrl] = useState("");

  const fetchMcpServers = async () => {
    try {
      setLoadingMcp(true);
      const res = await fetch("/api/mcp");
      if (res.ok) {
        const data = await res.json();
        setMcpServers(data.servers || []);
      }
    } catch {
      toast.error("Failed to load MCP servers");
    } finally {
      setLoadingMcp(false);
    }
  };

  useEffect(() => {
    if (activeTab === "mcp") {
      fetchMcpServers();
    }
  }, [activeTab]);

  const handleToggleMcp = async (id: string) => {
    setTogglingMcpId(id);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", serverId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMcpServers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: data.server.enabled, status: data.server.status } : s))
        );
        toast.success(`MCP Server ${data.server.enabled ? "enabled" : "disabled"}`);
      } else {
        toast.error("Failed to toggle MCP server");
      }
    } catch {
      toast.error("Network error toggling MCP server");
    } finally {
      setTogglingMcpId(null);
    }
  };

  const handleTestMcp = async (id: string) => {
    setTestingMcpId(id);
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test", serverId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "MCP server responded successfully!");
        setMcpServers((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "connected" } : s))
        );
      } else {
        toast.error(data.error || "MCP server verification failed");
      }
    } catch {
      toast.error("Network error testing MCP server");
    } finally {
      setTestingMcpId(null);
    }
  };

  const handleAddMcpServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMcpName.trim()) {
      toast.error("Please enter a server name");
      return;
    }
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          serverConfig: {
            name: newMcpName.trim(),
            description: newMcpDesc.trim(),
            transport: newMcpTransport,
            command: newMcpTransport === "stdio" ? newMcpCommand.trim() : undefined,
            args: newMcpTransport === "stdio" ? newMcpArgs.split(" ").filter(Boolean) : undefined,
            url: newMcpTransport === "sse" ? newMcpUrl.trim() : undefined,
          },
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`MCP Server "${newMcpName}" registered`);
        setMcpServers((prev) => [...prev, data.server]);
        setShowAddMcpModal(false);
        setNewMcpName("");
        setNewMcpDesc("");
        setNewMcpArgs("");
        setNewMcpUrl("");
      } else {
        toast.error(data.error || "Failed to register server");
      }
    } catch {
      toast.error("Error creating MCP server");
    }
  };

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
    { id: "models", label: "Available Models", icon: Zap },
    { id: "mcp", label: "MCP Server Hub", icon: Cpu },
    { id: "webhooks", label: "Webhooks & Simulator", icon: Radio },
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
          <span className="text-[11px] font-medium text-[#0075de] bg-[#e6f3fe] px-2.5 py-0.5 rounded-full border border-[#0075de]/20 inline-flex items-center gap-1.5">
            <Key className="w-3 h-3 text-[#0075de]" />
            Configuration Hub
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Manage model provider credentials and local Obsidian vault storage
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 p-0.5 rounded-lg bg-muted border border-border w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? "bg-card text-foreground font-semibold"
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
                                className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors gap-3"
                              >
                                <span className="text-xs font-mono text-muted-foreground truncate min-w-0 flex-1" title={m.id}>
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

      {/* MCP Server Hub Tab */}
      {activeTab === "mcp" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-foreground">Model Context Protocol (MCP) Hub</h3>
              <p className="text-xs text-muted-foreground">
                Connect external tool servers, resources, and filesystem sandboxes for your agent fleet
              </p>
            </div>

            <button
              onClick={() => setShowAddMcpModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition cursor-pointer w-fit"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add MCP Server</span>
            </button>
          </div>

          {loadingMcp ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span>Discovering MCP services...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {mcpServers.map((server) => (
                <div
                  key={server.id}
                  className="p-4 rounded-xl border border-border bg-card shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-secondary text-foreground">
                          <Server className="w-4 h-4 text-primary" />
                        </div>
                        <h4 className="text-sm font-semibold text-foreground">{server.name}</h4>
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                          server.enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-secondary text-muted-foreground border-border"
                        }`}
                      >
                        {server.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {server.description || "Model Context Protocol provider"}
                    </p>

                    <div className="pt-1 flex items-center gap-2 text-[10.5px] font-mono text-muted-foreground">
                      <span className="px-1.5 py-0.5 rounded bg-secondary border border-border">
                        {server.transport}
                      </span>
                      {server.command && (
                        <span className="truncate max-w-[150px]">{server.command} {server.args?.join(" ")}</span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleTestMcp(server.id)}
                      disabled={testingMcpId === server.id}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium border border-border bg-secondary hover:bg-secondary/80 text-foreground transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {testingMcpId === server.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      <span>Ping</span>
                    </button>

                    <button
                      onClick={() => handleToggleMcp(server.id)}
                      disabled={togglingMcpId === server.id}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        server.enabled
                          ? "bg-secondary hover:bg-muted text-foreground border border-border"
                          : "bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                    >
                      {server.enabled ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add MCP Server Modal */}
          {showAddMcpModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Add Custom MCP Server</h3>
                  <button
                    onClick={() => setShowAddMcpModal(false)}
                    className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleAddMcpServer} className="space-y-3 text-xs">
                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Server Name</label>
                    <input
                      type="text"
                      value={newMcpName}
                      onChange={(e) => setNewMcpName(e.target.value)}
                      placeholder="e.g. SQLite Inspector or Linear API"
                      className="w-full p-2 rounded-lg border border-border bg-background text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Description</label>
                    <input
                      type="text"
                      value={newMcpDesc}
                      onChange={(e) => setNewMcpDesc(e.target.value)}
                      placeholder="What tools does this server provide?"
                      className="w-full p-2 rounded-lg border border-border bg-background text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-muted-foreground block mb-1">Transport</label>
                    <select
                      value={newMcpTransport}
                      onChange={(e: any) => setNewMcpTransport(e.target.value)}
                      className="w-full p-2 rounded-lg border border-border bg-background text-foreground"
                    >
                      <option value="stdio">stdio (Local Process)</option>
                      <option value="sse">sse (Server-Sent Events / Remote URL)</option>
                    </select>
                  </div>

                  {newMcpTransport === "stdio" ? (
                    <>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Command</label>
                        <input
                          type="text"
                          value={newMcpCommand}
                          onChange={(e) => setNewMcpCommand(e.target.value)}
                          placeholder="npx or node"
                          className="w-full p-2 rounded-lg border border-border bg-background text-foreground font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-muted-foreground block mb-1">Arguments (space separated)</label>
                        <input
                          type="text"
                          value={newMcpArgs}
                          onChange={(e) => setNewMcpArgs(e.target.value)}
                          placeholder="-y @modelcontextprotocol/server-sqlite --db ./data.db"
                          className="w-full p-2 rounded-lg border border-border bg-background text-foreground font-mono"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">SSE URL</label>
                      <input
                        type="text"
                        value={newMcpUrl}
                        onChange={(e) => setNewMcpUrl(e.target.value)}
                        placeholder="https://mcp.internal.company.com/sse"
                        className="w-full p-2 rounded-lg border border-border bg-background text-foreground font-mono"
                      />
                    </div>
                  )}

                  <div className="pt-2 flex justify-end gap-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setShowAddMcpModal(false)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-secondary text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold"
                    >
                      Register Server
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Webhooks & Simulator Tab */}
      {activeTab === "webhooks" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <WebhookSimulator agents={agents as any} />
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
