"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Crown,
  Users,
  Zap,
  ArrowRight,
  Loader2,
  Play,
  X,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Folder,
  FileText,
  Download,
  Send,
  ExternalLink,
  Sparkles,
  Volume2,
  VolumeX,
  Printer,
  Clock,
  Activity,
  BarChart3,
  GitBranch,
  Network,
  Timer,
  Hash,
  RotateCcw,
  History,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Layers,
  Bot,
  Maximize2,
  Minimize2,
  Target,
  Radio,
  Shield,
  Cpu,
  Kanban,
  Search,
  Filter,
  SlidersHorizontal,
  Settings2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import type { A2AHierarchyExecutionResult, A2AHierarchyNodeExecution } from "@/types/a2a";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import {
  playTaskStartedSound,
  playTaskCompletedSound,
  playWarningSound,
} from "@/lib/sound-effects";

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface ConferenceAgent extends Omit<Partial<AgentProfile>, "role"> {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  role: string;
  department?: string;
  model?: string;
  themeColor?: string;
  description?: string;
  isActive?: boolean;
  isSpeaking?: boolean;
  currentTask?: string;
}

interface ConferenceEvent {
  id: string;
  type: "delegation" | "execution" | "synthesis" | "speaking" | "complete" | "thinking" | "error" | "phase";
  fromAgent: string;
  fromAvatar: string;
  toAgent?: string;
  toAvatar?: string;
  message: string;
  timestamp: string;
}

interface ConferenceQAMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isRevision?: boolean;
  timestamp: string;
}

interface ConferenceHistoryEntry {
  id: string;
  missionTopic: string;
  timestamp: string;
  totalLatencyMs: number;
  totalSubtasks: number;
  success: boolean;
}

// ─── Fallback Agents ────────────────────────────────────────────────────────

