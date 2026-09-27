"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { CommandPalette } from "@/components/layout/command-palette";
import { GeminiLiveOrb } from "@/components/voice/gemini-live-orb";
import { CostTrackerModal } from "@/components/telemetry/cost-tracker-modal";
import {
  DashboardChatProvider,
  useDashboardChat,
} from "@/context/dashboard-chat-context";
import { DashboardChatPanel } from "@/components/dashboard/dashboard-chat-panel";

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

export function GlobalCockpitProvider({ children }: { children: React.ReactNode }) {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isCostTrackerOpen, setIsCostTrackerOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K -> Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      // Alt+V or Ctrl+Shift+V -> Gemini Live Voice
      if (
        (e.altKey && e.key.toLowerCase() === "v") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "v")
      ) {
        e.preventDefault();
        setIsVoiceOpen((prev) => !prev);
      }
      // Alt+C or Ctrl+Shift+C -> Token & Cost Tracker
      if (
        (e.altKey && e.key.toLowerCase() === "c") ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c")
      ) {
        e.preventDefault();
        setIsCostTrackerOpen((prev) => !prev);
      }
    };

    const handleCustomEvents = (e: any) => {
      if (e.type === "open-command-palette") setIsCommandPaletteOpen(true);
      if (e.type === "open-voice-cockpit") setIsVoiceOpen(true);
      if (e.type === "open-cost-tracker") setIsCostTrackerOpen(true);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("open-command-palette", handleCustomEvents);
    window.addEventListener("open-voice-cockpit", handleCustomEvents);
    window.addEventListener("open-cost-tracker", handleCustomEvents);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("open-command-palette", handleCustomEvents);
      window.removeEventListener("open-voice-cockpit", handleCustomEvents);
      window.removeEventListener("open-cost-tracker", handleCustomEvents);
    };
  }, []);

  return (
    <DashboardChatProvider>
      {children}

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onOpenVoice={() => setIsVoiceOpen(true)}
        onOpenCostTracker={() => setIsCostTrackerOpen(true)}
      />

      <GeminiLiveOrb
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
      />

      <CostTrackerModal
        isOpen={isCostTrackerOpen}
        onClose={() => setIsCostTrackerOpen(false)}
      />

      {/* Persistent floating chat widget on non-dashboard pages */}
      <FloatingPersistentDashboardChat />
    </DashboardChatProvider>
  );
}
