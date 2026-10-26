"use client";

import { toast } from "sonner";
import { playTaskCompletedSound, playWarningSound, playClickSound } from "./sound-effects";

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning" | "agent" | "desktop";
  category: "agents" | "tasks" | "desktop" | "system";
  timestamp: number;
  read: boolean;
  link?: string;
  agentName?: string;
  agentAvatar?: string;
}

const STORAGE_KEY = "agent_os_notifications";

export function getStoredNotifications(): AppNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return [
    {
      id: "notif-init-1",
      title: "Agent OS Core Online",
      message: "Autonomous fleet initialized with 12 specialist agents and CUA desktop operator.",
      type: "success",
      category: "system",
      timestamp: Date.now() - 1000 * 60 * 5,
      read: false,
    },
    {
      id: "notif-init-2",
      title: "Desktop Automation Ready",
      message: "High-speed CUA Driver loaded with smooth mouse gliding and live visual telemetry.",
      type: "desktop",
      category: "desktop",
      timestamp: Date.now() - 1000 * 60 * 15,
      read: false,
      link: "/chat",
    },
    {
      id: "notif-init-3",
      title: "Autonomous Memory Synchronized",
      message: "Obsidian Vault indexed and ready for semantic vector search.",
      type: "agent",
      category: "agents",
      timestamp: Date.now() - 1000 * 60 * 45,
      read: true,
      agentName: "Athena Researcher",
      agentAvatar: "brain",
      link: "/memory",
    },
  ];
}

export function saveStoredNotifications(notifs: AppNotification[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, 50)));
    window.dispatchEvent(new CustomEvent("agent-notifications-updated"));
  } catch {}
}

/**
 * Trigger a rich, beautiful notification both as a Toast and into the Notification Center
 */
export function pushNotification(params: {
  title: string;
  message: string;
  type?: "success" | "error" | "info" | "warning" | "agent" | "desktop";
  category?: "agents" | "tasks" | "desktop" | "system";
  link?: string;
  agentName?: string;
  agentAvatar?: string;
  playSound?: boolean;
}): AppNotification {
  const type = params.type || "info";
  const category = params.category || (type === "agent" ? "agents" : type === "desktop" ? "desktop" : "system");

  const newNotification: AppNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: params.title,
    message: params.message,
    type,
    category,
    timestamp: Date.now(),
    read: false,
    link: params.link,
    agentName: params.agentName,
    agentAvatar: params.agentAvatar,
  };

  const current = getStoredNotifications();
  saveStoredNotifications([newNotification, ...current]);

  // Audio micro-haptics
  if (params.playSound !== false) {
    if (type === "success" || type === "agent") {
      playTaskCompletedSound();
    } else if (type === "warning" || type === "error") {
      playWarningSound();
    } else {
      playClickSound();
    }
  }

  // Trigger Toast Notification with rich custom content
  const toastDesc = params.agentName ? `${params.agentName}: ${params.message}` : params.message;
  
  if (type === "success") {
    toast.success(params.title, { description: toastDesc });
  } else if (type === "error") {
    toast.error(params.title, { description: toastDesc });
  } else if (type === "warning") {
    toast.warning(params.title, { description: toastDesc });
  } else {
    toast(params.title, { description: toastDesc });
  }

  return newNotification;
}

export function getUnreadCount(): number {
  return getStoredNotifications().filter((n) => !n.read).length;
}
