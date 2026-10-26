"use client";

import { useState } from "react";
import {
  X,
  FolderPlus,
  Sparkles,
  Globe,
  LayoutDashboard,
  FileCode,
  Loader2,
  Layers,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { playClickSound, playTaskCompletedSound } from "@/lib/sound-effects";

interface StudioNewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, template: string) => Promise<void>;
}

const TEMPLATES = [
  {
    id: "webapp",
    name: "Interactive Web App",
    desc: "Pre-configured with Tailwind CSS, clean layouts, and reactive client JS.",
    icon: Globe,
  },
  {
    id: "dashboard",
    name: "Analytics Dashboard",
    desc: "KPI stats cards, interactive charts canvas, and dark mode palette.",
    icon: LayoutDashboard,
  },
  {
    id: "landing",
    name: "SaaS Landing Page",
    desc: "High-conversion hero section, feature cards, and pricing table.",
    icon: Sparkles,
  },
  {
    id: "blank",
    name: "Blank Starter",
    desc: "Minimal index.html and styles.css ready for freeform generation.",
    icon: FileCode,
  },
];

export function StudioNewProjectModal({
  isOpen,
  onClose,
  onCreateProject,
}: StudioNewProjectModalProps) {
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("webapp");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = projectName.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-");
    if (!clean) {
      toast.error("Please enter a valid project name");
      return;
    }

    setIsSubmitting(true);
    playClickSound();

    try {
      await onCreateProject(clean, selectedTemplate);
      playTaskCompletedSound();
      toast.success(`Project "${clean}" created successfully!`);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4.5 h-4.5 text-[var(--primary)]" />
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Create New Project
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11.5px] font-medium text-[var(--muted-foreground)] block mb-1.5">
              Project Name (kebab-case)
            </label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. edtech-platform, crypto-analytics, ai-copilot"
              className="w-full bg-[var(--background)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl text-xs font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition"
              autoFocus
            />
          </div>

          <div>
            <label className="text-[11.5px] font-medium text-[var(--muted-foreground)] block mb-1.5">
              Starter Template
            </label>
            <div className="space-y-1.5">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? "border-[var(--primary)] bg-[var(--primary)]/5 text-[var(--foreground)]"
                        : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:border-[var(--border)]/80"
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? "bg-[var(--primary)] text-white shadow-xs"
                          : "bg-[var(--accent)] text-[var(--muted-foreground)]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-tight">
                        {tmpl.name}
                      </div>
                      <div className="text-[10.5px] text-[var(--muted-foreground)] truncate mt-0.5">
                        {tmpl.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-xs font-medium hover:bg-[var(--muted)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !projectName.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-xs font-medium hover:opacity-90 transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Create Project</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
