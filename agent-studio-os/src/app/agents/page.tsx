"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { TOOL_DEFINITIONS, INTEGRATION_DEFINITIONS } from "@/types";
import { slugify } from "@/lib/utils";
import { HermesTerminalModal } from "@/components/agents/hermes-terminal-modal";
import { AgentHierarchyView } from "@/components/agents/agent-hierarchy-view";

const iconMap: Record<string, React.ElementType> = {
  Terminal, Globe, Search, Eye, Code, Brain, FileText, Image,
  Users, Monitor, Music, ListTodo, BookOpen, Volume2,
};

const ALL_AVATAR_CATEGORIES = [
  {
    name: "Robots",
    emojis: ["🤖", "🦾", "🦿", "👾", "🛸", "🚀", "⚙️", "🕹️", "⚡", "🔮"],
  },
  {
    name: "Tech",
    emojis: ["🧠", "💡", "📡", "💻", "🖥️", "🛡️", "🔌", "🌐", "📱", "💾"],
  },
  {
    name: "Research",
    emojis: ["🔬", "📊", "📈", "🧭", "📚", "📝", "🔭", "🧬", "📐", "🔍"],
  },
  {
    name: "Creative",
    emojis: ["🎨", "🎭", "🎬", "🎪", "🪄", "🎵", "📸", "🖌️", "✨", "🌟"],
  },
  {
    name: "Creatures",
    emojis: ["🦊", "🐙", "🦅", "🐋", "🐺", "🦉", "🐉", "🦁", "🐯", "🦄"],
  },
  {
    name: "Personas",
    emojis: ["👑", "🧑‍💼", "👨‍💻", "👩‍🔬", "🧙", "🥷", "🦸", "🧑‍🚀", "🕵️", "👨‍🏫"],
  },
];

const PRESET_COLORS = [
  "#6366f1", "#8b5cf6", "#06b6d4", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#3b82f6",
];

const ROLE_OPTIONS = [
  { value: "orchestrator", label: "Orchestrator", desc: "Directs overall goals and planning", color: "#f59e0b" },
  { value: "manager", label: "Manager", desc: "Coordinates milestones and delegates", color: "#818cf8" },
  { value: "specialist", label: "Specialist", desc: "Domain expert — code, research, analysis", color: "#06b6d4" },
  { value: "worker", label: "Worker", desc: "Executes routines and tool calls", color: "#10b981" },
];

const QUICK_DEPTS = ["Engineering", "Research", "Operations", "Design", "Intelligence", "Executive"];

interface AgentTemplate {
  id: string;
  label: string;
  icon: string;
  badge: string;
  name: string;
  description: string;
  avatar: string;
  themeColor: string;
  role: string;
  department: string;
  model: string;
  tools: string[];
  integrations: string[];
  systemPrompt: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "fullstack",
    label: "Full-Stack Engineer",
    icon: "💻",
    badge: "Autonomous Code",
    name: "DevCore",
    description: "Builds web apps, refactors codebases, and executes terminal workflows.",
    avatar: "👨‍💻",
    themeColor: "#6366f1",
    role: "specialist",
    department: "Engineering",
    model: "anthropic/claude-3-5-sonnet-20241022",
    tools: ["terminal", "file", "web", "code", "search"],
    integrations: ["webhook"],
    systemPrompt: `You are an autonomous Senior Full-Stack Software Engineer and System Architect.
- Autonomously inspect codebases, execute diagnostics, and write clean, type-safe code.
- Adhere strictly to production-grade patterns, idiomatic conventions, and rigorous testing.
- Verify changes with unit tests or dry-run terminal outputs before confirming completion.
- Provide structured explanations with code diffs and actionable reasoning.`,
  },
  {
    id: "researcher",
    label: "Deep Researcher",
    icon: "🔬",
    badge: "Intelligence",
    name: "Scout",
    description: "Synthesizes documents, searches the web, and compiles structured briefs.",
    avatar: "🔬",
    themeColor: "#06b6d4",
    role: "specialist",
    department: "Research",
    model: "google/gemini-1.5-pro",
    tools: ["web", "search", "file", "memory"],
    integrations: ["telegram"],
    systemPrompt: `You are a Lead Research Analyst and Intelligence Operative.
- Synthesize technical literature, market trends, and real-time web intelligence.
- Rigorously fact-check findings, cross-reference sources, and provide citations.
- Structure deliverables into executive summaries with key takeaways and supporting data.
- Remain objective, analytical, and unambiguous.`,
  },
  {
    id: "orchestrator",
    label: "Fleet Orchestrator",
    icon: "👑",
    badge: "Coordination",
    name: "Atlas",
    description: "Decomposes complex objectives, delegates subtasks, and tracks milestones.",
    avatar: "🧠",
    themeColor: "#f59e0b",
    role: "orchestrator",
    department: "Executive",
    model: "openai/gpt-4o",
    tools: ["web", "file", "terminal"],
    integrations: ["slack", "webhook"],
    systemPrompt: `You are the Chief Fleet Orchestrator.
- Deconstruct complex user goals into atomic, parallelizable subtasks.
- Delegate tasks to specialist agents, monitor routine progression, and unblock bottlenecks.
- Enforce strict quality standards across all agent deliverables.
- Maintain high-level fleet situational awareness and synthesize end-to-end results.`,
  },
  {
    id: "omnichannel",
    label: "Omnichannel Dispatcher",
    icon: "📱",
    badge: "Messaging",
    name: "Echo",
    description: "Monitors WhatsApp, Telegram, Discord, and dispatches requests.",
    avatar: "🤖",
    themeColor: "#10b981",
    role: "worker",
    department: "Operations",
    model: "groq/llama-3.3-70b-versatile",
    tools: ["web", "file"],
    integrations: ["whatsapp", "telegram", "discord", "webhook"],
    systemPrompt: `You are the Omnichannel Communications and Dispatch Specialist.
- Listen for inbound messages across WhatsApp, Telegram, Discord, and Webhooks.
- Respond with prompt, courteous, and accurate answers.
- Classify incoming intent, resolve common inquiries, and dispatch specialist routines.
- Maintain formatting optimized for chat and mobile screens.`,
  },
  {
    id: "sre",
    label: "DevOps & SRE",
    icon: "⚙️",
    badge: "Infrastructure",
    name: "Sentry",
    description: "Monitors runtime health, infrastructure telemetry, and automated healing.",
    avatar: "🛡️",
    themeColor: "#ef4444",
    role: "specialist",
    department: "Operations",
    model: "deepseek/deepseek-coder",
    tools: ["terminal", "file", "web"],
    integrations: ["webhook", "slack"],
    systemPrompt: `You are the Lead Site Reliability and Infrastructure Engineer.
- Monitor service health, inspect real-time log streams, and diagnose anomalies.
- Safely manage deployments and container routines with dry-run verifications.
- Handle system alerts with immediate root-cause mitigation protocols.
- Document postmortems with clear timelines, causes, and preventative measures.`,
  },
];

