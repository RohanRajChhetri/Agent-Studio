"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Sliders,
  Sparkles,
  Columns3,
  MessageSquareQuote,
  Terminal,
  FolderDown,
  Trash2,
  Volume2,
  VolumeX,
  Brain,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
  Zap,
  MoreHorizontal,
  Layers,
  MessageSquare,
  Monitor,
  Activity,
} from "lucide-react";
import type { AgentProfile, ChatSession } from "@/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface ChatHeaderProps {
  selectedAgent: AgentProfile | null;
  agents: AgentProfile[];
  onSelectAgent: (agent: AgentProfile) => void;
  activeSession: ChatSession | null;
  model: string;
  models: string[];
  onSelectModel: (model: string) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  autoTTS: boolean;
  onToggleAutoTTS: () => void;
  vaultGrounding: boolean;
  onToggleVaultGrounding: () => void;
  onOpenSpecs: () => void;
  onOpenTerminal: () => void;
  onExportVault: () => void;
  onClearChat: () => void;
  splitArenaMode: boolean;
  onToggleSplitArena: () => void;
  compareMode: boolean;
  onToggleCompare: () => void;
  roundtableMode: boolean;
  onToggleRoundtable: () => void;
  hasMessages: boolean;
  onOpenDesktop?: () => void;
  onOpenDesktopLog?: () => void;
}

