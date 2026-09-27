"use client";

import { motion } from "framer-motion";
import {
  Key,
  Smartphone,
  Zap,
  Cpu,
  Radio,
  FolderOpen,
  AlertTriangle,
  Activity,
  Layers,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback, type ElementType } from "react";

export interface TabItem {
  id: string;
  label: string;
  shortLabel?: string;
  icon: ElementType;
  badge?: string | number | null;
  badgeVariant?: "default" | "success" | "warning" | "info";
}

interface SettingsHeaderProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  stats: {
    activeProviders: number;
    totalProviders: number;
    modelsCount: number;
    activeMcpServers: number;
    vaultNotes: number;
    omnirouteOnline: boolean;
  };
}

export function SettingsHeader({ activeTab, onTabChange, stats }: SettingsHeaderProps) {
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const tabs: TabItem[] = [
    {
      id: "providers",
      label: "Providers & API Keys",
      shortLabel: "Providers",
      icon: Key,
      badge: `${stats.activeProviders}/${stats.totalProviders}`,
      badgeVariant: stats.activeProviders > 0 ? "success" : "default",
    },
    {
      id: "devices",
      label: "Omnichannel & Devices",
      shortLabel: "Devices",
      icon: Smartphone,
      badge: "Mobile",
      badgeVariant: "info",
    },
    {
      id: "models",
      label: "Model Directory",
      shortLabel: "Models",
      icon: Zap,
      badge: stats.modelsCount > 0 ? stats.modelsCount : undefined,
    },
    {
      id: "mcp",
      label: "MCP Server Hub",
      shortLabel: "MCP Hub",
      icon: Cpu,
      badge: stats.activeMcpServers > 0 ? `${stats.activeMcpServers} live` : undefined,
      badgeVariant: stats.activeMcpServers > 0 ? "success" : "default",
    },
    {
      id: "vault",
      label: "Shared Memory Vault",
      shortLabel: "Memory Vault",
      icon: FolderOpen,
      badge: stats.vaultNotes > 0 ? `${stats.vaultNotes} notes` : undefined,
    },
    {
      id: "webhooks",
      label: "Webhooks & Simulator",
      shortLabel: "Webhooks",
      icon: Radio,
    },
    {
      id: "danger",
      label: "Diagnostics & Health",
      shortLabel: "Diagnostics",
      icon: AlertTriangle,
    },
  ];

  // Check scroll capability
  const checkScroll = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [checkScroll]);

  // Scroll active tab into view smoothly on mount or activeTab change
  useEffect(() => {
    const el = tabsListRef.current;
    if (!el) return;
    const activeBtn = el.querySelector(`[data-tab-id="${activeTab}"]`) as HTMLElement | null;
    if (activeBtn) {
      activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
    setTimeout(checkScroll, 300);
  }, [activeTab, checkScroll]);

  const scrollTabs = (direction: "left" | "right") => {
    const el = tabsListRef.current;
    if (!el) return;
    const scrollAmount = direction === "left" ? -240 : 240;
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
    setTimeout(checkScroll, 200);
  };

  // Enable mouse wheel horizontal scrolling
  const handleWheel = (e: React.WheelEvent) => {
    const el = tabsListRef.current;
    if (!el) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      el.scrollLeft += e.deltaY;
      checkScroll();
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Banner & Quick Telemetry */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden">
        {/* Subtle accent glow backdrop */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20 inline-flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-primary animate-pulse" />
              Agent Studio OS Platform
            </span>
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-secondary/60 text-muted-foreground">
              <span
                className={`w-2 h-2 rounded-full ${
                  stats.omnirouteOnline ? "bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20" : "bg-amber-500"
                }`}
              />
              <span>{stats.omnirouteOnline ? "OmniRoute Gateway Live" : "Direct Provider Mode"}</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Settings & Orchestration</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Configure LLM credentials, omnichannel messaging, MCP tool servers, and Obsidian episodic memory
          </p>
        </div>

        {/* Telemetry Chips */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap relative z-10">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <Key className="w-3.5 h-3.5 text-primary" />
            <div className="text-left">
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Providers</div>
              <div className="text-xs font-bold font-mono text-foreground">
                {stats.activeProviders} / {stats.totalProviders} Active
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <Layers className="w-3.5 h-3.5 text-emerald-500" />
            <div className="text-left">
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Models</div>
              <div className="text-xs font-bold font-mono text-foreground">{stats.modelsCount} Indexed</div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 border border-border">
            <Activity className="w-3.5 h-3.5 text-indigo-500" />
            <div className="text-left">
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Memory Vault</div>
              <div className="text-xs font-bold font-mono text-foreground">{stats.vaultNotes} Notes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Floating Animated Tabs Bar with Scroll Controls */}
      <div className="relative border-b border-border/80 flex items-center gap-1">
        {/* Left Scroll Button */}
        {canScrollLeft && (
          <button
            type="button"
            onClick={() => scrollTabs("left")}
            className="p-1.5 rounded-lg bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0 z-20 shadow-xs mb-1"
            title="Scroll tabs left"
            aria-label="Scroll tabs left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        {/* Tabs List */}
        <div
          ref={tabsListRef}
          role="tablist"
          aria-label="Settings navigation tabs"
          onScroll={checkScroll}
          onWheel={handleWheel}
          className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex-1 scroll-smooth"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                role="tab"
                data-tab-id={tab.id}
                aria-selected={isActive}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer select-none ${
                  isActive
                    ? "text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
                }`}
              >
                {/* Active Tab Floating Capsule */}
                {isActive && (
                  <motion.div
                    layoutId="activeSettingsTabPill"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    className="absolute inset-0 bg-primary/10 border border-primary/25 rounded-xl -z-10"
                  />
                )}

                <Icon className={`w-3.5 h-3.5 transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>

                {tab.badge && (
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full border transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : tab.badgeVariant === "success"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : tab.badgeVariant === "info"
                        ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                        : "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        {canScrollRight && (
          <button
            type="button"
            onClick={() => scrollTabs("right")}
            className="p-1.5 rounded-lg bg-card border border-border hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer shrink-0 z-20 shadow-xs mb-1"
            title="Scroll tabs right"
            aria-label="Scroll tabs right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
