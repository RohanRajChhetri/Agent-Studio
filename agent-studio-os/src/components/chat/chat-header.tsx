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
} from "lucide-react";
import type { AgentProfile, ChatSession } from "@/types";

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

  return (
    <div className="px-4 py-3 border-b border-border/80 bg-card/60 backdrop-blur-md flex items-center justify-between gap-3 shrink-0 relative z-20">
      {/* Left: Sidebar toggle + Active Agent indicator & Switcher */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          onClick={onToggleSidebar}
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="p-1.5 rounded-lg border border-border/70 bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer shrink-0"
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
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-xl border border-border/70 bg-secondary/40 hover:bg-secondary/70 hover:border-border transition-all cursor-pointer text-left"
            title="Switch agent persona"
          >
            {selectedAgent ? (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0 leading-none">{selectedAgent.avatar}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-foreground truncate max-w-[130px] sm:max-w-[180px]">
                      {selectedAgent.displayName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-medium bg-primary/10 text-primary border border-primary/20 shrink-0">
                      {selectedAgent.role || "Specialist"}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Bot className="w-4 h-4 text-primary" />
                <span>Select Agent</span>
              </div>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 ml-0.5" />
          </button>

          {/* Agent Switcher Menu */}
          {showAgentMenu && (
            <div className="absolute top-full left-0 mt-2 w-72 p-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/60">
                Switch Agent Persona
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5 pr-0.5">
                {agents.map((ag) => {
                  const isSelected = selectedAgent?.id === ag.id;
                  return (
                    <button
                      key={ag.id}
                      onClick={() => {
                        onSelectAgent(ag);
                        setShowAgentMenu(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-primary/15 text-primary font-semibold"
                          : "hover:bg-secondary/70 text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-lg shrink-0">{ag.avatar}</span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-xs">{ag.displayName}</p>
                          <p className="text-[10.5px] text-muted-foreground truncate max-w-[170px]">
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
                <div className="pt-1 border-t border-border/60">
                  <button
                    onClick={() => {
                      setShowAgentMenu(false);
                      onOpenSpecs();
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  >
                    <Sliders className="w-3 h-3" />
                    <span>View {selectedAgent.displayName} Directives</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right: Model selector & Streamlined Tools Menu */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Model Selector Pill */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl border border-border/70 bg-secondary/40 text-xs">
          <Zap className="w-3 h-3 text-amber-400 shrink-0" />
          <select
            value={model}
            onChange={(e) => onSelectModel(e.target.value)}
            className="bg-transparent text-xs text-foreground font-mono outline-none cursor-pointer pr-1 max-w-[130px] md:max-w-[180px] truncate"
            title="Active Model ID"
          >
            {models.length > 0 ? (
              models.map((m) => (
                <option key={m} value={m} className="bg-card text-foreground">
                  {m}
                </option>
              ))
            ) : (
              <option value="auto/fast">auto/fast</option>
            )}
          </select>
        </div>

        {/* Unified Tools & Modes Dropdown */}
        <div className="relative" ref={toolsMenuRef}>
          <button
            onClick={() => setShowToolsMenu((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm ${
              splitArenaMode || compareMode || roundtableMode
                ? "border-primary bg-primary/15 text-primary"
                : "border-border/70 bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title="Advanced tools, modes, and actions"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="hidden xs:inline">Tools</span>
            {(splitArenaMode || compareMode || roundtableMode) && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            )}
            <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
          </button>

          {showToolsMenu && (
            <div className="absolute top-full right-0 mt-2 w-64 p-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl space-y-1 animate-in fade-in zoom-in-95 duration-150 z-50">
              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Advanced Modes
              </div>

              {/* Compare Mode */}
              <button
                onClick={() => {
                  onToggleCompare();
                  setShowToolsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  compareMode
                    ? "bg-primary/15 text-primary font-semibold"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>3-Way Model Compare</span>
                </div>
                {compareMode && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>

              {/* Split Arena Mode */}
              <button
                onClick={() => {
                  onToggleSplitArena();
                  setShowToolsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  splitArenaMode
                    ? "bg-primary/15 text-primary font-semibold"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Split Arena (Dual-Model)</span>
                </div>
                {splitArenaMode && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>

              {/* Roundtable Debate Swarm */}
              <button
                onClick={() => {
                  onToggleRoundtable();
                  setShowToolsMenu(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
                  roundtableMode
                    ? "bg-primary/15 text-primary font-semibold"
                    : "hover:bg-secondary text-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquareQuote className="w-3.5 h-3.5" />
                  <span>Roundtable Debate Swarm</span>
                </div>
                {roundtableMode && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>

              <div className="my-1 border-t border-border/60" />
              <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Options & Utilities
              </div>

              {/* Obsidian Vault RAG Toggle */}
              <button
                onClick={() => {
                  onToggleVaultGrounding();
                }}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Brain className="w-3.5 h-3.5 text-primary" />
                  <span>Obsidian Vault Grounding</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    vaultGrounding
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-secondary text-muted-foreground"
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
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {autoTTS ? (
                    <Volume2 className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span>Auto-Read Responses (TTS)</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                    autoTTS
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {autoTTS ? "ON" : "OFF"}
                </span>
              </button>

              {/* Hermes CLI */}
              <button
                onClick={() => {
                  setShowToolsMenu(false);
                  onOpenTerminal();
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors cursor-pointer"
              >
                <Terminal className="w-3.5 h-3.5 text-foreground" />
                <span>Hermes CLI Console</span>
              </button>

              {/* Export to Vault */}
              {activeSession && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onExportVault();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs hover:bg-secondary text-foreground transition-colors cursor-pointer"
                >
                  <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export to Obsidian Vault</span>
                </button>
              )}

              {/* Clear Messages */}
              {hasMessages && (
                <button
                  onClick={() => {
                    setShowToolsMenu(false);
                    onClearChat();
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer border-t border-border/60 mt-1"
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
