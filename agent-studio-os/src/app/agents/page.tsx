"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Bot,
  Trash2,
  Terminal,
  Globe,
  Search,
  Eye,
  Code,
  Brain,
  FileText,
  Image,
  Users,
  Monitor,
  Music,
  ListTodo,
  BookOpen,
  Volume2,
  X,
  Loader2,
  MessageSquare,
  Pencil,
  Sparkles,
  Copy,
  Check,
  Wand2,
  Cpu,
  Layers,
  ShieldCheck,
  ChevronDown,
  Zap,
  EyeOff,
  Smartphone,
  CheckCircle2,
  RefreshCw,
  Radio,
  Send,
  Key,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { AgentAvatar, AGENT_ICON_PRESETS } from "@/components/ui/agent-avatar";

import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { TOOL_DEFINITIONS, INTEGRATION_DEFINITIONS } from "@/types";
import { slugify } from "@/lib/utils";
import { HermesTerminalModal } from "@/components/agents/hermes-terminal-modal";
import { AgentHierarchyView } from "@/components/agents/agent-hierarchy-view";
import { AgentPacksModal } from "@/components/agents/agent-packs-modal";

const iconMap: Record<string, React.ElementType> = {
  Terminal, Globe, Search, Eye, Code, Brain, FileText, Image,
  Users, Monitor, Music, ListTodo, BookOpen, Volume2,
};

const ROLE_OPTIONS = [
  { value: "specialist", label: "Specialist", desc: "Domain expert — code, research, analysis" },
  { value: "orchestrator", label: "Orchestrator", desc: "Directs overall goals and planning" },
  { value: "manager", label: "Manager", desc: "Coordinates milestones and delegates" },
  { value: "worker", label: "Worker", desc: "Executes routines and tool calls" },
];

