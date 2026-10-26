"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Send,
  Loader2,
  Crown,
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
  Monitor,
  Zap,
  RotateCcw,
  Settings,
  Image as ImageIcon,
  FileText,
  FileCode,
  FileSpreadsheet,
  Music,
  X,
  Radio,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";
import type { DashboardAttachment } from "@/context/dashboard-chat-context";

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
  retry: RotateCcw,
  undo: RotateCcw,
  switch_model: Bot,
  a2a_mission: Crown,
  plan: Layers,
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
  settings: Settings,
  braindump: Brain,
  packs: Layers,
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
  icon: COMMAND_ICONS[def.handler] || Zap,
  color: COMMAND_COLORS[def.category] || "text-slate-500 bg-slate-500/10 border-slate-500/30",
}));

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachmentIcon(type: DashboardAttachment["type"]) {
  switch (type) {
    case "image":
      return <ImageIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
    case "code":
      return <FileCode className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    case "data":
      return <FileSpreadsheet className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case "audio":
      return <Music className="w-3.5 h-3.5 text-purple-500 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-primary shrink-0" />;
  }
}

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
  onOpenDesktop?: () => void;
  attachments?: DashboardAttachment[];
  setAttachments?: React.Dispatch<React.SetStateAction<DashboardAttachment[]>>;
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
  onOpenDesktop,
  attachments,
  setAttachments,
}: DashboardCommandBarProps) {
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local attachment fallback if parent doesn't provide state
  const [localAttachments, setLocalAttachments] = useState<DashboardAttachment[]>([]);
  const currentAttachments = attachments !== undefined ? attachments : localAttachments;
  const updateAttachments = setAttachments !== undefined ? setAttachments : setLocalAttachments;

  // Live Speech Recognition (STT) State
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup
        }
      }
    };
  }, []);

  const toggleVoiceDictation = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.info("Browser speech recognition not available. Opening voice cockpit...");
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsDictating(false);
      toast.info("Voice dictation stopped");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      const baseText = prompt.trim();

      recognition.onstart = () => {
        setIsDictating(true);
        toast.info("Listening... Speak to dictate your message");
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }

        const newText = baseText
          ? `${baseText} ${fullTranscript.trim()}`
          : fullTranscript.trim();

        setPrompt(newText);
      };

      recognition.onerror = (event: any) => {
        console.warn("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          toast.error("Microphone access denied. Please allow microphone permissions.");
        }
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Speech recognition failed:", err);
      window.dispatchEvent(new CustomEvent("open-voice-cockpit"));
      setIsDictating(false);
    }
  };

  const processFiles = (files: File[]) => {
    if (!files || files.length === 0) return;

    files.forEach((file) => {
      const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name);
      const isImage = file.type.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/i.test(file.name);
      const isCode = /\.(ts|tsx|js|jsx|py|html|htm|css|json|yaml|yml|sh|bash|sql|rs|go|c|cpp|md|txt|xml)$/i.test(file.name);
      const isData = /\.(csv|tsv|json|xlsx|parquet)$/i.test(file.name);

      let type: DashboardAttachment["type"] = "document";
      if (isAudio) type = "audio";
      else if (isImage) type = "image";
      else if (isCode) type = "code";
      else if (isData) type = "data";

      if (isAudio || isImage) {
        const reader = new FileReader();
        reader.onload = () => {
          updateAttachments((prev) => [
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
          updateAttachments((prev) => [
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
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(Array.from(e.target.files));
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const items = e.clipboardData?.items;
    if (!items || items.length === 0) return;

    const filesToUpload: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          filesToUpload.push(file);
        }
      }
    }

    if (filesToUpload.length > 0) {
      processFiles(filesToUpload);
    }
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleRemoveAttachment = (id: string) => {
    updateAttachments((prev) => prev.filter((a) => a.id !== id));
  };

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

  const handleFormSubmit = (e: React.FormEvent) => {
    if (isDictating && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsDictating(false);
    }
    onCommandSubmit(e);
  };

  return (
    <div className="relative">
      <form
        onSubmit={handleFormSubmit}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-xl border bg-card p-2.5 transition-all focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 shadow-xs ${
          isDragging ? "border-primary ring-2 ring-primary/30 bg-primary/5" : "border-border"
        }`}
      >
        {/* Hidden File Input for Attachment (+) Button */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Drag and Drop Active Overlay Notice */}
        {isDragging && (
          <div className="mb-2 p-2.5 rounded-lg border border-dashed border-primary bg-primary/10 flex items-center justify-center text-xs font-medium text-primary gap-2 animate-pulse">
            <Upload className="w-4 h-4" />
            <span>Drop images or files here to attach</span>
          </div>
        )}

        {/* Live Voice Dictation Active Bar */}
        {isDictating && (
          <div className="mb-2 px-3 py-1.5 rounded-lg border border-red-500/40 bg-red-500/10 backdrop-blur-md flex items-center justify-between text-xs animate-pulse">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
              <Radio className="w-3.5 h-3.5 animate-spin text-red-500" />
              <span>Voice Dictation Active: Speak now...</span>
            </div>
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-700 dark:text-red-300 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/30 cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}

        {/* Attachment Chips Bar */}
        {currentAttachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 pb-2 mb-1.5 border-b border-border/60">
            {currentAttachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-secondary/80 border border-border text-xs text-foreground animate-in fade-in zoom-in-95"
              >
                {att.type === "image" && att.content ? (
                  <img
                    src={att.content}
                    alt={att.name}
                    className="w-4 h-4 rounded object-cover border border-border/80 shrink-0"
                  />
                ) : (
                  renderAttachmentIcon(att.type)
                )}
                <span className="font-medium truncate max-w-[140px] text-[11px]">{att.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  ({formatFileSize(att.size)})
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="p-0.5 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="Remove attachment"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 px-1">
          {/* (+) Button for Attachments */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/70 transition-colors cursor-pointer shrink-0 flex items-center justify-center group"
            title="Add attachments (files, images, code, docs)"
          >
            <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 group-hover:text-primary" />
          </button>

          {isAgentsMode && (
            <Crown className="w-4 h-4 text-primary shrink-0" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={prompt}
            onChange={handleInputChange}
            onPaste={handlePaste}
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
                ? "Message your team, queue a task, or type / for commands..."
                : `Message ${activeAgent?.displayName || "specialist"}...`
            }
            autoFocus
            className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-muted-foreground outline-none"
          />

          {/* Action Buttons on Right: Mic (Voice) + Kanban + Send */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Voice Dictation (Mic) Button */}
            <button
              type="button"
              onClick={toggleVoiceDictation}
              className={`p-1.5 rounded-md transition-all cursor-pointer flex items-center justify-center shrink-0 ${
                isDictating
                  ? "bg-red-500/20 text-red-500 ring-1 ring-red-500/40 animate-pulse"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
              }`}
              title={isDictating ? "Stop voice dictation" : "Click to speak (Voice dictation)"}
            >
              <Mic className="w-4 h-4" />
            </button>

            {(prompt.trim() || currentAttachments.length > 0) && (
              <>
                {!isAgentsMode && (
                  <button
                    type="button"
                    onClick={() => onSendToKanban()}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer disabled:opacity-40"
                    title="Send as new task to Kanban board"
                  >
                    <Columns3 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send to Kanban</span>
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || isChatSending || isA2AExecuting}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition disabled:opacity-50 text-xs font-bold cursor-pointer"
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
              </>
            )}
          </div>
        </div>

        {/* Slash Commands Dropdown Menu */}
        {showSlashMenu && (
          <div className={`absolute left-2 right-2 z-50 rounded-lg border border-border bg-card p-1.5 shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-150 max-h-80 overflow-y-auto ${
            isChatActive ? "bottom-full mb-2" : "top-full mt-2"
          }`}>
            <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
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
                  className="w-full flex items-center justify-between p-2 rounded-md text-left hover:bg-muted transition cursor-pointer text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center border text-xs ${sc.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-foreground">
                        <span className="font-mono">{sc.cmd}</span>
                        <span className="font-normal text-muted-foreground">— {sc.label}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{sc.desc}</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-sm bg-secondary text-muted-foreground font-mono whitespace-nowrap ml-2">
                    {sc.badge}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Sub-bar options: Specialist Picker + Clean Command Hint */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 mt-2 border-t border-border text-xs px-1 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-border bg-secondary/50 hover:bg-secondary text-xs font-medium text-foreground transition cursor-pointer"
            >
              <span className="shrink-0 flex items-center">
                {selectedAgentId === "auto" ? (
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                ) : (
                  <AgentAvatar avatar={activeAgent?.avatar} className="w-3.5 h-3.5 text-primary" />
                )}
              </span>
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
                className={`absolute left-0 z-50 w-72 rounded-lg border border-border bg-card p-2 shadow-xl space-y-2 animate-in fade-in zoom-in-95 duration-150 ${
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
                    className="w-full pl-8 pr-3 py-1.5 rounded-md border border-border bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
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
                    className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition cursor-pointer text-left ${
                      selectedAgentId === "auto"
                        ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <div>
                        <div className="font-medium">Auto-Assign</div>
                        <div className="text-[10px] text-muted-foreground">Smart cascade model routing</div>
                      </div>
                    </div>
                    {selectedAgentId === "auto" && <Check className="w-3.5 h-3.5 text-primary" />}
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
                        className={`w-full flex items-center justify-between p-2 rounded-md text-xs transition cursor-pointer text-left ${
                          isSelected
                            ? "bg-primary/10 text-primary border border-primary/20 font-semibold"
                            : "hover:bg-muted text-foreground"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 h-5 rounded-md bg-secondary flex items-center justify-center shrink-0 border border-border text-primary">
                            <AgentAvatar avatar={agent.avatar} className="w-3.5 h-3.5" />
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium truncate">{agent.displayName}</div>
                            <div className="text-[10px] text-muted-foreground truncate">
                              {agent.role || "specialist"} {agent.department ? `• ${agent.department}` : ""}
                            </div>
                          </div>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
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

            <button
              type="button"
              onClick={onOpenDesktop}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold transition cursor-pointer"
              title="Live Desktop View — inspect agent desktop screen & CUA controls"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>

            <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 ml-1">
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
