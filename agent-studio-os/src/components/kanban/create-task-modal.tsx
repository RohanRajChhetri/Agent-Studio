"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Plus,
  Bot,
  Calendar,
  AlertCircle,
  Loader2,
  Sparkles,
} from "lucide-react";
import type { AgentProfile } from "@/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (taskData: {
    title: string;
    description: string;
    priority: "low" | "medium" | "high" | "urgent";
    assigned_agent: string | null;
    due_date: string | null;
    status: string;
  }) => Promise<void> | void;
  agents: AgentProfile[];
  initialStatus?: string;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onCreate,
  agents,
  initialStatus = "backlog",
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState<string>("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        priority,
        assigned_agent: assignedAgent,
        due_date: dueDate || null,
        status: status || initialStatus,
      });
      // Reset form
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssignedAgent(null);
      setDueDate("");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create task");
    } finally {
      setIsSubmitting(false);
    }
  };

  const priorityOptions: Array<{ id: "low" | "medium" | "high" | "urgent"; label: string; color: string }> = [
    { id: "low", label: "Low", color: "text-slate-900 bg-slate-100 border-slate-300 dark:text-slate-200 dark:bg-slate-800/80 dark:border-slate-700" },
    { id: "medium", label: "Medium", color: "text-blue-950 bg-blue-100 border-blue-300 dark:text-blue-200 dark:bg-blue-950/70 dark:border-blue-700" },
    { id: "high", label: "High", color: "text-amber-950 bg-amber-100 border-amber-300 dark:text-amber-200 dark:bg-amber-950/70 dark:border-amber-700" },
    { id: "urgent", label: "Urgent", color: "text-rose-950 bg-rose-100 border-rose-300 dark:text-rose-200 dark:bg-rose-950/70 dark:border-rose-700" },
  ];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-background/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 overflow-hidden z-10"
        >
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Create New Task</h3>
                <p className="text-xs text-muted-foreground">Define a goal for an agent specialist to execute</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Task Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Conduct competitive pricing research for Q3..."
                autoFocus
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
              />
            </div>

            {/* Description / Instructions */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Objective & Instructions
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Provide detailed instructions or success criteria for the executing agent..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition resize-none"
              />
            </div>

            {/* Assign Specialist Agent */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Assign Specialist Agent
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setAssignedAgent("auto")}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition text-left cursor-pointer ${
                    assignedAgent === "auto"
                      ? "bg-[#e6f3fe] border-[#0075de]/40 text-[#0075de] font-semibold"
                      : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#0075de]" />
                  <span className="truncate">Auto-Assign</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAssignedAgent(null)}
                  className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition text-left cursor-pointer ${
                    assignedAgent === null
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  <Bot className="w-3.5 h-3.5 opacity-60" />
                  <span className="truncate">Unassigned</span>
                </button>
                {agents.map((agent) => {
                  const isSelected = assignedAgent === agent.id;
                  return (
                    <button
                      type="button"
                      key={agent.id}
                      onClick={() => setAssignedAgent(agent.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition text-left ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary"
                          : "bg-secondary/40 border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span className="text-sm">{agent.avatar || "🤖"}</span>
                      <span className="truncate">{agent.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Priority Level */}
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Priority Level
              </label>
              <div className="grid grid-cols-4 gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPriority(opt.id)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-medium border text-center transition cursor-pointer whitespace-nowrap ${
                      priority === opt.id
                        ? opt.color + " ring-1 ring-primary/40 font-semibold shadow-xs"
                        : "border-border text-muted-foreground hover:bg-secondary hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Due Date and Column */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Due Date (Optional)
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition"
                  />
                  <Calendar className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                  Target Board Column
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition cursor-pointer"
                >
                  <option value="backlog">Backlog</option>
                  <option value="in_progress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border mt-6">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !title.trim()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition shadow-lg shadow-primary/20"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    <span>Create Task</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
