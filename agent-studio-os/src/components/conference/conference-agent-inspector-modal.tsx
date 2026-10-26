"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { AgentAvatar } from "@/components/ui/agent-avatar";

export interface ConferenceAgentItem {
  id: string;
  name: string;
  displayName: string;
  avatar: string;
  role: string;
  department?: string;
  model?: string;
  description?: string;
}

export interface ConferenceAgentInspectorModalProps {
  inspectAgent: ConferenceAgentItem | null;
  orchestratorId?: string;
  onClose: () => void;
  onSetOrchestrator: (agent: ConferenceAgentItem) => void;
}

export function ConferenceAgentInspectorModal({
  inspectAgent,
  orchestratorId,
  onClose,
  onSetOrchestrator,
}: ConferenceAgentInspectorModalProps) {
  return (
    <AnimatePresence>
      {inspectAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md bg-card border border-border rounded-2xl shadow-xl overflow-hidden p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-secondary border border-border flex items-center justify-center shadow-xs">
                  <AgentAvatar avatar={inspectAgent.avatar} className="w-6 h-6 text-primary" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {inspectAgent.displayName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {inspectAgent.role || "Specialist"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inspectAgent.department || "General"}
                    </span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                  Mission Role & Specialty
                </span>
                <p className="text-foreground leading-relaxed bg-secondary/30 p-2.5 rounded-lg border border-border">
                  {inspectAgent.description ||
                    "Active specialist ready for autonomous delegation."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                  <span className="text-[10px] text-muted-foreground block">
                    Model Architecture
                  </span>
                  <span className="font-mono font-semibold text-foreground">
                    {inspectAgent.model || "claude-3-5-sonnet"}
                  </span>
                </div>
                <div className="bg-secondary/30 p-2 rounded-lg border border-border">
                  <span className="text-[10px] text-muted-foreground block">
                    A2A Compatibility
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    Hierarchical Ready
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              {inspectAgent.role === "orchestrator" &&
                inspectAgent.id !== orchestratorId && (
                  <button
                    type="button"
                    onClick={() => onSetOrchestrator(inspectAgent)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-white cursor-pointer transition"
                  >
                    Set as Council Chair
                  </button>
                )}
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer transition"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
