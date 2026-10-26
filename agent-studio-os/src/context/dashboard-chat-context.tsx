"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { AgentProfile } from "@/types";
import { toast } from "sonner";
import { matchBestAgent } from "@/lib/agent-matcher";

export interface DashboardAttachment {
  id: string;
  name: string;
  size: number;
  type: "document" | "image" | "audio" | "code" | "data";
  mimeType: string;
  content?: string;
}

export interface DashboardChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agentName?: string;
  agentAvatar?: string;
  latency?: number;
  model?: string;
  createdAt: string;
  actionExecuted?: string;
  task?: any;
  metadata?: Record<string, any>;
  attachments?: DashboardAttachment[];
}

interface DashboardChatContextType {
  isChatActive: boolean;
  setIsChatActive: (active: boolean) => void;
  activeAgent: AgentProfile | undefined;
  setActiveAgent: (agent: AgentProfile | undefined) => void;
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  currentSessionId: string | null;
  setCurrentSessionId: (id: string | null) => void;
  chatMessages: DashboardChatMessage[];
  setChatMessages: React.Dispatch<React.SetStateAction<DashboardChatMessage[]>>;
  isChatSending: boolean;
  followUpInput: string;
  setFollowUpInput: (val: string) => void;
  isMinimized: boolean;
  setIsMinimized: React.Dispatch<React.SetStateAction<boolean>>;
  agents: AgentProfile[];
  setAgents: React.Dispatch<React.SetStateAction<AgentProfile[]>>;
  sendChatMessage: (text: string, customAgentId?: string, attachments?: DashboardAttachment[]) => Promise<void>;
  openAgentChat: (agent: AgentProfile) => void;
  closeChat: () => void;
  clearChat: () => void;
  sendToKanban: (title?: string, description?: string) => Promise<void>;
}

const DashboardChatContext = createContext<DashboardChatContextType | undefined>(undefined);

const STORAGE_ACTIVE_KEY = "agent_os_dashboard_chat_active";
const STORAGE_MESSAGES_KEY = "agent_os_dashboard_chat_messages";
const STORAGE_SESSION_KEY = "agent_os_dashboard_chat_session_id";
const STORAGE_MINIMIZED_KEY = "agent_os_dashboard_chat_minimized";

