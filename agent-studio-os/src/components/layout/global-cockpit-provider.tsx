"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GeminiLiveOrb } from "@/components/voice/gemini-live-orb";
import {
  DashboardChatProvider,
  useDashboardChat,
} from "@/context/dashboard-chat-context";
import { DashboardChatPanel } from "@/components/dashboard/dashboard-chat-panel";
import { ProjectBuilderProvider } from "@/context/project-builder-context";
import { GlobalAgentTaskTracker } from "@/components/layout/global-agent-task-tracker";
import { CommandPalette } from "@/components/layout/command-palette";

/**
 * Floating Persistent Chat Panel
 * When on non-dashboard routes (pathname !== "/"), if chat is active, it stays open
 * in floating mode so user never loses their active agent conversation or deliverable.
 * It only closes when the user clicks the close button.
 */
function FloatingPersistentDashboardChat() {
  const pathname = usePathname();
  const {
    isChatActive,
    activeAgent,
    currentSessionId,
    chatMessages,
    isChatSending,
    followUpInput,
    setFollowUpInput,
    sendChatMessage,
    closeChat,
    sendToKanban,
  } = useDashboardChat();

  // On the dashboard ("/"), the chat panel is rendered in-page by page.tsx.
  // On all other pages (e.g. /kanban, /agents, /routines, /settings, /memory),
  // if active, it remains visible as a floating widget!
  if (pathname === "/" || !isChatActive) {
    return null;
  }

  return (
    <DashboardChatPanel
      isChatActive={isChatActive}
      activeAgent={activeAgent}
      currentSessionId={currentSessionId}
      chatMessages={chatMessages}
      isChatSending={isChatSending}
      followUpInput={followUpInput}
      setFollowUpInput={setFollowUpInput}
      onFollowUpSubmit={(e) => {
        e.preventDefault();
        if (followUpInput.trim() && !isChatSending) {
          const text = followUpInput.trim();
          setFollowUpInput("");
          sendChatMessage(text);
        }
      }}
      onCloseChat={closeChat}
      onSendToKanban={sendToKanban}
      isFloating={true}
    />
  );
}

import { NotificationCenterDrawer } from "@/components/notifications/notification-center-drawer";

export function GlobalCockpitProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+V or Ctrl+Shift+V -> Gemini Live Voice
      if (
        (e.altKey && e.key.toLowerCase() === "v") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v")
      ) {
        e.preventDefault();
        setIsVoiceOpen((prev) => !prev);
      }
      // Alt+C or Ctrl+Shift+C -> Analytics Tab
      if (
        (e.altKey && e.key.toLowerCase() === "c") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c")
      ) {
        e.preventDefault();
        router.push("/settings?tab=analytics");
      }
      // Alt+N or Ctrl+Shift+N -> Notification Center
      if (
        (e.altKey && e.key.toLowerCase() === "n") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "n")
      ) {
        e.preventDefault();
        setIsNotificationsOpen((prev) => !prev);
      }
    };

    const handleCustomEvents = (e: any) => {
      if (e.type === "open-voice-cockpit") setIsVoiceOpen(true);
      if (e.type === "open-notifications") setIsNotificationsOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-voice-cockpit", handleCustomEvents);
    window.addEventListener("open-notifications", handleCustomEvents);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-voice-cockpit", handleCustomEvents);
      window.removeEventListener("open-notifications", handleCustomEvents);
    };
  }, []);

  return (
    <DashboardChatProvider>
      <ProjectBuilderProvider>
        {children}

        <GeminiLiveOrb
          isOpen={isVoiceOpen}
          onClose={() => setIsVoiceOpen(false)}
        />

        <NotificationCenterDrawer
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
        />

        {/* Global Agent Task Tracker across all pages */}
        <GlobalAgentTaskTracker />

        {/* Global Command Palette (Cmd+K / Ctrl+K) */}
        <CommandPalette />

        {/* Persistent floating chat widget on non-dashboard pages */}
        <FloatingPersistentDashboardChat />
      </ProjectBuilderProvider>
    </DashboardChatProvider>
  );
}