const POPULAR_MODELS = [
  { id: "", label: "Default Router (OmniRoute Cascade)", provider: "Auto" },
  { id: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "anthropic/claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "Anthropic" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google" },
  { id: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", provider: "DeepSeek" },
  { id: "deepseek/deepseek-coder", label: "DeepSeek Coder", provider: "DeepSeek" },
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", provider: "Groq" },
  { id: "ollama/llama3.2", label: "Llama 3.2 (Local)", provider: "Ollama" },
];

function AgentFormModal({
  isOpen,
  onClose,
  onSaved,
  existingAgents,
  editAgent,
  onDelete,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingAgents: AgentProfile[];
  editAgent?: (AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null;
  onDelete?: (agent: AgentProfile) => void;
}) {
  const isEditMode = !!editAgent;
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("bot");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("specialist");
  const [department, setDepartment] = useState("Engineering");
  const [reportsToId, setReportsToId] = useState<string>("");
  const [selectedTools, setSelectedTools] = useState<string[]>(["terminal", "file", "web"]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [availableModels, setAvailableModels] = useState(POPULAR_MODELS);

  // Channel direct connection states
  const [channelConfigs, setChannelConfigs] = useState<Record<string, any>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testingChannel, setTestingChannel] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [waState, setWaState] = useState<{ qrDataUrl?: string; hasSession?: boolean }>({});
  const [waPairing, setWaPairing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch("/api/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models && Array.isArray(data.models) && data.models.length > 0) {
          const map = new Map<string, any>();
          POPULAR_MODELS.forEach((m) => map.set(m.id, m));
          data.models.forEach((m: any) => {
            if (!map.has(m.id)) {
              map.set(m.id, {
                id: m.id,
                label: m.name || m.id,
                provider: m.provider || "Configured",
              });
            }
          });
          setAvailableModels(Array.from(map.values()));
        }
      })
      .catch(() => { });
  }, [isOpen]);

  useEffect(() => {
    if (editAgent) {
      setName(editAgent.displayName || "");
      setAvatar(editAgent.avatar || "bot");
      setSystemPrompt(editAgent.systemPrompt || "");
      setModel(editAgent.model || "");
      setDescription(editAgent.description || "");
      setRole(editAgent.role || "specialist");
      setDepartment(editAgent.department || "Engineering");
      setReportsToId(editAgent.reportsToId || "");
      setSelectedTools(
        editAgent.tools?.filter((t) => t.enabled).map((t) => t.toolId) || ["terminal", "file", "web"]
      );
      setSelectedIntegrations(
        editAgent.integrations?.filter((i) => i.enabled).map((i) => i.platform) || []
      );

      // Fetch saved channel credentials
      fetch(`/api/integrations?agentId=${editAgent.id}`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            const configs: Record<string, any> = {};
            data.forEach((item: any) => {
              if (item.currentConfig) {
                configs[item.id] = { ...item.currentConfig };
              }
            });
            setChannelConfigs(configs);
          }
        })
        .catch(() => { });

      // Fetch whatsapp status
      fetch(`/api/integrations/whatsapp?agentId=${editAgent.id}`)
        .then((r) => r.json())
        .then((data) => {
          setWaState({ hasSession: Boolean(data.hasSession) });
        })
        .catch(() => { });
    } else {
      setName("");
      setAvatar("bot");
      setSystemPrompt("");
      setModel("");
      setDescription("");
      setRole("specialist");
      setDepartment("Engineering");
      setReportsToId("");
      setSelectedTools(["terminal", "file", "web"]);
      setSelectedIntegrations([]);
      setChannelConfigs({});
      setWaState({});
      setTestResults({});
    }
    setShowAvatarPicker(false);
  }, [editAgent, isOpen]);

  // WhatsApp QR status poller
  useEffect(() => {
    if (!waState.qrDataUrl || waState.hasSession) return;
    const targetId = editAgent?.id || "temp-pair";
    const timer = setInterval(async () => {
      try {
        const res = await fetch("/api/integrations/whatsapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "check_status", agentId: targetId }),
        });
        const data = await res.json();
        if (data.hasSession || data.state?.status === "connected") {
          setWaState((prev) => ({ ...prev, qrDataUrl: undefined, hasSession: true }));
          toast.success("WhatsApp paired successfully!");
        }
      } catch { }
    }, 2500);
    return () => clearInterval(timer);
  }, [waState.qrDataUrl, waState.hasSession, editAgent?.id]);

  const handleConfigChange = (platform: string, field: string, value: any) => {
    setChannelConfigs((prev) => ({
      ...prev,
      [platform]: {
        ...(prev[platform] || {}),
        [field]: value,
      },
    }));
  };

  const handleTestChannel = async (platform: string) => {
    setTestingChannel(platform);
    const cfg = channelConfigs[platform] || {};
    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, config: cfg }),
      });
      const data = await res.json();
      if (data.success) {
        const msg = data.details?.statusText || data.details?.username || "Verified";
        setTestResults((prev) => ({ ...prev, [platform]: { success: true, message: msg } }));
        toast.success(`${platform.toUpperCase()} connection verified: ${msg}`);
      } else {
        setTestResults((prev) => ({ ...prev, [platform]: { success: false, message: data.error || "Failed" } }));
        toast.error(data.error || `Failed to verify ${platform}`);
      }
    } catch {
      toast.error(`Verification error for ${platform}`);
    } finally {
      setTestingChannel(null);
    }
  };

  const handleStartWaPair = async () => {
    const targetId = editAgent?.id || "temp-pair";
    setWaPairing(true);
    try {
      const res = await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start_pair",
          agentId: targetId,
          mode: "self-chat",
          force: true,
        }),
      });
      const data = await res.json();
      if (data.status === "qr_ready" && data.qrDataUrl) {
        setWaState((prev) => ({ ...prev, qrDataUrl: data.qrDataUrl }));
        toast.info("Scan the QR code with WhatsApp on your phone");
      } else if (data.status === "connected" || data.hasSession) {
        setWaState((prev) => ({ ...prev, hasSession: true, qrDataUrl: undefined }));
        toast.success("WhatsApp is already connected for this agent");
      } else {
        toast.error(data.error || "Failed to generate pairing QR");
      }
    } catch {
      toast.error("Error initiating WhatsApp pairing");
    } finally {
      setWaPairing(false);
    }
  };

  const handleDisconnectWa = async () => {
    const targetId = editAgent?.id || "temp-pair";
    try {
      await fetch("/api/integrations/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_session", agentId: targetId }),
      });
      setWaState({ hasSession: false, qrDataUrl: undefined });
      toast.success("WhatsApp disconnected");
    } catch {
      toast.error("Failed to disconnect WhatsApp");
    }
  };

  const handleAutoGenerateDirective = () => {
    const roleDesc = ROLE_OPTIONS.find((r) => r.value === role)?.desc || role;
    const toolsList = selectedTools.join(", ") || "core analytical reasoning";
    const newDirective = `You are ${name || "an autonomous AI operative"}, functioning as the ${role.toUpperCase()} in the ${department} department.
Primary objective: ${description || "Execute assigned directives with maximum reliability, precision, and efficiency."}

Operational Directives:
- Role & Profile: ${role} (${roleDesc}).
- Toolset Capabilities: Leverage your active tools (${toolsList}) to explore, diagnose, implement, and verify tasks.
- Deliverables: Provide structured, unambiguous outputs with clear steps and actionable conclusions.`;
    setSystemPrompt(newDirective);
    toast.success("Drafted tailored system directive!");
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        displayName: name.trim(),
        avatar,
        systemPrompt,
        model: model.trim() || null,
        description: description.trim(),
        role,
        department: department.trim() || null,
        reportsToId: reportsToId || null,
        tools: selectedTools,
        integrations: selectedIntegrations,
      };

      const url = isEditMode && editAgent ? `/api/agents/${editAgent.id}` : "/api/agents";
      const method = isEditMode && editAgent ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save agent");
      }

      const savedAgent = await res.json();
      const targetAgentId = savedAgent.id || editAgent?.id;

      if (targetAgentId) {
        // Save channel connection configurations
        for (const platform of selectedIntegrations) {
          const cfg = channelConfigs[platform] || {};
          try {
            await fetch("/api/integrations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                platform,
                agentId: targetAgentId,
                enabled: true,
                config: cfg,
              }),
            });
            if (platform === "telegram" && cfg.botToken) {
              fetch("/api/integrations/telegram", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "start_poller" }),
              }).catch(() => { });
            }
          } catch (e) {
            console.error(`Failed to save integration for ${platform}:`, e);
          }
        }

        // If editing, disable removed integrations
        if (editAgent?.integrations) {
          const removed = editAgent.integrations
            .filter((i) => i.enabled && !selectedIntegrations.includes(i.platform))
            .map((i) => i.platform);
          for (const platform of removed) {
            try {
              await fetch("/api/integrations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  platform,
                  agentId: targetAgentId,
                  enabled: false,
                }),
              });
            } catch { }
          }
        }
      }

      toast.success(isEditMode ? `Agent "${name}" updated` : `Agent "${name}" created with channel connections`);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {isEditMode ? "Edit Agent" : "New Agent"}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isEditMode ? `Update configuration and channel connections for ${name || "agent"}` : "Configure an autonomous specialist and connect communication channels"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4 py-4 max-h-[72vh] overflow-y-auto pr-1">
            {/* Name & Avatar Icon */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                  className="w-10 h-10 rounded-lg border border-border bg-secondary/40 flex items-center justify-center text-primary hover:bg-secondary transition cursor-pointer"
                  title="Choose avatar icon"
                >
                  <AgentAvatar avatar={avatar} className="w-5 h-5 text-primary" />
                </button>
                {showAvatarPicker && (
                  <div className="absolute top-12 left-0 z-50 p-2 rounded-xl border border-border bg-card shadow-xl grid grid-cols-6 gap-1 w-64">
                    {AGENT_ICON_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        title={preset.label}
                        onClick={() => {
                          setAvatar(preset.id);
                          setShowAvatarPicker(false);
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer ${
                          avatar === preset.id
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <preset.icon className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium text-foreground block mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. CodeWeaver, Scout, Atlas"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Role & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="specialist">Specialist</option>
                  <option value="orchestrator">Orchestrator</option>
                  <option value="manager">Manager</option>
                  <option value="worker">Worker</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">Department</label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Research"
                  className="w-full px-3 py-1.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Manager Reports To */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Reports To (Optional)</label>
              <select
                value={reportsToId}
                onChange={(e) => setReportsToId(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="">None (Top-Level Agent)</option>
                {existingAgents
                  .filter((a) => !editAgent || a.id !== editAgent.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.displayName} ({a.role})
                    </option>
                  ))}
              </select>
            </div>

            {/* Model */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Model</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label} ({m.provider})
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief mission statement or responsibilities"
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>

            {/* System Instructions */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">System Instructions</label>
                <button
                  type="button"
                  onClick={handleAutoGenerateDirective}
                  className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                >
                  Auto-Draft
                </button>
              </div>
              <textarea
                rows={3}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Persona guidelines, response formatting, and task execution rules..."
                className="w-full px-3 py-2 rounded-lg border border-border bg-secondary/30 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-y font-mono"
              />
            </div>

            {/* Tools */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Enabled Tools</label>
              <div className="flex flex-wrap gap-1.5">
                {TOOL_DEFINITIONS.map((tool) => {
                  const isSelected = selectedTools.includes(tool.id);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() =>
                        setSelectedTools((prev) =>
                          isSelected ? prev.filter((t) => t !== tool.id) : [...prev, tool.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${isSelected
                          ? "bg-[#e6f3fe] border-[#0075de]/30 text-[#0075de]"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {tool.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Connected Channels & Inline Configuration */}
            <div>
              <label className="text-xs font-medium text-foreground block mb-1.5">Connected Channels</label>
              <div className="flex flex-wrap gap-1.5">
                {INTEGRATION_DEFINITIONS.map((integ) => {
                  const isSelected = selectedIntegrations.includes(integ.id);
                  return (
                    <button
                      key={integ.id}
                      type="button"
                      onClick={() =>
                        setSelectedIntegrations((prev) =>
                          isSelected ? prev.filter((i) => i !== integ.id) : [...prev, integ.id]
                        )
                      }
                      className={`px-2.5 py-1 rounded-full text-xs font-medium border transition cursor-pointer ${isSelected
                          ? "bg-[#e6f3fe] border-[#0075de]/30 text-[#0075de] font-semibold"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      {integ.label}
                    </button>
                  );
                })}
              </div>

              {/* Inline Direct Channel Connections */}
              {selectedIntegrations.length > 0 && (
                <div className="mt-3 space-y-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-primary" />
                      Configure Channel Connections
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Connect directly from here
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedIntegrations.map((platform) => {
                      const def = INTEGRATION_DEFINITIONS.find((i) => i.id === platform);
                      const isTesting = testingChannel === platform;
                      const testResult = testResults[platform];
                      const cfg = channelConfigs[platform] || {};
                      const showSecret = Boolean(showSecrets[platform]);

                      return (
                        <div
                          key={platform}
                          className="p-3 rounded-xl border border-border bg-secondary/20 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-foreground">
                                {def?.label || platform}
                              </span>
                              {testResult?.success && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 font-medium">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  {testResult.message}
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedIntegrations((prev) => prev.filter((i) => i !== platform))
                              }
                              className="text-[11px] text-muted-foreground hover:text-red-500 transition cursor-pointer"
                            >
                              Disconnect
                            </button>
                          </div>

                          {/* 1. Telegram Config */}
                          {platform === "telegram" && (
                            <div className="space-y-2">
                              <div>
                                <label className="text-[11px] text-muted-foreground block mb-1">
                                  Telegram Bot Token (from @BotFather)
                                </label>
                                <div className="relative">
                                  <input
                                    type={showSecret ? "text" : "password"}
                                    value={cfg.botToken || ""}
                                    onChange={(e) =>
                                      handleConfigChange("telegram", "botToken", e.target.value)
                                    }
                                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                                    className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowSecrets((prev) => ({ ...prev, telegram: !showSecret }))
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                  >
                                    {showSecret ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <input
                                  type="text"
                                  value={cfg.chatId || ""}
                                  onChange={(e) =>
                                    handleConfigChange("telegram", "chatId", e.target.value)
                                  }
                                  placeholder="Default Chat ID / Channel (optional)"
                                  className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleTestChannel("telegram")}
                                  disabled={isTesting || !cfg.botToken}
                                  className="px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                >
                                  {isTesting && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Test Token</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 2. WhatsApp Personal (QR Bridge) */}
                          {platform === "whatsapp" && (
                            <div className="space-y-2 text-xs">
                              {waState.hasSession ? (
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                  <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="font-medium text-xs">
                                      WhatsApp Device Connected
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={handleDisconnectWa}
                                    className="text-xs text-red-500 hover:underline cursor-pointer"
                                  >
                                    Disconnect
                                  </button>
                                </div>
                              ) : waState.qrDataUrl ? (
                                <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-card border border-border text-center">
                                  <img
                                    src={waState.qrDataUrl}
                                    alt="WhatsApp QR Code"
                                    className="w-36 h-36 rounded-lg bg-white p-2 border shadow-xs"
                                  />
                                  <p className="text-[11px] text-muted-foreground">
                                    Open WhatsApp &rarr; <b>Linked Devices</b> &rarr; <b>Link a Device</b> &rarr; Scan QR
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setWaState((prev) => ({ ...prev, qrDataUrl: undefined }))
                                    }
                                    className="text-[11px] text-muted-foreground hover:text-foreground underline cursor-pointer"
                                  >
                                    Cancel QR
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                                  <span className="text-xs text-muted-foreground">
                                    Link your phone via QR code
                                  </span>
                                  <button
                                    type="button"
                                    onClick={handleStartWaPair}
                                    disabled={waPairing}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    {waPairing && <Loader2 className="w-3 h-3 animate-spin" />}
                                    <span>Pair via QR Code</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* 3. Discord */}
                          {platform === "discord" && (
                            <div className="space-y-2">
                              <label className="text-[11px] text-muted-foreground block mb-0.5">
                                Discord Bot Token or Webhook URL
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type={showSecret ? "text" : "password"}
                                    value={cfg.botToken || cfg.webhookUrl || ""}
                                    onChange={(e) =>
                                      handleConfigChange("discord", "botToken", e.target.value)
                                    }
                                    placeholder="Bot Token or https://discord.com/api/webhooks/..."
                                    className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowSecrets((prev) => ({ ...prev, discord: !showSecret }))
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                  >
                                    {showSecret ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleTestChannel("discord")}
                                  disabled={isTesting || (!cfg.botToken && !cfg.webhookUrl)}
                                  className="px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                                >
                                  {isTesting && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Test</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 4. Slack */}
                          {platform === "slack" && (
                            <div className="space-y-2">
                              <label className="text-[11px] text-muted-foreground block mb-0.5">
                                Slack Bot Token or Incoming Webhook URL
                              </label>
                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type={showSecret ? "text" : "password"}
                                    value={cfg.botToken || cfg.webhookUrl || ""}
                                    onChange={(e) =>
                                      handleConfigChange("slack", "botToken", e.target.value)
                                    }
                                    placeholder="xoxb-... or https://hooks.slack.com/services/..."
                                    className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowSecrets((prev) => ({ ...prev, slack: !showSecret }))
                                    }
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                  >
                                    {showSecret ? (
                                      <EyeOff className="w-3.5 h-3.5" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleTestChannel("slack")}
                                  disabled={isTesting || (!cfg.botToken && !cfg.webhookUrl)}
                                  className="px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                                >
                                  {isTesting && <Loader2 className="w-3 h-3 animate-spin" />}
                                  <span>Test</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 5. Webhook */}
                          {platform === "webhook" && (
                            <div className="space-y-2">
                              <div>
                                <label className="text-[11px] text-muted-foreground block mb-0.5">
                                  Webhook Endpoint URL
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="url"
                                    value={cfg.webhookUrl || ""}
                                    onChange={(e) =>
                                      handleConfigChange("webhook", "webhookUrl", e.target.value)
                                    }
                                    placeholder="https://api.yourdomain.com/events/agent"
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleTestChannel("webhook")}
                                    disabled={isTesting || !cfg.webhookUrl}
                                    className="px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-medium transition cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5"
                                  >
                                    {isTesting && <Loader2 className="w-3 h-3 animate-spin" />}
                                    <span>Ping</span>
                                  </button>
                                </div>
                              </div>
                              <input
                                type="text"
                                value={cfg.secretToken || ""}
                                onChange={(e) =>
                                  handleConfigChange("webhook", "secretToken", e.target.value)
                                }
                                placeholder="Optional Secret Token or Authorization header"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                          )}

                          {/* 6. WhatsApp Cloud API */}
                          {platform === "whatsapp_cloud" && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={cfg.phoneNumberId || ""}
                                onChange={(e) =>
                                  handleConfigChange("whatsapp_cloud", "phoneNumberId", e.target.value)
                                }
                                placeholder="Phone Number ID from Meta Developer Console"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                              />
                              <div className="relative">
                                <input
                                  type={showSecret ? "text" : "password"}
                                  value={cfg.accessToken || ""}
                                  onChange={(e) =>
                                    handleConfigChange("whatsapp_cloud", "accessToken", e.target.value)
                                  }
                                  placeholder="Meta System User Access Token"
                                  className="w-full pl-3 pr-8 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowSecrets((prev) => ({ ...prev, whatsapp_cloud: !showSecret }))
                                  }
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                                >
                                  {showSecret ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* 7. Signal */}
                          {platform === "signal" && (
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={cfg.phoneNumber || ""}
                                onChange={(e) =>
                                  handleConfigChange("signal", "phoneNumber", e.target.value)
                                }
                                placeholder="Signal Registered Phone Number (e.g. +1234567890)"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                              />
                              <input
                                type="text"
                                value={cfg.gatewayUrl || ""}
                                onChange={(e) =>
                                  handleConfigChange("signal", "gatewayUrl", e.target.value)
                                }
                                placeholder="Signal Gateway URL (e.g. http://127.0.0.1:8080)"
                                className="w-full px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-2 pt-4 border-t border-border mt-2">
            {isEditMode && editAgent && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onDelete(editAgent);
                }}
                className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-500 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                title="Delete this agent"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Agent</span>
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isEditMode ? "Update Agent" : "Create Agent"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AgentRow({
  agent,
  managerName,
  onDelete,
  onOpenHermes,
  onOpenMemories,
  onEdit,
}: {
  agent: AgentProfile & { taskCount?: number; hermesLinked?: boolean };
  managerName?: string;
  onDelete: (agent: AgentProfile) => void;
  onOpenHermes: (agent: AgentProfile) => void;
  onOpenMemories: (agent: AgentProfile) => void;
  onEdit: (agent: AgentProfile & { taskCount?: number; hermesLinked?: boolean }) => void;
}) {
  const enabledTools = agent.tools?.filter((t) => t.enabled) || [];
  const enabledIntegrations = agent.integrations?.filter((i) => i.enabled) || [];

  return (
    <motion.div
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 hover:bg-muted/40 transition-colors"
    >
      {/* Left: Avatar, Status Dot, Name, Role, Dept */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-lg bg-secondary/50 border border-border flex items-center justify-center text-primary">
            <AgentAvatar avatar={agent.avatar} className="w-4 h-4" />
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-card ${agent.status === "busy"
                ? "bg-amber-500 animate-pulse"
                : agent.status === "offline"
                  ? "bg-muted-foreground/40"
                  : "bg-emerald-500"
              }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate">
              {agent.displayName}
            </span>

            <span
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium border ${agent.role === "orchestrator"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : agent.role === "manager"
                    ? "bg-secondary text-foreground border-border"
                    : agent.role === "worker"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                      : "bg-purple-500/10 text-purple-600 dark:text-purple-300 border-purple-500/20"
                }`}
            >
              {agent.role || "specialist"}
            </span>

            {agent.department && (
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground border border-border text-[10px] font-mono font-medium">
                {agent.department}
              </span>
            )}

            {managerName && (
              <span className="hidden md:inline-block text-[11px] text-muted-foreground">
                reports to <span className="text-foreground font-medium">{managerName}</span>
              </span>
            )}
          </div>

          {agent.description && (
            <p className="text-xs text-muted-foreground truncate max-w-sm sm:max-w-md lg:max-w-lg mt-0.5">
              {agent.description}
            </p>
          )}
        </div>
      </div>

      {/* Middle: Capabilities summary */}
      <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
        {agent.model && (
          <span className="font-mono text-[11px] bg-secondary/50 px-2 py-0.5 rounded-sm border border-border/50 max-w-[120px] truncate">
            {agent.model.split("/").pop()}
          </span>
        )}

        {enabledTools.length > 0 && (
          <span className="text-[11px] font-mono text-muted-foreground">
            {enabledTools.length} {enabledTools.length === 1 ? "tool" : "tools"}
          </span>
        )}

        {enabledIntegrations.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-sm border border-primary/20">
            <Radio className="w-2.5 h-2.5" />
            {enabledIntegrations.length} {enabledIntegrations.length === 1 ? "channel" : "channels"}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5 shrink-0 justify-end">
        <Link
          href={`/chat?agentId=${agent.id}`}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-secondary hover:bg-muted-highlight text-foreground border border-border transition cursor-pointer"
          title="Chat with agent"
        >
          <MessageSquare className="w-3 h-3" />
          <span className="hidden sm:inline">Chat</span>
        </Link>

        <button
          onClick={() => onOpenHermes(agent)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-highlight border border-border transition cursor-pointer"
          title="Hermes Terminal"
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onOpenMemories(agent)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-highlight border border-border transition cursor-pointer"
          title="Knowledge & Memories"
        >
          <Brain className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onEdit(agent)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-highlight border border-border transition cursor-pointer"
          title="Edit agent & connections"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => onDelete(agent)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-border transition cursor-pointer"
          title="Delete agent"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

function AgentMemoryModal({
  agent,
  isOpen,
  onClose,
}: {
  agent: AgentProfile | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [memoryItem, setMemoryItem] = useState<any>(null);
  const [viewTab, setViewTab] = useState<"directives" | "raw">("directives");

  useEffect(() => {
    if (!isOpen || !agent) return;
    setLoading(true);
    fetch(`/api/agents/${agent.id}/memory`)
      .then((r) => r.json())
      .then((data) => {
        setMemoryItem(data);
      })
      .catch(() => {
        toast.error("Failed to load agent memories from vault");
      })
      .finally(() => setLoading(false));
  }, [isOpen, agent]);

  if (!isOpen || !agent) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-4 max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-secondary/60 border border-border flex items-center justify-center text-primary">
                <AgentAvatar avatar={agent.avatar} className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {agent.displayName} Memory Vault
                </h2>
                <p className="text-[11px] text-muted-foreground font-mono">
                  {memoryItem?.vaultPath || "Obsidian Shared Memory Layer"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* View Tab Switcher */}
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border w-fit text-xs">
            <button
              onClick={() => setViewTab("directives")}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${viewTab === "directives" ? "bg-card text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Learned Directives ({memoryItem?.extractedDirectives?.length || 0})
            </button>
            <button
              onClick={() => setViewTab("raw")}
              className={`px-3 py-1 rounded-md transition cursor-pointer ${viewTab === "raw" ? "bg-card text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Raw Vault Note
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[220px]">
            {loading ? (
              <div className="flex items-center justify-center h-44 text-muted-foreground text-xs">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading vault memories...
              </div>
            ) : viewTab === "directives" ? (
              <div className="space-y-2">
                {memoryItem?.extractedDirectives && memoryItem.extractedDirectives.length > 0 ? (
                  memoryItem.extractedDirectives.map((dir: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-border bg-secondary/30 text-xs text-foreground flex items-start gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>{dir}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-lg">
                    No directives extracted yet. Converse with this agent to build episodic memory.
                  </div>
                )}
              </div>
            ) : (
              <pre className="p-3 rounded-lg border border-border bg-secondary/30 text-xs font-mono text-muted-foreground whitespace-pre-wrap overflow-x-auto">
                {memoryItem?.rawContent || "// No vault entry written yet for this agent"}
              </pre>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<(AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null>(null);
  const [terminalAgent, setTerminalAgent] = useState<AgentProfile | null>(null);
  const [selectedMemoryAgent, setSelectedMemoryAgent] = useState<AgentProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"directory" | "hierarchy">("directory");
  const [showPacksModal, setShowPacksModal] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : data.agents || []);
      }
    } catch {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      if (tabParam === "pipeline") {
        window.location.replace("/workflows?tab=pipeline");
        return;
      }
      if (tabParam === "hierarchy" || tabParam === "directory") {
        setViewMode(tabParam);
      }
      if (params.get("new") === "true") {
        setShowCreate(true);
      }
      if (params.get("packs") === "true") {
        setShowPacksModal(true);
      }
    }
  }, [fetchAgents]);

  const [agentToDelete, setAgentToDelete] = useState<AgentProfile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!agentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/agents/${agentToDelete.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(`Agent "${agentToDelete.displayName}" deleted`);
        setAgents((prev) => prev.filter((a) => a.id !== agentToDelete.id));
        setAgentToDelete(null);
        if (editingAgent?.id === agentToDelete.id) {
          setEditingAgent(null);
        }
      } else {
        toast.error(data.error || "Failed to delete agent");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error deleting agent");
    } finally {
      setIsDeleting(false);
    }
  };

  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    agents.forEach((a) => map.set(a.id, a.displayName));
    return map;
  }, [agents]);

  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>("all");

  const filteredAgents = useMemo(() => {
    let list = agents;
    if (selectedRoleFilter !== "all") {
      list = list.filter((a) => (a.role || "specialist") === selectedRoleFilter);
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        (a.role && a.role.toLowerCase().includes(q)) ||
        (a.department && a.department.toLowerCase().includes(q)) ||
        (a.description && a.description.toLowerCase().includes(q))
    );
  }, [agents, searchQuery, selectedRoleFilter]);

  return (
    <div className="space-y-6 w-full">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Agents</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Directory and organizational hierarchy of specialist personas
          </p>
        </div>

        {/* View Mode Switch & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border text-xs">
            <button
              onClick={() => setViewMode("directory")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${viewMode === "directory" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Directory
            </button>
            <button
              onClick={() => setViewMode("hierarchy")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${viewMode === "hierarchy" ? "bg-card text-foreground font-semibold shadow-xs" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Hierarchy
            </button>
          </div>

          <button
            onClick={() => setShowPacksModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition cursor-pointer"
            title="1-Click deploy specialized agent fleets"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Starter Packs</span>
          </button>

          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Agent</span>
          </button>
        </div>
      </div>

      {/* Uncongested Search Bar & Role Filters */}
      <div className="w-full max-w-xl mx-auto space-y-2.5">
        <div className="relative">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents by name, role, department..."
            className="w-full pl-10 pr-9 py-2 rounded-xl border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Role Filter Pills */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap">
          {[
            { id: "all", label: "All" },
            { id: "orchestrator", label: "Orchestrators" },
            { id: "manager", label: "Managers" },
            { id: "specialist", label: "Specialists" },
            { id: "worker", label: "Workers" },
          ].map((tab) => {
            const count =
              tab.id === "all"
                ? agents.length
                : agents.filter((a) => (a.role || "specialist") === tab.id).length;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedRoleFilter(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${selectedRoleFilter === tab.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
              >
                <span>{tab.label}</span>
                <span className="opacity-70 text-[10px] font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {/* Results Counter if Filtered */}
        {(searchQuery || selectedRoleFilter !== "all") && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2 pt-0.5">
            <span>
              Showing {filteredAgents.length} of {agents.length} agents
            </span>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedRoleFilter("all");
              }}
              className="text-primary hover:underline cursor-pointer font-medium"
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/80" />
                <div className="space-y-1.5">
                  <div className="w-32 h-3.5 rounded bg-secondary/80" />
                  <div className="w-48 h-2.5 rounded bg-secondary/50" />
                </div>
              </div>
              <div className="w-24 h-6 rounded bg-secondary/60" />
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-[40vh] text-center"
        >
          <h2 className="text-base font-semibold mb-1">No agents yet</h2>
          <p className="text-xs text-muted-foreground mb-4 max-w-sm">
            Create your first AI agent with custom tools and communication channels
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-medium transition cursor-pointer"
          >
            + Create Your First Agent
          </button>
        </motion.div>
      ) : viewMode === "hierarchy" ? (
        <AgentHierarchyView
          agents={filteredAgents}
          onOpenHermes={setTerminalAgent}
          onRefresh={fetchAgents}
          onEdit={(a) => setEditingAgent(a)}
          onDelete={(a) => setAgentToDelete(a)}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden shadow-xs">
          <AnimatePresence mode="popLayout">
            {filteredAgents.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No agents found matching &ldquo;{searchQuery}&rdquo;
              </div>
            ) : (
              filteredAgents.map((agent) => (
                <AgentRow
                  key={agent.id}
                  agent={agent}
                  managerName={agent.reportsToId ? agentNameMap.get(agent.reportsToId) : undefined}
                  onDelete={(a) => setAgentToDelete(a)}
                  onOpenHermes={setTerminalAgent}
                  onOpenMemories={(a) => setSelectedMemoryAgent(a)}
                  onEdit={(a) => setEditingAgent(a)}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Create Modal */}
      <AgentFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={fetchAgents}
        existingAgents={agents}
      />

      {/* Edit Modal */}
      <AgentFormModal
        isOpen={!!editingAgent}
        onClose={() => setEditingAgent(null)}
        onSaved={fetchAgents}
        existingAgents={agents}
        editAgent={editingAgent}
        onDelete={(a) => setAgentToDelete(a)}
      />

      <HermesTerminalModal
        agent={terminalAgent}
        isOpen={!!terminalAgent}
        onClose={() => setTerminalAgent(null)}
        availableAgents={agents}
        onSelectAgent={(ag) => setTerminalAgent(ag)}
      />

      <AgentMemoryModal
        agent={selectedMemoryAgent}
        isOpen={!!selectedMemoryAgent}
        onClose={() => setSelectedMemoryAgent(null)}
      />

      <AgentPacksModal
        isOpen={showPacksModal}
        onClose={() => setShowPacksModal(false)}
        onPackDeployed={fetchAgents}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {agentToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">
                    Delete Agent &ldquo;{agentToDelete.displayName}&rdquo;?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Are you sure you want to delete this agent? Subordinate agents will be unlinked to become top-level orchestrators, and tasks will remain safely preserved in your backlog.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setAgentToDelete(null)}
                  className="px-3.5 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? "Deleting..." : "Delete Agent"}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
