"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Terminal, Globe } from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface AgentSpecsModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: AgentProfile | null;
  model: string;
  onOpenTerminal: () => void;
}

export function AgentSpecsModal({
  isOpen,
  onClose,
  agent,
  model,
  onOpenTerminal,
}: AgentSpecsModalProps) {
  if (!isOpen || !agent) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-xl bg-card border border-border rounded-lg p-6 shadow-2xl overflow-hidden space-y-4 max-h-[85vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-start justify-between shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl border shrink-0"
                style={{
                  borderColor: `${agent.themeColor || "#6366f1"}40`,
                  backgroundColor: `${agent.themeColor || "#6366f1"}15`,
                }}
              >
                <AgentAvatar avatar={agent.avatar} className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground truncate">
                    {agent.displayName}
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-medium shrink-0">
                    {agent.status || "online"}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                  <span className="capitalize text-primary font-medium">
                    {agent.role || "specialist"}
                  </span>
                  {agent.department && <span>• {agent.department}</span>}
                  <span className="font-mono text-[11px] text-muted-foreground">
                    • {agent.model || model}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-all shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {agent.description && (
              <p className="text-xs text-muted-foreground leading-relaxed bg-secondary/60 p-3 rounded-xl border border-border">
                {agent.description}
              </p>
            )}

            {/* System Prompt Section */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  System Directives & Persona
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(agent.systemPrompt || "");
                    toast.success("System prompt copied to clipboard");
                  }}
                  className="text-[11px] text-foreground hover:text-foreground flex items-center gap-1 font-mono transition-colors cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Directives</span>
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto p-3.5 rounded-xl bg-secondary/80 border border-border font-mono text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed selection:bg-primary/30 text-primary">
                {agent.systemPrompt ||
                  "No custom system prompt specified (agent utilizes baseline autonomous reasoning instructions)."}
              </div>
            </div>

            {/* Active Toolsets & Integrations */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Enabled Toolsets & Integrations
              </span>
              <div className="flex flex-wrap gap-2">
                {(agent.tools?.filter((t) => t.enabled) || []).map((t) => (
                  <span
                    key={t.id || t.toolId}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-card border border-border text-foreground flex items-center gap-1.5"
                  >
                    <Terminal className="w-3 h-3 text-foreground" />
                    <span>{t.toolId}</span>
                  </span>
                ))}
                {(agent.integrations?.filter((i) => i.enabled) || []).map((i) => (
                  <span
                    key={i.id || i.platform}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-emerald-300 flex items-center gap-1.5"
                  >
                    <Globe className="w-3 h-3 text-foreground" />
                    <span>{i.platform}</span>
                  </span>
                ))}
                {(!agent.tools || agent.tools.filter((t) => t.enabled).length === 0) &&
                  (!agent.integrations ||
                    agent.integrations.filter((i) => i.enabled).length === 0) && (
                    <span className="text-xs text-muted-foreground italic">
                      Standard reasoning tools active
                    </span>
                  )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
            <button
              onClick={() => {
                onClose();
                onOpenTerminal();
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-card text-xs font-medium text-muted-foreground hover:text-foreground transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5 text-foreground" />
              <span>Open Hermes CLI</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
