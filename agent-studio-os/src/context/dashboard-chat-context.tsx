"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { AgentProfile } from "@/types";
import { toast } from "sonner";
import { matchBestAgent } from "@/lib/agent-matcher";

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
  sendChatMessage: (text: string, customAgentId?: string) => Promise<void>;
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

  // Load agents if not already loaded
  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setAgents(data);
            if (!activeAgent) {
              const defaultAgent = data.find((a: AgentProfile) => a.role === "orchestrator") || data[0];
              setActiveAgent(defaultAgent);
            }
          }
        }
      } catch {
        // Silently continue
      }
    }
    fetchAgents();
  }, [activeAgent]);

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
          }
        }
        if (savedSession) {
          setCurrentSessionId(savedSession);
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

  // Send message to agent
  const sendChatMessage = useCallback(
    async (text: string, customAgentId?: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      const targetAgentId = customAgentId || selectedAgentId;
      const targetAgent =
        targetAgentId !== "auto"
          ? agents.find((a) => a.id === targetAgentId) || activeAgent
          : matchBestAgent(trimmed, agents) || activeAgent;

      const userMessage: DashboardChatMessage = {
        id: "user-" + Date.now(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      setChatMessages((prev) => [...prev, userMessage]);
      setIsChatActive(true);
      setIsChatSending(true);
      setIsMinimized(false); // Auto-expand when a new message is sent

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: trimmed,
            agentId: targetAgent?.id,
            sessionId: currentSessionId || undefined,
            useVaultRAG: true,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to receive response from agent");

        if (data.sessionId) setCurrentSessionId(data.sessionId);

        const botMessage: DashboardChatMessage = {
          id: "bot-" + Date.now(),
          role: "assistant",
          content: data.content,
          agentName: data.agent?.displayName || targetAgent?.displayName || "Autonomous Specialist",
          agentAvatar: data.agent?.avatar || targetAgent?.avatar || "🤖",
          latency: data.latency,
          model: data.model,
          actionExecuted: data.actionExecuted,
          task: data.task,
          metadata: data.metadata,
          createdAt: new Date().toISOString(),
        };

        setChatMessages((prev) => [...prev, botMessage]);

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
    [agents, activeAgent, selectedAgentId, currentSessionId]
  );

  // Close chat (user explicitly closed)
  const closeChat = useCallback(() => {
    setIsChatActive(false);
    setIsMinimized(false);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_ACTIVE_KEY, "false");
      } catch {
        // Fallback
      }
    }
  }, []);

  // Clear chat history
  const clearChat = useCallback(() => {
    setChatMessages([]);
    setCurrentSessionId(null);
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
