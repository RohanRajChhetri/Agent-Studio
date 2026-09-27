"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader } from "./components/settings-header";
import { ProvidersTab, type ProviderInfo } from "./components/providers-tab";
import { DevicesTab } from "./devices-tab";
import { ModelsTab, type ModelEntry } from "./components/models-tab";
import { MCPTab } from "./components/mcp-tab";
import { VaultTab, type VaultStats } from "./components/vault-tab";
import { DiagnosticsTab } from "./components/diagnostics-tab";
import { WebhookSimulator } from "@/components/routines/webhook-simulator";
import type { MCPServerConfig } from "@/types/mcp";

interface AgentSimple {
  id: string;
  displayName: string;
  avatar: string;
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
      if (
        tabParam &&
        ["providers", "devices", "models", "mcp", "webhooks", "vault", "danger"].includes(tabParam)
      ) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  // API Key management state
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [testingKey, setTestingKey] = useState<string | null>(null);
  const [keyTestStatus, setKeyTestStatus] = useState<
    Record<string, { success: boolean; latency?: number; error?: string }>
  >({});

  // Model inspection state
  const [refreshingModels, setRefreshingModels] = useState(false);
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; latency: number; error?: string }>
  >({});

  // Vault stats state
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [syncingVault, setSyncingVault] = useState(false);

  // MCP Server state
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [loadingMcp, setLoadingMcp] = useState(false);
  const [testingMcpId, setTestingMcpId] = useState<string | null>(null);
  const [togglingMcpId, setTogglingMcpId] = useState<string | null>(null);

  const fetchMcpServers = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    if (activeTab === "mcp") {
      fetchMcpServers();
    }
  }, [activeTab, fetchMcpServers]);

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

  const handleAddMcpServer = async (serverConfig: {
    name: string;
    description: string;
    transport: "stdio" | "sse";
    command?: string;
    args?: string[];
    url?: string;
  }) => {
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add",
          serverConfig,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`MCP Server "${serverConfig.name}" registered`);
        setMcpServers((prev) => [...prev, data.server]);
      } else {
        toast.error(data.error || "Failed to register server");
        throw new Error(data.error);
      }
    } catch (err) {
      toast.error("Error creating MCP server");
      throw err;
    }
  };

  const handleDeleteMcpServer = async (id: string) => {
    try {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", serverId: id }),
      });
      if (res.ok) {
        setMcpServers((prev) => prev.filter((s) => s.id !== id));
        toast.success("MCP Server removed");
      } else {
        toast.error("Failed to remove MCP server");
      }
    } catch {
      toast.error("Network error removing MCP server");
    }
  };

  const fetchData = useCallback(async () => {
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
        const rawAgents = Array.isArray(agentsData) ? agentsData : agentsData.agents || [];
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
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const saveKey = async (provider: string, envVar: string, value: string) => {
    setSavingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", provider, envVar, value }),
      });

      if (res.ok) {
        toast.success(`Saved API key for ${provider}`);
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

  const testKey = async (provider: string, envVar: string, value?: string) => {
    setTestingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test",
          provider,
          envVar,
          value: value || undefined,
        }),
      });

      const data = await res.json();
      setKeyTestStatus((prev) => ({ ...prev, [envVar]: data }));
      if (data.success) {
        toast.success(`${provider} verification passed`);
      } else {
        toast.error(data.error || `${provider} key validation failed`);
      }
      return data;
    } catch {
      const fail = { success: false, error: "Network error testing key" };
      setKeyTestStatus((prev) => ({
        ...prev,
        [envVar]: fail,
      }));
      toast.error("Network error testing key");
      return fail;
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
        toast.success(`${modelId}: latency recorded`);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground font-mono">Loading settings and fleet telemetry...</span>
      </div>
    );
  }

  const activeProvidersCount = providers.filter((p) => p.isSet).length;
  const activeMcpCount = mcpServers.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto pb-12">
      {/* Settings Modern Header with Tabs */}
      <SettingsHeader
        activeTab={activeTab}
        onTabChange={handleTabChange}
        stats={{
          activeProviders: activeProvidersCount,
          totalProviders: providers.length,
          modelsCount: models.length,
          activeMcpServers: activeMcpCount,
          vaultNotes: vaultStats?.noteCount ?? 0,
          omnirouteOnline,
        }}
      />

      {/* Providers Tab */}
      {activeTab === "providers" && (
        <ProvidersTab
          providers={providers}
          onSaveKey={saveKey}
          onDeleteKey={deleteKey}
          onTestKey={testKey}
          keyTestStatus={keyTestStatus}
          savingKey={savingKey}
          deletingKey={deletingKey}
          testingKey={testingKey}
        />
      )}

      {/* Omnichannel & Devices Tab */}
      {activeTab === "devices" && (
        <DevicesTab agents={agents} />
      )}

      {/* Models Directory Tab */}
      {activeTab === "models" && (
        <ModelsTab
          models={models}
          omnirouteOnline={omnirouteOnline}
          onRefreshModels={handleRefreshModels}
          refreshingModels={refreshingModels}
          onTestModel={testModel}
          testingModel={testingModel}
          testResults={testResults}
        />
      )}

      {/* MCP Server Hub Tab */}
      {activeTab === "mcp" && (
        <MCPTab
          servers={mcpServers}
          loading={loadingMcp}
          onToggleServer={handleToggleMcp}
          onTestServer={handleTestMcp}
          onAddServer={handleAddMcpServer}
          onDeleteServer={handleDeleteMcpServer}
          testingMcpId={testingMcpId}
          togglingMcpId={togglingMcpId}
        />
      )}

      {/* Shared Memory Vault Tab */}
      {activeTab === "vault" && (
        <VaultTab
          vaultStats={vaultStats}
          onSyncVault={handleSyncVault}
          onOpenObsidian={handleOpenObsidian}
          syncingVault={syncingVault}
        />
      )}

      {/* Webhooks & Event Simulator Tab */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <WebhookSimulator agents={agents as any} />
        </div>
      )}

      {/* Diagnostics & Concurrency Health Tab */}
      {activeTab === "danger" && (
        <DiagnosticsTab
          onRefreshData={fetchData}
          omnirouteOnline={omnirouteOnline}
        />
      )}
    </div>
  );
}
