"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FolderPlus, X, Sparkles, Layout, BarChart3, FileCode, Check } from "lucide-react";

export type ProjectTemplateType = "webapp" | "dashboard" | "blank";

interface ProjectTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (name: string, template: ProjectTemplateType) => Promise<void>;
}

export function ProjectTemplatesModal({
  isOpen,
  onClose,
  onCreateProject,
}: ProjectTemplatesModalProps) {
  const [projectName, setProjectName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTemplateType>("webapp");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = projectName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    if (!clean) return;

    setIsSubmitting(true);
    try {
      await onCreateProject(clean, selectedTemplate);
      setProjectName("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const TEMPLATES: Array<{
    id: ProjectTemplateType;
    title: string;
    description: string;
    icon: typeof Layout;
    badge: string;
  }> = [
    {
      id: "webapp",
      title: "Interactive Web App",
      description: "Tailwind CSS CDN, dark glass hero, toast notification system, and interactive JS app logic.",
      icon: Layout,
      badge: "Recommended",
    },
    {
      id: "dashboard",
      title: "SaaS Analytics Dashboard",
      description: "Interactive HTML5 Canvas chart stream, metric KPI cards, dark-mode SaaS UI, and live simulation.",
      icon: BarChart3,
      badge: "Popular",
    },
    {
      id: "blank",
      title: "Blank Project",
      description: "Clean slate with starter index.html and README.md. Ideal for custom prompts and scratch builds.",
      icon: FileCode,
      badge: "Minimal",
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-lg p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl space-y-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-500">
              <FolderPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-[var(--foreground)]">New Project Workspace</h3>
              <p className="text-[12px] text-[var(--muted-foreground)]">Select a starter template to scaffold instantly</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] rounded-lg hover:bg-[var(--muted)] cursor-pointer transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-[var(--muted-foreground)] block mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. crypto-tracker, ai-portfolio, chat-widget"
              className="w-full bg-[var(--background)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl text-[13px] font-mono text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 focus:shadow-sm transition"
              autoFocus
              required
            />
            <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
              Path: <code className="text-[var(--primary)] font-mono text-[10.5px]">agent-workspace/{projectName.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "my-project"}</code>
            </p>
          </div>

          <div>
            <label className="text-[12px] font-medium text-[var(--muted-foreground)] block mb-2">
              Choose Starter Template
            </label>
            <div className="grid grid-cols-1 gap-2.5">
              {TEMPLATES.map((tmpl) => {
                const Icon = tmpl.icon;
                const isSelected = selectedTemplate === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[var(--primary)]/5 border-[var(--primary)] text-[var(--foreground)] shadow-sm"
                        : "bg-[var(--background)]/50 border-[var(--border)] hover:border-[var(--border)]/80 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${isSelected ? "bg-[var(--primary)] text-white" : "bg-[var(--muted)] text-[var(--muted-foreground)]"}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[13px] text-[var(--foreground)]">{tmpl.title}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          isSelected ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold" : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        }`}>
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--muted-foreground)] mt-0.5 leading-relaxed">
                        {tmpl.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border)] text-[12.5px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)] transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !projectName.trim()}
              className="px-4 py-2 rounded-xl bg-[var(--primary)] text-white text-[12.5px] font-medium hover:opacity-90 disabled:opacity-40 transition cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Create Workspace</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
