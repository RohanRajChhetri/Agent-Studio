"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Loader2,
  Crown,
  Sparkles,
  Columns3,
  Bot,
  Check,
  ChevronDown,
  Brain,
  Sun,
  Layers,
  Mic,
  Coins,
  Image,
  Code,
  HelpCircle,
  BarChart3,
  Plus,
  Paperclip,
  Upload,
} from "lucide-react";
import type { AgentProfile } from "@/types";
import {
  SLASH_COMMANDS as ALL_SLASH_COMMANDS,
  getCommandSuggestions,
  getCategoryInfo,
  type SlashCommandDefinition,
} from "@/lib/slash-commands";

// Icon mapping for slash commands
const COMMAND_ICONS: Record<string, React.ElementType> = {
  new_session: Plus,
  help: HelpCircle,
  status: BarChart3,
  stop: Loader2,
  branch: Layers,
  queue_task: Columns3,
  retry: Sparkles,
  undo: Sparkles,
  switch_model: Bot,
  a2a_mission: Crown,
  plan: Sparkles,
  compress: Layers,
  review: Bot,
  loop: Sun,
  image_gen: Image,
  code: Code,
  usage: Coins,
  profile: Bot,
  debug: Code,
  voice: Mic,
  memory: Brain,
  routines: Sun,
  settings: Sparkles,
  braindump: Brain,
  packs: Sparkles,
  pipeline: Layers,
};

const COMMAND_COLORS: Record<string, string> = {
  mvp: "text-blue-500 bg-blue-500/10 border-blue-500/30",
  core: "text-purple-500 bg-purple-500/10 border-purple-500/30",
  advanced: "text-amber-500 bg-amber-500/10 border-amber-500/30",
  admin: "text-slate-500 bg-slate-500/10 border-slate-500/30",
};

export interface SlashCommandItem {
  cmd: string;
  label: string;
  badge: string;
  desc: string;
  icon: React.ElementType;
  color: string;
}

// Convert centralized commands to UI items
const SLASH_COMMANDS_UI: SlashCommandItem[] = ALL_SLASH_COMMANDS.map((def) => ({
  cmd: def.command,
  label: def.description,
  badge: getCategoryInfo(def.category).label,
  desc: def.usage,
  icon: COMMAND_ICONS[def.handler] || Sparkles,
  color: COMMAND_COLORS[def.category] || "text-slate-500 bg-slate-500/10 border-slate-500/30",
}));

interface DashboardCommandBarProps {
  prompt: string;
  setPrompt: (val: string) => void;
  selectedAgentId: string;
  setSelectedAgentId: (id: string) => void;
  agents: AgentProfile[];
  activeAgent?: AgentProfile;
  isSubmitting: boolean;
  isChatSending: boolean;
  isA2AExecuting: boolean;
  isChatActive?: boolean;
  onCommandSubmit: (e: React.FormEvent) => void;
  onSendToKanban: (title?: string, desc?: string) => void;
  onSelectSlashCommand: (cmd: string) => void;
  onOpenBrainDump: () => void;
}

