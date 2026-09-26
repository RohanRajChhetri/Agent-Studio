"use client";

import { useState, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  Paperclip,
  Mic,
  Square,
  FileText,
  Image as ImageIcon,
  Music,
  FileCode,
  FileSpreadsheet,
  X,
  Radio,
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
  isRecordingAudio: boolean;
  recordingDuration: number;
  onStartAudioRecording: () => void;
  onStopAudioRecording: () => void;
  slashCommands: SlashCommand[];
  placeholder?: string;
  disabled?: boolean;
}

export function ChatComposer({
  input,
  setInput,
  onSend,
  isSending,
  attachments,
  onRemoveAttachment,
  onFileUpload,
  isRecordingAudio,
  recordingDuration,
  onStartAudioRecording,
  onStopAudioRecording,
  slashCommands,
  placeholder = "Message your agent... (Enter to send, Shift+Enter for newline, / for commands)",
  disabled = false,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        toast.info("🎙️ Listening... Speak naturally to dictate text");
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
      // Fallback to audio recording
      onStartAudioRecording();
    }
  };

  const showSlashMenu = input.startsWith("/") && input.length <= 15;
  const filteredCommands = slashCommands.filter((c) =>
    c.cmd.toLowerCase().startsWith(input.toLowerCase())
  );

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

  return (
    <div className="p-3 sm:p-4 bg-card/80 backdrop-blur-md border-t border-border/80 relative z-10 shrink-0">
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
        <div className="mb-2 px-3 py-1.5 rounded-xl border border-red-500/40 bg-red-500/15 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2 text-red-400 font-medium">
            <Radio className="w-3.5 h-3.5 animate-spin text-red-500" />
            <span>Voice Dictation Active: Speak now (words will appear in box)...</span>
          </div>
          <button
            type="button"
            onClick={toggleDictation}
            className="px-2 py-0.5 rounded-md bg-red-500/30 text-red-200 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/40 cursor-pointer"
          >
            Stop
          </button>
        </div>
      )}

      {/* Slash Commands Autocomplete Popover */}
      {showSlashMenu && filteredCommands.length > 0 && (
        <div className="absolute bottom-full left-4 sm:left-6 mb-2 w-80 max-h-56 overflow-y-auto p-1.5 rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl space-y-0.5 animate-in fade-in zoom-in-95 duration-100 z-50">
          <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
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
              className="w-full flex items-center justify-between p-2 rounded-lg text-left text-xs hover:bg-secondary transition-colors cursor-pointer"
            >
              <div>
                <span className="font-mono font-bold text-primary">{c.cmd}</span>
                <p className="text-[10.5px] text-muted-foreground truncate">{c.desc}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2.5 max-h-28 overflow-y-auto">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 border border-border/80 text-xs text-foreground animate-in fade-in"
            >
              {att.type === "image" ? (
                <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : att.type === "audio" ? (
                <Music className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : att.type === "code" ? (
                <FileCode className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : att.type === "data" ? (
                <FileSpreadsheet className="w-3.5 h-3.5 text-primary shrink-0" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
              )}
              <span className="truncate max-w-[140px] font-medium">{att.name}</span>
              <button
                type="button"
                onClick={() => onRemoveAttachment(att.id)}
                className="p-0.5 hover:text-red-400 rounded transition-colors ml-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div className="flex items-end gap-2 p-1.5 rounded-2xl border border-border/80 bg-secondary/30 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
        {/* Left Action Buttons: Attach File & Voice Dictation Mic */}
        <div className="flex items-center gap-1 shrink-0 pb-1 pl-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach documents, images, code, or data files"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
          >
            <Paperclip className="w-4 h-4" />
          </button>

          {/* Voice Dictation Mic (Instant STT Speech-to-Text) */}
          <button
            type="button"
            onClick={toggleDictation}
            title={isDictating ? "Stop voice dictation" : "Click to speak (Live Speech-to-Text)"}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isDictating
                ? "bg-red-500/25 text-red-400 ring-2 ring-red-500/40 animate-pulse"
                : isRecordingAudio
                ? "bg-amber-500/20 text-amber-400 ring-2 ring-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
            }`}
          >
            {isDictating ? (
              <div className="flex items-center gap-1">
                <Square className="w-3.5 h-3.5 fill-red-400 text-red-400" />
                <span className="text-[10px] font-mono font-bold text-red-400">Live</span>
              </div>
            ) : isRecordingAudio ? (
              <div className="flex items-center gap-1">
                <Square className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
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
            className="p-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 disabled:opacity-40 disabled:hover:bg-primary shadow-sm hover:shadow transition-all cursor-pointer flex items-center justify-center"
            title="Send message (Enter)"
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Footer Hint */}
      <div className="flex items-center justify-between text-[10.5px] text-muted-foreground px-2 pt-1.5 font-mono select-none">
        <span>Click <strong className="text-foreground font-semibold">🎙️ Mic</strong> to speak • <strong className="text-foreground font-semibold">/</strong> for commands</span>
        <span className="hidden sm:inline">Press <strong className="text-foreground font-semibold">Enter ↵</strong> to send</span>
      </div>
    </div>
  );
}