const POPULAR_MODELS = [
  { id: "", label: "Default Router (OmniRoute Cascade)", provider: "Auto", badge: "Smart" },
  { id: "anthropic/claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", provider: "Anthropic", badge: "Fast & SOTA" },
  { id: "anthropic/claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", provider: "Anthropic", badge: "Ultra Fast" },
  { id: "openai/gpt-4o", label: "GPT-4o", provider: "OpenAI", badge: "Flagship" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini", provider: "OpenAI", badge: "Lightweight" },
  { id: "google/gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "Google", badge: "1M Context" },
  { id: "google/gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "Google", badge: "Low Latency" },
  { id: "deepseek/deepseek-chat", label: "DeepSeek V3", provider: "DeepSeek", badge: "Reasoning" },
  { id: "deepseek/deepseek-coder", label: "DeepSeek Coder", provider: "DeepSeek", badge: "Code" },
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", provider: "Groq", badge: "Instant" },
  { id: "ollama/llama3.2", label: "Llama 3.2 (Local)", provider: "Ollama", badge: "Offline" },
];

function AgentFormModal({
  isOpen,
  onClose,
  onSaved,
  existingAgents,
  editAgent,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  existingAgents: AgentProfile[];
  editAgent?: (AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null;
}) {
  const isEditMode = !!editAgent;
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🤖");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [model, setModel] = useState("");
  const [themeColor, setThemeColor] = useState("#6366f1");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("specialist");
  const [department, setDepartment] = useState("Engineering");
  const [reportsToId, setReportsToId] = useState<string>("");
  const [selectedTools, setSelectedTools] = useState<string[]>(["terminal", "file", "web"]);
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([]);
  const [activeAvatarTab, setActiveAvatarTab] = useState(0);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalTab, setModalTab] = useState<"config" | "directive" | "playground">("config");
  const [customModelMode, setCustomModelMode] = useState(false);
  const [availableModels, setAvailableModels] = useState(POPULAR_MODELS);

  // Playground states
  const [testPrompt, setTestPrompt] = useState("");
  const [testResponse, setTestResponse] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Fetch live configured models from /api/models on open
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
                badge: "Active",
              });
            }
          });
          setAvailableModels(Array.from(map.values()));
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Apply Blueprint Starter Template
  const handleApplyTemplate = (tpl: AgentTemplate) => {
    setName(tpl.name);
    setAvatar(tpl.avatar);
    setThemeColor(tpl.themeColor);
    setRole(tpl.role);
    setDepartment(tpl.department);
    setModel(tpl.model);
    setDescription(tpl.description);
    setSelectedTools(tpl.tools);
    setSelectedIntegrations(tpl.integrations);
    setSystemPrompt(tpl.systemPrompt);
    toast.success(`Loaded "${tpl.label}" starter blueprint!`);
  };

  // Auto-Generate System Directive
  const handleAutoGenerateDirective = () => {
    const roleDesc = ROLE_OPTIONS.find((r) => r.value === role)?.desc || role;
    const toolsList = selectedTools.join(", ") || "core analytical reasoning";
    const newDirective = `You are ${name || "an autonomous AI operative"}, functioning as the ${role.toUpperCase()} in the ${department} department.
Primary objective: ${description || "Execute assigned directives with maximum reliability, precision, and efficiency."}

Operational Directives:
- Role & Profile: ${role} (${roleDesc}).
- Toolset Capabilities: Leverage your active tools (${toolsList}) to explore, diagnose, implement, and verify tasks.
- Deliverables: Provide structured, unambiguous outputs with clear steps and actionable conclusions.
- Collaboration: When coordinating across the agent fleet, maintain concise contracts and clear milestone updates.

Quality Standards:
- Never assume ambiguous parameters; inspect environment context or request clarification first.
- Maintain high agency, systematic verification, and zero conversational fluff.`;
    setSystemPrompt(newDirective);
    toast.success("Drafted tailored system directive!");
  };

  // Append guideline snippet
  const handleAppendDirectiveSnippet = (snippet: string) => {
    setSystemPrompt((prev) => {
      const clean = prev.trim();
      return clean ? `${clean}\n\n${snippet}` : snippet;
    });
    toast.success("Added guideline to directive");
  };

  // Run test prompt in Playground
  const handleRunTestPrompt = async () => {
    if (!testPrompt.trim()) {
      toast.error("Enter a test prompt first");
      return;
    }
    setTestRunning(true);
    setTestResponse("");
    setTestLatency(null);
    const start = Date.now();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: testPrompt.trim(),
          model: model.trim() || undefined,
          agentId: editAgent?.id || undefined,
        }),
      });

      const data = await res.json();
      const elapsed = Date.now() - start;
      setTestLatency(elapsed);

      if (res.ok && data.message) {
        setTestResponse(typeof data.message === "string" ? data.message : data.message.content || JSON.stringify(data.message));
        toast.success(`Received test response in ${elapsed}ms`);
      } else {
        setTestResponse(data.error || "Execution failed");
        toast.error(data.error || "Failed to get test response");
      }
    } catch (err) {
      setTestResponse("Failed to connect to agent execution runtime.");
      toast.error("Error communicating with model");
    } finally {
      setTestRunning(false);
    }
  };

  // Populate fields when editing or reset on open
  useEffect(() => {
    if (editAgent) {
      setName(editAgent.displayName || "");
      setAvatar(editAgent.avatar || "🤖");
      setSystemPrompt(editAgent.systemPrompt || "");
      setModel(editAgent.model || "");
      setThemeColor(editAgent.themeColor || "#6366f1");
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
      setCustomModelMode(Boolean(editAgent.model && !POPULAR_MODELS.some((m) => m.id === editAgent.model)));
    } else {
      // Reset for create mode
      setName("");
      setAvatar("🤖");
      setSystemPrompt("");
      setModel("");
      setThemeColor("#6366f1");
      setDescription("");
      setRole("specialist");
      setDepartment("Engineering");
      setReportsToId("");
      setSelectedTools(["terminal", "file", "web"]);
      setSelectedIntegrations([]);
      setCustomModelMode(false);
    }
    setModalTab("config");
    setTestResponse("");
    setTestPrompt("");
    setTestLatency(null);
  }, [editAgent, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Agent name is required");
      return;
    }
    setSaving(true);
    try {
      if (isEditMode && editAgent) {
        // PUT request for edit
        const res = await fetch(`/api/agents/${editAgent.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name.trim(),
            avatar,
            systemPrompt,
            model: model.trim() || null,
            themeColor,
            description: description.trim(),
            role,
            department: department.trim() || null,
            reportsToId: reportsToId || null,
            integrations: selectedIntegrations,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to update agent");
        }
        toast.success(`Agent "${name}" updated`);
      } else {
        // POST request for create
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: name.trim(),
            avatar,
            systemPrompt,
            model: model.trim() || null,
            themeColor,
            description: description.trim(),
            role,
            department: department.trim() || null,
            reportsToId: reportsToId || null,
            tools: selectedTools,
            integrations: selectedIntegrations,
          }),
        });
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to create agent");
        }
        toast.success(`Agent "${name}" created`);
      }
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save agent");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const agentSlug = slugify(name || "agent");
  const activeRoleObj = ROLE_OPTIONS.find((r) => r.value === role) || ROLE_OPTIONS[2];
  const charCount = systemPrompt.length;
  const wordCount = systemPrompt.trim() ? systemPrompt.trim().split(/\s+/).length : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-md overflow-y-auto"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ type: "spring", damping: 28, stiffness: 350 }}
          className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shadow-sm transition-all"
                style={{ backgroundColor: `${themeColor}20`, borderColor: `${themeColor}50` }}
              >
                {avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">
                    {isEditMode ? "Agent Configuration Studio" : "Agent Provisioning Studio"}
                  </h2>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                    {isEditMode ? "Edit Mode" : "New Operative"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isEditMode
                    ? `Updating parameters for @${agentSlug}`
                    : "Design persona, intelligence models, system directives, and channel connections"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Tabs */}
              <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setModalTab("config")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === "config"
                      ? "bg-card text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Basics &amp; Model</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("directive")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === "directive"
                      ? "bg-card text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Wand2 className="w-3.5 h-3.5 text-primary" />
                  <span>Directive Studio</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModalTab("playground")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                    modalTab === "playground"
                      ? "bg-card text-foreground shadow-sm font-bold border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Prompt Lab</span>
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Scrollable Body: Split Pane with Live Preview Card */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Interactive Form Tabs */}
              <div className="lg:col-span-8 space-y-6">
                {modalTab === "config" && (
                  <>
                    {/* Starter Templates (Create mode only) */}
                    {!isEditMode && (
                      <div className="space-y-2 pb-2">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            Starter Blueprints (One-Click Setup)
                          </label>
                          <span className="text-[11px] text-muted-foreground">Click to autofill recommended settings</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {AGENT_TEMPLATES.map((tpl) => (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => handleApplyTemplate(tpl)}
                              className="text-left p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition-all group cursor-pointer"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-base group-hover:scale-110 transition-transform">
                                  {tpl.icon}
                                </span>
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary border border-primary/20 font-semibold">
                                  {tpl.badge}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-foreground truncate">{tpl.label}</p>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">{tpl.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Identity Section */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                        Agent Identity &amp; Aesthetics
                      </label>
                      <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-3 flex flex-col items-center justify-center p-3 rounded-xl border border-border bg-secondary/40">
                          <button
                            type="button"
                            onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                            className="w-14 h-14 rounded-2xl border-2 flex items-center justify-center text-2xl transition-transform hover:scale-105 shadow-inner cursor-pointer"
                            style={{ borderColor: themeColor, backgroundColor: `${themeColor}20` }}
                          >
                            {avatar}
                          </button>
                          <span className="text-[10px] text-muted-foreground mt-1.5 font-medium">Click to Change</span>
                        </div>

                        <div className="col-span-9 space-y-2">
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="Agent name (e.g. Nexus, Scout, CodeWeaver)..."
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-xl border border-border bg-secondary/40 text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                            />
                            {name && (
                              <span className="absolute right-3 top-2.5 text-[11px] font-mono text-muted-foreground">
                                @{agentSlug}
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Brief mission description (e.g. Autonomous Full-Stack engineer)..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full px-4 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-[11px] text-muted-foreground">Theme:</span>
                            {PRESET_COLORS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setThemeColor(c)}
                                className={`w-5 h-5 rounded-md transition-transform cursor-pointer ${
                                  themeColor === c ? "scale-125 ring-2 ring-white ring-offset-2 ring-offset-zinc-950" : "hover:scale-110 opacity-80"
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Avatar Picker popover */}
                      <AnimatePresence>
                        {showAvatarPicker && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden rounded-xl border border-border bg-card p-4 shadow-xl"
                          >
                            <div className="flex items-center gap-1 mb-3 overflow-x-auto pb-1">
                              {ALL_AVATAR_CATEGORIES.map((cat, idx) => (
                                <button
                                  key={cat.name}
                                  type="button"
                                  onClick={() => setActiveAvatarTab(idx)}
                                  className={`px-2.5 py-1 rounded-lg text-xs transition-all whitespace-nowrap cursor-pointer ${
                                    activeAvatarTab === idx
                                      ? "bg-secondary text-foreground font-semibold"
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {cat.name}
                                </button>
                              ))}
                            </div>
                            <div className="grid grid-cols-10 gap-1.5 max-h-32 overflow-y-auto">
                              {ALL_AVATAR_CATEGORIES[activeAvatarTab].emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => { setAvatar(emoji); setShowAvatarPicker(false); }}
                                  className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg transition-all cursor-pointer ${
                                    avatar === emoji
                                      ? "bg-primary/20 text-primary border border-primary"
                                      : "hover:bg-secondary border border-transparent"
                                  }`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Role & Hierarchy */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                        Organizational Role &amp; Hierarchy
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {ROLE_OPTIONS.map((r) => (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => setRole(r.value)}
                            className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                              role === r.value
                                ? "border-primary bg-primary/10 shadow-sm"
                                : "border-border hover:border-border/80 bg-secondary/30"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: r.color }} />
                              <span className={`text-xs font-bold ${role === r.value ? "text-foreground" : "text-muted-foreground"}`}>
                                {r.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{r.desc}</p>
                          </button>
                        ))}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Department</label>
                          <input
                            type="text"
                            placeholder="e.g. Engineering"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {QUICK_DEPTS.map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => setDepartment(d)}
                                className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors cursor-pointer ${
                                  department === d
                                    ? "bg-primary/20 text-primary border-primary/40 font-semibold"
                                    : "text-muted-foreground border-border hover:text-foreground"
                                }`}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Reports To (Manager)</label>
                          <select
                            value={reportsToId}
                            onChange={(e) => setReportsToId(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:border-primary cursor-pointer"
                          >
                            <option value="">None (Top-Level Agent)</option>
                            {existingAgents
                              .filter((a) => !editAgent || a.id !== editAgent.id)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.avatar} {a.displayName} ({a.role})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Model Intelligence Selector */}
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <Cpu className="w-3.5 h-3.5 text-primary" />
                          Model Intelligence
                        </label>
                        <button
                          type="button"
                          onClick={() => setCustomModelMode(!customModelMode)}
                          className="text-[11px] text-primary hover:underline font-medium cursor-pointer"
                        >
                          {customModelMode ? "Switch to Preset Dropdown" : "Custom Model String..."}
                        </button>
                      </div>

                      {customModelMode ? (
                        <div className="space-y-1">
                          <input
                            type="text"
                            placeholder="Enter any model identifier: e.g. openai/gpt-4o, anthropic/claude-3-5-sonnet..."
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Leave blank to utilize OmniRoute Cascade default router.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2">
                          <select
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-card text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                          >
                            {availableModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.label} &mdash; [{m.provider}] {m.badge ? `(${m.badge})` : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Tools Capability Matrix */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Autonomous Tools ({selectedTools.length} enabled)
                        </label>
                        <span className="text-[11px] text-muted-foreground">Checked tools are accessible in runtime</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
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
                              className={`px-3 py-2 rounded-xl border text-xs text-left transition-all cursor-pointer flex items-center justify-between ${
                                isSelected
                                  ? "border-primary/40 bg-primary/10 text-foreground font-semibold"
                                  : "border-border text-muted-foreground hover:text-foreground hover:border-border/80 bg-secondary/30"
                              }`}
                            >
                              <span>{tool.label}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Integrations & Channels Section */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-foreground uppercase tracking-wider">
                          Devices &amp; Communication Channels ({selectedIntegrations.length} active)
                        </label>
                        <Link
                          href="/settings?tab=devices"
                          className="text-[11px] text-primary hover:underline font-semibold"
                        >
                          Configure Tokens &rarr;
                        </Link>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
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
                              className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                isSelected
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : "border-border hover:border-border/80 bg-secondary/30 text-muted-foreground"
                              }`}
                            >
                              <div className="flex items-center justify-between mb-0.5">
                                <span className={`text-xs font-bold ${isSelected ? "text-emerald-400" : "text-foreground"}`}>
                                  {integ.label}
                                </span>
                                {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />}
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1">{integ.description}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {modalTab === "directive" && (
                  /* Directive Studio View */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border bg-primary/5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                          <Wand2 className="w-3.5 h-3.5" />
                          System Directive Studio
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Directives define the core persona, logic contracts, tool guidelines, and guardrails for <span className="text-foreground font-semibold">{name || "this agent"}</span>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAutoGenerateDirective}
                        className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Auto-Draft Directive</span>
                      </button>
                    </div>

                    {/* Quick Guideline Enhancers */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Quick Directive Enhancers (Click to append)</label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAppendDirectiveSnippet("Reasoning Protocol:\n- Think step-by-step through complex requests.\n- Analyze potential edge cases and performance impacts before executing changes.")}
                          className="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-[11px] text-foreground font-medium transition-colors cursor-pointer"
                        >
                          + Chain of Thought
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendDirectiveSnippet("Safety Guardrails:\n- Never execute destructive or irreversible shell commands without dry-running or verifying environment flags.\n- Never leak sensitive keys or credentials in logs.")}
                          className="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-[11px] text-foreground font-medium transition-colors cursor-pointer"
                        >
                          + Strict Safety &amp; Guardrails
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendDirectiveSnippet("Multi-Agent Protocol:\n- Deconstruct complex deliverables into atomic subtasks.\n- Maintain clear, typed status handoffs for orchestrators and subordinates.")}
                          className="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-[11px] text-foreground font-medium transition-colors cursor-pointer"
                        >
                          + Multi-Agent Protocol
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAppendDirectiveSnippet("Output Style:\n- Be direct, factual, and concise.\n- Prioritize bullet points, diffs, and structured tables over verbose conversational text.")}
                          className="px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-[11px] text-foreground font-medium transition-colors cursor-pointer"
                        >
                          + Concise &amp; No Fluff
                        </button>
                      </div>
                    </div>

                    {/* Directive Textarea */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                        <span>System Directive Text</span>
                        <span className="font-mono text-[10px]">
                          {charCount} chars &bull; ~{wordCount} words
                        </span>
                      </div>
                      <textarea
                        rows={12}
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Define agent identity, behavioral standards, operational constraints, and domain expertise..."
                        className="w-full px-4 py-3 rounded-xl border border-border bg-secondary/30 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary leading-relaxed resize-y"
                      />
                    </div>
                  </div>
                )}

                {modalTab === "playground" && (
                  /* Live Prompt Lab & Persona Simulator */
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border border-border bg-primary/5 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-bold text-primary uppercase tracking-wide flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Live Persona Simulator
                        </h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Execute test prompts against <span className="text-foreground font-semibold">{name || "this agent"}</span> to evaluate reasoning latency and output structure.
                        </p>
                      </div>
                      {testLatency !== null && (
                        <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-primary/20 text-primary border border-primary/30 shrink-0">
                          ⚡ {testLatency}ms
                        </span>
                      )}
                    </div>

                    {/* Quick Test Templates */}
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-muted-foreground">Test Templates</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "Introduce yourself and state your primary capabilities.",
                          "Analyze a deadlock scenario between two async worker routines.",
                          "Draft an executive report on multi-agent swarm optimization.",
                        ].map((tpl) => (
                          <button
                            key={tpl}
                            type="button"
                            onClick={() => setTestPrompt(tpl)}
                            className="px-2.5 py-1 rounded-lg border border-border bg-secondary/40 hover:bg-secondary text-[11px] text-muted-foreground hover:text-foreground transition-all text-left truncate max-w-[300px] cursor-pointer"
                          >
                            {tpl}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Test Prompt Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground">Prompt Simulation</label>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Target Model: {model || "Auto-Cascade Router"}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder="Enter a test prompt or challenge to see the agent's live reaction..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-sans"
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={handleRunTestPrompt}
                          disabled={testRunning || !testPrompt.trim()}
                          className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-semibold flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
                        >
                          {testRunning ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Simulating Execution...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Run Test Prompt</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Output Box */}
                    {testResponse && (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                            <Bot className="w-3.5 h-3.5 text-primary" />
                            Agent Output
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(testResponse);
                              toast.success("Response copied to clipboard");
                            }}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="p-4 rounded-xl border border-border bg-secondary/50 text-xs text-foreground leading-relaxed font-sans whitespace-pre-wrap max-h-60 overflow-y-auto">
                          {testResponse}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Column: Live Operative Preview Card */}
              <div className="lg:col-span-4 space-y-4 sticky top-0">
                <div className="p-1 rounded-2xl bg-gradient-to-b from-border/80 via-border/30 to-border/80">
                  <div className="p-5 rounded-[15px] bg-card/90 backdrop-blur-xl border border-border/50 space-y-4 shadow-xl relative overflow-hidden">
                    {/* Ambient Glow */}
                    <div
                      className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-25"
                      style={{ backgroundColor: themeColor }}
                    />

                    {/* Card Header */}
                    <div className="flex items-start justify-between">
                      <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl border shadow-md"
                        style={{
                          backgroundColor: `${themeColor}20`,
                          borderColor: `${themeColor}50`,
                          boxShadow: `0 0 20px ${themeColor}25`,
                        }}
                      >
                        {avatar}
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Ready
                        </span>
                        <p className="text-[10px] text-muted-foreground font-mono mt-1">@{agentSlug}</p>
                      </div>
                    </div>

                    {/* Name & Desc */}
                    <div>
                      <h3 className="text-base font-bold text-foreground truncate">
                        {name || "Unnamed Operative"}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {description || "Autonomous agent ready for mission dispatch."}
                      </p>
                    </div>

                    {/* Role & Dept Badges */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-lg text-xs font-semibold text-foreground border shadow-xs"
                        style={{ backgroundColor: `${activeRoleObj.color}20`, borderColor: `${activeRoleObj.color}40` }}
                      >
                        {activeRoleObj.label}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground border border-border">
                        {department || "General"}
                      </span>
                    </div>

                    {/* Model Pill */}
                    <div className="p-2.5 rounded-xl bg-secondary/40 border border-border/80 text-xs flex items-center justify-between">
                      <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-primary" />
                        Model
                      </span>
                      <span className="font-mono text-foreground font-semibold text-[11px] truncate max-w-[150px]">
                        {model ? (availableModels.find((m) => m.id === model)?.label || model) : "OmniRoute Cascade"}
                      </span>
                    </div>

                    {/* Capabilities Summary */}
                    <div className="space-y-2 pt-1 border-t border-border/60">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Enabled Tools:</span>
                        <span className="font-semibold text-foreground">{selectedTools.length} of 14</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Connected Channels:</span>
                        <span className="font-semibold text-emerald-400">{selectedIntegrations.length} of 7</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Directive Size:</span>
                        <span className="font-mono text-muted-foreground text-[11px]">
                          {charCount > 0 ? `${charCount} chars` : "Default"}
                        </span>
                      </div>
                    </div>

                    {/* Quick Switch to Prompt Lab */}
                    <button
                      type="button"
                      onClick={() => setModalTab("playground")}
                      className="w-full py-2 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Test in Prompt Lab &rarr;</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/60 backdrop-blur-xl">
            <p className="text-xs text-muted-foreground hidden sm:block">
              {isEditMode ? "Modifications apply across all active routines and channels." : "New agent will automatically be provisioned with Hermes profile and database records."}
            </p>
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{saving ? (isEditMode ? "Saving Changes..." : "Provisioning Agent...") : (isEditMode ? "Save Changes" : "Create Agent")}</span>
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function AgentCard({
  agent,
  managerName,
  onDelete,
  onOpenHermes,
  onOpenMemories,
  onEdit,
}: {
  agent: AgentProfile & { taskCount?: number; hermesLinked?: boolean };
  managerName?: string;
  onDelete: (id: string) => void;
  onOpenHermes: (agent: AgentProfile) => void;
  onOpenMemories: (agent: AgentProfile) => void;
  onEdit: (agent: AgentProfile & { taskCount?: number; hermesLinked?: boolean }) => void;
}) {
  const enabledTools = agent.tools?.filter((t) => t.enabled) || [];
  const enabledIntegrations = agent.integrations?.filter((i) => i.enabled) || [];
  const roleColor = ROLE_OPTIONS.find((r) => r.value === agent.role)?.color || "#6b7280";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -2 }}
      className="group relative rounded-lg border border-border glass overflow-hidden hover:border-border transition-all duration-300"
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ backgroundColor: agent.themeColor || "#6366f1" }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center text-xl border shrink-0"
              style={{
                borderColor: `${agent.themeColor || "#6366f1"}30`,
                backgroundColor: `${agent.themeColor || "#6366f1"}10`,
              }}
            >
              {agent.avatar}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <h3 className="font-semibold text-sm text-foreground truncate" title={agent.displayName}>
                  {agent.displayName}
                </h3>
                <span className={`w-1.5 h-1.5 rounded-md shrink-0 ${agent.status === "online" ? "bg-emerald-500" : "bg-secondary dark:bg-secondary"}`} />
              </div>
              <div className="flex items-center gap-2 mt-0.5 min-w-0">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-md" style={{ backgroundColor: roleColor }} />
                  {agent.role || "worker"}
                </span>
                {agent.department && (
                  <span className="text-[11px] text-muted-foreground truncate" title={agent.department}>
                    {agent.department}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(agent);
              }}
              className="p-1.5 rounded-lg bg-secondary/50 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
              title="Edit agent profile"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete agent "${agent.displayName}"?`)) onDelete(agent.id);
              }}
              className="p-1.5 rounded-lg bg-secondary/50 hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all"
              title={`Delete ${agent.displayName}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {managerName && (
          <p className="text-[11px] text-muted-foreground mb-2">
            ↳ Reports to {managerName}
          </p>
        )}

        {agent.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{agent.description}</p>
        )}

        {/* Compact info line */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
          {enabledTools.length > 0 && <span>{enabledTools.length} tools</span>}
          {enabledIntegrations.length > 0 && (
            <span className="text-foreground/80">
              {enabledIntegrations.map((i) => i.platform).join(", ")}
            </span>
          )}
          {agent.model && (
            <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]">{agent.model}</span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1.5 pt-2.5 border-t border-border">
          <Link
            href={`/chat?agentId=${agent.id}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs text-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-primary/10 text-primary transition-all flex items-center gap-1"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Chat</span>
          </Link>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenMemories(agent); }}
            className="text-xs text-foreground hover:text-purple-200 px-2 py-1 rounded-lg hover:bg-primary/10 text-primary transition-all flex items-center gap-1"
            title="Inspect learned rules & episodic memory"
          >
            <Brain className="w-3 h-3" />
            <span>Memory</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onOpenHermes(agent); }}
            className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-secondary/50 transition-all"
          >
            Hermes CLI
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function AgentMemoryModal({
  agent,
  isOpen,
  onClose,
}: {
  agent: (AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [memoryItem, setMemoryItem] = useState<{
    agentName: string;
    vaultPath: string;
    rawMarkdown: string;
    extractedDirectives: string[];
    lastUpdated?: string;
  } | null>(null);
  const [viewTab, setViewTab] = useState<"directives" | "raw">("directives");

  const loadMemories = useCallback(async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const res = await fetch("/api/agents/memories");
      const data = await res.json();
      if (data.success && Array.isArray(data.memories)) {
        const found = data.memories.find(
          (m: { agentName: string }) =>
            m.agentName?.toLowerCase() === agent.displayName.toLowerCase() ||
            m.agentName?.toLowerCase() === agent.id.toLowerCase()
        );
        if (found) {
          const rawMarkdown = found.rawMarkdown || found.content || "";
          const lines = rawMarkdown.split("\n");
          const directives: string[] = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
              directives.push(trimmed.slice(2).trim());
            }
          }
          setMemoryItem({
            agentName: found.agentName || agent.displayName,
            vaultPath: found.vaultPath || `.agent-os/vault/memories/${(found.agentName || agent.displayName).toLowerCase().replace(/\s+/g, "-")}.md`,
            rawMarkdown,
            extractedDirectives: Array.isArray(found.extractedDirectives)
              ? found.extractedDirectives
              : directives.length > 0
              ? directives
              : ["Prioritize clear, production-ready deliverables."],
            lastUpdated: found.updatedAt,
          });
        } else {
          setMemoryItem({
            agentName: agent.displayName,
            vaultPath: `.agent-os/vault/memories/${agent.displayName.toLowerCase().replace(/\s+/g, "-")}.md`,
            rawMarkdown: `# Episodic Memory: ${agent.displayName}\n\n## Learned Rules & Directives\n- Prioritize clear, production-ready deliverables.\n\n## Iteration & Reflection History\n*No reflection logs yet. Tasks revised with feedback will record insights here automatically.*`,
            extractedDirectives: ["Prioritize clear, production-ready deliverables."],
          });
        }
      }
    } catch {
      toast.error("Failed to fetch agent memories");
    } finally {
      setLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    if (isOpen) {
      loadMemories();
    }
  }, [isOpen, loadMemories]);

  if (!isOpen || !agent) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 space-y-4 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border"
              style={{
                borderColor: `${agent.themeColor || "#a855f7"}30`,
                backgroundColor: `${agent.themeColor || "#a855f7"}15`,
              }}
            >
              {agent.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-foreground">
                  {agent.displayName} &mdash; Episodic Memory
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-border">
                  Grounding Active
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">
                {memoryItem?.vaultPath || "Vault Episodic File"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* View Switcher */}
        <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
          <button
            onClick={() => setViewTab("directives")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewTab === "directives"
                ? "bg-primary/20 text-primary border border-border font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Learned Directives ({memoryItem?.extractedDirectives?.length ?? 0})
          </button>
          <button
            onClick={() => setViewTab("raw")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              viewTab === "raw"
                ? "bg-primary/20 text-primary border border-border font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Raw Vault Note
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto min-h-[250px] space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-foreground" />
            </div>
          ) : viewTab === "directives" ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                These dynamic rules were distilled from human feedback, self-reflection loops, and past task executions. They are automatically injected into this agent&apos;s system prompt during all chat completions and swarm runs:
              </p>
              {(memoryItem?.extractedDirectives?.length ?? 0) > 0 ? (
                <div className="space-y-2 pt-1">
                  {memoryItem?.extractedDirectives?.map((directive, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-secondary/50 border border-border text-xs text-foreground"
                    >
                      <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[10px] shrink-0 font-bold">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{directive}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic py-6 text-center">
                  No explicit directives extracted yet. Run task revisions or chat with this agent to automatically generate memory rules.
                </div>
              )}
            </div>
          ) : (
            <pre className="p-4 rounded-xl bg-secondary/50 border border-border font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {memoryItem?.rawMarkdown || "No vault file content found."}
            </pre>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-muted-foreground text-[11px]">
            Changes synchronize automatically with your shared Obsidian vault
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-secondary/50 hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<
    (AgentProfile & { taskCount?: number; hermesLinked?: boolean })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<
    (AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null
  >(null);
  const [terminalAgent, setTerminalAgent] = useState<AgentProfile | null>(null);
  const [selectedMemoryAgent, setSelectedMemoryAgent] = useState<
    (AgentProfile & { taskCount?: number; hermesLinked?: boolean }) | null
  >(null);
  const [viewMode, setViewMode] = useState<"grid" | "hierarchy">("grid");

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data);
    } catch (error) {
      console.error("Error fetching agents:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Agent deleted");
        fetchAgents();
      } else {
        toast.error("Failed to delete agent");
      }
    } catch {
      toast.error("Failed to delete agent");
    }
  };

  const agentNameMap = new Map<string, string>();
  agents.forEach((a) => agentNameMap.set(a.id, `${a.avatar} ${a.displayName}`));

  return (
    <div className="space-y-5 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground bg-primary/10 text-primary px-2.5 py-0.5 rounded-md border border-border inline-flex items-center gap-1.5">
              <Bot className="w-3 h-3" />
              Fleet Orchestration
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agent Studio</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create, configure, and orchestrate multi-agent hierarchies
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center p-0.5 rounded-lg border border-border bg-secondary/50 text-xs">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "grid" ? "bg-secondary/50 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("hierarchy")}
              className={`px-3 py-1.5 rounded-md transition-all ${
                viewMode === "hierarchy" ? "bg-secondary/50 text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Hierarchy
            </button>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-medium transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Agent</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-2xl border border-border bg-card/60 animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-xl bg-secondary/80" />
                <div className="w-16 h-5 rounded-md bg-secondary/60" />
              </div>
              <div className="space-y-2">
                <div className="w-3/4 h-4 rounded bg-secondary/80" />
                <div className="w-full h-3 rounded bg-secondary/50" />
              </div>
              <div className="pt-2 flex items-center justify-between border-t border-border/50">
                <div className="w-20 h-4 rounded bg-secondary/60" />
                <div className="w-14 h-4 rounded bg-secondary/60" />
              </div>
            </div>
          ))}
        </div>
      ) : agents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center h-[50vh] text-center"
        >
          <h2 className="text-lg font-semibold mb-1">No agents yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first AI agent with custom tools, integrations, and organizational hierarchy
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-sm font-medium transition-colors"
          >
            + Create Your First Agent
          </button>
        </motion.div>
      ) : viewMode === "hierarchy" ? (
        <AgentHierarchyView agents={agents} onOpenHermes={setTerminalAgent} onRefresh={fetchAgents} />
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          <AnimatePresence mode="popLayout">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                managerName={agent.reportsToId ? agentNameMap.get(agent.reportsToId) : undefined}
                onDelete={handleDelete}
                onOpenHermes={setTerminalAgent}
                onOpenMemories={(a) => setSelectedMemoryAgent(a)}
                onEdit={(a) => setEditingAgent(a)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
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
    </div>
  );
}