export function ChatHeader({
  selectedAgent,
  agents,
  onSelectAgent,
  activeSession,
  model,
  models,
  onSelectModel,
  sidebarOpen,
  onToggleSidebar,
  autoTTS,
  onToggleAutoTTS,
  vaultGrounding,
  onToggleVaultGrounding,
  onOpenSpecs,
  onOpenTerminal,
  onExportVault,
  onClearChat,
  splitArenaMode,
  onToggleSplitArena,
  compareMode,
  onToggleCompare,
  roundtableMode,
  onToggleRoundtable,
  hasMessages,
  onOpenDesktop,
  onOpenDesktopLog,
}: ChatHeaderProps) {
  const [showAgentMenu, setShowAgentMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const agentMenuRef = useRef<HTMLDivElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (agentMenuRef.current && !agentMenuRef.current.contains(e.target as Node)) {
        setShowAgentMenu(false);
      }
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target as Node)) {
        setShowToolsMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isStandardChat = !splitArenaMode && !compareMode && !roundtableMode;

  return (
    <div className="px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-b border-border bg-card/90 backdrop-blur-xl flex items-center justify-between gap-1.5 sm:gap-3 shrink-0 relative z-30 select-none text-card-foreground">
      {/* Left: Sidebar toggle + Active Agent indicator & Switcher */}
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
          {sidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" />
          )}
        </button>

        {/* Agent Switcher Dropdown */}
        <div className="relative" ref={agentMenuRef}>
          <button
            onClick={() => setShowAgentMenu((prev) => !prev)}
            className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl border border-border bg-secondary/80 hover:bg-secondary hover:border-primary/40 transition-all cursor-pointer text-left group"
            title="Switch agent persona"
          >
            {selectedAgent ? (
              <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <AgentAvatar avatar={selectedAgent.avatar} className="w-4 h-4 text-primary shrink-0" />
                <div className="min-w-0 flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[70px] xs:max-w-[100px] sm:max-w-[150px]">
                    {selectedAgent.displayName}
                  </span>
                  {/* Live Status Beacon */}
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bot className="w-4 h-4 text-primary" />
                <span>Select Agent</span>
              </div>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground shrink-0 ml-0.5 transition-transform duration-150" />
          </button>

          {/* Agent Switcher Dropdown Menu */}
          {showAgentMenu && (
            <div className="absolute top-full left-0 mt-2 w-72 p-1.5 rounded-2xl border border-border bg-popover text-popover-foreground backdrop-blur-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border">
                Agent Personas
              </div>
              <div className="max-h-64 overflow-y-auto space-y-0.5 pr-0.5 scrollbar-thin scrollbar-thumb-border">
                {agents.map((ag) => {
                  const isSelected = selectedAgent?.id === ag.id;
                  return (
                    <button
                      key={ag.id}
                      onClick={() => {
                        onSelectAgent(ag);
                        setShowAgentMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-accent text-accent-foreground font-semibold border border-primary/20"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AgentAvatar avatar={ag.avatar} className="w-4 h-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-medium truncate text-xs text-foreground">{ag.displayName}</p>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[170px]">
                            {ag.description || ag.role}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
              {selectedAgent && (
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => {
                      setShowAgentMenu(false);
                      onOpenSpecs();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>View {selectedAgent.displayName} Directives</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Session Title Breadcrumb */}
        {activeSession && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground font-mono pl-1 max-w-[160px] lg:max-w-[220px] truncate">
            <span className="opacity-40">/</span>
            <span className="truncate text-foreground font-sans font-medium">{activeSession.title}</span>
          </div>
        )}
      </div>

      {/* Center: Linear-Style Segmented Mode Switcher */}
      <div className="hidden lg:flex items-center p-0.5 rounded-xl bg-secondary border border-border text-xs">
        <button
          onClick={() => {
            if (!isStandardChat) {
              if (splitArenaMode) onToggleSplitArena();
              if (compareMode) onToggleCompare();
              if (roundtableMode) onToggleRoundtable();
            }
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
            isStandardChat
              ? "bg-card text-foreground shadow-xs font-semibold border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => {
            if (!splitArenaMode) onToggleSplitArena();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
            splitArenaMode
              ? "bg-card text-foreground shadow-xs font-semibold border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>A/B Arena</span>
        </button>

        <button
          onClick={() => {
            if (!roundtableMode) onToggleRoundtable();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
            roundtableMode
              ? "bg-card text-foreground shadow-xs font-semibold border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquareQuote className="w-3.5 h-3.5 text-primary" />
          <span>Roundtable</span>
        </button>

        <button
          onClick={() => {
            if (!compareMode) onToggleCompare();
          }}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
            compareMode
              ? "bg-card text-foreground shadow-xs font-semibold border border-border/80"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Columns3 className="w-3.5 h-3.5 text-primary" />
          <span>3-Way Compare</span>
        </button>
      </div>

      {/* Right: Model Selector, Desktop Buttons & Consolidated Tools Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Model Selector Pill */}
        <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl border border-border bg-secondary/80 text-xs text-foreground">
          <Zap className="w-3 h-3 text-primary shrink-0" />
          <select
            value={model}
            onChange={(e) => onSelectModel(e.target.value)}
            className="bg-transparent text-xs text-foreground font-mono outline-none cursor-pointer pr-0.5 sm:pr-1 max-w-[70px] xs:max-w-[95px] sm:max-w-[160px] truncate"
            title="Active Model ID"
          >
            {models.length > 0 ? (
              models.map((m) => (
                <option key={m} value={m} className="bg-popover text-popover-foreground">
                  {m}
                </option>
              ))
            ) : (
              <option value="auto/fast">auto/fast</option>
            )}
          </select>
        </div>

        {/* Live Desktop Button */}
        {onOpenDesktop && (
          <button
            onClick={onOpenDesktop}
            className="flex items-center gap-1.5 p-1.5 px-2 sm:px-2.5 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-foreground transition-all cursor-pointer shadow-xs group"
            title="Open Live Desktop Screen Operator"
          >
            <Monitor className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline text-xs font-medium">Desktop</span>
          </button>
        )}

        {/* Desktop Action Log Button */}
        {onOpenDesktopLog && (
          <button
            onClick={onOpenDesktopLog}
            className="flex items-center gap-1.5 p-1.5 px-2 sm:px-2.5 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-foreground transition-all cursor-pointer shadow-xs group"
            title="Open Desktop Action Audit Trail & Logs"
          >
            <Activity className="w-3.5 h-3.5 text-primary group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline text-xs font-medium">Desktop Log</span>
          </button>
        )}

        {/* Consolidated Tools & Options Popover */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            onClick={() => setShowToolsMenu((prev) => !prev)}
            className={`flex items-center gap-1.5 p-1.5 px-2 sm:px-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-xs ${
              vaultGrounding || autoTTS || splitArenaMode || compareMode || roundtableMode
                ? "border-primary/40 bg-accent text-accent-foreground font-semibold"
                : "border-border bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title="Workspace options & tools"
          >
            <MoreHorizontal className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">Tools</span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
          </button>

          {showToolsMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 p-1.5 rounded-2xl border border-border bg-popover text-popover-foreground backdrop-blur-2xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50">
              {/* Mobile Segment Switchers (visible if hidden on desktop) */}
              <div className="lg:hidden">
                <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Modes
                </div>
                <button
                  onClick={() => {
                    if (splitArenaMode) onToggleSplitArena();
                    if (compareMode) onToggleCompare();
                    if (roundtableMode) onToggleRoundtable();
                    setShowToolsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    isStandardChat
                      ? "bg-muted text-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Standard Chat</span>
                  </div>
                  {isStandardChat && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                <button
                  onClick={() => {
                    onToggleSplitArena();
                    setShowToolsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    splitArenaMode
                      ? "bg-muted text-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Split Arena</span>
                  </div>
                  {splitArenaMode && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                <button
                  onClick={() => {
                    onToggleRoundtable();
                    setShowToolsMenu(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                    roundtableMode
                      ? "bg-muted text-foreground font-semibold"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote className="w-3.5 h-3.5 text-primary" />
                    <span>Roundtable Debate</span>
                  </div>
                  {roundtableMode && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                <div className="my-1 border-t border-border" />
              </div>

              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Grounding & Speech
              </div>

              {/* Obsidian Vault RAG Toggle */}
              <button
                onClick={() => {
                  onToggleVaultGrounding();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span>Obsidian Vault RAG</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    vaultGrounding
                      ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {vaultGrounding ? "ON" : "OFF"}
                </span>
              </button>

              {/* Auto Audio (TTS) Toggle */}
              <button
                onClick={() => {
                  onToggleAutoTTS();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {autoTTS ? (
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>Auto-Read Responses</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded font-mono ${
                    autoTTS
                      ? "bg-secondary text-foreground border border-border"
                      : "bg-secondary text-muted-foreground border border-border"
                  }`}
                >
                  {autoTTS ? "ON" : "OFF"}
                </span>
              </button>

              <div className="my-1 border-t border-border" />
              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Console & Actions
              </div>

              {/* Agent Live Desktop Screen */}
              {onOpenDesktop && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onOpenDesktop();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="w-3.5 h-3.5 text-primary" />
                    <span>Live Desktop Screen</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                    Live
                  </span>
                </button>
              )}

              {/* Desktop Action Log */}
              {onOpenDesktopLog && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onOpenDesktopLog();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    <span>Desktop Action Log</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
                    Audit
                  </span>
                </button>
              )}

              {/* Hermes CLI */}
              <button
                onClick={() => {
                  setShowToolsMenu(false);
                  onOpenTerminal();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Hermes CLI Console</span>
              </button>

              {/* Export to Vault */}
              {activeSession && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onExportVault();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs hover:bg-muted text-foreground transition-colors cursor-pointer"
                >
                  <FolderDown className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Export Chat to Vault</span>
                </button>
              )}

              {/* Clear Messages */}
              {hasMessages && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onClearChat();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer border-t border-border mt-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Conversation</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
