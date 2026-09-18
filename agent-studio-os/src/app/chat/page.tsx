"use client";

import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Columns3,
  RotateCcw,
  Clock,
  Sparkles,
  Terminal,
  Search,
  Globe,
  FileText,
  Trash2,
  Info,
  Sliders,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Brain,
  MessageSquareQuote,
  Play,
  Check,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Layers,
  Code2,
  Plus,
  Star,
  GitFork,
  FolderDown,
  Edit3,
  MessageSquare,
  X,
  Copy,
  Download,
  Paperclip,
  Music,
  Image as ImageIcon,
  FileSpreadsheet,
  Square,
  FileCode,
  Radio,
  ArrowDown,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile, ChatSession } from "@/types";
import { HermesTerminalModal } from "@/components/agents/hermes-terminal-modal";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { timeAgo, formatResponseTime } from "@/lib/utils";

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  type: "document" | "code" | "audio" | "image" | "data";
  mimeType: string;
  content: string;
  duration?: number;
}

interface RAGCitation {
  title: string;
  relPath: string;
  excerpt: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  latency?: number;
  source?: string;
  agentName?: string;
  ragCitations?: RAGCitation[];
  attachments?: ChatAttachment[];
  timestamp?: string | number | Date;
}

interface CompareResult {
  model: string;
  content: string;
  latency: number;
  source?: string;
  error?: string;
}

interface ActiveArtifact {
  title: string;
  code: string;
  language: string;
  msgId: string;
  output?: { stdout: string; stderr: string; time: number; running: boolean };
}

const SLASH_COMMANDS = [
  { cmd: "/help", desc: "Show all slash commands, tools, and shortcuts", usage: "/help" },
  { cmd: "/swarm", desc: "Launch multi-agent specialist swarm on a task", usage: "/swarm <topic>" },
  { cmd: "/debate", desc: "Conduct multi-agent roundtable debate", usage: "/debate <topic>" },
  { cmd: "/compare", desc: "Compare 3 models simultaneously side-by-side", usage: "/compare <prompt>" },
  { cmd: "/vault", desc: "Toggle Obsidian Vault RAG Grounding on/off", usage: "/vault" },
  { cmd: "/hermes", desc: "Open interactive Hermes CLI runtime console", usage: "/hermes" },
  { cmd: "/clear", desc: "Clear current conversation messages", usage: "/clear" },
  { cmd: "/reset", desc: "Start a fresh new conversation session", usage: "/reset" },
  { cmd: "/voice", desc: "Launch full duplex AI voice conversation modal", usage: "/voice" },
  { cmd: "/model", desc: "Switch active LLM model (e.g. /model auto/fast)", usage: "/model <model-id>" },
  { cmd: "/agent", desc: "Switch to another agent (e.g. /agent Noman)", usage: "/agent <name>" },
];

const STARTER_PROMPTS = [
  {
    icon: Zap,
    title: "System Architecture",
    tag: "Design",
    desc: "Design full-stack AI orchestration schema & API routes",
    prompt: "Provide an end-to-end architectural blueprint for our AI agent pipeline, detailing data flow, state management, and API design.",
  },
  {
    icon: Search,
    title: "Deep Analysis",
    tag: "Research",
    desc: "Synthesize benchmarks, trade-offs, and multi-agent patterns",
    prompt: "Analyze the trade-offs between centralized orchestrator swarms vs decentralized peer-to-peer agent networks with concrete examples.",
  },
  {
    icon: ListTodo,
    title: "Automated Routine",
    tag: "Workflow",
    desc: "Create a scheduled workflow for backlog grooming & alerts",
    prompt: "Draft a daily automated routine prompt that monitors our Kanban board, flags stagnant tasks, and suggests actionable subtasks.",
  },
  {
    icon: Brain,
    title: "Knowledge Vault",
    tag: "RAG",
    desc: "Audit Obsidian knowledge base and extract project directives",
    prompt: "Audit our shared Obsidian knowledge vault and generate a synthesized summary of key guidelines and current project state.",
  },
];