const DEFAULT_CONFERENCE_AGENTS: ConferenceAgent[] = [
  {
    id: "default-atlas",
    name: "atlas",
    displayName: "Atlas",
    avatar: "👑",
    role: "orchestrator",
    department: "Executive",
    model: "claude-3-5-sonnet",
    themeColor: "#f59e0b",
    description: "Chief of Staff & Autonomous Executive Orchestrator",
  },
  {
    id: "default-justitia",
    name: "justitia",
    displayName: "Justitia",
    avatar: "⚖️",
    role: "orchestrator",
    department: "Legal Counsel",
    model: "claude-3-5-sonnet",
    themeColor: "#ec4899",
    description: "Governance, Regulatory Compliance & Protocol Safety",
  },
  {
    id: "default-sentinel",
    name: "sentinel",
    displayName: "Sentinel",
    avatar: "🛡️",
    role: "orchestrator",
    department: "SRE & Infrastructure",
    model: "claude-3-5-sonnet",
    themeColor: "#06b6d4",
    description: "SRE, Incident Orchestrator & Defense In Depth",
  },
  {
    id: "default-devcore",
    name: "devcore",
    displayName: "DevCore",
    avatar: "💻",
    role: "specialist",
    department: "Engineering",
    model: "claude-3-5-sonnet",
    themeColor: "#3b82f6",
    description: "Full-Stack System Architect & Principal Engineer",
  },
  {
    id: "default-nova",
    name: "nova",
    displayName: "Nova",
    avatar: "⚡",
    role: "specialist",
    department: "Growth",
    model: "gpt-4o",
    themeColor: "#8b5cf6",
    description: "Developer Experience & Technical Product Lead",
  },
  {
    id: "default-ledger",
    name: "ledger",
    displayName: "Ledger",
    avatar: "📊",
    role: "worker",
    department: "Operations",
    model: "claude-3-5-haiku",
    themeColor: "#10b981",
    description: "Compliance, Cost Efficiency & Audit Logger",
  },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const QUICK_MISSIONS = [
  {
    icon: "🔐",
    label: "JWT Auth System",
    prompt: "Design and implement a production-grade JWT authentication system with refresh tokens, RBAC, and session management",
  },
  {
    icon: "🚀",
    label: "CI/CD Pipeline",
    prompt: "Design a complete CI/CD pipeline for a microservices app with automated testing, Docker builds, and blue-green deployments",
  },
  {
    icon: "📊",
    label: "Analytics Dashboard",
    prompt: "Build a real-time analytics dashboard with charts, KPIs, data filtering, and CSV export for an e-commerce platform",
  },
  {
    icon: "⚡",
    label: "Rate Limiter",
    prompt: "Implement a distributed API rate limiter using Redis with sliding window algorithm and per-user quotas",
  },
  {
    icon: "🧠",
    label: "ML Pipeline",
    prompt: "Build a machine learning pipeline for sentiment analysis with data preprocessing, model training, and REST API deployment",
  },
  {
    icon: "📱",
    label: "Mobile Onboarding",
    prompt: "Design a mobile app onboarding flow with biometric login, multi-step registration, and social auth",
  },
];

const PHASE_STEPS = [
  { key: "init", label: "Analyzing", icon: "🔬" },
  { key: "delegate", label: "Delegating", icon: "📤" },
  { key: "execute", label: "Executing", icon: "⚡" },
  { key: "synthesize", label: "Synthesizing", icon: "🧠" },
  { key: "done", label: "Complete", icon: "✅" },
];

const DEPARTMENT_FILTERS = [
  { key: "all", label: "All Council" },
  { key: "engineering", label: "Engineering & Infra" },
  { key: "product", label: "Product & QA" },
  { key: "growth", label: "Growth & Creative" },
  { key: "strategy", label: "Strategy & Legal" },
] as const;

// ─── Component ──────────────────────────────────────────────────────────────

export default function ConferencePage() {
  const [agents, setAgents] = useState<ConferenceAgent[]>(DEFAULT_CONFERENCE_AGENTS);
  const [selectedOrchestratorId, setSelectedOrchestratorId] = useState<string | null>(null);
  const [activeDeptFilter, setActiveDeptFilter] = useState<string>("all");
  const [agentSearch, setAgentSearch] = useState("");
  const [inspectAgent, setInspectAgent] = useState<ConferenceAgent | null>(null);

  const [deliberationDepth, setDeliberationDepth] = useState<"standard" | "deep" | "rapid">("standard");
  const [missionInput, setMissionInput] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [events, setEvents] = useState<ConferenceEvent[]>([]);
  const [result, setResult] = useState<A2AHierarchyExecutionResult | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [copiedFile, setCopiedFile] = useState(false);
  const [currentStep, setCurrentStep] = useState("");
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(-1);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [conferenceHistory, setConferenceHistory] = useState<ConferenceHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<"deliverable" | "tree" | "metrics">("deliverable");
  const [showTranscript, setShowTranscript] = useState(false);
  const [deliverableExpanded, setDeliverableExpanded] = useState(false);
  const [a2aStats, setA2aStats] = useState<{
    totalMessages: number;
    completedCount: number;
    inProgressCount: number;
    failedCount: number;
    successRate: number;
  } | null>(null);

  // Kanban dispatch state
  const [isDispatchingKanban, setIsDispatchingKanban] = useState(false);
  const [dispatchedCount, setDispatchedCount] = useState<number | null>(null);

  // Q&A state
  const [qaMessages, setQaMessages] = useState<ConferenceQAMessage[]>([]);
  const [qaInput, setQaInput] = useState("");
  const [isQaSending, setIsQaSending] = useState(false);

  // Refs
  const streamRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Speech synthesis
  const speakText = useCallback(
    (text: string) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window) || !isVoiceEnabled) return;
      try {
        window.speechSynthesis.cancel();
        const clean = text.replace(/[*#`_\[\]]/g, "").slice(0, 180);
        const u = new SpeechSynthesisUtterance(clean);
        u.rate = 1.05;
        window.speechSynthesis.speak(u);
      } catch {
        /* blocked */
      }
    },
    [isVoiceEnabled]
  );

  useEffect(() => () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  // Load agents from DB
  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      if (res.ok) {
        const d = await res.json();
        const loaded = Array.isArray(d) ? d : d.agents || [];
        if (loaded.length > 0) {
          setAgents(loaded);
        }
      }
    } catch {
      /* fallback to defaults */
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Load A2A stats
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/a2a");
        if (res.ok) {
          const d = await res.json();
          setA2aStats(d.stats || null);
        }
      } catch {
        /* silent */
      }
    })();
  }, [result]);

  // Load history from localStorage
  useEffect(() => {
    try {
      const s = localStorage.getItem("conf-history");
      if (s) setConferenceHistory(JSON.parse(s));
    } catch {
      /* silent */
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (isExecuting) {
      const t0 = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => setElapsedMs(Date.now() - t0), 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExecuting]);

  // Auto-scroll containers
  useEffect(() => {
    if (streamRef.current) streamRef.current.scrollTop = streamRef.current.scrollHeight;
  }, [events]);
  useEffect(() => {
    if (qaRef.current) qaRef.current.scrollTop = qaRef.current.scrollHeight;
  }, [qaMessages]);

  // ── Derived Agents ──────────────────────────────────────────────────────────

  const orchestrators = useMemo(() => {
    const list = agents.filter((a) => a.role === "orchestrator");
    return list.length > 0 ? list : agents.slice(0, 1);
  }, [agents]);

  const orchestrator = useMemo(() => {
    if (selectedOrchestratorId) {
      const found = agents.find((a) => a.id === selectedOrchestratorId);
      if (found) return found;
    }
    // Prefer Atlas if available, else first orchestrator
    const atlas = orchestrators.find((o) => o.name === "atlas");
    return atlas || orchestrators[0] || agents[0];
  }, [agents, orchestrators, selectedOrchestratorId]);

  const specialists = useMemo(() => {
    return agents.filter((a) => a.id !== orchestrator?.id);
  }, [agents, orchestrator]);

  const filteredSpecialists = useMemo(() => {
    return specialists.filter((agent) => {
      // Search query
      if (agentSearch.trim()) {
        const q = agentSearch.toLowerCase();
        const match =
          agent.displayName.toLowerCase().includes(q) ||
          agent.department?.toLowerCase().includes(q) ||
          agent.description?.toLowerCase().includes(q) ||
          agent.role?.toLowerCase().includes(q);
        if (!match) return false;
      }

      // Department category filter
      if (activeDeptFilter === "all") return true;
      const dept = (agent.department || "").toLowerCase();
      if (activeDeptFilter === "engineering") {
        return (
          dept.includes("eng") ||
          dept.includes("infra") ||
          dept.includes("container") ||
          dept.includes("sec") ||
          dept.includes("observ") ||
          dept.includes("sre")
        );
      }
      if (activeDeptFilter === "product") {
        return (
          dept.includes("product") ||
          dept.includes("qa") ||
          dept.includes("test") ||
          dept.includes("design") ||
          dept.includes("ui") ||
          dept.includes("ux") ||
          dept.includes("fuzz")
        );
      }
      if (activeDeptFilter === "growth") {
        return (
          dept.includes("growth") ||
          dept.includes("revenue") ||
          dept.includes("copy") ||
          dept.includes("creative") ||
          dept.includes("media") ||
          dept.includes("social")
        );
      }
      if (activeDeptFilter === "strategy") {
        return (
          dept.includes("exec") ||
          dept.includes("legal") ||
          dept.includes("priv") ||
          dept.includes("contract") ||
          dept.includes("operat") ||
          dept.includes("research") ||
          dept.includes("peer") ||
          dept.includes("head")
        );
      }
      return true;
    });
  }, [specialists, activeDeptFilter, agentSearch]);

  const addEvent = useCallback(
    (event: Omit<ConferenceEvent, "id" | "timestamp">) => {
      setEvents((prev) => [
        ...prev,
        {
          ...event,
          id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (isVoiceEnabled && ["speaking", "complete", "synthesis"].includes(event.type)) {
        speakText(event.message);
      }
    },
    [isVoiceEnabled, speakText]
  );

  const fmtTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}.${Math.floor((ms % 1000) / 100)}s`;
  };

  // ── Execute Conference Mission ──────────────────────────────────────────────

  const executeMission = async () => {
    if (!missionInput.trim()) {
      toast.error("Please enter a mission topic");
      return;
    }
    if (!orchestrator) {
      toast.error("No orchestrator agent available");
      return;
    }

    setIsExecuting(true);
    setResult(null);
    setEvents([]);
    setExpandedNodes({});
    setQaMessages([]);
    setDispatchedCount(null);
    setPhaseIndex(0);
    setActiveResultTab("deliverable");

    playTaskStartedSound();

    addEvent({
      type: "phase",
      fromAgent: "A2A Protocol Engine",
      fromAvatar: "⚙️",
      message: `Conference session convened under chair ${orchestrator.displayName} (${orchestrator.department || "Executive"}). Protocol v2.4 initialized.`,
    });
    addEvent({
      type: "speaking",
      fromAgent: orchestrator.displayName,
      fromAvatar: orchestrator.avatar,
      message: `Council convened. Mission topic: "${missionInput.trim()}". Decomposing strategic objectives and work packages across specialist hierarchy...`,
    });
    setSpeakingAgentId(orchestrator.id);
    setCurrentStep(`${orchestrator.displayName} analyzing & decomposing...`);

    const subs = filteredSpecialists.length > 0 ? filteredSpecialists.slice(0, 4) : specialists.slice(0, 4);

    const t1 = setTimeout(() => {
      setPhaseIndex(1);
      setCurrentStep("Issuing A2A contracts & delegating to specialist council...");
      subs.forEach((sub, i) => {
        setTimeout(() => {
          addEvent({
            type: "delegation",
            fromAgent: orchestrator.displayName,
            fromAvatar: orchestrator.avatar,
            toAgent: sub.displayName,
            toAvatar: sub.avatar,
            message: `Delegating domain deliverable to ${sub.displayName} (${sub.department || sub.role || "specialist"})`,
          });
          setSpeakingAgentId(sub.id);
        }, i * 700);
      });
    }, 2000);

    const t2 = setTimeout(() => {
      setPhaseIndex(2);
      setCurrentStep("Specialists executing work packages...");
      subs.forEach((sub, i) => {
        setTimeout(() => {
          addEvent({
            type: "execution",
            fromAgent: sub.displayName,
            fromAvatar: sub.avatar,
            message: `Analyzing domain requirements, researching best practices, and drafting technical deliverable...`,
          });
          setSpeakingAgentId(sub.id);
        }, i * 1100);
      });
    }, 5000);

    const t3 = setTimeout(() => {
      setPhaseIndex(3);
      setCurrentStep("Synthesizing unified Master Executive Deliverable...");
      addEvent({
        type: "synthesis",
        fromAgent: orchestrator.displayName,
        fromAvatar: orchestrator.avatar,
        message: "All specialist submissions received. Synthesizing unified Master Executive Deliverable and architectural roadmap...",
      });
      setSpeakingAgentId(orchestrator.id);
    }, 9500);

    try {
      const res = await fetch("/api/a2a/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orchestratorId: orchestrator.id,
          missionTopic: missionInput.trim(),
          missionDetails: `Deliberation Depth: ${deliberationDepth}`,
        }),
      });

      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      const data = await res.json();

      if (res.ok && data.success) {
        setResult(data);
        setSpeakingAgentId(null);
        setCurrentStep("");
        setPhaseIndex(4);

        playTaskCompletedSound();

        data.executionTree?.subordinates?.forEach((sub: A2AHierarchyNodeExecution) => {
          addEvent({
            type: "complete",
            fromAgent: sub.agentName,
            fromAvatar: sub.avatar,
            message: `Completed deliverable: "${sub.taskTitle}" — ${Math.round((sub.latencyMs || 0) / 1000)}s`,
          });
        });
        addEvent({
          type: "complete",
          fromAgent: data.executionTree?.agentName || orchestrator.displayName,
          fromAvatar: data.executionTree?.avatar || orchestrator.avatar,
          message: "Consensus reached! Master Executive Deliverable recorded and committed to workspace vault.",
        });

        // Save history
        const entry: ConferenceHistoryEntry = {
          id: data.missionId || `h-${Date.now()}`,
          missionTopic: missionInput.trim(),
          timestamp: new Date().toISOString(),
          totalLatencyMs: data.totalLatencyMs,
          totalSubtasks: data.totalSubtasks,
          success: true,
        };
        const hist = [entry, ...conferenceHistory].slice(0, 20);
        setConferenceHistory(hist);
        try {
          localStorage.setItem("conf-history", JSON.stringify(hist));
        } catch {
          /* silent */
        }

        toast.success(`Conference consensus fulfilled — ${data.totalSubtasks} specialist subtasks recorded!`);
      } else {
        playWarningSound();
        toast.error(data.error || "Conference execution failed");
        setPhaseIndex(-1);
      }
    } catch {
      playWarningSound();
      toast.error("Network communication error with Conference Engine");
      setPhaseIndex(-1);
    } finally {
      setIsExecuting(false);
      setSpeakingAgentId(null);
      setCurrentStep("");
    }
  };

  // ── Dispatch to Kanban ──────────────────────────────────────────────────────

  const handleDispatchToKanban = async () => {
    if (!result) return;
    setIsDispatchingKanban(true);
    try {
      const res = await fetch("/api/a2a/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: result.missionTopic,
          verdict: {
            summary: result.rootSummary,
            consensusPoints: [
              `Hierarchical conference executed with ${result.totalSubtasks} subtasks.`,
              `Chaired and synthesized by ${result.orchestratorName}.`,
            ],
            recommendedAction: "Execute concrete implementation tickets via Kanban board.",
          },
          targetStatus: "todo",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const count = data.createdTasks?.length || result.totalSubtasks || 3;
        setDispatchedCount(count);
        playTaskCompletedSound();
        toast.success(`Dispatched ${count} action tasks to Kanban Board!`);
      } else {
        toast.error(data.error || "Failed to dispatch tasks");
      }
    } catch {
      toast.error("Network error dispatching tasks");
    } finally {
      setIsDispatchingKanban(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleCopy = () => {
    if (!result?.finalDeliverable) return;
    navigator.clipboard.writeText(result.finalDeliverable);
    setCopied(true);
    toast.success("Deliverable copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyPath = () => {
    if (!result?.conferenceFile?.filePath) return;
    navigator.clipboard.writeText(result.conferenceFile.filePath);
    setCopiedFile(true);
    toast.success("File path copied to clipboard");
    setTimeout(() => setCopiedFile(false), 2000);
  };

  const handlePrint = () => {
    if (!result) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Please allow popups to export briefing");
      return;
    }
    const title = missionInput.trim() || result.missionTopic || "A2A Conference Executive Briefing";
    const parts = agents
      .map(
        (a) =>
          `<span style="display:inline-block;padding:4px 10px;margin:3px 4px;border-radius:6px;background:#f8fafc;font-size:12px;font-weight:600;border:1px solid #cbd5e1;color:#1e293b;">${
            a.avatar || "🤖"
          } ${a.displayName} (${a.department || a.role || "specialist"})</span>`
      )
      .join(" ");
    const esc = (result.finalDeliverable || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title><style>@media print{body{margin:0;padding:20px;font-size:11pt}.no-print{display:none!important}}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;line-height:1.6;color:#0f172a;max-width:900px;margin:30px auto;padding:0 24px}.hdr{border-bottom:2px solid #0284c7;padding-bottom:16px;margin-bottom:24px}.ttl{font-size:24px;font-weight:800;color:#0369a1;margin:0 0 8px}.meta{font-size:13px;color:#64748b;display:flex;gap:16px;flex-wrap:wrap}h2{font-size:16px;text-transform:uppercase;letter-spacing:.05em;color:#334155;margin-top:28px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}.del{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;white-space:pre-wrap;font-size:13px;font-family:monospace;line-height:1.7}.btn{padding:8px 16px;background:#0284c7;color:#fff;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:13px}</style></head><body><div class="no-print" style="margin-bottom:20px"><button class="btn" onclick="window.print()">Print / Save as PDF</button></div><div class="hdr"><div class="ttl">${title}</div><div class="meta"><span><b>Chair:</b> ${
      result.orchestratorName
    }</span><span><b>Generated:</b> ${new Date().toLocaleString()}</span><span><b>Duration:</b> ${Math.round(
      result.totalLatencyMs / 1000
    )}s</span><span><b>Subtasks:</b> ${result.totalSubtasks}</span></div></div><h2>Council Attendees</h2><div style="margin-bottom:20px">${parts}</div><h2>Master Executive Deliverable</h2><div class="del">${esc}</div><script>setTimeout(()=>window.print(),500)</script></body></html>`);
    w.document.close();
  };

  const handleQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qaInput.trim() || isQaSending || !result) return;
    const q = qaInput.trim();
    setQaInput("");
    setQaMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", content: q, timestamp: new Date().toISOString() },
    ]);
    setIsQaSending(true);
    try {
      const res = await fetch("/api/a2a/conference/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          missionTopic: result.missionTopic,
          currentDeliverable: result.finalDeliverable,
          conferenceFilePath: result.conferenceFile?.filePath,
          userPrompt: q,
          history: qaMessages.map((m) => ({ role: m.role, content: m.content })),
          orchestratorId: result.orchestratorId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setQaMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          isRevision: data.isRevision,
          timestamp: new Date().toISOString(),
        },
      ]);
      if (data.revisedDeliverable) {
        setResult((prev) => (prev ? { ...prev, finalDeliverable: data.revisedDeliverable } : prev));
        toast.success("Master Deliverable updated with council revisions!");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process floor inquiry");
    } finally {
      setIsQaSending(false);
    }
  };

  const evtColor = (t: string) =>
    ({
      delegation: "border-l-amber-500 bg-amber-500/5",
      execution: "border-l-blue-500 bg-blue-500/5",
      synthesis: "border-l-purple-500 bg-purple-500/5",
      speaking: "border-l-primary bg-primary/5",
      complete: "border-l-emerald-500 bg-emerald-500/5",
      thinking: "border-l-slate-500 bg-slate-500/5",
      error: "border-l-red-500 bg-red-500/5",
      phase: "border-l-violet-500 bg-violet-500/5",
    }[t] || "border-l-border");

  const evtIcon = (t: string) =>
    ({
      delegation: "📤",
      execution: "⚡",
      synthesis: "🧠",
      speaking: "💬",
      complete: "✅",
      thinking: "🤔",
      error: "❌",
      phase: "🔷",
    }[t] || "•");

  const resetSession = () => {
    setResult(null);
    setEvents([]);
    setQaMessages([]);
    setDispatchedCount(null);
    setPhaseIndex(-1);
    setMissionInput("");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-8">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
            <Users className="w-3.5 h-3.5 text-primary" />
            <span>A2A Conference Hall</span>
            <span className="opacity-40">•</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/80 border border-border">
              Protocol v2.4
            </span>
            {isExecuting && (
              <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                LIVE
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            Autonomous Agent Conference
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-agent hierarchy execution with real-time council deliberation & steerability
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Audio toggle */}
          <button
            type="button"
            onClick={() => {
              const n = !isVoiceEnabled;
              setIsVoiceEnabled(n);
              if (!n && typeof window !== "undefined" && "speechSynthesis" in window) {
                window.speechSynthesis.cancel();
              }
              toast.info(n ? "Council voice synthesis enabled" : "Voice synthesis muted");
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
              isVoiceEnabled
                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {isVoiceEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span>{isVoiceEnabled ? "Voice On" : "Muted"}</span>
          </button>

          {/* History modal toggle */}
          {conferenceHistory.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition cursor-pointer ${
                showHistory
                  ? "bg-primary/10 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-secondary border border-border">
                {conferenceHistory.length}
              </span>
            </button>
          )}

          {/* Active session buttons */}
          {result && (
            <>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              <button
                type="button"
                onClick={resetSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary border border-border transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Mission</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ HISTORY DROPDOWN PANEL ═══ */}
      <AnimatePresence>
        {showHistory && conferenceHistory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="notion-card p-4 border border-border/80 shadow-md">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-primary" /> Past Conference Missions
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setConferenceHistory([]);
                    localStorage.removeItem("conf-history");
                    toast.info("History cleared");
                  }}
                  className="text-[10px] text-muted-foreground hover:text-destructive transition cursor-pointer"
                >
                  Clear History
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {conferenceHistory.slice(0, 9).map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => {
                      setMissionInput(entry.missionTopic);
                      setShowHistory(false);
                      inputRef.current?.focus();
                      toast.info("Topic loaded into mission prompt");
                    }}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-secondary/40 transition cursor-pointer text-left group"
                  >
                    <span
                      className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] shrink-0 ${
                        entry.success
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "bg-red-500/10 text-red-500"
                      }`}
                    >
                      {entry.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-medium text-foreground truncate block group-hover:text-primary transition">
                        {entry.missionTopic}
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {Math.round(entry.totalLatencyMs / 1000)}s • {entry.totalSubtasks} tasks
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ AGENT WAR ROOM & COUNCIL CHAMBER ═══ */}
      <div className="notion-card relative overflow-hidden border border-border/80 shadow-sm">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] via-transparent to-amber-500/[0.03]" />

        <div className="relative p-5 space-y-4">
          {/* Table Header with Stats */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-3">
            <div className="flex items-center gap-2.5 flex-wrap">
              <Crown className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Conference Council
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary border border-border font-mono text-muted-foreground">
                {agents.length} Agents Online
              </span>
              <span className="text-[11px] text-muted-foreground hidden md:inline">
                • Chair: <strong className="text-foreground">{orchestrator?.displayName}</strong>
              </span>
            </div>

            {/* A2A Engine Stats */}
            {a2aStats && (
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  {a2aStats.totalMessages} a2a messages
                </span>
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  {a2aStats.successRate}% consensus
                </span>
              </div>
            )}
          </div>

          {/* Main Stage: Orchestrator Chair + Specialists Council */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* ── Orchestrator Podium ── */}
            {orchestrator && (
              <div
                className={`flex flex-col justify-between items-center text-center p-4 rounded-xl border-2 transition-all lg:w-56 shrink-0 ${
                  speakingAgentId === orchestrator.id
                    ? "border-primary bg-primary/5 shadow-lg shadow-primary/10 ring-2 ring-primary/20"
                    : "border-amber-500/30 bg-amber-500/[0.02]"
                }`}
              >
                <div className="space-y-2 w-full flex flex-col items-center">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold border border-amber-500/20">
                    <Crown className="w-3 h-3" />
                    <span>COUNCIL CHAIR</span>
                  </div>

                  <div className="relative my-1">
                    <motion.span
                      animate={speakingAgentId === orchestrator.id ? { scale: [1, 1.08, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border-2 shadow-md ${
                        speakingAgentId === orchestrator.id
                          ? "border-primary/50 bg-primary/10"
                          : "border-amber-500/30 bg-amber-500/10"
                      }`}
                    >
                      {orchestrator.avatar}
                    </motion.span>
                    {speakingAgentId === orchestrator.id && (
                      <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
                    )}
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-foreground">{orchestrator.displayName}</h4>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {orchestrator.department || orchestrator.role || "Orchestrator"}
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground/80 mt-0.5 block">
                      {orchestrator.model || "claude-3-5-sonnet"}
                    </span>
                  </div>

                  {speakingAgentId === orchestrator.id && (
                    <div className="flex gap-1 py-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <motion.div
                          key={i}
                          animate={{ height: [3, 16, 3] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                          className="w-1 bg-primary rounded-full"
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Chair Selector Dropdown */}
                {orchestrators.length > 1 && !isExecuting && (
                  <div className="w-full mt-3 pt-3 border-t border-border/50">
                    <label className="text-[10px] font-medium text-muted-foreground block mb-1">
                      Change Chair
                    </label>
                    <select
                      value={orchestrator.id}
                      onChange={(e) => {
                        setSelectedOrchestratorId(e.target.value);
                        toast.info("Council chair updated");
                      }}
                      className="w-full text-[11px] font-medium bg-secondary/80 border border-border rounded-lg px-2 py-1 text-foreground outline-none cursor-pointer"
                    >
                      {orchestrators.map((orc) => (
                        <option key={orc.id} value={orc.id}>
                          {orc.avatar} {orc.displayName} ({orc.department || "Orchestrator"})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ── Specialist Council Chamber ── */}
            <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
              {/* Filter bar & Search */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5 max-w-full">
                  {DEPARTMENT_FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => setActiveDeptFilter(f.key)}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg border transition whitespace-nowrap cursor-pointer ${
                        activeDeptFilter === f.key
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Search */}
                <div className="relative w-full sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Find specialist..."
                    className="w-full text-xs pl-8 pr-2.5 py-1 rounded-lg bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
                  />
                  {agentSearch && (
                    <button
                      type="button"
                      onClick={() => setAgentSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Specialists Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 max-h-56 overflow-y-auto scrollbar-thin pr-1">
                {filteredSpecialists.map((agent) => {
                  const speaking = speakingAgentId === agent.id;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => setInspectAgent(agent)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-pointer group ${
                        speaking
                          ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-1 ring-primary/20"
                          : "border-border/70 bg-card/80 hover:bg-secondary/50 hover:border-primary/30"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <span
                          className={`w-9 h-9 rounded-lg flex items-center justify-center text-base border transition ${
                            speaking
                              ? "border-primary/40 bg-primary/10"
                              : "border-border bg-secondary group-hover:scale-105"
                          }`}
                        >
                          {agent.avatar}
                        </span>
                        {speaking && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-card animate-pulse" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition">
                          {agent.displayName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {agent.department || agent.role || "Specialist"}
                        </p>
                      </div>
                      {speaking && (
                        <div className="flex gap-0.5 shrink-0">
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              animate={{ height: [3, 10, 3] }}
                              transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
                              className="w-0.5 bg-primary rounded-full"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {filteredSpecialists.length === 0 && (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No specialists match "{agentSearch}".
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ AGENT INSPECTOR MODAL ═══ */}
      <AnimatePresence>
        {inspectAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-5 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center text-2xl shadow-xs">
                    {inspectAgent.avatar}
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-foreground">{inspectAgent.displayName}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {inspectAgent.role || "Specialist"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {inspectAgent.department || "General"}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectAgent(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Mission Role & Specialty
                  </span>
                  <p className="text-foreground leading-relaxed bg-secondary/30 p-2.5 rounded-lg border border-border">
                    {inspectAgent.description || "Active specialist ready for autonomous delegation."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                    <span className="text-[10px] text-muted-foreground block">Model Architecture</span>
                    <span className="font-mono font-semibold text-foreground">
                      {inspectAgent.model || "claude-3-5-sonnet"}
                    </span>
                  </div>
                  <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                    <span className="text-[10px] text-muted-foreground block">A2A Compatibility</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      Hierarchical Ready
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {inspectAgent.role === "orchestrator" && inspectAgent.id !== orchestrator?.id && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrchestratorId(inspectAgent.id);
                      setInspectAgent(null);
                      toast.success(`Designated ${inspectAgent.displayName} as Council Chair`);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white cursor-pointer transition"
                  >
                    Set as Council Chair
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectAgent(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer transition"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ MISSION COMMAND CENTER ═══ */}
      <div className="notion-card p-5 space-y-3.5 border border-border/80 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Direct Council Mission
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Deliberation depth selector */}
            {!isExecuting && (
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-medium bg-secondary/60 p-0.5 rounded-lg border border-border">
                {(["rapid", "standard", "deep"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setDeliberationDepth(mode)}
                    className={`px-2 py-0.5 rounded-md capitalize transition cursor-pointer ${
                      deliberationDepth === mode
                        ? "bg-card text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            )}

            {isExecuting && (
              <span className="flex items-center gap-1.5 text-xs font-mono text-primary tabular-nums">
                <Timer className="w-3.5 h-3.5 animate-pulse" />
                {fmtTime(elapsedMs)}
              </span>
            )}
          </div>
        </div>

        {/* Input & Launch Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            executeMission();
          }}
          className="flex flex-col sm:flex-row gap-2.5"
        >
          <input
            ref={inputRef}
            type="text"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            placeholder="Describe the mission for your agent team (e.g. Design production JWT auth system with RBAC)..."
            disabled={isExecuting}
            className="flex-1 bg-secondary/50 border border-border px-4 py-3 rounded-xl text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition shadow-xs"
          />
          <button
            type="submit"
            disabled={isExecuting || !missionInput.trim()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition cursor-pointer shadow-sm shrink-0"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>In Session...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Launch Conference</span>
              </>
            )}
          </button>
        </form>

        {/* Quick Missions */}
        {!isExecuting && !result && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_MISSIONS.map((m) => (
              <button
                key={m.label}
                type="button"
                onClick={() => {
                  setMissionInput(m.prompt);
                  inputRef.current?.focus();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-card hover:bg-secondary/60 hover:border-primary/30 text-muted-foreground hover:text-foreground transition cursor-pointer shadow-xs"
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Live Phase Stepper */}
        <AnimatePresence>
          {(isExecuting || phaseIndex === 4) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 overflow-hidden"
            >
              <div className="flex items-center gap-1">
                {PHASE_STEPS.map((step, i) => {
                  const isDone = i < phaseIndex || phaseIndex === 4;
                  const isActive = i === phaseIndex && phaseIndex !== 4;
                  return (
                    <div key={step.key} className="flex items-center gap-1 flex-1">
                      <div
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/30 shadow-xs"
                            : isDone
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : "bg-secondary/50 text-muted-foreground opacity-40"
                        }`}
                      >
                        {isActive && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {isDone && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        {!isActive && !isDone && <span className="text-xs">{step.icon}</span>}
                        <span className="hidden sm:inline">{step.label}</span>
                      </div>
                      {i < PHASE_STEPS.length - 1 && (
                        <div
                          className={`w-2 sm:w-3 h-0.5 rounded-full shrink-0 ${
                            isDone ? "bg-emerald-500/50" : "bg-border"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {isExecuting && currentStep && (
                <p className="text-xs text-muted-foreground mt-2.5 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>{currentStep}</span>
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══ DELIVERABLE ARTIFACT BANNER ═══ */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="notion-card p-4 border-primary/30 bg-gradient-to-r from-primary/[0.04] via-blue-500/[0.03] to-emerald-500/[0.04] shadow-sm"
        >
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                <code className="text-xs font-mono px-2 py-0.5 rounded bg-secondary border border-border text-primary font-bold">
                  {result.dedicatedFolder || "agent-workspace/conference/"}
                </code>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Consensus Fulfilled
                </span>
              </div>

              {result.conferenceFile && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  <span className="font-mono text-foreground font-medium truncate">
                    {result.conferenceFile.fileName}
                  </span>
                  {result.conferenceFile.size > 0 && (
                    <span className="text-[11px] opacity-70">
                      ({Math.round(result.conferenceFile.size / 1024)} KB)
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-primary" />
                  {Math.round(result.totalLatencyMs / 1000)}s duration
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Layers className="w-3 h-3 text-amber-500" />
                  {result.totalSubtasks} subtasks executed
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3 text-blue-500" />
                  {result.executionTree?.subordinates?.length || 0} specialists reports
                </span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {result.conferenceFile && (
                <a
                  href={result.conferenceFile.fileUrl}
                  download={result.conferenceFile.fileName}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 transition shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
              )}

              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-xs cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>PDF Briefing</span>
              </button>

              {/* Dispatch to Kanban */}
              <button
                type="button"
                onClick={handleDispatchToKanban}
                disabled={isDispatchingKanban || dispatchedCount !== null}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-xs cursor-pointer ${
                  dispatchedCount !== null
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {isDispatchingKanban ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : dispatchedCount !== null ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Kanban className="w-3.5 h-3.5" />
                )}
                <span>
                  {dispatchedCount !== null
                    ? `Dispatched (${dispatchedCount})`
                    : "Dispatch to Kanban"}
                </span>
              </button>

              <Link
                href="/code"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-secondary transition cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Code</span>
              </Link>

              <button
                type="button"
                onClick={handleCopyPath}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-secondary transition cursor-pointer"
              >
                {copiedFile ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedFile ? "Copied" : "Copy Path"}</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ TWO COLUMNS: ACTIVITY STREAM + MASTER RESULT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Activity Stream ── */}
        <div className="notion-card p-5 flex flex-col min-h-0 border border-border/80 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 text-primary" />
              <span>Live Deliberation Stream</span>
              {events.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary border border-border font-mono">
                  {events.length} events
                </span>
              )}
            </h3>
            {events.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTranscript(!showTranscript)}
                className={`text-[11px] font-medium px-2.5 py-1 rounded-md border transition cursor-pointer ${
                  showTranscript
                    ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                    : "border-border text-muted-foreground hover:bg-secondary"
                }`}
              >
                {showTranscript ? "Rich Stream" : "Raw Log"}
              </button>
            )}
          </div>

          <div
            ref={streamRef}
            className="flex-1 space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin pr-1"
          >
            {events.length === 0 && !isExecuting && (
              <div className="text-center py-20 text-muted-foreground">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center">
                  <Users className="w-6 h-6 opacity-30 text-primary" />
                </div>
                <p className="text-xs font-medium text-foreground">A2A Council Chamber Ready</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                  Launch a mission above to watch council members delegate, execute, and deliberate in real time.
                </p>
              </div>
            )}

            {showTranscript ? (
              <div className="space-y-1 font-mono text-[11px] p-2 bg-secondary/30 rounded-lg border border-border">
                {events.map((evt, i) => (
                  <div
                    key={evt.id}
                    className="flex gap-2 py-0.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded px-1 transition"
                  >
                    <span className="w-5 text-right shrink-0 opacity-40">{i + 1}</span>
                    <span className="w-16 shrink-0 font-medium">
                      {new Date(evt.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span
                      className={`w-18 shrink-0 uppercase font-bold text-[10px] ${
                        evt.type === "complete"
                          ? "text-emerald-500"
                          : evt.type === "delegation"
                          ? "text-amber-500"
                          : evt.type === "execution"
                          ? "text-blue-500"
                          : evt.type === "synthesis"
                          ? "text-purple-500"
                          : ""
                      }`}
                    >
                      {evt.type}
                    </span>
                    <span className="text-foreground shrink-0 font-semibold">{evt.fromAgent}</span>
                    {evt.toAgent && (
                      <>
                        <span>→</span>
                        <span className="text-foreground font-semibold">{evt.toAgent}</span>
                      </>
                    )}
                    <span className="truncate opacity-75">{evt.message}</span>
                  </div>
                ))}
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {events.map((evt) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`flex gap-2.5 p-2.5 rounded-xl border-l-2 ${evtColor(evt.type)}`}
                  >
                    <span className="text-sm shrink-0 mt-0.5">{evtIcon(evt.type)}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap text-xs">
                        <span>{evt.fromAvatar}</span>
                        <span className="font-bold text-foreground">{evt.fromAgent}</span>
                        {evt.toAgent && (
                          <>
                            <ArrowRight className="w-3 h-3 text-muted-foreground" />
                            <span>{evt.toAvatar}</span>
                            <span className="font-bold text-foreground">{evt.toAgent}</span>
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground font-mono ml-auto shrink-0">
                          {new Date(evt.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {evt.message}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ── Master Deliverable & Tree Panel ── */}
        <div className="notion-card p-5 flex flex-col min-h-0 border border-border/80 shadow-sm">
          <div className="flex items-center justify-between mb-3 border-b border-border/50 pb-2.5">
            {result ? (
              <div className="flex items-center gap-1">
                {(["deliverable", "tree", "metrics"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveResultTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer capitalize ${
                      activeResultTab === tab
                        ? "bg-primary/10 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    {tab === "deliverable" && (
                      <span className="flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500" />
                        <span>Deliverable</span>
                      </span>
                    )}
                    {tab === "tree" && (
                      <span className="flex items-center gap-1.5">
                        <GitBranch className="w-3.5 h-3.5 text-blue-500" />
                        <span>Tree Hierarchy</span>
                      </span>
                    )}
                    {tab === "metrics" && (
                      <span className="flex items-center gap-1.5">
                        <BarChart3 className="w-3.5 h-3.5 text-violet-500" />
                        <span>Metrics</span>
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Crown className="w-3.5 h-3.5 text-amber-500" />
                <span>Master Executive Deliverable</span>
              </h3>
            )}

            {result && activeResultTab === "deliverable" && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-secondary border border-border">
                  {Math.round(result.totalLatencyMs / 1000)}s
                </span>
                <button
                  type="button"
                  onClick={() => setDeliverableExpanded(!deliverableExpanded)}
                  className="p-1 rounded-md hover:bg-secondary transition cursor-pointer text-muted-foreground"
                >
                  {deliverableExpanded ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-border hover:bg-secondary transition cursor-pointer"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Empty state */}
          {!result && !isExecuting && (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center">
                  <Zap className="w-6 h-6 opacity-30 text-amber-500" />
                </div>
                <p className="text-xs font-medium text-foreground">Deliverable Output Area</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs mx-auto">
                  Consolidated technical roadmap, specialist subtasks, and executive deliverables will render here.
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {isExecuting && !result && (
            <div className="flex-1 flex items-center justify-center py-20">
              <div className="text-center space-y-3">
                <Loader2 className="w-9 h-9 animate-spin text-primary mx-auto" />
                <div>
                  <p className="text-xs text-foreground font-semibold">{currentStep}</p>
                  <p className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5">
                    Elapsed: {fmtTime(elapsedMs)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Deliverable Tab ── */}
          {result && activeResultTab === "deliverable" && (
            <div
              className={`flex-1 space-y-4 overflow-y-auto scrollbar-thin ${
                deliverableExpanded ? "max-h-[800px]" : "max-h-[520px]"
              }`}
            >
              <div className="p-4 rounded-xl bg-secondary/30 border border-border text-xs leading-relaxed">
                <MarkdownRenderer content={result.finalDeliverable} />
              </div>

              {/* Specialist Reports Accordion */}
              {result.executionTree.subordinates &&
                result.executionTree.subordinates.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Specialist Subtask Reports ({result.executionTree.subordinates.length})
                    </h4>
                    {result.executionTree.subordinates.map((sub, i) => {
                      const open = expandedNodes[sub.agentId] ?? false;
                      return (
                        <div
                          key={i}
                          className="rounded-xl border border-border bg-card/60 overflow-hidden shadow-xs"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedNodes((p) => ({ ...p, [sub.agentId]: !p[sub.agentId] }))
                            }
                            className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-secondary/40 transition cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 text-xs min-w-0">
                              <span>{sub.avatar}</span>
                              <span className="font-bold text-foreground">{sub.agentName}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground shrink-0">
                                {sub.agentRole}
                              </span>
                              <span className="text-muted-foreground truncate hidden sm:inline">
                                — {sub.taskTitle}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                              {sub.latencyMs && (
                                <span className="text-[10px] font-mono">
                                  {Math.round(sub.latencyMs / 1000)}s
                                </span>
                              )}
                              {open ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </div>
                          </button>
                          <AnimatePresence>
                            {open && sub.output && (
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: "auto" }}
                                exit={{ height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="p-3.5 border-t border-border bg-muted/20 text-xs leading-relaxed max-h-60 overflow-y-auto">
                                  <MarkdownRenderer content={sub.output} />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          )}

          {/* ── Tree Tab ── */}
          {result && activeResultTab === "tree" && (
            <div className="flex-1 max-h-[520px] overflow-y-auto scrollbar-thin space-y-2 pr-1">
              {/* Root */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/30">
                <span className="text-xl">{result.executionTree.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground">
                      {result.executionTree.agentName}
                    </span>
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {result.executionTree.taskTitle}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">
                  {Math.round((result.executionTree.latencyMs || 0) / 1000)}s
                </span>
              </div>

              {/* Subordinates */}
              {result.executionTree.subordinates?.map((sub, i) => (
                <div key={i} className="ml-5 pl-4 border-l-2 border-border/80 space-y-1">
                  <div className="flex items-center gap-2.5 p-2 rounded-lg bg-card/60 border border-border/60 hover:bg-secondary/30 transition">
                    <span className="text-base">{sub.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-foreground">{sub.agentName}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                          {sub.agentRole}
                        </span>
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{sub.taskTitle}</p>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {Math.round((sub.latencyMs || 0) / 1000)}s
                    </span>
                  </div>

                  {/* Tier 3 workers if any */}
                  {sub.subordinates?.map((w, j) => (
                    <div key={j} className="ml-5 pl-3 border-l-2 border-border/40">
                      <div className="flex items-center gap-2 p-1.5 rounded-lg bg-secondary/20 hover:bg-secondary/40 transition">
                        <span className="text-sm">{w.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <span className="text-[11px] font-semibold text-foreground">
                            {w.agentName}
                          </span>
                          <p className="text-[10px] text-muted-foreground truncate">{w.taskTitle}</p>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {Math.round((w.latencyMs || 0) / 1000)}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Metrics Tab ── */}
          {result && activeResultTab === "metrics" && (
            <div className="flex-1 max-h-[520px] overflow-y-auto scrollbar-thin space-y-4 pr-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    label: "Duration",
                    value: `${Math.round(result.totalLatencyMs / 1000)}s`,
                    icon: Clock,
                    color: "text-primary",
                  },
                  {
                    label: "Subtasks",
                    value: result.totalSubtasks,
                    icon: Layers,
                    color: "text-amber-500",
                  },
                  {
                    label: "Reports",
                    value: result.executionTree?.subordinates?.length || 0,
                    icon: FileText,
                    color: "text-blue-500",
                  },
                  {
                    label: "Events",
                    value: events.length,
                    icon: Activity,
                    color: "text-violet-500",
                  },
                ].map((s) => (
                  <div key={s.label} className="p-3 rounded-xl bg-secondary/30 border border-border">
                    <div className="flex items-center gap-1.5 mb-1">
                      <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                        {s.label}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Specialist Performance Bar */}
              {result.executionTree.subordinates &&
                result.executionTree.subordinates.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Specialist Latency Breakdown
                    </h4>
                    {result.executionTree.subordinates.map((sub, i) => {
                      const pct =
                        result.totalLatencyMs > 0
                          ? Math.round(((sub.latencyMs || 0) / result.totalLatencyMs) * 100)
                          : 0;
                      return (
                        <div key={i} className="p-2.5 rounded-lg border border-border bg-card/60">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 text-xs">
                              <span>{sub.avatar}</span>
                              <span className="font-bold text-foreground">{sub.agentName}</span>
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {Math.round((sub.latencyMs || 0) / 1000)}s ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-full rounded-full transition-all"
                              style={{ width: `${Math.max(pct, 4)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              {/* Metadata */}
              <div className="space-y-1.5 pt-2 border-t border-border">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-primary" /> Session Metadata
                </h4>
                {[
                  ["Mission ID", result.missionId],
                  ["Orchestrator Chair", result.orchestratorName],
                  ["Session Completed", new Date(result.createdAt).toLocaleString()],
                  ["Vault Storage", result.dedicatedFolder || "agent-workspace/conference/"],
                ].map(([k, v]) => (
                  <div
                    key={k as string}
                    className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs"
                  >
                    <span className="font-medium text-foreground">{k}</span>
                    <code className="text-[11px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-secondary max-w-[220px] truncate">
                      {v as string}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══ INTERACTIVE CONFERENCE FLOOR (Q&A / REVISION) ═══ */}
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="notion-card p-5 space-y-3.5 border border-border/80 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 border border-primary/20 flex items-center justify-center text-sm shadow-xs">
                💬
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Interactive Conference Floor
                  <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active Steerability
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Direct inquiries to council chair {result.orchestratorName} or request deliverable revisions
                </p>
              </div>
            </div>
            {qaMessages.length > 0 && (
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-secondary border border-border font-mono text-muted-foreground">
                {qaMessages.length} msgs
              </span>
            )}
          </div>

          {/* Quick inquiries */}
          {qaMessages.length === 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[
                "Explain the architecture",
                "Security considerations?",
                "Add rate limiting",
                "Add unit tests",
                "What are the trade-offs?",
              ].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setQaInput(s)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-secondary/60 hover:border-primary/30 text-muted-foreground hover:text-foreground transition cursor-pointer shadow-xs"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Q&A Messages Stream */}
          {qaMessages.length > 0 && (
            <div
              ref={qaRef}
              className="space-y-3 p-3.5 rounded-xl bg-secondary/30 border border-border max-h-[300px] overflow-y-auto scrollbar-thin"
            >
              {qaMessages.map((msg) => {
                const isUser = msg.role === "user";
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <span className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs shrink-0 mt-0.5 shadow-xs">
                        👑
                      </span>
                    )}
                    <div className={`space-y-1 ${isUser ? "max-w-[85%]" : "max-w-[90%]"}`}>
                      <div
                        className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                          isUser
                            ? "bg-primary text-primary-foreground font-medium rounded-tr-xs shadow-xs"
                            : "bg-card border border-border text-foreground shadow-xs"
                        }`}
                      >
                        {!isUser && msg.isRevision && (
                          <div className="mb-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                            <Sparkles className="w-3 h-3" />
                            <span>Deliverable Revised</span>
                          </div>
                        )}
                        <div className="prose prose-xs dark:prose-invert max-w-none">
                          <MarkdownRenderer content={msg.content} />
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono px-1 block">
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floor Input */}
          <form onSubmit={handleQA} className="relative flex items-center gap-2">
            <input
              type="text"
              value={qaInput}
              onChange={(e) => setQaInput(e.target.value)}
              placeholder="Ask a question or request changes to the master deliverable..."
              disabled={isQaSending}
              className="flex-1 bg-secondary/50 border border-border px-4 py-3 rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition pr-28 shadow-xs"
            />
            <button
              type="submit"
              disabled={!qaInput.trim() || isQaSending}
              className="absolute right-2 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {isQaSending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Deliberating...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3 h-3" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      )}
    </div>
  );
}
