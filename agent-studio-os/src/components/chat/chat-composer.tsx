"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Paperclip,
  Plus,
  Mic,
  Square,
  FileText,
  Image as ImageIcon,
  Music,
  FileCode,
  FileSpreadsheet,
  X,
  Radio,
  Sparkles,
  Command,
  Search,
  Code2,
  Users,
  Upload,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import type { ChatAttachment } from "@/app/chat/page";

interface SlashCommand {
  cmd: string;
  desc: string;
  usage: string;
}

interface ChatComposerProps {
  input: string;
  setInput: (val: string) => void;
  onSend: () => void;
  isSending: boolean;
  attachments: ChatAttachment[];
  onRemoveAttachment: (id: string) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesSelected?: (files: File[]) => void;
  onPreviewImage?: (image: { url: string; name: string }) => void;
  isRecordingAudio: boolean;
  recordingDuration: number;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  slashCommands: SlashCommand[];
  placeholder?: string;
  disabled?: boolean;
  focusMode?: string;
  onSelectFocusMode?: (mode: string) => void;
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  isSending,
  attachments,
  onRemoveAttachment,
  onFileUpload,
  onFilesSelected,
  onPreviewImage,
  isRecordingAudio,
  recordingDuration,
  onStartAudioRecording,
  onStopAudioRecording,
  slashCommands,
  placeholder = "Message your agent... (Enter to send, Shift+Enter for newline, / for commands)",
  disabled = false,
  focusMode = "General",
  onSelectFocusMode,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFocusMenu, setShowFocusMenu] = useState(false);
  const focusMenuRef = useRef<HTMLDivElement>(null);

  // Live Speech Recognition (STT) State
  const [isDictating, setIsDictating] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  // Close focus menu on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (focusMenuRef.current && !focusMenuRef.current.contains(e.target as Node)) {
        setShowFocusMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleDictation = () => {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      // Fallback to audio recorder if browser does not support Web Speech API
      if (isRecordingAudio) {
        onStopAudioRecording();
      } else {
        onStartAudioRecording();
      }
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

      const baseText = input.trim();

      recognition.onstart = () => {
        setIsDictating(true);
        toast.info("Listening... Speak naturally to dictate text");
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
        }

        const newText = baseText
          ? `${baseText} ${fullTranscript.trim()}`
          : fullTranscript.trim();

        setInput(newText);
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
      console.error("Speech recognition failed to initialize:", err);
      onStartAudioRecording();
    }
  };

  const showSlashMenu = input.startsWith("/") && input.length <= 15;
  const filteredCommands = slashCommands.filter((c) =>
    c.cmd.toLowerCase().startsWith(input.toLowerCase())
  );

  const [isDragging, setIsDragging] = useState(false);

  // Handle clipboard paste for screenshots, images, and files
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
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

    if (filesToUpload.length > 0 && onFilesSelected) {
      e.preventDefault();
      onFilesSelected(filesToUpload);
    }
  };

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0 && onFilesSelected) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((input.trim() || attachments.length > 0) && !isSending && !disabled) {
        if (isDictating && recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch {
            // ignore
          }
          setIsDictating(false);
        }
        onSend();
      }
    }
  };

  const FOCUS_MODES = [
    { id: "General", label: "General", icon: Sparkles, desc: "Standard reasoning & tools" },
    { id: "Research", label: "Deep Research", icon: Search, desc: "Obsidian Vault RAG & synthesis" },
    { id: "Code", label: "Code Architect", icon: Code2, desc: "Implementation & sandbox" },
    { id: "Swarm", label: "Multi-Agent Swarm", icon: Users, desc: "Roundtable arbitration" },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 pb-3 sm:pb-4 pt-1 relative z-20 shrink-0">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={onFileUpload}
        className="hidden"
      />

      {/* Live Voice Dictation Active Bar */}
      {isDictating && (
        <div className="mb-2 px-3.5 py-1.5 rounded-xl border border-red-500/40 bg-red-950/40 backdrop-blur-md flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2 text-red-300 font-medium">
            <Radio className="w-3.5 h-3.5 animate-spin text-red-400" />
            <span>Voice Dictation Active: Speak now (words will appear in box)...</span>
          </div>
          <button
            type="button"
            onClick={toggleDictation}
            className="px-2 py-0.5 rounded-md bg-red-500/30 text-red-200 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/50 cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* Slash Commands Autocomplete Popover */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-4 sm:left-6 mb-2 w-80 max-h-56 overflow-y-auto p-1.5 rounded-2xl border border-border bg-popover/95 text-popover-foreground backdrop-blur-2xl shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100 z-50">
          <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Available Slash Commands
          </div>
          {filteredCommands.map((c) => (
            <button
              key={c.cmd}
              type="button"
              onClick={() => {
                setInput(c.cmd + " ");
                textareaRef.current?.focus();
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl text-left text-xs hover:bg-secondary text-foreground transition-colors cursor-pointer"
            >
              <div>
                <span className="font-mono font-bold text-foreground">{c.cmd}</span>
                <p className="text-[10.5px] text-muted-foreground truncate">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 max-h-28 overflow-y-auto">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-secondary border border-border text-xs text-foreground animate-in fade-in shadow-xs"
            >
              {att.type === "image" && att.content ? (
                <div
                  onClick={() => onPreviewImage && onPreviewImage({ url: att.content, name: att.name })}
                  className="cursor-pointer hover:opacity-80 transition shrink-0"
                  title="Click to preview image"
                >
                  <img
                    src={att.content}
                    alt={att.name}
                    className="w-4 h-4 rounded object-cover border border-border/80"
                  />
                </div>
              ) : att.type === "image" ? (
                <ImageIcon className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
              ) : att.type === "audio" ? (
                <Music className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
              ) : att.type === "code" ? (
                <FileCode className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
              ) : att.type === "data" ? (
                <FileSpreadsheet className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-foreground/80 shrink-0" />
              )}
              <span
                className={`truncate max-w-[140px] font-medium ${
                  att.type === "image" && att.content ? "cursor-pointer hover:underline" : ""
                }`}
                onClick={() => {
                  if (att.type === "image" && att.content && onPreviewImage) {
                    onPreviewImage({ url: att.content, name: att.name });
                  }
                }}
              >
                {att.name}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                ({(att.size / 1024).toFixed(0)} KB)
              </span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                className="p-0.5 hover:text-red-500 rounded transition-colors ml-1 cursor-pointer"
                title="Remove attachment"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Paperclip Pinned Command Composer */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-2xl border transition-all p-1.5 ${
          isDragging
            ? "border-primary ring-2 ring-primary/40 bg-primary/5"
            : "border-border bg-card shadow-2xs focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20"
        }`}
      >
        {/* Drag and Drop Active Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-30 m-1 rounded-2xl bg-primary/10 border-2 border-dashed border-primary backdrop-blur-xs flex items-center justify-center gap-2 pointer-events-none animate-in fade-in duration-150">
            <Upload className="w-5 h-5 text-primary animate-bounce" />
            <span className="text-xs font-semibold text-primary">Drop files or images here to attach</span>
          </div>
        )}

        <div className="flex items-end gap-2">
          {/* Left Action Buttons: Focus Tag, Attach File & Voice Mic */}
          <div className="flex items-center gap-1 shrink-0 pb-1 pl-1">
            {/* Quick Focus Pill */}
            {onSelectFocusMode && (
              <div className="relative" ref={focusMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowFocusMenu((prev) => !prev)}
                  className="hidden xs:flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-secondary hover:bg-muted-highlight text-foreground text-[11px] font-medium transition-all cursor-pointer shadow-2xs"
                  title="Switch Focus Mode"
                >
                  <Sparkles className="w-3 h-3 text-muted-foreground" />
                  <span className="truncate max-w-[80px] font-mono">{focusMode}</span>
                </button>

                {showFocusMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 p-1.5 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl space-y-1 animate-in fade-in zoom-in-95 duration-100 z-50">
                    <div className="px-2.5 py-1 text-[10px] font-bold font-mono text-muted-foreground uppercase tracking-wider border-b border-border">
                      Focus Modes
                    </div>
                    {FOCUS_MODES.map((mode) => {
                      const Icon = mode.icon;
                      const isSelected = focusMode === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => {
                            onSelectFocusMode(mode.id);
                            setShowFocusMenu(false);
                          }}
                          className={`w-full flex items-center gap-2 p-2 rounded-md text-left text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                              : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium text-xs">{mode.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{mode.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Attach documents, images, code, or data files"
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted-highlight transition-colors cursor-pointer group"
            >
              <Plus className="w-4 h-4 transition-transform group-hover:rotate-90 group-hover:text-primary" />
            </button>

            {/* Voice Dictation Mic */}
            <button
              type="button"
              onClick={toggleDictation}
              title={isDictating ? "Stop voice dictation" : "Click to speak (Live Speech-to-Text)"}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                isDictating
                  ? "bg-red-500/25 text-red-500 ring-1 ring-red-500/40 animate-pulse"
                  : isRecordingAudio
                  ? "bg-amber-500/20 text-amber-500 ring-1 ring-amber-500/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted-highlight"
              }`}
            >
              {isDictating ? (
                <div className="flex items-center gap-1">
                  <Square className="w-3.5 h-3.5 fill-red-500 text-red-500" />
                  <span className="text-[10px] font-mono font-bold text-red-500">Live</span>
                </div>
              ) : isRecordingAudio ? (
                <div className="flex items-center gap-1">
                  <Square className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  <span className="text-[10px] font-mono font-bold">{recordingDuration}s</span>
                </div>
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            placeholder={isDictating ? "Listening... (speak clearly)" : placeholder}
            disabled={disabled}
            rows={1}
            className="flex-1 min-w-0 bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none leading-relaxed py-2 px-1 max-h-36 overflow-y-auto"
          />

          {/* Send Button */}
          <div className="shrink-0 pb-1 pr-1">
            <button
              type="button"
              onClick={onSend}
              disabled={(!input.trim() && attachments.length === 0) || isSending || disabled}
              className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 disabled:opacity-30 disabled:active:scale-100 shadow-2xs transition-all cursor-pointer flex items-center justify-center font-bold"
              title="Send message (Enter)"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary-foreground" />
              ) : (
                <Send className="w-4 h-4 fill-primary-foreground text-primary-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Micro-Hints Bar */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-2 pt-1 font-mono select-none border-t border-border">
          <div className="flex items-center gap-2">
            <span>Type <strong className="text-foreground font-semibold">/</strong> for commands</span>
            <span>•</span>
            <span>Click <strong className="text-foreground font-semibold inline-flex items-center gap-1"><Mic className="w-3 h-3 text-primary" /> Mic</strong> to speak</span>
          </div>
          <span className="hidden sm:inline">Press <strong className="text-foreground font-semibold">Enter ↵</strong> to send</span>
        </div>
      </div>
    </div>
  );
}
