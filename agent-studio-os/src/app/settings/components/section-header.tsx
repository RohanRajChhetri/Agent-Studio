"use client";

import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

interface SectionHeaderProps {
  category: string;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: "success" | "warning" | "info" | "default";
  actions?: ReactNode;
}

export function SectionHeader({
  category,
  title,
  description,
  badge,
  badgeVariant = "default",
  actions,
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-border/70">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            {category}
          </span>
          <span className="text-muted-foreground/40">•</span>
          {badge && (
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-medium ${
                badgeVariant === "success"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : badgeVariant === "info"
                  ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                  : badgeVariant === "warning"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-secondary text-muted-foreground border-border"
              }`}
            >
              {badge}
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          {title}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
          {description}
        </p>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {actions}
        </div>
      )}
    </div>
  );
}
