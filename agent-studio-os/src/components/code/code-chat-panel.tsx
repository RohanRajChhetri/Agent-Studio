"use client";

import { useRef, useEffect } from "react";
import {
  Sparkles,
  ArrowRight,
  Loader2,
  Bot,
  User,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Layers,
} from "lucide-react";
import type { CodeMessage } from "@/context/project-builder-context";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";

interface CodeChatPanelProps {
  messages: CodeMessage[];
  prompt: string;
  onChangePrompt: (val: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isGenerating: boolean;
  selectedProject: string;
  onPreviewFile?: (path: string) => void;
  chips?: Array<{ label: string; prompt: string }>;
}

export function CodeChatPanel({
  messages,
  prompt,
  onChangePrompt,
  onSubmit,
  isGenerating,
  selectedProject,
  onPreviewFile,
  chips = [
    { label: "✨ Enhance Design", prompt: "Polish the UI with modern gradients, smooth micro-interactions, and responsive layout" },
    { label: "⚡ Add Features", prompt: "Add interactive state management, local storage persistence, and sound feedback" },
    { label: "🛡️ Fix Bugs", prompt: "Review the code for edge conditions, unhandled exceptions, and console warnings" },
  ],
}: CodeChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  return (
    <div className="w-80 lg:w-96 border-r border-border bg-card/40 backdrop-blur-xs flex flex-col shrink-0 min-h-0 select-none">
      {/* Panel Header */}
      <div className="h-10 px-4 border-b border-border/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">AI Code Studio</span>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-mono">
          {messages.length} {messages.length === 1 ? "turn" : "turns"}
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3.5">
        {messages.length === 0 ? (
          <div className="py-3 px-1 space-y-3.5">
            <div className="text-center space-y-1.5">
              <div className="w-10 h-10 mx-auto rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Autonomous Project Architect
                </h4>
                <p className="text-[11.5px] text-muted-foreground mt-0.5">
                  Select a starter preset or describe your requirements below.
                </p>
              </div>
            </div>

            {/* Starter Architecture Presets */}
            <div className="space-y-1.5 pt-1">
              {[
                {
                  icon: "🌐",
                  title: "Modern Web Application",
                  desc: "Interactive HTML5/Tailwind app with state & dark mode",
                  prompt: "Build an interactive single-page application with modern Tailwind CSS styling, dark/light theme toggle, responsive layout, and smooth animations.",
                },
                {
                  icon: "⚛️",
                  title: "React Component App",
                  desc: "React UI with interactive state hooks & data cards",
                  prompt: "Create a modern React component application with interactive state hooks, animated cards, search filtering, and local storage persistence.",
                },
                {
                  icon: "🐍",
                  title: "Python Automation Tool",
                  desc: "Python CLI script with args & data processing",
                  prompt: "Build a modular Python automation tool with command-line arguments, structured data processing, error handling, and clean terminal feedback.",
                },
                {
                  icon: "🚀",
                  title: "Node.js REST API",
                  desc: "Full backend API service with mock database",
                  prompt: "Build a Node.js REST API service with clean modular routing, CRUD endpoints, request validation, and an in-memory JSON mock database.",
                },
                {
                  icon: "🎮",
                  title: "Canvas Arcade Game",
                  desc: "Retro game with keyboard controls & scorekeeper",
                  prompt: "Build a complete retro arcade game on HTML5 Canvas with keyboard controls, sound effects, particle effects, and high-score tracking.",
                },
              ].map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChangePrompt(preset.prompt);
                    textareaRef.current?.focus();
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-xl border border-border/80 bg-card hover:border-primary/40 hover:bg-secondary/40 text-left transition cursor-pointer group shadow-2xs"
                >
                  <span className="text-lg shrink-0 mt-0.5">{preset.icon}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {preset.title}
                    </div>
                    <div className="text-[10.5px] text-muted-foreground leading-tight truncate">
                      {preset.desc}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-xs shadow-xs ${
                    isUser
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary border border-border text-primary"
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed space-y-2 select-text ${
                    isUser
                      ? "bg-primary text-primary-foreground font-medium rounded-tr-xs"
                      : "bg-secondary/70 border border-border text-foreground rounded-tl-xs shadow-xs"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="space-y-2">
                      <MarkdownRenderer content={msg.content} />
                    </div>
                  )}

                  {/* Generated files pill list */}
                  {!isUser && ((msg.createdFiles && msg.createdFiles.length > 0) || ((msg as any).metadata?.files && (msg as any).metadata.files.length > 0)) && (
                    <div className="pt-2 border-t border-border/50 space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Updated Files:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(msg.createdFiles || (msg as any).metadata?.files || []).map((f: any) => {
                          const pathStr = typeof f === "string" ? f : f.path;
                          return (
                            <button
                              key={pathStr}
                              type="button"
                              onClick={() => onPreviewFile?.(pathStr)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-card border border-border/80 text-[11px] font-mono hover:border-primary transition cursor-pointer"
                            >
                              <FileCode className="w-3 h-3 text-primary" />
                              <span>{pathStr}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Animated Generation Step Card */}
        {isGenerating && (
          <div className="flex gap-2.5 animate-in fade-in duration-200">
            <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
            <div className="max-w-[85%] rounded-2xl p-3 bg-secondary/60 border border-border text-xs space-y-2 shadow-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span>Autonomous Agent Synthesizing</span>
              </div>
              <div className="space-y-1.5 text-muted-foreground text-[11.5px]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Parsed project context & requirements</span>
                </div>
                <div className="flex items-center gap-2 text-foreground font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  <span>Synthesizing code & patching file buffers...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Input Area */}
      <div className="p-3 border-t border-border bg-card/80 shrink-0 space-y-2">
        {/* Suggestion Prompt Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {chips.map((chip, i) => (
            <button
              key={i}
              type="button"
              disabled={isGenerating}
              onClick={() => {
                onChangePrompt(chip.prompt);
                textareaRef.current?.focus();
              }}
              className="px-2 py-0.5 rounded-full bg-secondary hover:bg-primary/10 hover:text-primary text-[10.5px] font-medium whitespace-nowrap transition cursor-pointer shrink-0 disabled:opacity-40"
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Prompt Input Form */}
        <form onSubmit={onSubmit} className="relative">
          <div className="relative flex items-end bg-background border border-border rounded-2xl focus-within:border-primary/60 focus-within:shadow-xs transition">
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(e) => onChangePrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e as any);
                }
              }}
              placeholder="Ask agent to generate code or modify files..."
              disabled={isGenerating}
              rows={1}
              className="flex-1 bg-transparent px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground outline-none resize-none min-h-[42px] max-h-[120px] leading-relaxed font-sans"
            />
            <div className="p-1.5">
              <button
                type="submit"
                disabled={isGenerating || !prompt.trim()}
                className="p-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-30 transition cursor-pointer flex items-center justify-center shrink-0 shadow-xs"
                title="Send Prompt (Enter)"
              >
                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
