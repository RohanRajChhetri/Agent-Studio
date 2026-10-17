"use client";

import { motion } from "framer-motion";
import { Sparkles, Bot } from "lucide-react";

interface DashboardHeroHeaderProps {
  agentCount: number;
  isChatActive?: boolean;
}

export function DashboardHeroHeader({ agentCount, isChatActive = false }: DashboardHeroHeaderProps) {
  if (isChatActive) {
    return null; // When chatting, let the conversation take full focus
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="text-center space-y-3.5 pt-2 pb-1"
    >
      {/* Subtle status chip */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/70 text-muted-foreground text-[11px] font-medium border border-border/60">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-foreground font-semibold">Agent Studio OS</span>
        <span className="opacity-40">•</span>
        <span>{agentCount} Specialists Online</span>
      </div>

      {/* Clean, minimalist headline */}
      <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
        What would you like to build today?
      </h1>

      {/* Understated subtext */}
      <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
        Direct missions, orchestrate autonomous multi-agent chains, or chat with specialist personas.
      </p>
    </motion.div>
  );
}