export function DashboardChatProvider({ children }: { children: React.ReactNode }) {
  const [isChatActive, setIsChatActive] = useState(false);
  const [chatMessages, setChatMessages] = useState<DashboardChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentProfile | undefined>(undefined);
  const [selectedAgentId, setSelectedAgentId] = useState("auto");
  const [isChatSending, setIsChatSending] = useState(false);
  const [followUpInput, setFollowUpInput] = useState("");
  const [isMinimized, setIsMinimized] = useState(false);
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Synchronous refs to prevent race conditions and ensure single-session continuity
  const currentSessionIdRef = useRef<string | null>(null);
  const chatMessagesRef = useRef<DashboardChatMessage[]>([]);
  const activeAgentRef = useRef<AgentProfile | undefined>(undefined);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    chatMessagesRef.current = chatMessages;
  }, [chatMessages]);

  useEffect(() => {
    activeAgentRef.current = activeAgent;
  }, [activeAgent]);

  // Load agents if not already loaded
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAgents(data);
            if (!activeAgentRef.current) {
              const defaultAgent = data.find((a: AgentProfile) => a.role === "orchestrator") || data[0];
              setActiveAgent(defaultAgent);
              activeAgentRef.current = defaultAgent;
            }
          }
        }
      } catch {
        // Silently continue
      }
    }
    fetchAgents();
  }, []);

  // Restore persisted chat state from localStorage
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const savedActive = localStorage.getItem(STORAGE_ACTIVE_KEY);
        const savedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);
        const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
        const savedMinimized = localStorage.getItem(STORAGE_MINIMIZED_KEY);

        if (savedActive === "true") {
          setIsChatActive(true);
        }
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChatMessages(parsed);
            chatMessagesRef.current = parsed;
          }
        }
        if (savedSession) {
          setCurrentSessionId(savedSession);
          currentSessionIdRef.current = savedSession;
        }
        if (savedMinimized === "true") {
          setIsMinimized(true);
        }
      }
    } catch {
      // Storage access error fallback
    } finally {
      setIsInitialized(true);
    }
  }, []);

  // Save changes to localStorage after initialization
  useEffect(() => {
    if (!isInitialized || typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_ACTIVE_KEY, isChatActive ? "true" : "false");
      localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(chatMessages.slice(-50)));
      localStorage.setItem(STORAGE_MINIMIZED_KEY, isMinimized ? "true" : "false");
      if (currentSessionId) {
        localStorage.setItem(STORAGE_SESSION_KEY, currentSessionId);
      } else {
        localStorage.removeItem(STORAGE_SESSION_KEY);
      }
    } catch {
      // Storage write error fallback
    }
  }, [isChatActive, chatMessages, currentSessionId, isMinimized, isInitialized]);

  // Send message to agent with session continuity
  const sendChatMessage = useCallback(
    async (text: string, customAgentId?: string, attachments?: DashboardAttachment[]) => {
      const trimmed = text.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;

      // Preserve agent across an ongoing conversation unless user explicitly picks another
      let targetAgent: AgentProfile | undefined;
      if (customAgentId) {
        targetAgent = agents.find((a) => a.id === customAgentId) || activeAgentRef.current;
      } else if (selectedAgentId !== "auto") {
        targetAgent = agents.find((a) => a.id === selectedAgentId) || activeAgentRef.current;
      } else if (chatMessagesRef.current.length > 0 && activeAgentRef.current) {
        // Continue with the existing agent in this ongoing conversation
        targetAgent = activeAgentRef.current;
      } else {
        targetAgent = matchBestAgent(trimmed, agents) || activeAgentRef.current || agents[0];
      }

      if (targetAgent) {
        setActiveAgent(targetAgent);
        activeAgentRef.current = targetAgent;
      }

      const userMessage: DashboardChatMessage = {
        id: "user-" + Date.now(),
        role: "user",
        content: trimmed || (attachments && attachments.length > 0 ? "Attached files" : ""),
        attachments: attachments && attachments.length > 0 ? attachments : undefined,
        createdAt: new Date().toISOString(),
      };

      const updatedHistory = [...chatMessagesRef.current, userMessage];
      setChatMessages(updatedHistory);
      chatMessagesRef.current = updatedHistory;
      setIsChatActive(true);
      setIsChatSending(true);
      setIsMinimized(false); // Auto-expand when a new message is sent

      // Format prompt payload including attached files, code, and audio memo summaries
      let promptPayload = trimmed;
      if (attachments && attachments.length > 0) {
        const summaryParts = attachments.map((att) => {
          if (att.content && (att.type === "document" || att.type === "code" || att.type === "data")) {
            const MAX_TEXT_LEN = 80000;
            let fileText = att.content;
            let truncationNotice = "";
            if (fileText.length > MAX_TEXT_LEN) {
              const truncatedKB = Math.round((fileText.length - MAX_TEXT_LEN) / 1024);
              fileText = fileText.slice(0, MAX_TEXT_LEN);
              truncationNotice = `\n... [Note: Remaining ${truncatedKB} KB truncated to fit context limits]`;
            }
            return `\n--- File Attachment: ${att.name} (${att.mimeType || "text/plain"}) ---\n\`\`\`\n${fileText}${truncationNotice}\n\`\`\``;
          }
          if (att.type === "image") {
            return `[Attached Image: "${att.name}" (${(att.size / 1024).toFixed(1)} KB) - Image data forwarded for visual inspection]`;
          }
          return `[Attached File: "${att.name}" (${(att.size / 1024).toFixed(1)} KB, type: ${att.type})]`;
        });
        promptPayload = trimmed
          ? `${trimmed}\n\n${summaryParts.join("\n\n")}`
          : summaryParts.join("\n\n");
      }

      // Use active session id if available
      const activeSession = currentSessionIdRef.current || currentSessionId || undefined;

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptPayload,
            agentId: targetAgent?.id,
            sessionId: activeSession,
            history: updatedHistory.slice(-10).map((m) => ({
              role: m.role,
              content: m.content,
            })),
            useVaultRAG: true,
            attachments: attachments,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to receive response from agent");

        // Lock in session ID so all subsequent messages reuse this exact session
        if (data.sessionId) {
          currentSessionIdRef.current = data.sessionId;
          setCurrentSessionId(data.sessionId);
        }

        if (Array.isArray(data.outputs) && data.outputs.length > 1) {
          const newBotMessages: DashboardChatMessage[] = data.outputs.map((out: any, index: number) => ({
            id: `bot-${Date.now()}-${index}`,
            role: "assistant" as const,
            content: out.content || String(out),
            agentName: out.agentName || data.agent?.displayName || targetAgent?.displayName || "Autonomous Specialist",
            agentAvatar: out.agentAvatar || data.agent?.avatar || targetAgent?.avatar || "bot",
            latency: out.latency || data.latency,
            model: data.model,
            actionExecuted: data.actionExecuted,
            task: data.task,
            metadata: out.metadata || data.metadata,
            createdAt: new Date(Date.now() + index * 100).toISOString(),
          }));
          setChatMessages((prev) => {
            const next = [...prev, ...newBotMessages];
            chatMessagesRef.current = next;
            return next;
          });
        } else {
          const botMessage: DashboardChatMessage = {
            id: "bot-" + Date.now(),
            role: "assistant",
            content: data.content,
            agentName: data.agent?.displayName || targetAgent?.displayName || "Autonomous Specialist",
            agentAvatar: data.agent?.avatar || targetAgent?.avatar || "bot",
            latency: data.latency,
            model: data.model,
            actionExecuted: data.actionExecuted,
            task: data.task,
            metadata: data.metadata,
            createdAt: new Date().toISOString(),
          };
          setChatMessages((prev) => {
            const next = [...prev, botMessage];
            chatMessagesRef.current = next;
            return next;
          });
        }

        if (data.actionExecuted === "execute_kanban") {
          toast.success(`Kanban Task "${data.task?.title || "Task"}" executed and moved to Review!`);
        } else if (data.actionExecuted === "assign_task") {
          toast.success(`Task assigned and queued on Kanban!`);
        } else if (data.actionExecuted === "approve_task") {
          toast.success(`Task approved and marked Done!`);
        }

        // Notify other components (like dashboard metrics or kanban) to refresh
        if (typeof window !== "undefined" && data.actionExecuted) {
          window.dispatchEvent(new CustomEvent("agent-data-updated"));
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to chat with agent");
      } finally {
        setIsChatSending(false);
      }
    },
    [agents, selectedAgentId, currentSessionId]
  );

  // Close chat (user explicitly closed) - blanks the conversation clean
  const closeChat = useCallback(() => {
    setIsChatActive(false);
    setIsMinimized(false);
    setChatMessages([]);
    chatMessagesRef.current = [];
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_MESSAGES_KEY);
        localStorage.removeItem(STORAGE_SESSION_KEY);
        localStorage.setItem(STORAGE_ACTIVE_KEY, "false");
        localStorage.setItem(STORAGE_MINIMIZED_KEY, "false");
      } catch {
        // Fallback
      }
    }
  }, []);

  // Clear chat history
  const clearChat = useCallback(() => {
    setChatMessages([]);
    chatMessagesRef.current = [];
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(STORAGE_MESSAGES_KEY);
        localStorage.removeItem(STORAGE_SESSION_KEY);
      } catch {
        // Fallback
      }
    }
  }, []);

  // Send deliverable or prompt as task directly to Kanban
  const sendToKanban = useCallback(
    async (taskTitle?: string, taskDescription?: string) => {
      const rawTitle = (taskTitle || "").trim();
      if (!rawTitle) {
        toast.error("Please enter a task title or objective to queue to Kanban");
        return;
      }

      const targetAgent = matchBestAgent(rawTitle + " " + (taskDescription || ""), agents) || activeAgent;

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: rawTitle,
            description: taskDescription || "Dispatched from Mission Control Command Center",
            priority: "medium",
            agentId: targetAgent?.id || null,
            status: "backlog",
          }),
        });

        if (!res.ok) throw new Error("Failed to queue task to Kanban");

        const created = await res.json();
        toast.success(
          `Task "${created.title}" assigned to ${targetAgent?.displayName || "Specialist"} & queued on Kanban!`
        );

        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("agent-data-updated"));
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to queue task to Kanban");
      }
    },
    [agents, activeAgent]
  );

  const openAgentChat = useCallback((agent: AgentProfile) => {
    setActiveAgent(agent);
    setSelectedAgentId(agent.id);
    setIsChatActive(true);
    setIsMinimized(false);
  }, []);

  return (
    <DashboardChatContext.Provider
      value={{
        isChatActive,
        setIsChatActive,
        activeAgent,
        setActiveAgent,
        selectedAgentId,
        setSelectedAgentId,
        currentSessionId,
        setCurrentSessionId,
        chatMessages,
        setChatMessages,
        isChatSending,
        followUpInput,
        setFollowUpInput,
        isMinimized,
        setIsMinimized,
        agents,
        setAgents,
        sendChatMessage,
        openAgentChat,
        closeChat,
        clearChat,
        sendToKanban,
      }}
    >
      {children}
    </DashboardChatContext.Provider>
  );
}

export function useDashboardChat() {
  const context = useContext(DashboardChatContext);
  if (!context) {
    throw new Error("useDashboardChat must be used within a DashboardChatProvider");
  }
  return context;
}
