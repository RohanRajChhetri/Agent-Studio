"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Shield,
  Layers,
  Crown,
  BookOpen,
  Send,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

interface AgentPreset {
  name: string;
  displayName: string;
  avatar: string;
  role: string;
  department: string;
  description: string;
}

interface AgentPack {
  id: string;
  title: string;
  tagline: string;
  description: string;
  badge: string;
  icon: string;
  agents: AgentPreset[];
}

interface AgentPacksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPackDeployed?: () => void;
}

export function AgentPacksModal({
  isOpen,
  onClose,
  onPackDeployed,
}: AgentPacksModalProps) {
  const [packs, setPacks] = useState<AgentPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPackId, setSelectedPackId] = useState<string>("founder-solopreneur");
  const [deployingId, setDeployingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    fetch("/api/agents/packs")
      .then((r) => r.json())
      .then((data) => {
        if (data.packs) {
          setPacks(data.packs);
          if (data.packs.length > 0 && !selectedPackId) {
            setSelectedPackId(data.packs[0].id);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, selectedPackId]);

  const handleDeploy = async (packId: string) => {
    setDeployingId(packId);
    try {
      const res = await fetch("/api/agents/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Agent Pack deployed to your workforce!");
        if (onPackDeployed) onPackDeployed();
        onClose();
      } else {
        toast.error(data.error || "Failed to deploy agent pack");
      }
    } catch {
      toast.error("Network error deploying pack");
    } finally {
      setDeployingId(null);
    }
  };

  if (!isOpen) return null;

  const activePack = packs.find((p) => p.id === selectedPackId) || packs[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-3xl rounded-2xl border border-border bg-card text-foreground shadow-2xl p-5 sm:p-6 space-y-5 max-h-[88vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Agent Workforce Starter Packs
                </h3>
                <p className="text-xs text-muted-foreground">
                  1-Click deploy specialized AI agent teams with configured hierarchies, personas & starter tasks
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0 overflow-y-auto pr-1">
              {/* Pack Selector Tabs */}
              <div className="space-y-2 md:col-span-1 border-r-0 md:border-r border-border md:pr-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1 block mb-2">
                  Select Pack
                </span>
                {packs.map((pack) => {
                  const isSelected = pack.id === activePack?.id;
                  return (
                    <button
                      key={pack.id}
                      onClick={() => setSelectedPackId(pack.id)}
                      className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                        isSelected
                          ? "bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20"
                          : "border-border bg-secondary/30 hover:bg-secondary/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xl">{pack.icon}</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary border border-border font-bold">
                          {pack.badge}
                        </span>
                      </div>
                      <span className="font-bold text-xs text-foreground mt-1">
                        {pack.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground line-clamp-1">
                        {pack.agents.length} Autonomous Agents
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Pack Detailed Preview */}
              {activePack && (
                <div className="md:col-span-2 space-y-4 pl-0 md:pl-2 flex flex-col justify-between">
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{activePack.icon}</span>
                        <h4 className="text-base font-bold text-foreground">
                          {activePack.title}
                        </h4>
                      </div>
                      <p className="text-xs font-medium text-primary mt-0.5">
                        {activePack.tagline}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activePack.description}
                      </p>
                    </div>

                    {/* Agent Roster Preview */}
                    <div className="space-y-2 pt-2 border-t border-border">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                        Included Fleet Specialists ({activePack.agents.length})
                      </span>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {activePack.agents.map((ag) => (
                          <div
                            key={ag.name}
                            className="p-2.5 rounded-xl border border-border bg-secondary/30 flex items-start gap-2.5 text-xs"
                          >
                            <span className="text-xl p-1 rounded-lg bg-card border border-border shrink-0">
                              {ag.avatar}
                            </span>
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{ag.displayName}</span>
                                <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border">
                                  {ag.role}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({ag.department})
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground line-clamp-2">
                                {ag.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Deploy Action */}
                  <div className="pt-3 border-t border-border flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Deploys {activePack.agents.length} agents + starter tasks
                    </span>

                    <button
                      onClick={() => handleDeploy(activePack.id)}
                      disabled={deployingId === activePack.id}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold shadow-lg shadow-primary/25 transition cursor-pointer disabled:opacity-50"
                    >
                      {deployingId === activePack.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Provisioning Fleet & Sprints...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-4 h-4" />
                          <span>Deploy {activePack.title} (1-Click)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