function ChatContent() {
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agentId");

  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("auto/fast");
  const [models, setModels] = useState<string[]>([]);
  const [activeStreamsCount, setActiveStreamsCount] = useState(0);
  const [activeStreamsCountB, setActiveStreamsCountB] = useState(0);
  const sending = activeStreamsCount > 0;
  const setSending = (val: boolean) => setActiveStreamsCount((c) => val ? c + 1 : Math.max(0, c - 1));

  // Split Arena (Concurrent Dual-Model) States
  const [splitArenaMode, setSplitArenaMode] = useState(false);
  const [modelB, setModelB] = useState("groq/llama-3.3-70b-versatile");
  const [messagesB, setMessagesB] = useState<ChatMessage[]>([]);
  const [splitArenaTarget, setSplitArenaTarget] = useState<"both" | "left" | "right">("both");
  const chatScrollContainerBRef = useRef<HTMLDivElement>(null);

  const [compareMode, setCompareMode] = useState(false);
  const [roundtableMode, setRoundtableMode] = useState(false);
  const [roundtableAgents, setRoundtableAgents] = useState<string[]>([]);
  const [roundtableLoading, setRoundtableLoading] = useState(false);
  const [vaultGrounding, setVaultGrounding] = useState(true);
  const [selectedArtifact, setSelectedArtifact] = useState<ActiveArtifact | null>(null);
  const [copiedArtifact, setCopiedArtifact] = useState(false);
  const [codeOutputs, setCodeOutputs] = useState<
    Record<string, { stdout: string; stderr: string; time: number; running: boolean }>
  >({});
  const [activeCitationMsgId, setActiveCitationMsgId] = useState<string | null>(null);

  // Enhanced UI & Interactivity States
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showAgentSpecsModal, setShowAgentSpecsModal] = useState(false);
  const chatScrollContainerRef = useRef<HTMLDivElement>(null);

  // Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState("");
  const [sidebarTab, setSidebarTab] = useState<"sessions" | "agents">("sessions");
  const [isEditingActiveTitle, setIsEditingActiveTitle] = useState(false);
  const [activeTitleInput, setActiveTitleInput] = useState("");

  const [compareModels, setCompareModels] = useState<string[]>([
    "auto/fast",
    "gemini/gemini-3.5-flash",
    "gemini/gemini-3.1-flash-lite",
  ]);
  const [compareResults, setCompareResults] = useState<CompareResult[]>([]);
  const [comparing, setComparing] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Attachments & Voice Memo Recording State
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Handle File & Audio Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(file.name);
      const isCode = /\.(ts|tsx|js|jsx|py|html|css|json|yaml|yml|sh|bash|sql|rs|go|c|cpp|md)$/i.test(file.name);
      const isData = /\.(csv|tsv|json|xlsx|parquet)$/i.test(file.name);

      let type: ChatAttachment["type"] = "document";
      if (isAudio) type = "audio";
      else if (isImage) type = "image";
      else if (isCode) type = "code";
      else if (isData) type = "data";

      if (isAudio || isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              id: "att-" + Math.random().toString(36).slice(2, 9),
              name: file.name,
              size: file.size,
              type,
              mimeType: file.type || (isAudio ? "audio/mpeg" : "image/png"),
              content: reader.result as string,
            },
          ]);
          toast.success(`Attached ${file.name}`);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          setAttachments((prev) => [
            ...prev,
            {
              id: "att-" + Math.random().toString(36).slice(2, 9),
              name: file.name,
              size: file.size,
              type,
              mimeType: file.type || "text/plain",
              content: reader.result as string,
            },
          ]);
          toast.success(`Attached ${file.name}`);
        };
        reader.readAsText(file);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Start Live Audio Memo Recording
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          const now = new Date();
          const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          setAttachments((prev) => [
            ...prev,
            {
              id: "rec-" + Math.random().toString(36).slice(2, 9),
              name: `Voice Memo (${timeStr})`,
              size: audioBlob.size,
              type: "audio",
              mimeType: "audio/webm",
              content: base64Data,
              duration: recordingDuration,
            },
          ]);
          toast.success("Voice memo attached");
        };
        reader.readAsDataURL(audioBlob);

        stream.getTracks().forEach((track) => track.stop());
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        setRecordingDuration(0);
        setIsRecordingAudio(false);
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
      toast.info("Recording voice memo...");
    } catch (err) {
      console.error("Audio recording error:", err);
      toast.error("Microphone access denied or unavailable");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Audio Read (TTS) state & handler
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoTTS, setAutoTTS] = useState<boolean>(false);
  const synthKeepAliveRef = useRef<NodeJS.Timeout | null>(null);
  const speechCancelledRef = useRef<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("agent-studio-auto-tts");
      if (saved === "true") setAutoTTS(true);
    }
  }, []);

  const toggleAutoTTS = useCallback(() => {
    setAutoTTS((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("agent-studio-auto-tts", String(next));
      }
      toast.info(next ? "Auto-Read (TTS) enabled for chat" : "Auto-Read disabled");
      return next;
    });
  }, []);

  const stopAudioPlayback = useCallback(() => {
    speechCancelledRef.current = true;
    if (synthKeepAliveRef.current) {
      clearInterval(synthKeepAliveRef.current);
      synthKeepAliveRef.current = null;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.pause();
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        console.error("Speech cancellation error:", e);
      }
    }
    setSpeakingMsgId(null);
  }, []);

  const handleSpeakMessage = useCallback((msgId: string, text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Audio speech synthesis is not supported by your browser");
      return;
    }

    if (speakingMsgId === msgId) {
      stopAudioPlayback();
      toast.info("Audio playback stopped");
      return;
    }

    stopAudioPlayback();
    speechCancelledRef.current = false;

    // Clean markdown formatting, code blocks, latex, and urls for smooth natural speech
    const cleanText = text
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_~>]/g, "")
      .replace(/\$\$[\s\S]*?\$\$/g, "")
      .replace(/\$[^$]+\$/g, "")
      .replace(/https?:\/\/\S+/g, "link")
      .replace(/\n+/g, " ")
      .trim();

    if (!cleanText) {
      toast.info("No readable text in message");
      return;
    }

    // Chunk text into natural sentence phrases (<= 150 chars) to prevent Chrome's 15s SpeechSynthesis bug
    const rawChunks = cleanText.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleanText];
    const chunks: string[] = [];
    for (const c of rawChunks) {
      const trimmed = c.trim();
      if (!trimmed) continue;
      if (trimmed.length <= 150) {
        chunks.push(trimmed);
      } else {
        const parts = trimmed.match(/[^,;]+[,;]+|[^,;]+$/g) || [trimmed];
        for (const p of parts) {
          const pt = p.trim();
          if (pt) chunks.push(pt);
        }
      }
    }

    if (chunks.length === 0) return;

    setSpeakingMsgId(msgId);

    // Keep synthesis engine alive in Chromium browsers
    synthKeepAliveRef.current = setInterval(() => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        if (window.speechSynthesis.speaking && window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    }, 3000);

    const speakChunkIndex = (index: number) => {
      if (speechCancelledRef.current) {
        return;
      }

      if (index >= chunks.length) {
        if (synthKeepAliveRef.current) {
          clearInterval(synthKeepAliveRef.current);
          synthKeepAliveRef.current = null;
        }
        setSpeakingMsgId(null);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const naturalVoice =
        voices.find(
          (v) =>
            v.lang.startsWith("en") &&
            (v.name.includes("Natural") ||
              v.name.includes("Google") ||
              v.name.includes("Neural") ||
              v.name.includes("Online"))
        ) || voices.find((v) => v.lang.startsWith("en"));

      if (naturalVoice) utterance.voice = naturalVoice;

      utterance.onend = () => {
        if (speechCancelledRef.current) {
          return;
        }
        speakChunkIndex(index + 1);
      };

      utterance.onerror = () => {
        if (speechCancelledRef.current) {
          return;
        }
        if (synthKeepAliveRef.current) {
          clearInterval(synthKeepAliveRef.current);
          synthKeepAliveRef.current = null;
        }
        setSpeakingMsgId(null);
      };

      window.speechSynthesis.speak(utterance);
    };

    // Ensure voices are loaded or ready
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.onvoiceschanged = null;
        if (!speechCancelledRef.current) {
          speakChunkIndex(0);
        }
      };
      setTimeout(() => {
        if (!speechCancelledRef.current) {
          speakChunkIndex(0);
        }
      }, 200);
    } else {
      speakChunkIndex(0);
    }
  }, [speakingMsgId, stopAudioPlayback]);

  // Cancel speech synthesis on component unmount
  useEffect(() => {
    return () => {
      stopAudioPlayback();
    };
  }, [stopAudioPlayback]);

  // Fetch models & agents on mount
  useEffect(() => {
    async function fetchData() {
      try {
        const [modelsRes, agentsRes] = await Promise.all([
          fetch("/api/models"),
          fetch("/api/agents"),
        ]);
        const modelsData = await modelsRes.json();
        const agentsData: AgentProfile[] = await agentsRes.json();

        if (modelsData.models?.length) {
          const list: string[] = Array.from(
            new Set(modelsData.models.map((m: { id: string }) => m.id))
          );
          setModels(list);
        }

        setAgents(agentsData);

        if (agentsData.length > 0) {
          const target = initialAgentId
            ? agentsData.find((a) => a.id === initialAgentId) || agentsData[0]
            : agentsData[0];
          setSelectedAgent(target);
          setRoundtableAgents(agentsData.slice(0, 3).map((a) => a.id));
        }
      } catch (error) {
        console.error("Failed to fetch initial chat data:", error);
      }
    }
    fetchData();
  }, [initialAgentId]);

  // Fetch sessions for selected agent
  const fetchSessions = useCallback(
    async (agentId: string) => {
      setLoadingSessions(true);
      try {
        const res = await fetch(`/api/sessions?agentId=${agentId}`);
        if (res.ok) {
          const data: ChatSession[] = await res.json();
          setSessions(data);

          if (data.length > 0) {
            setActiveSessionId((prev) => {
              const exists = data.some((s) => s.id === prev);
              return exists ? prev : data[0].id;
            });
          } else {
            // Auto create initial session
            const createRes = await fetch("/api/sessions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId, title: "New Session" }),
            });
            if (createRes.ok) {
              const newSession = await createRes.json();
              setSessions([newSession]);
              setActiveSessionId(newSession.id);
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch sessions:", err);
      } finally {
        setLoadingSessions(false);
      }
    },
    []
  );

  // When selectedAgent changes, fetch sessions
  useEffect(() => {
    if (selectedAgent) {
      fetchSessions(selectedAgent.id);
    }
  }, [selectedAgent, fetchSessions]);

  // Load chat messages when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    async function loadSessionMessages() {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/sessions/${activeSessionId}`);
        if (res.ok) {
          const sessionData = await res.json();
          if (Array.isArray(sessionData.messages)) {
            setMessages(
              sessionData.messages.map((m: any) => ({
                id: m.id,
                role: m.role,
                content: m.content,
                model: m.model,
                latency: m.latency,
                agentName: m.role === "assistant" ? selectedAgent?.displayName : undefined,
                timestamp: m.createdAt || m.timestamp || new Date().toISOString(),
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load session messages:", err);
      } finally {
        setLoadingHistory(false);
      }
    }
    loadSessionMessages();
  }, [activeSessionId, selectedAgent]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, compareResults, roundtableLoading]);

  // Detect scrolling to toggle "Jump to latest" floating button
  const handleChatScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distance > 180);
  };

  // Execute safe code sandbox snippet
  const handleRunCode = async (snippetId: string, code: string, language: string) => {
    setCodeOutputs((prev) => ({
      ...prev,
      [snippetId]: { stdout: "", stderr: "", time: 0, running: true },
    }));

    try {
      const res = await fetch("/api/tools/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool: "code", code, language }),
      });
      const data = await res.json();
      setCodeOutputs((prev) => ({
        ...prev,
        [snippetId]: {
          stdout: data.result?.stdout || "",
          stderr: data.result?.stderr || (data.success ? "" : data.error || "Execution failed"),
          time: data.result?.executionTime || 0,
          running: false,
        },
      }));
    } catch (err) {
      setCodeOutputs((prev) => ({
        ...prev,
        [snippetId]: {
          stdout: "",
          stderr: err instanceof Error ? err.message : "Execution failed",
          time: 0,
          running: false,
        },
      }));
    }
  };

  // Create a new session
  const handleCreateNewSession = async () => {
    if (!selectedAgent) return;
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          title: "New Session",
          model,
        }),
      });
      if (res.ok) {
        const newSession = await res.json();
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
        setMessages([]);
        setSidebarTab("sessions");
        toast.success("New conversation session started");
      }
    } catch {
      toast.error("Failed to create session");
    }
  };

  // Rename session
  const handleRenameSession = async (sessionId: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title: updated.title } : s))
        );
        setEditingSessionId(null);
        setIsEditingActiveTitle(false);
        toast.success("Session renamed");
      }
    } catch {
      toast.error("Failed to rename session");
    }
  };

  // Toggle pin
  const handleTogglePin = async (session: ChatSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !session.pinned }),
      });
      if (res.ok) {
        const updated = await res.json();
        setSessions((prev) =>
          prev
            .map((s) => (s.id === session.id ? { ...s, pinned: updated.pinned } : s))
            .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
        );
        toast.success(session.pinned ? "Session unpinned" : "Session pinned to top");
      }
    } catch {
      toast.error("Failed to update pin state");
    }
  };

  // Fork session
  const handleForkSession = async (session: ChatSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${session.id}/fork`, {
        method: "POST",
      });
      if (res.ok) {
        const forked = await res.json();
        setSessions((prev) => [forked, ...prev]);
        setActiveSessionId(forked.id);
        toast.success(`Branched into "${forked.title}"`);
      }
    } catch {
      toast.error("Failed to branch session");
    }
  };

  // Export session to Obsidian Vault
  const handleExportSession = async (session: ChatSession, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${session.id}/export`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Exported transcript to Vault: ${data.vaultPath}`);
      } else {
        toast.error(data.error || "Failed to export transcript");
      }
    } catch {
      toast.error("Failed to export transcript");
    }
  };

  // Delete session
  const handleDeleteSession = async (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation session?")) return;
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
        if (activeSessionId === sessionId) {
          const remaining = sessions.filter((s) => s.id !== sessionId);
          if (remaining.length > 0) {
            setActiveSessionId(remaining[0].id);
          } else if (selectedAgent) {
            handleCreateNewSession();
          }
        }
        toast.success("Session deleted");
      }
    } catch {
      toast.error("Failed to delete session");
    }
  };

  // Clear chat history
  const handleClearChat = async () => {
    if (!activeSessionId) {
      setMessages([]);
      return;
    }
    try {
      await fetch(`/api/chat?sessionId=${activeSessionId}`, { method: "DELETE" });
      setMessages([]);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, messageCount: 0, lastMessage: null }
            : s
        )
      );
      toast.success("Chat history cleared");
    } catch {
      toast.error("Failed to clear chat");
    }
  };

  // Direct Runner for Swarm / Debate
  const runRoundtableDirect = async (topic: string) => {
    if (!topic.trim() || roundtableLoading) return;
    setRoundtableLoading(true);

    const userTopicMsg: ChatMessage = {
      id: "topic-" + Date.now(),
      role: "user",
      content: `🏛️ **Roundtable Debate Topic**: ${topic}`,
    };
    setMessages((prev) => [...prev, userTopicMsg]);

    try {
      const res = await fetch("/api/chat/roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          agentIds: roundtableAgents,
          rounds: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Roundtable session failed");

      if (data.messages) {
        const newMsgs: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
          id: `rt-${Date.now()}-${idx}`,
          role: "assistant",
          content: m.content,
          agentName: m.displayName,
          latency: m.latency,
          source: "omniroute",
        }));
        setMessages((prev) => [...prev, ...newMsgs]);
        toast.success(`Roundtable completed with ${data.agentCount} specialists!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Debate failed");
    } finally {
      setRoundtableLoading(false);
    }
  };

  // Direct Runner for Model Comparison
  const runCompareDirect = async (currentPrompt: string) => {
    if (!currentPrompt.trim() || comparing) return;
    setComparing(true);
    setCompareResults([]);

    try {
      const promises = compareModels.map(async (m) => {
        const start = Date.now();
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: currentPrompt,
              model: m,
              agentName: selectedAgent?.name,
              agentId: selectedAgent?.id,
            }),
          });
          const data = await res.json();
          return {
            model: m,
            content: data.response || "No response received",
            latency: data.latency || Date.now() - start,
            source: data.source,
            error: res.ok ? undefined : data.error,
          };
        } catch (err) {
          return {
            model: m,
            content: "",
            latency: Date.now() - start,
            error: err instanceof Error ? err.message : "Network error",
          };
        }
      });

      const results = await Promise.all(promises);
      setCompareResults(results);
    } catch (err) {
      toast.error("Model comparison failed");
    } finally {
      setComparing(false);
    }
  };

  // Copy message text to clipboard
  const handleCopyMessage = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedMsgId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  // Regenerate last assistant response
  const handleRegenerate = async () => {
    if (messages.length === 0 || sending) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf("user");
    if (lastUserIdx === -1) return;
    const lastUserMsg = messages[lastUserIdx];
    // Remove all messages starting from the last user message
    setMessages((prev) => prev.slice(0, lastUserIdx));
    await sendMessage(lastUserMsg.content, lastUserMsg.attachments);
  };

  // Send single message with Real-Time SSE Streaming
  const sendMessage = async (overrideText?: string, overrideAttachments?: ChatAttachment[]) => {
    const rawInput = (overrideText !== undefined ? overrideText : input).trim();
    const attachedToSend = overrideAttachments !== undefined ? overrideAttachments : [...attachments];
    if (!rawInput && attachedToSend.length === 0) return;

    if (overrideText === undefined) {
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      setAttachments([]);
    }

    // Handle Slash Commands
    if (rawInput === "/help" || rawInput === "help") {
      const userMsg: ChatMessage = {
        id: "usr-" + Date.now(),
        role: "user",
        content: "/help",
      };
      const helpMsg: ChatMessage = {
        id: "asst-" + Date.now(),
        role: "assistant",
        content: [
          "### 🛠️ Agent Studio OS — Available Slash Commands & Tools",
          "",
          "| Command | Description | Syntax / Usage |",
          "|---|---|---|",
          "| `/help` | Show this command guide & capabilities | `/help` |",
          "| `/swarm` | Launch autonomous multi-agent specialist swarm | `/swarm <topic>` |",
          "| `/debate` | Conduct multi-agent roundtable debate | `/debate <topic>` |",
          "| `/compare` | Side-by-side comparison across 3 LLMs | `/compare <prompt>` |",
          "| `/vault` | Toggle Obsidian Vault RAG Grounding on/off | `/vault` |",
          "| `/hermes` | Open interactive Hermes CLI console | `/hermes` |",
          "| `/clear` | Clear conversation history in current session | `/clear` |",
          "| `/reset` | Create and switch to a clean conversation session | `/reset` |",
          "| `/voice` | Open full duplex AI voice conversation modal | `/voice` |",
          "| `/model` | Switch active inference model | `/model <model-id>` |",
          "| `/agent` | Switch active agent persona | `/agent <name>` |",
          "",
          "> **Tip**: You can type `/` anytime in the chat box to view the interactive autocomplete dropdown, or click the **`/`** button next to the input box.",
        ].join("\n"),
        model: "system/commands",
        agentName: "Fleet Command",
      };
      setMessages((prev) => [...prev, userMsg, helpMsg]);
      return;
    }
    if (rawInput === "/reset") {
      handleCreateNewSession();
      return;
    }
    if (rawInput.startsWith("/model ")) {
      const targetModel = rawInput.replace(/^\/model\s+/, "").trim();
      if (targetModel) {
        setModel(targetModel);
        toast.success(`Active model switched to ${targetModel}`);
        return;
      }
    }
    if (rawInput.startsWith("/agent ")) {
      const targetAgentName = rawInput.replace(/^\/agent\s+/, "").trim().toLowerCase();
      const match = agents.find(
        (a) =>
          a.name.toLowerCase() === targetAgentName ||
          a.displayName.toLowerCase().includes(targetAgentName)
      );
      if (match) {
        setSelectedAgent(match);
        toast.success(`Switched agent to ${match.displayName}`);
        return;
      } else {
        toast.error(`Agent "${targetAgentName}" not found. Available: ${agents.map(a => a.displayName).join(", ")}`);
        return;
      }
    }
    if (rawInput === "/clear") {
      handleClearChat();
      return;
    }
    if (rawInput === "/vault") {
      setVaultGrounding((v) => !v);
      toast.info(!vaultGrounding ? "Vault RAG Grounding Enabled" : "Vault RAG Disabled");
      return;
    }
    if (rawInput === "/hermes") {
      setTerminalOpen(true);
      return;
    }
    if (rawInput.startsWith("/swarm ") || rawInput.startsWith("/debate ")) {
      const topic = rawInput.replace(/^\/(swarm|debate)\s+/, "").trim();
      if (topic) {
        setRoundtableMode(true);
        runRoundtableDirect(topic);
        return;
      }
    }
    if (rawInput.startsWith("/compare ")) {
      const cmpPrompt = rawInput.replace(/^\/compare\s+/, "").trim();
      if (cmpPrompt) {
        setCompareMode(true);
        runCompareDirect(cmpPrompt);
        return;
      }
    }

    const userMessage: ChatMessage = {
      id: "usr-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      role: "user",
      content: rawInput || (attachedToSend.length > 0 ? "Attached files" : ""),
      attachments: attachedToSend,
      timestamp: new Date().toISOString(),
    };

    const asstMsgId = "asst-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const assistantPlaceholder: ChatMessage = {
      id: asstMsgId,
      role: "assistant",
      content: "",
      model,
      agentName: selectedAgent?.displayName || "Agent",
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setSending(true);

    // Format prompt payload including attached files, code, and audio memo summaries
    let promptPayload = rawInput;
    if (attachedToSend.length > 0) {
      const summaryParts = attachedToSend.map((att) => {
        if (att.type === "audio") {
          return `[Attached Voice/Audio Note: "${att.name}" (${(att.size / 1024).toFixed(1)} KB)]`;
        }
        if (att.content && (att.type === "document" || att.type === "code" || att.type === "data")) {
          return `\n--- File Attachment: ${att.name} (${att.mimeType}) ---\n\`\`\`\n${att.content}\n\`\`\``;
        }
        return `[Attached File: "${att.name}" (${(att.size / 1024).toFixed(1)} KB, type: ${att.type})]`;
      });
      promptPayload = rawInput
        ? `${rawInput}\n\n${summaryParts.join("\n\n")}`
        : summaryParts.join("\n\n");
    }

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptPayload,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          model,
          agentName: selectedAgent?.name,
          agentId: selectedAgent?.id,
          sessionId: activeSessionId,
          useVaultRAG: vaultGrounding,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Chat stream connection failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";
      let capturedCitations: RAGCitation[] | undefined = undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;

          try {
            const data = JSON.parse(raw);
            if (data.type === "start") {
              if (data.sessionId && activeSessionId !== data.sessionId) {
                setActiveSessionId(data.sessionId);
              }
              if (data.citations) {
                capturedCitations = data.citations;
              }
            } else if (data.type === "chunk") {
              streamedContent += data.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? {
                        ...m,
                        content: streamedContent,
                        ragCitations: capturedCitations,
                      }
                    : m
                )
              );
            } else if (data.type === "done") {
              const full = data.fullText || streamedContent;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId
                    ? {
                        ...m,
                        content: full,
                        latency: data.latency,
                        ragCitations: capturedCitations,
                      }
                    : m
                )
              );

              // Update session list title & message count
              const targetSid = data.sessionId || activeSessionId;
              setSessions((prev) =>
                prev.map((s) => {
                  if (s.id === targetSid) {
                    const isDefault = s.title === "New Session";
                    const autoTitle = isDefault
                      ? rawInput.slice(0, 42).replace(/[\r\n]+/g, " ").trim()
                      : s.title;
                    return {
                      ...s,
                      title: autoTitle,
                      messageCount: (s.messageCount || 0) + 2,
                      lastMessage: full,
                      updatedAt: new Date().toISOString(),
                    };
                  }
                  return s;
                })
              );

              // Auto-speak message if Auto-TTS is active
              if (autoTTS && full) {
                handleSpeakMessage(asstMsgId, full);
              }
            } else if (data.type === "error") {
              throw new Error(data.error || "Stream returned error");
            }
          } catch {
            // Ignore non-json
          }
        }
      }

      // Safeguard: Ensure assistant placeholder has content if stream finished without emitting chunks
      if (!streamedContent) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === asstMsgId && !m.content
              ? {
                  ...m,
                  content: "⚠️ I encountered an interruption while generating a reply. Please verify your selected model in Settings or try re-sending.",
                }
              : m
          )
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Chat streaming failed";
      toast.error(errMsg);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === asstMsgId && !m.content
            ? {
                ...m,
                content: `⚠️ Error generating response: ${errMsg}. Please check your model keys in Settings.`,
              }
            : m
        )
      );
    } finally {
      setSending(false);
    }
  };

  // Model B Runner for Split Arena mode (Talk to different models simultaneously)
  const sendMessageB = async (overrideText?: string, overrideAttachments?: ChatAttachment[]) => {
    const rawInput = (overrideText !== undefined ? overrideText : input).trim();
    const attachedToSend = overrideAttachments !== undefined ? overrideAttachments : [...attachments];
    if (!rawInput && attachedToSend.length === 0) return;

    const userMessage: ChatMessage = {
      id: "usr-b-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      role: "user",
      content: rawInput || (attachedToSend.length > 0 ? "Attached files" : ""),
      attachments: attachedToSend,
    };

    const asstMsgId = "asst-b-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
    const assistantPlaceholder: ChatMessage = {
      id: asstMsgId,
      role: "assistant",
      content: "",
      model: modelB,
      agentName: `Model B (${modelB})`,
    };

    setMessagesB((prev) => [...prev, userMessage, assistantPlaceholder]);
    setActiveStreamsCountB((c) => c + 1);

    let promptPayload = rawInput;
    if (attachedToSend.length > 0) {
      const summaryParts = attachedToSend.map((att) => {
        if (att.content && (att.type === "document" || att.type === "code" || att.type === "data")) {
          return `\n--- File Attachment: ${att.name} (${att.mimeType}) ---\n\`\`\`\n${att.content}\n\`\`\``;
        }
        return `[Attached File: "${att.name}"]`;
      });
      promptPayload = rawInput ? `${rawInput}\n\n${summaryParts.join("\n\n")}` : summaryParts.join("\n\n");
    }

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: promptPayload,
          history: messagesB.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          model: modelB,
          agentName: selectedAgent?.name,
          agentId: selectedAgent?.id,
          useVaultRAG: vaultGrounding,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Model B stream connection failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") continue;

          try {
            const data = JSON.parse(raw);
            if (data.type === "chunk") {
              streamedContent += data.text;
              setMessagesB((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId ? { ...m, content: streamedContent } : m
                )
              );
            } else if (data.type === "done") {
              const full = data.fullText || streamedContent;
              setMessagesB((prev) =>
                prev.map((m) =>
                  m.id === asstMsgId ? { ...m, content: full, latency: data.latency } : m
                )
              );
            }
          } catch {}
        }
      }

      if (!streamedContent) {
        setMessagesB((prev) =>
          prev.map((m) =>
            m.id === asstMsgId && !m.content
              ? { ...m, content: "⚠️ Interruption occurred while generating reply." }
              : m
          )
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "Model B stream failed";
      setMessagesB((prev) =>
        prev.map((m) =>
          m.id === asstMsgId && !m.content ? { ...m, content: `⚠️ Error: ${errMsg}` } : m
        )
      );
    } finally {
      setActiveStreamsCountB((c) => Math.max(0, c - 1));
    }
  };

  // Dispatcher for Split Arena
  const handleSplitArenaSend = () => {
    const rawInput = input.trim();
    const currentAtts = [...attachments];
    if (!rawInput && currentAtts.length === 0) return;

    setInput("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    if (splitArenaTarget === "both") {
      // Dispatch to both models concurrently!
      sendMessage(rawInput, currentAtts);
      sendMessageB(rawInput, currentAtts);
    } else if (splitArenaTarget === "left") {
      sendMessage(rawInput, currentAtts);
    } else if (splitArenaTarget === "right") {
      sendMessageB(rawInput, currentAtts);
    }
  };

  // Run multi-agent roundtable debate
  const handleRoundtableDebate = async () => {
    if (!input.trim() || roundtableLoading) return;
    const topic = input.trim();
    setInput("");
    setRoundtableLoading(true);

    const userTopicMsg: ChatMessage = {
      id: "topic-" + Date.now(),
      role: "user",
      content: `🏛️ **Roundtable Debate Topic**: ${topic}`,
    };
    setMessages((prev) => [...prev, userTopicMsg]);

    try {
      const res = await fetch("/api/chat/roundtable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          agentIds: roundtableAgents,
          rounds: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Roundtable session failed");

      if (data.messages) {
        const newMsgs: ChatMessage[] = data.messages.map((m: any, idx: number) => ({
          id: `rt-${Date.now()}-${idx}`,
          role: "assistant",
          content: m.content,
          agentName: m.displayName,
          latency: m.latency,
          source: "omniroute",
        }));
        setMessages((prev) => [...prev, ...newMsgs]);
        toast.success(`Roundtable completed with ${data.agentCount} specialists!`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Debate failed");
    } finally {
      setRoundtableLoading(false);
    }
  };

  // Run model comparison
  const handleCompare = async () => {
    if (!input.trim() || comparing) return;
    setComparing(true);
    setCompareResults([]);
    const currentPrompt = input.trim();

    try {
      const promises = compareModels.map(async (m) => {
        const start = Date.now();
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: currentPrompt,
              model: m,
              agentName: selectedAgent?.name,
              agentId: selectedAgent?.id,
            }),
          });
          const data = await res.json();
          return {
            model: m,
            content: data.response || "No response received",
            latency: data.latency || Date.now() - start,
            source: data.source,
            error: res.ok ? undefined : data.error,
          };
        } catch (err) {
          return {
            model: m,
            content: "",
            latency: Date.now() - start,
            error: err instanceof Error ? err.message : "Network error",
          };
        }
      });

      const results = await Promise.all(promises);
      setCompareResults(results);
    } catch (error) {
      toast.error("Failed to run model comparison");
    } finally {
      setComparing(false);
    }
  };

  // Clear thread / active session
  const clearCurrentChat = async () => {
    if (!activeSessionId) return;
    try {
      await fetch(`/api/chat?sessionId=${activeSessionId}`, { method: "DELETE" });
      setMessages([]);
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, messageCount: 0, lastMessage: null } : s
        )
      );
      toast.success("Cleared conversation messages");
    } catch {
      toast.error("Failed to clear messages");
    }
  };

  // Helper to render message with rich Markdown, attachments, and runnable code blocks
  const renderMessageContent = (msg: ChatMessage) => {
    const codeBlockRegex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;
    let blockIndex = 0;

    // Render any file or audio attachments sent with this message
    const attachmentElements = msg.attachments && msg.attachments.length > 0 ? (
      <div className="mb-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {msg.attachments.map((att) => (
            <div
              key={att.id}
              className="p-2.5 rounded-xl border border-border bg-secondary/50 backdrop-blur-sm space-y-1.5 max-w-sm"
            >
              <div className="flex items-center gap-2">
                {att.type === "audio" ? (
                  <Music className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : att.type === "image" ? (
                  <ImageIcon className="w-4 h-4 text-foreground shrink-0" />
                ) : att.type === "code" ? (
                  <FileCode className="w-4 h-4 text-foreground shrink-0" />
                ) : att.type === "data" ? (
                  <FileSpreadsheet className="w-4 h-4 text-foreground shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="font-medium text-xs text-foreground truncate">{att.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {(att.size / 1024).toFixed(1)} KB
                </span>
              </div>

              {att.type === "audio" && (
                <div className="pt-1">
                  <audio controls src={att.content} className="h-7 w-full max-w-[260px] rounded-lg" />
                </div>
              )}

              {att.type === "image" && (
                <div className="pt-1 max-w-[260px]">
                  <img
                    src={att.content}
                    alt={att.name}
                    className="rounded-lg max-h-48 object-cover border border-border"
                  />
                </div>
              )}

              {(att.type === "code" || att.type === "data" || att.type === "document") && att.content && (
                <div className="pt-1 text-[11px]">
                  <details className="cursor-pointer">
                    <summary className="text-muted-foreground hover:text-foreground font-medium select-none text-[10.5px]">
                      Preview content ({att.content.split("\n").length} lines)
                    </summary>
                    <pre className="mt-1 p-2 rounded bg-card border border-border text-[10px] font-mono text-muted-foreground max-h-36 overflow-auto leading-relaxed">
                      {att.content.slice(0, 2000)}
                      {att.content.length > 2000 ? "\n... (truncated preview)" : ""}
                    </pre>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    ) : null;

    while ((match = codeBlockRegex.exec(msg.content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <MarkdownRenderer
            key={`text-${lastIndex}`}
            content={msg.content.slice(lastIndex, match.index)}
            isUser={msg.role === "user"}
          />
        );
      }

      const lang = (match[1] || "text").toLowerCase();
      const code = match[2];
      const snippetId = `${msg.id}-${blockIndex++}`;
      const output = codeOutputs[snippetId];
      const isExecutable = ["python", "py", "javascript", "js", "ts", "typescript"].includes(lang);

      parts.push(
        <div
          key={`code-${snippetId}`}
          className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-lg"
        >
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-secondary/60 text-[11px] font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <Code2 className="w-3.5 h-3.5 text-foreground" />
              <span className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground">
                {lang}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  setSelectedArtifact({
                    title: `${selectedAgent?.name || "agent"}_${lang}_artifact`,
                    code,
                    language: lang,
                    msgId: snippetId,
                    output,
                  })
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-border text-primary text-[10.5px] hover:bg-primary/20 text-primary transition-all font-sans font-medium"
                title="Inspect in Artifact Drawer"
              >
                <Code2 className="w-3 h-3" />
                <span>Open Artifact</span>
              </button>
              {isExecutable && (
                <button
                  onClick={() => handleRunCode(snippetId, code, lang)}
                  disabled={output?.running}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/20 text-primary hover:bg-primary/90 text-primary hover:text-foreground border border-border text-[10.5px] font-sans font-medium transition-all"
                >
                  {output?.running ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Play className="w-3 h-3" />
                  )}
                  <span>{output?.running ? "Executing..." : "Run in Sandbox"}</span>
                </button>
              )}
            </div>
          </div>

          <pre className="p-3.5 text-xs font-mono text-foreground overflow-x-auto leading-relaxed">
            {code}
          </pre>

          {output && (output.stdout || output.stderr || output.running) && (
            <div className="border-t border-border p-3 bg-secondary/60 text-xs font-mono">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>TERMINAL OUTPUT</span>
                {output.time > 0 && <span>{formatResponseTime(output.time)}</span>}
              </div>

              {output.stdout && (
                <pre className="text-foreground whitespace-pre-wrap">{output.stdout}</pre>
              )}
              {output.stderr && (
                <pre className="text-red-400 whitespace-pre-wrap">{output.stderr}</pre>
              )}
            </div>
          )}
        </div>
      );

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < msg.content.length) {
      parts.push(
        <MarkdownRenderer
          key={`text-${lastIndex}`}
          content={msg.content.slice(lastIndex)}
          isUser={msg.role === "user"}
        />
      );
    }

    return (
      <div>
        {attachmentElements}
        {parts}
      </div>
    );
  };

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const filteredSessions = sessions.filter((s) => {
    if (!sessionSearch.trim()) return true;
    const q = sessionSearch.toLowerCase();
    return s.title.toLowerCase().includes(q) || (s.lastMessage && s.lastMessage.toLowerCase().includes(q));
  });

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 space-y-3 w-full flex-1 overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-foreground tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-border shrink-0">
              Interactive Arena
            </span>
            {roundtableMode && (
              <span className="text-[11px] font-semibold text-foreground tracking-wider uppercase px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-border flex items-center gap-1 shrink-0">
                <MessageSquareQuote className="w-3 h-3" />
                Roundtable Swarm
              </span>
            )}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
            Agent Chat Studio
          </h1>
          <p className="text-xs text-muted-foreground">
            Multi-session orchestration & real-time dialogue powered by{" "}
            <strong className="text-foreground font-semibold">
              Omniroute Primary Brain
            </strong>
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap">
          {/* Vault Grounding Toggle */}
          <button
            onClick={() => {
              setVaultGrounding(!vaultGrounding);
              toast.info(vaultGrounding ? "Vault RAG disabled" : "Vault RAG enabled for chat");
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shrink-0 cursor-pointer ${
              vaultGrounding
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground bg-secondary/60"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>Vault RAG: {vaultGrounding ? "ON" : "OFF"}</span>
          </button>

          {/* Roundtable Debate Toggle */}
          <button
            onClick={() => {
              setRoundtableMode(!roundtableMode);
              if (!roundtableMode) setCompareMode(false);
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all border shrink-0 cursor-pointer ${
              roundtableMode
                ? "border-border bg-primary/15 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary/60"
            }`}
          >
            <MessageSquareQuote className="w-3.5 h-3.5" />
            <span>Roundtable</span>
          </button>

          {/* Split Arena (Concurrent Dual Models) Toggle */}
          <button
            onClick={() => {
              setSplitArenaMode(!splitArenaMode);
              if (!splitArenaMode) {
                setCompareMode(false);
                setRoundtableMode(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border shrink-0 cursor-pointer ${
              splitArenaMode
                ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary/60"
            }`}
            title="Chat with two different models simultaneously side-by-side"
          >
            <Columns3 className="w-3.5 h-3.5 text-foreground" />
            <span>Split Arena</span>
          </button>

          {/* Comparison Mode Toggle */}
          <button
            onClick={() => {
              setCompareMode(!compareMode);
              if (!compareMode) {
                setRoundtableMode(false);
                setSplitArenaMode(false);
              }
            }}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition-all border shrink-0 cursor-pointer ${
              compareMode
                ? "border-border bg-primary/15 text-primary shadow-sm"
                : "border-border text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary/60"
            }`}
          >
            <Columns3 className="w-3.5 h-3.5" />
            <span>Compare</span>
          </button>
        </div>
      </div>

      {/* Main Multi-Agent Container */}
      <div className="flex-1 min-h-0 overflow-hidden flex gap-4">
        {/* Left Sidebar: Sessions & Fleet Switcher */}
        {sidebarOpen ? (
          <div className="w-80 md:w-72 lg:w-80 shrink-0 flex flex-col h-full min-h-0 rounded-lg border border-border bg-card/70 backdrop-blur-xl p-3 space-y-2.5 overflow-hidden transition-all">
          {/* Top Switcher: Sessions vs Fleet + Hide Sidebar Button */}
          <div className="flex items-center gap-1.5">
            <div className="flex-1 flex items-center justify-between gap-1 p-1 rounded-xl bg-secondary/80 border border-border text-xs">
              <button
                onClick={() => setSidebarTab("sessions")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === "sessions"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chats ({sessions.length})</span>
              </button>
              <button
                onClick={() => setSidebarTab("agents")}
                className={`flex-1 py-1.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                  sidebarTab === "agents"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Agents ({agents.length})</span>
              </button>
            </div>

            {/* Button directly in the sidebar to hide it */}
            <button
              onClick={() => setSidebarOpen(false)}
              title="Hide sidebar"
              className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border transition-colors shrink-0"
            >
              <PanelLeftClose className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {sidebarTab === "sessions" ? (
            /* Sessions Panel */
            <div className="flex-1 flex flex-col min-h-0 space-y-2 overflow-hidden">
              {/* Active Agent Pill & New Chat Button */}
              <div className="flex items-center justify-between gap-2 pt-0.5">
                <button
                  onClick={() => setSidebarTab("agents")}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary/60 transition-colors text-left flex-1 min-w-0 group"
                  title="Click to switch agent"
                >
                  <span className="text-lg">{selectedAgent?.avatar}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-foreground transition-colors">
                      {selectedAgent?.displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      Switch Agent &rarr;
                    </p>
                  </div>
                </button>

                <button
                  onClick={handleCreateNewSession}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-medium transition-all shadow-md shadow-indigo-600/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New</span>
                </button>
              </div>

              {/* Search Sessions */}
              <div className="relative">
                <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  placeholder="Search chats..."
                  className="w-full pl-8 pr-2.5 py-1.5 rounded-xl border border-border bg-secondary/60 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border"
                />
              </div>

              {/* Sessions List (Scrollable) */}
              <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                {loadingSessions ? (
                  <div className="py-8 flex justify-center items-center">
                    <Loader2 className="w-4 h-4 animate-spin text-foreground" />
                  </div>
                ) : filteredSessions.length === 0 ? (
                  <div className="py-8 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                    {sessionSearch ? "No matching sessions" : "No sessions yet"}
                  </div>
                ) : (
                  filteredSessions.map((s) => {
                    const isActive = s.id === activeSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setActiveSessionId(s.id)}
                        className={`group relative flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isActive
                            ? "bg-primary/15 text-primary border-border text-foreground shadow-sm ring-1 ring-indigo-500/30"
                            : "bg-secondary/30 border-border text-muted-foreground hover:bg-secondary/70 hover:border-border"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            {s.pinned && (
                              <Star className="w-3 h-3 text-muted-foreground dark:text-muted-foreground fill-amber-400 shrink-0" />
                            )}
                            {editingSessionId === s.id ? (
                              <input
                                type="text"
                                value={editingSessionTitle}
                                onChange={(e) => setEditingSessionTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleRenameSession(s.id, editingSessionTitle);
                                  if (e.key === "Escape") setEditingSessionId(null);
                                }}
                                onBlur={() => handleRenameSession(s.id, editingSessionTitle)}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                className="bg-card px-1.5 py-0.5 rounded text-xs font-semibold text-foreground border border-border outline-none w-full"
                              />
                            ) : (
                              <span className="text-xs font-semibold truncate">
                                {s.title}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {timeAgo(s.updatedAt)}
                          </span>
                        </div>

                        {s.lastMessage && (
                          <p className="text-[11px] text-muted-foreground truncate mt-1 line-clamp-1">
                            {s.lastMessage}
                          </p>
                        )}

                        {/* Session Actions on Hover */}
                        <div className="flex items-center justify-between pt-1 mt-1 border-t border-border text-[10px] text-muted-foreground">
                          <span className="font-mono">{s.messageCount || 0} messages</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => handleTogglePin(s, e)}
                              title={s.pinned ? "Unpin session" : "Pin session to top"}
                              className="p-1 hover:text-amber-300 hover:bg-secondary/50 rounded transition-colors"
                            >
                              <Star
                                className={`w-3 h-3 ${s.pinned ? "fill-amber-400 text-muted-foreground dark:text-muted-foreground" : ""}`}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSessionId(s.id);
                                setEditingSessionTitle(s.title);
                              }}
                              title="Rename session"
                              className="p-1 hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleForkSession(s, e)}
                              title="Branch / Fork conversation"
                              className="p-1 hover:text-foreground hover:bg-secondary/50 rounded transition-colors"
                            >
                              <GitFork className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleExportSession(s, e)}
                              title="Export to Obsidian Vault"
                              className="p-1 hover:text-emerald-300 hover:bg-secondary/50 rounded transition-colors"
                            >
                              <FolderDown className="w-3 h-3" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteSession(s.id, e)}
                              title="Delete session"
                              className="p-1 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Fleet Selection Panel */
            <div className="flex-1 flex flex-col min-h-0 space-y-1.5 overflow-hidden">
              <div className="flex items-center justify-between px-1 pb-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {roundtableMode ? "Debate Swarm" : "Select Agent"}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                {agents.map((agent) => {
                  const isSelected = selectedAgent?.id === agent.id;
                  const inRoundtable = roundtableAgents.includes(agent.id);

                  if (roundtableMode) {
                    return (
                      <button
                        key={agent.id}
                        onClick={() => {
                          setRoundtableAgents((prev) =>
                            prev.includes(agent.id)
                              ? prev.filter((id) => id !== agent.id)
                              : [...prev, agent.id]
                          );
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                          inRoundtable
                            ? "border-border bg-primary/10 text-primary shadow-sm ring-1 ring-purple-500/30"
                            : "border-border bg-secondary/30 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <span className="text-xl shrink-0 mt-0.5">{agent.avatar}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-semibold text-foreground truncate">
                              {agent.displayName}
                            </h4>
                            {inRoundtable && <Check className="w-3 h-3 text-foreground" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {agent.role}
                          </p>
                        </div>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={agent.id}
                      onClick={() => {
                        setSelectedAgent(agent);
                        setSidebarTab("sessions");
                      }}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ${
                        isSelected
                          ? "border-border bg-primary/10 text-primary shadow-lg ring-1 ring-indigo-500/30"
                          : "border-border bg-secondary/30 hover:bg-secondary/70 hover:border-border"
                      }`}
                    >
                      <span className="text-xl shrink-0 mt-0.5">{agent.avatar}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {agent.displayName}
                          </h4>
                          <span className="w-1.5 h-1.5 rounded-md bg-emerald-500 shadow-sm" />
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {agent.description || "Specialist Agent"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Agent Footer */}
          <div className="mt-auto pt-2.5 border-t border-border px-1 space-y-1 text-[10.5px]">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Active Agent:</span>
              <span className="font-mono text-muted-foreground text-[10px] truncate max-w-[140px]">
                {selectedAgent ? selectedAgent.displayName : "Default"}
              </span>
            </div>
          </div>
        </div>
        ) : (
          /* Collapsed Sidebar Rail with Show Sidebar Button */
          <div className="w-12 shrink-0 flex flex-col items-center py-3 px-1.5 h-full min-h-0 rounded-lg border border-border bg-card/70 backdrop-blur-xl space-y-3 transition-all">
            {/* Button directly in the sidebar to show it */}
            <button
              onClick={() => setSidebarOpen(true)}
              title="Show sidebar"
              className="p-2 rounded-xl bg-secondary/90 hover:bg-primary/20 text-primary text-muted-foreground hover:text-foreground border border-border hover:border-border transition-all shadow-sm"
            >
              <PanelLeftOpen className="w-4 h-4 text-foreground" />
            </button>

            <div className="w-6 border-t border-border" />

            <button
              onClick={() => {
                setSidebarTab("sessions");
                setSidebarOpen(true);
              }}
              title="Open Chats"
              className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setSidebarTab("agents");
                setSidebarOpen(true);
              }}
              title="Open Fleet"
              className="p-2 rounded-xl hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Bot className="w-4 h-4" />
            </button>

            <div className="mt-auto">
              <button
                onClick={() => {
                  handleCreateNewSession();
                  setSidebarOpen(true);
                }}
                title="New Chat"
                className="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/90 text-primary hover:text-foreground border border-border transition-all"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Right Chat Column */}
        <div className="flex-1 min-w-0 flex flex-col h-full min-h-0 rounded-lg border border-border bg-card/70 backdrop-blur-xl overflow-hidden relative transition-all">
          {/* Active Session & Agent Banner */}
          {selectedAgent && !roundtableMode && (
            <div className="px-3 sm:px-5 py-2.5 border-b border-border bg-secondary/40 flex items-center justify-between gap-2.5 shrink-0 min-w-0 overflow-hidden">
              {/* Agent Persona & Session Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                <span className="text-2xl shrink-0">{selectedAgent.avatar}</span>
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                    <h3 className="text-sm font-bold text-foreground truncate shrink-0 max-w-[90px] sm:max-w-[130px] md:max-w-[180px]">
                      {selectedAgent.displayName}
                    </h3>
                    <button
                      onClick={() => setShowAgentSpecsModal(true)}
                      className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 font-medium flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                      title="Inspect persona directives & capabilities"
                    >
                      <Sliders className="w-2.5 h-2.5" />
                      <span>Specs</span>
                    </button>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium items-center gap-1 shrink-0 hidden sm:flex">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  </div>

                  {/* Active Session Title (Smoothly truncates within remaining available width, never overflows) */}
                  <div className="flex items-center gap-1 mt-0.5 min-w-0 overflow-hidden">
                    {isEditingActiveTitle ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (activeSession) handleRenameSession(activeSession.id, activeTitleInput);
                        }}
                        className="flex items-center gap-1 min-w-0 flex-1 max-w-xs"
                      >
                        <input
                          type="text"
                          value={activeTitleInput}
                          onChange={(e) => setActiveTitleInput(e.target.value)}
                          className="px-2 py-0.5 rounded bg-card border border-border text-xs text-foreground font-medium outline-none min-w-0 w-full"
                          autoFocus
                          onBlur={() => {
                            if (activeSession && activeTitleInput.trim()) {
                              handleRenameSession(activeSession.id, activeTitleInput);
                            } else {
                              setIsEditingActiveTitle(false);
                            }
                          }}
                        />
                      </form>
                    ) : (
                      <button
                        onClick={() => {
                          if (activeSession) {
                            setActiveTitleInput(activeSession.title);
                            setIsEditingActiveTitle(true);
                          }
                        }}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground group text-left min-w-0 flex-1 overflow-hidden cursor-pointer"
                        title="Click to rename session"
                      >
                        <span className="font-semibold truncate min-w-0 block flex-1">
                          {activeSession?.title || "Session Dialogue"}
                        </span>
                        <Edit3 className="w-3 h-3 text-muted-foreground group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-all shrink-0" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Session Actions & Model Selector Toolbar */}
              <div className="flex items-center gap-1 shrink-0 flex-nowrap py-0.5">
                {/* Model Selector */}
                <div className="flex items-center gap-1 bg-secondary/80 border border-border rounded-xl px-2 py-1 text-xs shrink-0 max-w-[110px] xs:max-w-[130px] sm:max-w-[160px] md:max-w-[180px] overflow-hidden">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase shrink-0 hidden md:inline">Model:</span>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    aria-label="Select AI model"
                    className="bg-transparent text-xs text-foreground outline-none font-mono cursor-pointer truncate min-w-0 w-full"
                  >
                    {models.map((m) => (
                      <option key={m} value={m} className="bg-card">
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Auto Audio Read (TTS) Toggle */}
                <button
                  onClick={toggleAutoTTS}
                  className={`flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-xl border text-xs font-medium transition-all shrink-0 cursor-pointer ${
                    autoTTS
                      ? "border-primary bg-primary/20 text-primary font-semibold shadow-sm"
                      : "border-border hover:border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                  title={autoTTS ? "Auto-Read (TTS) is ON" : "Turn ON Auto-Read (TTS)"}
                >
                  {autoTTS ? (
                    <Volume2 className="w-3.5 h-3.5 text-primary animate-pulse shrink-0" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="text-[11px] hidden xl:inline">{autoTTS ? "TTS ON" : "TTS"}</span>
                </button>

                {/* Branch / Fork */}
                {activeSession && (
                  <button
                    onClick={() => handleForkSession(activeSession)}
                    className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-all shrink-0 cursor-pointer"
                    title="Fork / branch this conversation session"
                  >
                    <GitFork className="w-3.5 h-3.5 text-foreground shrink-0" />
                    <span className="text-[11px] hidden xl:inline">Fork</span>
                  </button>
                )}

                {/* Export to Vault */}
                {activeSession && (
                  <button
                    onClick={() => handleExportSession(activeSession)}
                    className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-all shrink-0 cursor-pointer"
                    title="Export transcript to Obsidian Vault"
                  >
                    <FolderDown className="w-3.5 h-3.5 text-foreground shrink-0" />
                    <span className="text-[11px] hidden xl:inline">Vault</span>
                  </button>
                )}

                {/* Hermes CLI */}
                <button
                  onClick={() => setTerminalOpen(true)}
                  className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs font-medium transition-all shrink-0 cursor-pointer"
                  title="Open Hermes CLI Terminal"
                >
                  <Terminal className="w-3.5 h-3.5 text-foreground shrink-0" />
                  <span className="text-[11px] hidden xl:inline">CLI</span>
                </button>

                {/* Clear Chat */}
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1 rounded-xl border border-border hover:border-red-500/30 bg-secondary/80 hover:bg-red-500/10 text-muted-foreground hover:text-red-400 text-xs font-medium transition-all shrink-0 cursor-pointer"
                    title="Clear current session messages"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] hidden xl:inline">Clear</span>
                  </button>
                )}

                {/* Live Stream Indicator */}
                {sending && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-mono font-medium animate-pulse shrink-0">
                    <Loader2 className="w-3 h-3 animate-spin text-amber-500 shrink-0" />
                    <span className="hidden sm:inline">Streaming</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {roundtableMode && (
            <div className="px-5 py-3 border-b border-border bg-purple-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-purple-300">
                <MessageSquareQuote className="w-4 h-4 text-foreground" />
                <span className="font-semibold">Roundtable Swarm Active:</span>
                <span>
                  {roundtableAgents.length} specialists selected for debate.
                </span>
              </div>
            </div>
          )}

          {/* Comparison Mode vs Standard Chat */}
          {compareMode ? (
            <div className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {compareModels.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 bg-secondary/80 border border-border rounded-xl px-3 py-1.5 text-xs"
                  >
                    <span className="text-muted-foreground font-medium">Slot {idx + 1}:</span>
                    <select
                      value={m}
                      onChange={(e) => {
                        const copy = [...compareModels];
                        copy[idx] = e.target.value;
                        setCompareModels(copy);
                      }}
                      aria-label={`Select model for Slot ${idx + 1}`}
                      className="bg-transparent text-xs text-foreground outline-none font-mono cursor-pointer flex-1"
                    >
                      {models.map((modelOpt) => (
                        <option key={modelOpt} value={modelOpt} className="bg-card">
                          {modelOpt}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {comparing && (
                <div className="flex items-center justify-center py-12 gap-3 text-sm text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                  <span>Generating completions across 3 models simultaneously...</span>
                </div>
              )}

              {compareResults.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {compareResults.map((res, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-secondary/50 p-4 space-y-3 flex flex-col"
                    >
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <span className="font-mono text-xs font-semibold text-primary truncate">
                          {res.model}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {formatResponseTime(res.latency)}
                        </span>

                      </div>
                      <div className="flex-1 text-xs text-foreground whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[450px]">
                        {res.error ? (
                          <span className="text-red-400">{res.error}</span>
                        ) : (
                          res.content
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : splitArenaMode ? (
            /* Split Dual-Model Arena View */
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 overflow-hidden">
              {/* Left Column: Model A */}
              <div className="flex flex-col h-full min-h-0 rounded-lg border border-border bg-secondary/40 backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-secondary/90 border-b border-border shrink-0 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="w-2 h-2 rounded-md bg-indigo-400 shrink-0" />
                    <span className="text-xs font-bold text-primary shrink-0">Model A:</span>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      aria-label="Select Model A"
                      className="bg-secondary/90 border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none font-mono cursor-pointer truncate max-w-[140px] sm:max-w-[200px] min-w-0 w-full"
                    >
                      {models.map((m) => (
                        <option key={m} value={m} className="bg-card">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeStreamsCount > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-foreground animate-pulse font-mono font-semibold shrink-0">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Streaming</span>
                      </span>
                    )}
                    <button
                      onClick={() => setMessages([])}
                      title="Clear Model A chat"
                      className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-secondary/50 transition-colors shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={chatScrollContainerRef}
                  className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-3"
                >
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-2 py-12">
                      <Bot className="w-8 h-8 text-foreground/50" />
                      <p className="text-xs font-semibold text-muted-foreground">Model A Stream Ready</p>
                      <p className="text-[11px] text-muted-foreground max-w-xs">
                        Configured as <span className="font-mono text-primary">{model}</span>. Messages sent to Model A or Both will generate here.
                      </p>
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 max-w-full ${
                          msg.role === "user" ? "ml-auto justify-end" : ""
                        }`}
                      >
                        <div className="space-y-1 max-w-[90%]">
                          <div
                            className={`p-3 rounded-xl text-xs leading-relaxed ${
                              msg.role === "user"
                                ? "bg-primary text-white rounded-tr-none shadow-sm"
                                : "bg-secondary/90 border border-border text-foreground rounded-tl-none"
                            }`}
                          >
                            {renderMessageContent(msg)}
                          </div>
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1 font-mono">
                              <span className="font-semibold text-primary">{msg.model || model}</span>
                              {msg.latency && <span>{formatResponseTime(msg.latency)}</span>}
                              <button
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                                title="Copy"
                              >
                                {copiedMsgId === msg.id ? <Check className="w-2.5 h-2.5 text-foreground" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                              <button
                                onClick={() => handleSpeakMessage(msg.id, msg.content)}
                                className={`flex items-center gap-1 transition-all shrink-0 cursor-pointer ${
                                  speakingMsgId === msg.id ? "text-primary animate-pulse" : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={speakingMsgId === msg.id ? "Stop audio" : "Read audio"}
                              >
                                {speakingMsgId === msg.id ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Model B */}
              <div className="flex flex-col h-full min-h-0 rounded-lg border border-emerald-500/20 bg-secondary/40 backdrop-blur-md overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-secondary/90 border-b border-border shrink-0 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <span className="w-2 h-2 rounded-md bg-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-emerald-400 shrink-0">Model B:</span>
                    <select
                      value={modelB}
                      onChange={(e) => setModelB(e.target.value)}
                      aria-label="Select Model B"
                      className="bg-secondary/90 border border-border rounded-lg px-2 py-1 text-xs text-foreground outline-none font-mono cursor-pointer truncate max-w-[140px] sm:max-w-[200px] min-w-0 w-full"
                    >
                      {models.map((m) => (
                        <option key={m} value={m} className="bg-card">
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {activeStreamsCountB > 0 && (
                      <span className="flex items-center gap-1 text-[10px] text-foreground animate-pulse font-mono font-semibold shrink-0">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Streaming</span>
                      </span>
                    )}
                    <button
                      onClick={() => setMessagesB([])}
                      title="Clear Model B chat"
                      className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-secondary/50 transition-colors shrink-0 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div
                  ref={chatScrollContainerBRef}
                  className="flex-1 min-h-0 p-3.5 overflow-y-auto space-y-3"
                >
                  {messagesB.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground space-y-2 py-12">
                      <Sparkles className="w-8 h-8 text-foreground/50" />
                      <p className="text-xs font-semibold text-muted-foreground">Model B Stream Ready</p>
                      <p className="text-[11px] text-muted-foreground max-w-xs">
                        Configured as <span className="font-mono text-emerald-300">{modelB}</span>. Messages sent to Model B or Both will generate here concurrently.
                      </p>
                    </div>
                  ) : (
                    messagesB.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex gap-2 max-w-full ${
                          msg.role === "user" ? "ml-auto justify-end" : ""
                        }`}
                      >
                        <div className="space-y-1 max-w-[90%]">
                          <div
                            className={`p-3 rounded-xl text-xs leading-relaxed ${
                              msg.role === "user"
                                ? "bg-emerald-600 text-white rounded-tr-none shadow-sm"
                                : "bg-secondary/90 border border-border text-foreground rounded-tl-none"
                            }`}
                          >
                            {renderMessageContent(msg)}
                          </div>
                          {msg.role === "assistant" && (
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground px-1 font-mono">
                              <span className="font-semibold text-emerald-300">{msg.model || modelB}</span>
                              {msg.latency && <span>{formatResponseTime(msg.latency)}</span>}
                              <button
                                onClick={() => handleCopyMessage(msg.content, msg.id)}
                                className="text-muted-foreground hover:text-foreground"
                                title="Copy"
                              >
                                {copiedMsgId === msg.id ? <Check className="w-2.5 h-2.5 text-foreground" /> : <Copy className="w-2.5 h-2.5" />}
                              </button>
                              <button
                                onClick={() => handleSpeakMessage(msg.id, msg.content)}
                                className={`flex items-center gap-1 transition-all ${
                                  speakingMsgId === msg.id ? "text-emerald-400 animate-pulse" : "text-muted-foreground hover:text-foreground"
                                }`}
                                title={speakingMsgId === msg.id ? "Stop audio" : "Read audio"}
                              >
                                {speakingMsgId === msg.id ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* Standard Message Stream */
            <div
              ref={chatScrollContainerRef}
              onScroll={handleChatScroll}
              className="flex-1 min-h-0 p-5 overflow-y-auto space-y-4 relative"
            >
              {loadingHistory ? (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="w-6 h-6 animate-spin text-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[75%] text-center space-y-5 py-10 px-4 max-w-2xl mx-auto">
                  <div className="relative">
                    <div
                      className="w-16 h-16 rounded-lg flex items-center justify-center text-3xl border shadow-2xl relative z-10"
                      style={{
                        borderColor: `${selectedAgent?.themeColor || "#6366f1"}40`,
                        backgroundColor: `${selectedAgent?.themeColor || "#6366f1"}15`,
                      }}
                    >
                      {selectedAgent?.avatar || "🤖"}
                    </div>
                    <div
                      className="absolute inset-0 blur-2xl opacity-40 rounded-md"
                      style={{ backgroundColor: selectedAgent?.themeColor || "#6366f1" }}
                    />
                  </div>

                  <div className="space-y-1.5 max-w-md">
                    <h3 className="text-base font-bold text-foreground tracking-tight">
                      Collaborate with {selectedAgent?.displayName || "Agent"}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedAgent?.description ||
                        "Autonomous specialist connected to Omniroute Primary Brain & Obsidian Vault."}
                    </p>
                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-md">
                        <span className="w-1.5 h-1.5 rounded-md bg-emerald-500 animate-pulse" />
                        Vault RAG Active
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-primary bg-primary/10 text-primary border border-border px-2.5 py-0.5 rounded-md">
                        <Sparkles className="w-2.5 h-2.5 text-foreground" />
                        {model}
                      </span>
                    </div>
                  </div>

                  {/* 4 Quick Starter Prompt Cards */}
                  <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 text-left">
                    {STARTER_PROMPTS.map((sp, sIdx) => (
                      <button
                        key={sIdx}
                        onClick={() => {
                          setInput(sp.prompt);
                          textareaRef.current?.focus();
                          toast.info(`Loaded prompt: ${sp.title}`);
                        }}
                        className="p-3.5 rounded-lg bg-secondary/60 hover:bg-secondary/80 border border-border hover:border-border transition-all text-left group flex flex-col justify-between space-y-2 hover:shadow-lg hover:shadow-indigo-500/5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                            <sp.icon className="w-4 h-4" />
                          </div>
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 transition-colors">
                            {sp.tag}
                          </span>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-foreground group-hover:text-foreground transition-colors">
                            {sp.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground group-hover:text-muted-foreground transition-colors line-clamp-2 mt-0.5">
                            {sp.desc}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isLatestAssistant = msg.role === "assistant" && idx === messages.length - 1;

                  return (
                    <div
                      key={msg.id}
                      className={`flex gap-3 max-w-3xl ${
                        msg.role === "user" ? "ml-auto justify-end" : ""
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary border border-border flex items-center justify-center shrink-0 mt-0.5 text-base">
                          {selectedAgent?.avatar || "🤖"}
                        </div>
                      )}

                      <div className="space-y-1.5 max-w-[85%]">
                        <div
                          className={`p-4 rounded-2xl text-xs leading-relaxed ${
                            msg.role === "user"
                              ? "bg-primary text-white rounded-tr-sm shadow-md shadow-primary/25 font-normal"
                              : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                          }`}
                        >
                          {renderMessageContent(msg)}
                        </div>

                        {/* RAG Citations Pill */}
                        {msg.ragCitations && msg.ragCitations.length > 0 && (
                          <div className="pt-1">
                            <button
                              onClick={() =>
                                setActiveCitationMsgId(
                                  activeCitationMsgId === msg.id ? null : msg.id
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-foreground hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all font-medium"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>
                                {msg.ragCitations.length} Vault Note
                                {msg.ragCitations.length > 1 ? "s" : ""} Cited
                              </span>
                              <ChevronDown
                                className={`w-3 h-3 transition-transform ${
                                  activeCitationMsgId === msg.id ? "rotate-180" : ""
                                }`}
                              />
                            </button>

                            {activeCitationMsgId === msg.id && (
                              <div className="mt-2 space-y-1.5 p-2.5 rounded-xl border border-emerald-500/20 bg-emerald-950/30 text-[10.5px]">
                                {msg.ragCitations.map((cit, cIdx) => (
                                  <div key={cIdx} className="space-y-0.5">
                                    <span className="font-semibold text-emerald-300 font-mono">
                                      [[{cit.title}]]
                                    </span>
                                    <p className="text-muted-foreground text-[10px] italic">
                                      &quot;{cit.excerpt}&quot;
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {msg.role === "assistant" && (
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground px-1">
                            <span className="font-semibold text-muted-foreground">
                              {msg.agentName || selectedAgent?.displayName}
                            </span>
                            {msg.timestamp && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            {msg.latency && (
                              <span className="flex items-center gap-0.5 text-muted-foreground font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                {formatResponseTime(msg.latency)}
                              </span>
                            )}

                            {/* Copy Response Button */}
                            <button
                              onClick={() => handleCopyMessage(msg.content, msg.id)}
                              title="Copy response"
                              className="p-1 rounded-lg border border-border hover:border-border text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3 h-3 text-foreground" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>

                            {/* Audio Read (TTS) Button */}
                            <button
                              onClick={() => handleSpeakMessage(msg.id, msg.content)}
                              title="Read message aloud"
                              className="p-1 px-1.5 rounded-lg border border-border hover:border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span className="text-[9.5px] hidden sm:inline">Read</span>
                            </button>

                            {/* Regenerate Button on Latest Assistant Message */}
                            {isLatestAssistant && !sending && (
                              <button
                                onClick={handleRegenerate}
                                className="p-1 px-1.5 rounded-lg border border-border hover:border-border hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                                title="Regenerate this response"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span className="text-[9.5px] hidden sm:inline">Retry</span>
                              </button>
                            )}
                          </div>
                        )}

                        {msg.role === "user" && (
                          <div className="flex items-center justify-end gap-2 px-1 text-[10px] text-muted-foreground">
                            {msg.timestamp && (
                              <span className="text-[10px] text-muted-foreground/60 font-mono">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <button
                              onClick={() => handleCopyMessage(msg.content, msg.id)}
                              className="hover:text-muted-foreground opacity-60 hover:opacity-100 transition-all flex items-center gap-1 shrink-0 cursor-pointer"
                              title="Copy prompt"
                            >
                              {copiedMsgId === msg.id ? (
                                <Check className="w-3 h-3 text-foreground" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>

                      {msg.role === "user" && (
                        <div className="w-8 h-8 rounded-xl bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {sending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-11">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                  <span>{selectedAgent?.displayName || "Agent"} is generating via Omniroute...</span>
                </div>
              )}

              {roundtableLoading && (
                <div className="flex items-center gap-2 text-xs text-purple-300 pl-11">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                  <span>Specialists are conducting roundtable debate...</span>
                </div>
              )}

              {/* Floating Jump to Latest Button */}
              <AnimatePresence>
                {showScrollBottom && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                    className="sticky bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-semibold shadow-2xl border border-border transition-all cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5 animate-bounce" />
                    <span>Jump to latest</span>
                  </motion.button>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Message Input Box with STT Voice Mic & Slash Commands */}
          <div className="p-4 border-t border-border bg-card/80 backdrop-blur-xl shrink-0">
            {/* Slash Commands Palette */}
            {input.startsWith("/") && (
              <div className="mb-2 p-2 rounded-xl border border-border bg-secondary/95 backdrop-blur-xl shadow-xl space-y-1">
                <div className="px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-foreground" />
                  <span>Quick Commands</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {SLASH_COMMANDS.filter((sc) =>
                    sc.cmd.startsWith(input.split(" ")[0])
                  ).map((sc) => (
                    <button
                      key={sc.cmd}
                      type="button"
                      onClick={() => {
                        if (sc.cmd === "/help") {
                          sendMessage("/help");
                        } else if (sc.cmd === "/vault") {
                          setVaultGrounding((v) => !v);
                          setInput("");
                          toast.info(!vaultGrounding ? "Vault RAG Grounding Enabled" : "Vault RAG Disabled");
                        } else if (sc.cmd === "/clear") {
                          handleClearChat();
                          setInput("");
                        } else if (sc.cmd === "/hermes") {
                          setTerminalOpen(true);
                          setInput("");
                        } else if (sc.cmd === "/reset") {
                          handleCreateNewSession();
                          setInput("");
                        } else {
                          setInput(`${sc.cmd} `);
                          if (textareaRef.current) textareaRef.current.focus();
                        }
                      }}
                      className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary/50 text-left transition-colors group"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground group-hover:text-foreground">
                          {sc.cmd}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">{sc.desc}</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground font-mono hidden sm:inline">
                        {sc.usage}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Attached Files & Audio Preview Tray */}
            {attachments.length > 0 && (
              <div className="mb-2.5 flex flex-wrap gap-2 items-center max-h-32 overflow-y-auto p-2 rounded-xl bg-secondary/60 border border-border">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg bg-secondary/80 border border-border text-xs text-foreground group shadow-sm"
                  >
                    {att.type === "audio" ? (
                      <Music className="w-3.5 h-3.5 text-muted-foreground dark:text-muted-foreground shrink-0" />
                    ) : att.type === "image" ? (
                      <ImageIcon className="w-3.5 h-3.5 text-foreground shrink-0" />
                    ) : att.type === "code" ? (
                      <FileCode className="w-3.5 h-3.5 text-foreground shrink-0" />
                    ) : att.type === "data" ? (
                      <FileSpreadsheet className="w-3.5 h-3.5 text-foreground shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="truncate max-w-[140px] font-medium text-[11px]">{att.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {(att.size / 1024).toFixed(0)}KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setAttachments((prev) => prev.filter((a) => a.id !== att.id))}
                      className="p-0.5 rounded text-muted-foreground hover:text-red-400 hover:bg-secondary/50 transition-colors"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Hidden File Input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              multiple
              className="hidden"
              accept="audio/*,image/*,text/*,.pdf,.doc,.docx,.json,.csv,.ts,.tsx,.js,.jsx,.py,.md,.sql,.yaml,.yml"
            />

            {/* Split Arena Target Selector */}
            {splitArenaMode && (
              <div className="w-full flex items-center justify-between pb-2.5 mb-2 border-b border-border text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground font-medium">Send Target:</span>
                  <div className="flex items-center gap-1 bg-secondary/90 p-0.5 rounded-xl border border-border">
                    <button
                      type="button"
                      onClick={() => setSplitArenaTarget("both")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        splitArenaTarget === "both"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-emerald-300 border border-emerald-500/40 shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Zap className="w-3 h-3 text-foreground" />
                      <span>Both Models (Simultaneous)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitArenaTarget("left")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        splitArenaTarget === "left"
                          ? "bg-primary/20 text-primary border border-border shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>Model A Only</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSplitArenaTarget("right")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        splitArenaTarget === "right"
                          ? "bg-primary/20 text-primary border border-border shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>Model B Only</span>
                    </button>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
                  ⚡ Concurrently stream responses side-by-side
                </span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (roundtableMode) handleRoundtableDebate();
                else if (compareMode) handleCompare();
                else if (splitArenaMode) handleSplitArenaSend();
                else sendMessage();
              }}
              className="flex items-center gap-1.5 sm:gap-2 w-full min-w-0"
            >
              {/* File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Attach files (Documents, Code, Data, Audio, Images)"
                className="shrink-0 p-2.5 rounded-xl border border-border bg-secondary/70 text-muted-foreground hover:text-foreground hover:border-border transition-all cursor-pointer"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              {/* Slash Command Palette Trigger Button */}
              <button
                type="button"
                onClick={() => {
                  if (input.startsWith("/")) {
                    setInput("");
                  } else {
                    setInput("/");
                    if (textareaRef.current) textareaRef.current.focus();
                  }
                }}
                title="Browse slash commands (/help, /swarm, /compare, /vault, /hermes...)"
                className={`shrink-0 p-2.5 rounded-xl border transition-all text-xs font-mono font-bold cursor-pointer ${
                  input.startsWith("/")
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border bg-secondary/70 text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                /
              </button>

              {/* Voice Memo Recording Button */}
              <button
                type="button"
                onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                title={isRecordingAudio ? "Stop recording voice memo" : "Record audio voice memo"}
                className={`shrink-0 p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isRecordingAudio
                    ? "border-red-500 bg-red-500/20 text-red-400 ring-2 ring-red-500/40 animate-pulse"
                    : "border-border bg-secondary/70 text-muted-foreground hover:text-amber-300 hover:border-border"
                }`}
              >
                {isRecordingAudio ? (
                  <div className="flex items-center gap-1">
                    <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                    <span className="text-[10px] font-mono font-bold text-red-400">
                      {recordingDuration}s
                    </span>
                  </div>
                ) : (
                  <Music className="w-4 h-4" />
                )}
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                rows={1}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (roundtableMode) handleRoundtableDebate();
                    else if (compareMode) handleCompare();
                    else if (splitArenaMode) handleSplitArenaSend();
                    else sendMessage();
                  }
                }}
                placeholder={
                  roundtableMode
                    ? "Enter debate prompt or problem statement for specialists..."
                    : compareMode
                    ? "Enter prompt to compare models..."
                    : splitArenaMode
                    ? `Send to ${splitArenaTarget === "both" ? "Both Models simultaneously" : splitArenaTarget === "left" ? `Model A (${model})` : `Model B (${modelB})`}... (Enter to send, double-text supported)`
                    : selectedAgent
                    ? `Message ${selectedAgent.displayName}... (Enter to send, Shift+Enter for newline, / for commands)`
                    : "Type a prompt... (Enter to send, double-text anytime, / for commands)"
                }
                disabled={comparing || roundtableLoading}
                className="flex-1 min-w-0 px-3.5 sm:px-4 py-2.5 rounded-xl border border-border bg-card text-xs outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-foreground placeholder:text-muted-foreground transition-all resize-none min-h-[40px] max-h-32"
              />

              <button
                type="submit"
                disabled={(!input.trim() && attachments.length === 0) || comparing || roundtableLoading}
                className="shrink-0 flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-xs font-semibold hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-40 disabled:hover:shadow-none transition-all cursor-pointer"
              >
                {comparing || roundtableLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>
                  {roundtableMode ? "Debate" : compareMode ? "Compare" : splitArenaMode ? (splitArenaTarget === "both" ? "Send Both" : "Send") : "Send"}
                </span>
              </button>

              {/* Stop Audio Playback Button below chat */}
              {speakingMsgId && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    stopAudioPlayback();
                    toast.info("Audio playback stopped");
                  }}
                  className="shrink-0 px-3 sm:px-3.5 py-2.5 rounded-xl border border-red-500/50 bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center gap-1.5 text-xs font-semibold animate-pulse transition-all cursor-pointer shadow-lg shadow-red-500/20"
                  title="Stop audio playback"
                >
                  <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                  <span className="hidden sm:inline">Stop Audio</span>
                </button>
              )}
            </form>
          </div>

          {/* Interactive Slide-Out Artifact Drawer */}
          <AnimatePresence>
            {selectedArtifact && (
              <motion.div
                initial={{ x: "100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "100%", opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="absolute inset-y-0 right-0 w-full sm:w-[460px] lg:w-[540px] bg-card/95 backdrop-blur-xl backdrop-blur-2xl border-l border-border shadow-2xl z-30 flex flex-col overflow-hidden"
              >
                {/* Drawer Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/60">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary border border-border flex items-center justify-center text-primary shrink-0">
                      <Code2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-foreground truncate">
                        {selectedArtifact.title}
                      </h4>
                      <span className="text-[10px] text-muted-foreground font-mono uppercase">
                        {selectedArtifact.language}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Copy Button */}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedArtifact.code);
                        setCopiedArtifact(true);
                        setTimeout(() => setCopiedArtifact(false), 2000);
                        toast.success("Artifact copied to clipboard");
                      }}
                      className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy Code"
                    >
                      {copiedArtifact ? (
                        <Check className="w-3.5 h-3.5 text-foreground" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Download Button */}
                    <button
                      onClick={() => {
                        const blob = new Blob([selectedArtifact.code], { type: "text/plain" });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `${selectedArtifact.title}.${
                          selectedArtifact.language === "python"
                            ? "py"
                            : selectedArtifact.language === "typescript"
                            ? "ts"
                            : "txt"
                        }`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success("Artifact downloaded");
                      }}
                      className="p-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors"
                      title="Download Artifact"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>

                    {/* Run Sandbox Button */}
                    <button
                      onClick={() =>
                        handleRunCode(
                          selectedArtifact.msgId,
                          selectedArtifact.code,
                          selectedArtifact.language
                        )
                      }
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-semibold transition-all shadow-sm"
                    >
                      <Play className="w-3 h-3" />
                      <span>Run</span>
                    </button>

                    {/* Close Button */}
                    <button
                      onClick={() => setSelectedArtifact(null)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors ml-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Code / Diagram Viewer */}
                {selectedArtifact.language === "mermaid" ? (
                  <div className="flex-1 flex flex-col overflow-hidden bg-card">
                    <div className="px-4 py-2 bg-primary/10 border-b border-border flex items-center justify-between text-xs text-primary">
                      <span className="font-semibold flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-foreground" />
                        Mermaid Diagram Visualizer
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">Flowchart / Graph</span>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-4">
                      {/* Visual Flow Representation */}
                      <div className="p-4 rounded-xl border border-border bg-primary/5 text-xs">
                        <div className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2">
                          Diagram Nodes & Flow
                        </div>
                        <div className="space-y-2 font-mono text-[11px] text-muted-foreground">
                          {selectedArtifact.code.split("\n").filter(l => l.trim() && !l.trim().startsWith("%%")).map((line, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/40 border border-border">
                              <span className="w-5 h-5 rounded-md bg-primary/20 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <span className="text-foreground break-all">{line}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Source Code */}
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                          Mermaid Definition Source
                        </div>
                        <pre className="p-3 rounded-xl bg-secondary/50 border border-border text-xs font-mono text-muted-foreground overflow-x-auto whitespace-pre">
                          {selectedArtifact.code}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto p-4 bg-card font-mono text-xs text-foreground leading-relaxed whitespace-pre selection:bg-primary/30">
                    <code>{selectedArtifact.code}</code>
                  </div>
                )}

                {/* Terminal Output Footer */}
                {codeOutputs[selectedArtifact.msgId] && (
                  <div className="border-t border-border p-3 bg-secondary/60 text-xs font-mono max-h-48 overflow-y-auto">
                    <div className="text-[10px] text-muted-foreground mb-1 flex justify-between">
                      <span>TERMINAL OUTPUT</span>
                      <span>{formatResponseTime(codeOutputs[selectedArtifact.msgId].time)}</span>
                    </div>

                    {codeOutputs[selectedArtifact.msgId].stdout && (
                      <pre className="text-foreground whitespace-pre-wrap">
                        {codeOutputs[selectedArtifact.msgId].stdout}
                      </pre>
                    )}
                    {codeOutputs[selectedArtifact.msgId].stderr && (
                      <pre className="text-red-400 whitespace-pre-wrap">
                        {codeOutputs[selectedArtifact.msgId].stderr}
                      </pre>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <HermesTerminalModal
        agent={selectedAgent}
        isOpen={terminalOpen}
        onClose={() => setTerminalOpen(false)}
        availableAgents={agents}
        onSelectAgent={(ag) => setSelectedAgent(ag)}
      />

      {/* Agent Specifications & Directives Modal */}
      <AnimatePresence>
        {showAgentSpecsModal && selectedAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-xl bg-card border border-border rounded-lg p-6 shadow-2xl overflow-hidden space-y-4 max-h-[85vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl border shrink-0"
                    style={{
                      borderColor: `${selectedAgent.themeColor || "#6366f1"}40`,
                      backgroundColor: `${selectedAgent.themeColor || "#6366f1"}15`,
                    }}
                  >
                    {selectedAgent.avatar}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground truncate">{selectedAgent.displayName}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-foreground border border-emerald-500/20 font-medium shrink-0">
                        {selectedAgent.status || "online"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <span className="capitalize text-primary font-medium">{selectedAgent.role || "specialist"}</span>
                      {selectedAgent.department && <span>• {selectedAgent.department}</span>}
                      <span className="font-mono text-[11px] text-muted-foreground">• {selectedAgent.model || model}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setShowAgentSpecsModal(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {selectedAgent.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/60 p-3 rounded-xl border border-border">
                    {selectedAgent.description}
                  </p>
                )}

                {/* System Prompt Section */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">System Directives & Persona</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(selectedAgent.systemPrompt || "");
                        toast.success("System prompt copied to clipboard");
                      }}
                      className="text-[11px] text-foreground hover:text-foreground flex items-center gap-1 font-mono transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Directives</span>
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto p-3.5 rounded-xl bg-secondary/80 border border-border font-mono text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed selection:bg-primary/30 text-primary">
                    {selectedAgent.systemPrompt || "No custom system prompt specified (agent utilizes baseline autonomous reasoning instructions)."}
                  </div>
                </div>

                {/* Active Toolsets & Integrations */}
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-muted-foreground">Enabled Toolsets & Integrations</span>
                  <div className="flex flex-wrap gap-2">
                    {(selectedAgent.tools?.filter((t) => t.enabled) || []).map((t) => (
                      <span
                        key={t.id || t.toolId}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-card border border-border text-foreground flex items-center gap-1.5"
                      >
                        <Terminal className="w-3 h-3 text-foreground" />
                        <span>{t.toolId}</span>
                      </span>
                    ))}
                    {(selectedAgent.integrations?.filter((i) => i.enabled) || []).map((i) => (
                      <span
                        key={i.id || i.platform}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5"
                      >
                        <Globe className="w-3 h-3 text-foreground" />
                        <span>{i.platform}</span>
                      </span>
                    ))}
                    {(!selectedAgent.tools || selectedAgent.tools.filter((t) => t.enabled).length === 0) &&
                      (!selectedAgent.integrations || selectedAgent.integrations.filter((i) => i.enabled).length === 0) && (
                        <span className="text-xs text-muted-foreground italic">Standard reasoning tools active</span>
                      )}
                  </div>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
                <button
                  onClick={() => {
                    setShowAgentSpecsModal(false);
                    setTerminalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Terminal className="w-3.5 h-3.5 text-foreground" />
                  <span>Open Hermes CLI</span>
                </button>
                <button
                  onClick={() => setShowAgentSpecsModal(false)}
                  className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold text-foreground transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[70vh]">
          <Loader2 className="w-8 h-8 animate-spin text-foreground" />
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
