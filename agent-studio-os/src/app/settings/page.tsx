"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsSidebar } from "./components/settings-sidebar";
import { SectionHeader } from "./components/section-header";
import { ProvidersTab, type ProviderInfo } from "./components/providers-tab";
import { DevicesTab } from "./devices-tab";
import { ModelsTab, type ModelEntry } from "./components/models-tab";
import { MCPTab } from "./components/mcp-tab";
import { VaultTab, type VaultStats } from "./components/vault-tab";
import { SkillsTab } from "./components/skills-tab";
import { DiagnosticsTab } from "./components/diagnostics-tab";
import { AnalyticsTab } from "./components/analytics-tab";
import { WebhookSimulator } from "@/components/routines/webhook-simulator";
import { ConfirmModal } from "@/components/confirm-modal";
import type { MCPServerConfig } from "@/types/mcp";
import type { ExternalSkill } from "@/types/skills";

interface AgentSimple {
  id: string;
  displayName: string;
  avatar: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("providers");
  const [searchQuery, setSearchQuery] = useState("");
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ModelEntry[]>([]);
  const [agents, setAgents] = useState<AgentSimple[]>([]);
  const [omnirouteOnline, setOmnirouteOnline] = useState(false);
  const [activeChannelsCount, setActiveChannelsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Normalize legacy tab aliases to canonical tab IDs
  const normalizeTab = (tab: string | null): string => {
    if (!tab) return "providers";
    if (tab === "devices") return "chat-apps";
    if (tab === "vault") return "storage";
    if (tab === "danger") return "diagnostics";
    if (
      ["providers", "models", "skills", "mcp", "chat-apps", "webhooks", "storage", "diagnostics", "analytics"].includes(
        tab
      )
    ) {
      return tab;
    }
    return "providers";
  };

  // Sync activeTab with URL ?tab= parameter
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam) {
        setActiveTab(normalizeTab(tabParam));
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
  const [envVarToDelete, setEnvVarToDelete] = useState<string | null>(null);

  // MCP Server state
  const [mcpServers, setMcpServers] = useState<MCPServerConfig[]>([]);
  const [loadingMcp, setLoadingMcp] = useState(false);
  const [testingMcpId, setTestingMcpId] = useState<string | null>(null);
  const [togglingMcpId, setTogglingMcpId] = useState<string | null>(null);

  // External Skills state
  const [skills, setSkills] = useState<ExternalSkill[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [togglingSkillId, setTogglingSkillId] = useState<string | null>(null);

  const fetchSkills = useCallback(async () => {
    try {
      setLoadingSkills(true);
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      toast.error("Failed to load skills");
    } finally {
      setLoadingSkills(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  const handleToggleSkill = async (id: string, enabled?: boolean) => {
    setTogglingSkillId(id);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", skillId: id, enabled }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSkills((prev) =>
          prev.map((s) => (s.id === id ? { ...s, enabled: data.skill.enabled } : s))
        );
        toast.success(
          `Skill "${data.skill.displayName}" ${data.skill.enabled ? "enabled" : "disabled"}`
        );
      } else {
        toast.error(data.error || "Failed to toggle skill");
      }
    } catch {
      toast.error("Network error toggling skill");
    } finally {
      setTogglingSkillId(null);
    }
  };

  const handleAddSkill = async (skillData: any) => {
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add", skill: skillData }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSkills((prev) => [...prev, data.skill]);
        return true;
      } else {
        toast.error(data.error || "Failed to add skill");
        return false;
      }
    } catch {
      toast.error("Network error adding skill");
      return false;
    }
  };

  const handleUpdateSkill = async (id: string, updates: any) => {
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", skillId: id, updates }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSkills((prev) => prev.map((s) => (s.id === id ? data.skill : s)));
        return true;
      } else {
        toast.error(data.error || "Failed to update skill");
        return false;
      }
    } catch {
      toast.error("Network error updating skill");
      return false;
    }
  };

  const handleDeleteSkill = async (id: string) => {
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", skillId: id }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSkills((prev) => prev.filter((s) => s.id !== id));
        return true;
      } else {
        toast.error(data.error || "Failed to delete skill");
        return false;
      }
    } catch {
      toast.error("Network error deleting skill");
      return false;
    }
  };

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
          prev.map((s) =>
            s.id === id ? { ...s, enabled: data.server.enabled, status: data.server.status } : s
          )
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
      const [providersRes, modelsRes, agentsRes, vaultRes, channelsRes] = await Promise.all([
        fetch("/api/providers"),
        fetch("/api/models"),
        fetch("/api/agents"),
        fetch("/api/vault?action=stats"),
        fetch("/api/integrations").catch(() => null),
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
            avatar: a.avatar || "bot",
          }))
        );
      }

      if (vaultRes.ok) {
        setVaultStats(await vaultRes.json());
      }

      if (channelsRes && channelsRes.ok) {
        const channelsData = await channelsRes.json();
        if (Array.isArray(channelsData)) {
          const activeCount = channelsData.filter(
            (c: any) => c.status === "connected" || c.currentEnabled || c.enabled
          ).length;
          setActiveChannelsCount(activeCount);
        }
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
    setEnvVarToDelete(envVar);
  };

  const confirmDeleteKey = async () => {
    if (!envVarToDelete) return;
    const envVar = envVarToDelete;
    setDeletingKey(envVar);
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", envVar }),
      });

      if (res.ok) {
        toast.success(`Removed ${envVar}`);
        setEnvVarToDelete(null);
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
    <div className="w-full max-w-7xl mx-auto pb-16 space-y-6">
      {/* Settings Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-border/70">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage AI credentials, skills, communication channels, and local storage
          </p>
        </div>

        {/* Global Router Gateway Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card shadow-2xs self-start sm:self-auto text-xs">
          <span
            className={`w-2 h-2 rounded-full ${
              omnirouteOnline ? "bg-emerald-500 ring-2 ring-emerald-500/20 animate-pulse" : "bg-amber-500"
            }`}
          />
          <span className="font-mono text-[11px] text-foreground font-medium">
            {omnirouteOnline ? "OmniRoute Gateway Live" : "Direct Provider Mode"}
          </span>
        </div>
      </div>

      {/* Master-Detail Two-Column Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-8">
        {/* Left Sidebar Navigation */}
        <SettingsSidebar
          activeTab={activeTab}
          onTabChange={handleTabChange}
          stats={{
            activeProviders: activeProvidersCount,
            totalProviders: providers.length,
            modelsCount: models.length,
            activeMcpServers: activeMcpCount,
            vaultNotes: vaultStats?.noteCount ?? 0,
            omnirouteOnline,
            activeSkillsCount: skills.filter((s) => s.enabled).length,
            totalSkillsCount: skills.length,
            activeChannelsCount,
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        {/* Right Active Content Panel with Smooth Animation */}
        <main className="flex-1 min-w-0 w-full space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="space-y-6"
            >
              {/* Providers View */}
              {activeTab === "providers" && (
                <>
                  <SectionHeader
                    category="AI Setup"
                    title="Providers"
                    description="Configure direct LLM API keys for OpenAI, Anthropic, Gemini, Groq, and DeepSeek, or connect via OmniRoute."
                    badge={omnirouteOnline ? "OmniRoute Gateway Live" : "Direct Provider Mode"}
                    badgeVariant={omnirouteOnline ? "success" : "default"}
                  />
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
                </>
              )}

              {/* Models View */}
              {activeTab === "models" && (
                <>
                  <SectionHeader
                    category="AI Setup"
                    title="Models"
                    description="Discover indexed AI models, inspect latency, test inferences, and manage smart routing."
                    badge={models.length > 0 ? `${models.length} Models Indexed` : undefined}
                    badgeVariant="info"
                  />
                  <ModelsTab
                    models={models}
                    omnirouteOnline={omnirouteOnline}
                    onRefreshModels={handleRefreshModels}
                    refreshingModels={refreshingModels}
                    onTestModel={testModel}
                    testingModel={testingModel}
                    testResults={testResults}
                  />
                </>
              )}

              {/* Skills View */}
              {activeTab === "skills" && (
                <>
                  <SectionHeader
                    category="Tools"
                    title="Skills"
                    description="Custom sandboxed scripts, REST APIs, and tool execution instructions callable by all agents."
                    badge={
                      skills.filter((s) => s.enabled).length > 0
                        ? `${skills.filter((s) => s.enabled).length} Live Skills`
                        : undefined
                    }
                    badgeVariant="success"
                  />
                  <SkillsTab
                    skills={skills}
                    loading={loadingSkills}
                    onRefresh={fetchSkills}
                    onToggleSkill={handleToggleSkill}
                    onAddSkill={handleAddSkill}
                    onUpdateSkill={handleUpdateSkill}
                    onDeleteSkill={handleDeleteSkill}
                    togglingId={togglingSkillId}
                  />
                </>
              )}

              {/* MCP Servers View */}
              {activeTab === "mcp" && (
                <>
                  <SectionHeader
                    category="Tools"
                    title="MCP"
                    description="Model Context Protocol servers providing external databases, filesystem sandboxes, and search tools."
                    badge={activeMcpCount > 0 ? `${activeMcpCount} Connected` : undefined}
                    badgeVariant="success"
                  />
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
                </>
              )}

              {/* Chat Apps View */}
              {activeTab === "chat-apps" && (
                <>
                  <SectionHeader
                    category="Communications"
                    title="Chat Apps"
                    description="Connect autonomous agents to WhatsApp QR session, Telegram bot, Discord, and Slack messaging channels."
                    badge={activeChannelsCount > 0 ? `${activeChannelsCount} Active Channels` : undefined}
                    badgeVariant={activeChannelsCount > 0 ? "success" : "default"}
                  />
                  <DevicesTab agents={agents} />
                </>
              )}

              {/* Webhooks View */}
              {activeTab === "webhooks" && (
                <>
                  <SectionHeader
                    category="Communications"
                    title="Webhooks"
                    description="Inbound webhook endpoints, payload simulation, and autonomous routine execution triggers."
                    badge="Authenticated Endpoints"
                    badgeVariant="info"
                  />
                  <div className="space-y-4">
                    <WebhookSimulator agents={agents as any} />
                  </div>
                </>
              )}

              {/* Storage View */}
              {activeTab === "storage" && (
                <>
                  <SectionHeader
                    category="System"
                    title="Storage"
                    description="Persistent local directory paths for code projects, screenshots, and Obsidian memory synchronization."
                    badge={vaultStats?.noteCount ? `${vaultStats.noteCount} Notes` : undefined}
                    badgeVariant="info"
                  />
                  <VaultTab
                    vaultStats={vaultStats}
                    onSyncVault={handleSyncVault}
                    onOpenObsidian={handleOpenObsidian}
                    syncingVault={syncingVault}
                  />
                </>
              )}

              {/* Diagnostics View */}
              {activeTab === "diagnostics" && (
                <>
                  <SectionHeader
                    category="System"
                    title="Diagnostics"
                    description="System health telemetry, database WAL status, and runtime cache management."
                    badge={omnirouteOnline ? "Fleet Healthy" : "Ready"}
                    badgeVariant={omnirouteOnline ? "success" : "default"}
                  />
                  <DiagnosticsTab
                    onRefreshData={fetchData}
                    omnirouteOnline={omnirouteOnline}
                  />
                </>
              )}

              {/* Analytics View */}
              {activeTab === "analytics" && (
                <>
                  <SectionHeader
                    category="System"
                    title="Analytics"
                    description="Real-time model routing telemetry, token consumption, and estimated provider costs."
                    badge="Live Telemetry"
                    badgeVariant="info"
                  />
                  <AnalyticsTab />
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Delete API Key / Provider Confirm Modal */}
      <ConfirmModal
        isOpen={!!envVarToDelete}
        onClose={() => {
          if (!deletingKey) setEnvVarToDelete(null);
        }}
        onConfirm={confirmDeleteKey}
        title="Remove API Key"
        description="Are you sure you want to remove this provider credential?"
        itemTitle={envVarToDelete || undefined}
        dangerDetails="Agents relying on this model provider will fail unless alternative credentials are configured."
        confirmText="Remove Key"
        variant="danger"
        loading={!!deletingKey}
      />
    </div>
  );
}
