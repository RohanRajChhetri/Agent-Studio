"use client";

import { useState, useRef, useEffect } from "react";
import {
  Folder,
  ChevronDown,
  Plus,
  Mic,
  MicOff,
  ArrowRight,
  Sparkles,
  Bot,
  Layers,
  Paperclip,
  Check,
  FileCode,
  Globe,
  SlidersHorizontal,
  Zap,
  Rocket,
  Brain,
  Search,
  Palette,
  ShieldCheck,
  Database,
  LayoutTemplate,
  BarChart3,
  Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { WorkspaceProjectInfo } from "@/lib/project-filesystem";
import { playClickSound } from "@/lib/sound-effects";

interface StudioInputCardProps {
  prompt: string;
  onChangePrompt: (text: string) => void;
  onSubmit: (e?: React.FormEvent, customPrompt?: string) => void;
  isGenerating: boolean;
  selectedProject: string;
  projects: WorkspaceProjectInfo[];
  onSelectProject: (name: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  selectedPersona?: string;
  onSelectPersona?: (persona: string) => void;
  isFloatingCentered?: boolean;
}

export const AVAILABLE_MODELS = [
  { id: "gemini-3.6-flash", label: "Gemini 3.8 Flash (High)", desc: "Ultra-fast multimodal coder", icon: Zap },
  { id: "gemini-2.0-flash-exp", label: "Gemini 2.5 Flash / Fast", desc: "Native audio & code reasoning", icon: Rocket },
  { id: "claude-3-7-sonnet", label: "Claude 3.7 Sonnet", desc: "Top-tier fullstack software architect", icon: Brain },
  { id: "gpt-4o", label: "GPT-4o (Omni)", desc: "High reliability balanced coder", icon: Sparkles },
  { id: "deepseek-r1", label: "DeepSeek R1 Distill", desc: "Deep multi-step reasoning", icon: Search },
];

export const AVAILABLE_PERSONAS = [
  {
    id: "main",
    label: "Lead Architect",
    shortLabel: "Lead Architect",
    desc: "Full-stack architecture & balanced end-to-end solutions",
    icon: Brain,
  },
  {
    id: "uiux",
    label: "UI/UX & Design",
    shortLabel: "UI/UX Designer",
    desc: "Stunning aesthetics, CSS styling, glassmorphism & micro-animations",
    icon: Palette,
  },
  {
    id: "fast",
    label: "Rapid Coder",
    shortLabel: "Rapid Coder",
    desc: "High-speed prototype delivery & direct scripts",
    icon: Zap,
  },
  {
    id: "qa",
    label: "QA & Auditor",
    shortLabel: "QA Auditor",
    desc: "Defensive validation, edge-case coverage & resilience",
    icon: ShieldCheck,
  },
  {
    id: "backend",
    label: "API & Data",
    shortLabel: "API & Data",
    desc: "Data models, state logic, schemas & mock APIs",
    icon: Database,
  },
];

export function StudioInputCard({
  prompt,
  onChangePrompt,
  onSubmit,
  isGenerating,
  selectedProject,
  projects,
  onSelectProject,
  selectedModel,
  onSelectModel,
  selectedPersona = "main",
  onSelectPersona,
  isFloatingCentered = true,
}: StudioInputCardProps) {
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showPersonaPicker, setShowPersonaPicker] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const personaPickerRef = useRef<HTMLDivElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [prompt]);

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (projectPickerRef.current && !projectPickerRef.current.contains(target)) {
        setShowProjectPicker(false);
      }
      if (modelPickerRef.current && !modelPickerRef.current.contains(target)) {
        setShowModelPicker(false);
      }
      if (personaPickerRef.current && !personaPickerRef.current.contains(target)) {
        setShowPersonaPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Web Speech API for voice dictation
  const toggleVoice = () => {
    playClickSound();
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
      alert("Voice input is not supported in this browser. Use Chrome or Edge.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = () => setIsListening(false);

      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          onChangePrompt(prompt ? `${prompt} ${transcript}` : transcript);
        }
      };

      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const currentModelMeta = AVAILABLE_MODELS.find((m) => m.id === selectedModel) || AVAILABLE_MODELS[0];
  const currentPersonaMeta =
    AVAILABLE_PERSONAS.find(
      (p) => p.id === selectedPersona || (selectedPersona === "default" && p.id === "main")
    ) || AVAILABLE_PERSONAS[0];

  const PersonaIcon = currentPersonaMeta.icon;

  return (
    <div
      className={`w-full max-w-2xl mx-auto flex flex-col items-center gap-3 transition-all ${
        isFloatingCentered ? "my-auto py-12" : "py-2"
      }`}
    >
      {/* ─── SELECT PROJECT PILL (Centered Empty State) ─── */}
      {isFloatingCentered && (
        <div className="flex flex-col items-center gap-1.5 relative" ref={projectPickerRef}>
          <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
            Select Workspace Project (Ctrl+.)
          </span>

          <button
            type="button"
            onClick={() => {
              playClickSound();
              setShowProjectPicker((prev) => !prev);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--card)] hover:bg-[var(--accent)] border border-[var(--border)] text-sm font-semibold text-[var(--foreground)] transition cursor-pointer shadow-sm hover:border-[var(--primary)]/50 group"
          >
            <Folder className="w-4 h-4 text-[var(--primary)] group-hover:scale-110 transition-transform" />
            <span className="truncate max-w-[240px]">{selectedProject || "workspace"}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
          </button>

          <AnimatePresence>
            {showProjectPicker && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.96 }}
                className="absolute top-full mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-2xl z-50 space-y-1 text-left"
              >
                <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)] flex items-center justify-between">
                  <span>Workspace Projects</span>
                  <span>{projects.length}</span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-none">
                  {projects.map((proj) => (
                    <button
                      key={proj.name}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onSelectProject(proj.name);
                        setShowProjectPicker(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition cursor-pointer ${
                        proj.name === selectedProject
                          ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                          : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Folder className="w-3.5 h-3.5 shrink-0 opacity-70" />
                        <span className="truncate">{proj.name}</span>
                      </div>
                      {proj.name === selectedProject && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ─── PRIMARY COMPOSER INPUT CHASSIS ─── */}
      <div className="w-full rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl hover:border-[var(--primary)]/40 transition-all flex flex-col p-3 focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--primary)]/15">
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => onChangePrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSubmit(e);
            }
          }}
          placeholder="Ask the AI agent to build a product, add features, style UI, or refactor code..."
          rows={isFloatingCentered ? 3 : 2}
          disabled={isGenerating}
          className="w-full bg-transparent resize-none outline-none text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] leading-relaxed px-1 scrollbar-none"
        />

        {/* ─── BOTTOM CONTROLS ROW ─── */}
        <div className="flex items-center justify-between pt-2.5 mt-1 border-t border-[var(--border)]/40">
          {/* Left Controls: Model & Active Persona Switchers */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Model Selector Pill */}
            <div className="relative" ref={modelPickerRef}>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setShowModelPicker((prev) => !prev);
                  setShowPersonaPicker(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer border border-transparent hover:border-[var(--border)]"
                title="Select Intelligence Model"
              >
                <currentModelMeta.icon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                <span className="text-[12px]">{currentModelMeta.label}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              <AnimatePresence>
                {showModelPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.96 }}
                    className="absolute bottom-full mb-1.5 left-0 w-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl z-50 space-y-0.5 text-left"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                      Intelligence Model
                    </div>
                    {AVAILABLE_MODELS.map((m) => {
                      const ModelIcon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            onSelectModel(m.id);
                            setShowModelPicker(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                            m.id === selectedModel
                              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                              : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <ModelIcon className="w-4 h-4 text-[var(--primary)] shrink-0" />
                            <div className="truncate text-left">
                              <div className="truncate text-[12px] font-medium leading-none mb-0.5">
                                {m.label}
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {m.desc}
                              </div>
                            </div>
                          </div>
                          {m.id === selectedModel && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Persona Selector Pill */}
            <div className="relative" ref={personaPickerRef}>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setShowPersonaPicker((prev) => !prev);
                  setShowModelPicker(false);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[var(--accent)] text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer border border-transparent hover:border-[var(--border)]"
                title="Select Autonomous Agent Persona"
              >
                <PersonaIcon className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="text-[12px]">{currentPersonaMeta.shortLabel}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>

              <AnimatePresence>
                {showPersonaPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 4, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 2, scale: 0.96 }}
                    className="absolute bottom-full mb-1.5 left-0 w-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-1.5 shadow-2xl z-50 space-y-0.5 text-left"
                  >
                    <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--muted-foreground)]">
                      Active Agent Persona
                    </div>
                    {AVAILABLE_PERSONAS.map((p) => {
                      const Icon = p.icon;
                      const isSelected =
                        p.id === selectedPersona || (selectedPersona === "default" && p.id === "main");
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onSelectPersona?.(p.id);
                            setShowPersonaPicker(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition cursor-pointer ${
                            isSelected
                              ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                              : "text-[var(--foreground)] hover:bg-[var(--accent)]"
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <Icon className="w-4 h-4 text-amber-500 shrink-0" />
                            <div className="truncate text-left">
                              <div className="truncate text-[12px] font-medium leading-none mb-0.5">
                                {p.label}
                              </div>
                              <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                                {p.desc}
                              </div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Controls: Microphone & Submit */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={toggleVoice}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                isListening
                  ? "bg-rose-500/20 text-rose-400 animate-pulse"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--accent)]"
              }`}
              title={isListening ? "Listening... (click to stop)" : "Voice dictation"}
            >
              {isListening ? <MicOff className="w-4 h-4 text-rose-400" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={(e) => onSubmit(e)}
              disabled={!prompt.trim() || isGenerating}
              className={`p-2 rounded-xl transition cursor-pointer ${
                prompt.trim() && !isGenerating
                  ? "bg-[var(--primary)] text-white hover:bg-[var(--primary)]/90 shadow-md hover:scale-105 active:scale-95"
                  : "bg-[var(--accent)] text-[var(--muted-foreground)] opacity-50 cursor-not-allowed"
              }`}
              title="Submit prompt (Enter)"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── STATUS / KEYBOARD HINT FOOTER ─── */}
      <div className="w-full flex items-center justify-between px-2 text-[11px] text-[var(--muted-foreground)] select-none">
        <div className="flex items-center gap-1.5">
          <PersonaIcon className="w-3 h-3 text-amber-500" />
          <span className="font-mono text-[11px]">Role: {currentPersonaMeta.label}</span>
        </div>
        <div className="font-mono text-[10px] opacity-70">
          Enter ↵ to generate • Shift+Enter for newline
        </div>
      </div>

      {/* ─── QUICK STARTER SUGGESTIONS (Empty State only) ─── */}
      {isFloatingCentered && (
        <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-4">
          {[
            {
              label: "Landing Page",
              icon: LayoutTemplate,
              prompt: "Build a sleek SaaS landing page with hero, features grid, pricing tier cards, and FAQ accordion.",
            },
            {
              label: "Analytics Dashboard",
              icon: BarChart3,
              prompt: "Create a modern real-time performance analytics dashboard with interactive charts, KPI metrics, and data filters.",
            },
            {
              label: "Admin Portal",
              icon: ShieldCheck,
              prompt: "Scaffold a full admin portal with user management table, search, modal editor, and activity feed.",
            },
            {
              label: "Mobile App UI",
              icon: Smartphone,
              prompt: "Design a mobile-first responsive web app interface with bottom navigation tabs and fluid gesture cards.",
            },
          ].map((chip) => {
            const ChipIcon = chip.icon;
            return (
              <button
                key={chip.label}
                type="button"
                onClick={() => {
                  playClickSound();
                  onChangePrompt(chip.prompt);
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--card)]/80 hover:bg-[var(--accent)] text-[11.5px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer hover:border-[var(--primary)]/30"
              >
                <ChipIcon className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />
                <span>{chip.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
