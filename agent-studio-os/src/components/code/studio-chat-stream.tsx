"use client";

import { useRef, useEffect, useState } from "react";
import {
  Bot,
  User,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Loader2,
  FileCode,
  Package,
  Layers,
  Zap,
  ArrowRight,
  Code,
  Smartphone,
  FlaskConical,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import type { CodeMessage } from "@/context/project-builder-context";
import { StudioInputCard } from "./studio-input-card";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";

interface StudioChatStreamProps {
  messages: CodeMessage[];
  isGenerating: boolean;
  prompt: string;
  onChangePrompt: (text: string) => void;
  onSubmit: (e?: React.FormEvent, customPrompt?: string) => void;
  selectedProject: string;
  projects: WorkspaceProjectInfo[];
  onSelectProject: (name: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  selectedPersona?: string;
  onSelectPersona?: (persona: string) => void;
  onOpenBuiltInIde: () => void;
}

export function StudioChatStream({
  messages,
  isGenerating,
  prompt,
  onChangePrompt,
  onSubmit,
  selectedProject,
  projects,
  onSelectProject,
  selectedModel,
  onSelectModel,
  selectedPersona,
  onSelectPersona,
  onOpenBuiltInIde,
}: StudioChatStreamProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
  };

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  // Clean conversational text parser: strips raw code blocks so chat stays conversation-focused
  const parseConversationalContent = (rawContent: string) => {
    if (!rawContent) return "";
    let normalized = rawContent.trim();
    // Auto-close any unclosed code block if truncated or missing closing fence
    const tickCount = (normalized.match(/```/g) || []).length;
    if (tickCount % 2 !== 0) {
      normalized += "\n```";
    }
    // Remove all code blocks (regardless of language tag, colon, path, or whitespace)
    let cleaned = normalized.replace(/```[\s\S]*?```/g, "");
    // Remove dangling file headers that immediately preceded code blocks (e.g. "### File: index.html" or "**styles.css**:")
    cleaned = cleaned.replace(/(?:###?\s*(?:File:\s*|Filename:\s*)?`?[a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+`?|\*\*(?:File:\s*)?[a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+\*\*:?|(?:File|Filename):\s*`?[a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+`?)\s*$/gm, "");
    cleaned = cleaned.trim();
    return cleaned || "I've generated the updated files and compiled them into the live product canvas.";
  };

  // Quick follow-up chip suggestions
  const FOLLOW_UP_PROMPTS = [
    { label: "Polish UI", icon: Sparkles, prompt: "Elevate the styling with smoother gradients, modern typography, and glassmorphism cards." },
    { label: "Check Mobile", icon: Smartphone, prompt: "Ensure all sections stack responsively on mobile and touch targets are easy to tap." },
    { label: "Add Animations", icon: Zap, prompt: "Add subtle micro-interactions, button hover states, and smooth spring reveals." },
    { label: "Add Test Data", icon: FlaskConical, prompt: "Populate the components with realistic mock data and interactive state." },
  ];

  return (
    <div className="flex-1 min-w-0 flex flex-col h-full bg-[var(--background)] overflow-hidden relative">
      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-6 scrollbar-none"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Welcoming state when conversation is empty for this project */}
          {messages.length === 0 && !isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs space-y-4 text-center my-6"
            >
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">
                  Project &ldquo;{selectedProject}&rdquo; Loaded
                </h3>
                <p className="text-xs text-[var(--muted-foreground)] max-w-sm mx-auto leading-relaxed">
                  The live product canvas on the right reflects your current project. Ask anything below to add features, adjust layout, or style components.
                </p>
              </div>
              <div className="pt-2 flex flex-wrap justify-center gap-2 max-w-md mx-auto">
                {FOLLOW_UP_PROMPTS.map((chip) => {
                  const ChipIcon = chip.icon;
                  return (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => onSubmit(undefined, chip.prompt)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--accent)] text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer hover:border-[var(--primary)]/40"
                    >
                      <ChipIcon className="w-3 h-3 text-[var(--primary)] shrink-0" />
                      <span>{chip.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === "user";
            const isExpanded = expandedThinking[msg.id] ?? false;
            const conversationText = isUser ? msg.content : parseConversationalContent(msg.content);
            const createdFiles = msg.createdFiles || [];

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-2"
              >
                {/* Message Header */}
                <div className="flex items-center gap-2 select-none">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isUser
                        ? "bg-[var(--accent)] text-[var(--foreground)]"
                        : "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                    }`}
                  >
                    {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[12.5px] font-semibold text-[var(--foreground)]">
                    {isUser ? "You" : "Main Agent"}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--muted-foreground)]">
                    {msg.createdAt
                      ? new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>

                {/* Message Body */}
                <div
                  className={`pl-8 pr-1 space-y-3 ${
                    isUser
                      ? "text-[14px] text-[var(--foreground)] font-normal leading-relaxed"
                      : "text-[13.5px] text-[var(--foreground)]/90 leading-relaxed"
                  }`}
                >
                  {isUser ? (
                    <div className="p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xs">
                      {msg.content}
                    </div>
                  ) : (
                    <>
                      {/* High-Level Product Milestones / Files Badge (Instead of raw code dump) */}
                      {createdFiles.length > 0 && (
                        <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-2">
                          <div className="flex items-center justify-between text-xs font-medium text-[var(--foreground)]">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Product Updated ({createdFiles.length} files modified)</span>
                            </div>
                            <button
                              type="button"
                              onClick={onOpenBuiltInIde}
                              className="text-[11px] text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <Code className="w-3 h-3" />
                              <span>Inspect in IDE</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {createdFiles.map((f) => (
                              <div
                                key={f.path}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--accent)] text-[11px] font-mono text-[var(--foreground)]"
                              >
                                <FileCode className="w-3 h-3 text-[var(--primary)]" />
                                <span>{f.path}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conversational Explanation */}
                      <div className="prose dark:prose-invert max-w-none text-[13.5px] leading-relaxed">
                        <MarkdownRenderer content={conversationText} />
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Active Generation Ticker */}
          {isGenerating && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="pl-8 space-y-2"
            >
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-[var(--card)] border border-[var(--primary)]/30 shadow-md">
                <Loader2 className="w-4 h-4 text-[var(--primary)] animate-spin shrink-0" />
                <div className="text-xs text-[var(--foreground)] flex-1 min-w-0">
                  <span className="font-semibold text-[var(--primary)] mr-1.5">Developing product...</span>
                  <span className="text-[var(--muted-foreground)]">
                    Scaffolding components, styling design system, and updating sandbox
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Quick Follow-up Suggestions when idle */}
          {!isGenerating && messages.length > 0 && (
            <div className="pl-8 pt-2 flex flex-wrap gap-2">
              {FOLLOW_UP_PROMPTS.map((chip) => {
                const ChipIcon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => onSubmit(undefined, chip.prompt)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)] hover:bg-[var(--accent)] text-[11px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer hover:border-[var(--primary)]/30"
                  >
                    <ChipIcon className="w-3 h-3 text-[var(--primary)] shrink-0" />
                    <span>{chip.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Docked Antigravity Floating Input at Bottom */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--card)]/60 backdrop-blur-md shrink-0">
        <StudioInputCard
          prompt={prompt}
          onChangePrompt={onChangePrompt}
          onSubmit={onSubmit}
          isGenerating={isGenerating}
          selectedProject={selectedProject}
          projects={projects}
          onSelectProject={onSelectProject}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          selectedPersona={selectedPersona}
          onSelectPersona={onSelectPersona}
          isFloatingCentered={false}
        />
      </div>
    </div>
  );
}