export function DashboardCommandBar({
  prompt,
  setPrompt,
  selectedAgentId,
  setSelectedAgentId,
  agents,
  activeAgent,
  isSubmitting,
  isChatSending,
  isA2AExecuting,
  isChatActive = false,
  onCommandSubmit,
  onSendToKanban,
  onSelectSlashCommand,
  onOpenBrainDump,
}: DashboardCommandBarProps) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }
    if (pickerOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [pickerOpen]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPrompt(val);
    if (val.startsWith("/") && !val.includes(" ")) {
      setShowSlashMenu(true);
    } else {
      setShowSlashMenu(false);
    }
  };

  const filteredPickerAgents = useMemo(() => {
    if (!pickerSearch.trim()) return agents;
    const q = pickerSearch.toLowerCase();
    return agents.filter(
      (a) =>
        a.displayName.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        (a.department && a.department.toLowerCase().includes(q)) ||
        (a.role && a.role.toLowerCase().includes(q))
    );
  }, [agents, pickerSearch]);

  const isAgentsMode = prompt.trim().toLowerCase().startsWith("/agents");

  return (
    <div className="relative">
      <form
        onSubmit={onCommandSubmit}
        className="relative rounded-xl border border-border bg-card p-2.5 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 shadow-xs"
      >
        <div className="flex items-center gap-2.5 px-2">
          {isAgentsMode ? (
            <Crown className="w-4 h-4 text-[#0075de] shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={handleInputChange}
            onFocus={() => {
              if (prompt.startsWith("/") && !prompt.includes(" ")) setShowSlashMenu(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                if (showSlashMenu) {
                  setShowSlashMenu(false);
                } else if (prompt) {
                  setPrompt("");
                }
              }
            }}
            placeholder={
              isAgentsMode
                ? "Enter high-level mission for the agent hierarchy... (e.g. /agents Build JWT authentication)"
                : isChatActive
                ? `Reply to ${activeAgent?.displayName || "agent"}... (or type / for commands)`
                : selectedAgentId === "auto"
                ? "Message your team, queue a task, or type /agents..."
                : `Message ${activeAgent?.displayName || "specialist"}...`
            }
            autoFocus
            className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-none"
          />

          {prompt.trim() && (
            <div className="flex items-center gap-1.5 shrink-0">
              {!isAgentsMode && (
                <button
                  type="button"
                  onClick={() => onSendToKanban()}
                  disabled={isSubmitting}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                  title="Send as new task to Kanban board"
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Send to Kanban</span>
                </button>
              )}

              <button
                type="submit"
                disabled={isSubmitting || isChatSending || isA2AExecuting}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 text-xs font-bold cursor-pointer"
                title={isAgentsMode ? "Execute A2A Mission" : isChatActive ? "Send reply" : "Send message"}
              >
                {isSubmitting || isChatSending || isA2AExecuting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isAgentsMode ? (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    <span>Execute A2A</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{isChatActive ? "Reply" : "Send"}</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Slash Commands Dropdown Menu */}
        {showSlashMenu && (
          <div className={`absolute left-2 right-2 z-50 rounded-xl border border-border bg-card p-1.5 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto ${
            isChatActive ? "bottom-full mb-2" : "top-full mt-2"
          }`}>
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Slash Commands ({SLASH_COMMANDS_UI.length})
            </div>
            {SLASH_COMMANDS_UI.filter((sc) => {
              const partial = prompt.replace(/^\//, "").toLowerCase();
              if (!partial) return true;
              return sc.cmd.slice(1).startsWith(partial) || sc.label.toLowerCase().includes(partial);
            }).map((sc) => {
              const Icon = sc.icon;
              return (
                <button
                  key={sc.cmd}
                  type="button"
                  onClick={() => {
                    onSelectSlashCommand(sc.cmd);
                    setShowSlashMenu(false);
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-lg text-left hover:bg-secondary/60 transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center border text-xs ${sc.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <span>{sc.cmd}</span>
                        <span className="font-normal text-muted-foreground">— {sc.label}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{sc.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono whitespace-nowrap ml-2">
                    {sc.badge}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-bar options: Specialist Picker + Clean Command Hint */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2 border-t border-border text-xs px-1 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground transition cursor-pointer"
            >
              <span className="text-xs">{selectedAgentId === "auto" ? "⚡" : (activeAgent?.avatar || "🤖")}</span>
              <span className="font-semibold text-xs text-foreground">
                {selectedAgentId === "auto" ? (
                  prompt.trim() && activeAgent ? `Auto-Assign: ${activeAgent.displayName}` : "Auto-Assign"
                ) : activeAgent?.displayName}
              </span>
              <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
            </button>

            {/* Popover Dropdown */}
            {pickerOpen && (
              <div
                ref={pickerRef}
                className={`absolute left-0 z-50 w-72 rounded-xl border border-border bg-card p-2 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
                  isChatActive ? "bottom-full mb-2" : "top-full mt-1.5"
                }`}
              >
                <div className="relative">
                  <Bot className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Filter agents..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                  {/* Auto-Assign */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAgentId("auto");
                      setPickerOpen(false);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer text-left ${
                      selectedAgentId === "auto"
                        ? "bg-[#e6f3fe] text-[#0075de] font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⚡</span>
                      <div>
                        <div className="font-medium">Auto-Assign</div>
                        <div className="text-[10px] text-muted-foreground">Smart cascade model routing</div>
                      </div>
                    </div>
                    {selectedAgentId === "auto" && <Check className="w-3.5 h-3.5 text-[#0075de]" />}
                  </button>

                  {/* Filtered Agent List */}
                  {filteredPickerAgents.map((agent) => {
                    const isSelected = selectedAgentId === agent.id;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          setSelectedAgentId(agent.id);
                          setPickerOpen(false);
                        }}
                        className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-[#e6f3fe] text-[#0075de] font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base shrink-0">{agent.avatar || "🤖"}</span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{agent.displayName}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {agent.role || "specialist"} {agent.department ? `• ${agent.department}` : ""}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#0075de] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Capture Tools + Hint */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onOpenBrainDump}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition cursor-pointer"
              title="Voice & Text Brain Dump — speech recognition & auto-decomposition into tickets"
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Brain Dump</span>
            </button>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 ml-1">
              <span>Type</span>
              <button
                type="button"
                onClick={() => onSelectSlashCommand("/agents")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-secondary font-mono text-foreground font-semibold cursor-pointer border border-border"
              >
                /agents
              </button>
              <span>for A2A, or</span>
              <button
                type="button"
                onClick={() => onSelectSlashCommand("/")}
                className="px-1.5 py-0.5 rounded bg-muted hover:bg-secondary font-mono text-foreground font-semibold cursor-pointer border border-border"
              >
                /
              </button>
              <span>for commands</span>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
