"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Key,
  Zap,
  BookOpen,
  Cpu,
  MessageSquare,
  Radio,
  FolderOpen,
  Activity,
  BarChart3,
  Search,
  X,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import type { ElementType } from "react";

export interface SettingsNavStats {
  activeProviders: number;
  totalProviders: number;
  modelsCount: number;
  activeMcpServers: number;
  vaultNotes: number;
  omnirouteOnline: boolean;
  activeSkillsCount?: number;
  totalSkillsCount?: number;
  activeChannelsCount?: number;
}

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: ElementType;
  badge?: string | number | null;
  badgeVariant?: "default" | "success" | "warning" | "info";
  keywords: string[];
  description: string;
}

export interface SettingsCategory {
  title: string;
  items: SettingsNavItem[];
}

interface SettingsSidebarProps {
  activeTab: string;
  onTabChange: (tabId: string) => void;
  stats: SettingsNavStats;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function SettingsSidebar({
  activeTab,
  onTabChange,
  stats,
  searchQuery,
  onSearchChange,
}: SettingsSidebarProps) {
  // Navigation hierarchy conforming to:
  // AI Setup: Providers, Models
  // Tools: Skills, MCP
  // Communications: Chat Apps, Webhooks
  // System: Storage, Diagnostics
  const categories: SettingsCategory[] = useMemo(
    () => [
      {
        title: "AI Setup",
        items: [
          {
            id: "providers",
            label: "Providers",
            icon: Key,
            badge: `${stats.activeProviders}/${stats.totalProviders}`,
            badgeVariant: stats.activeProviders > 0 ? "success" : "default",
            description: "Direct API keys for OpenAI, Anthropic, Gemini, Groq, DeepSeek",
            keywords: [
              "providers",
              "api keys",
              "credentials",
              "tokens",
              "openai",
              "gemini",
              "anthropic",
              "claude",
              "groq",
              "deepseek",
              "mistral",
              "xai",
              "ollama",
            ],
          },
          {
            id: "models",
            label: "Models",
            icon: Zap,
            badge: stats.modelsCount > 0 ? `${stats.modelsCount}` : undefined,
            badgeVariant: stats.modelsCount > 0 ? "info" : "default",
            description: "Catalog, latency inspection, and OmniRoute smart routing",
            keywords: [
              "models",
              "catalog",
              "directory",
              "omniroute",
              "latency",
              "gpt-4o",
              "claude-3-7",
              "routing",
              "benchmarks",
            ],
          },
        ],
      },
      {
        title: "Tools",
        items: [
          {
            id: "skills",
            label: "Skills",
            icon: BookOpen,
            badge:
              stats.activeSkillsCount !== undefined && stats.activeSkillsCount > 0
                ? `${stats.activeSkillsCount} live`
                : undefined,
            badgeVariant: stats.activeSkillsCount && stats.activeSkillsCount > 0 ? "success" : "default",
            description: "Custom sandboxed scripts, REST APIs, and agent tool execution",
            keywords: [
              "skills",
              "tools",
              "scripts",
              "python",
              "javascript",
              "rest api",
              "functions",
              "sandbox",
              "grounding",
            ],
          },
          {
            id: "mcp",
            label: "MCP",
            icon: Cpu,
            badge: stats.activeMcpServers > 0 ? `${stats.activeMcpServers} live` : undefined,
            badgeVariant: stats.activeMcpServers > 0 ? "success" : "default",
            description: "Model Context Protocol servers for databases, files, and search",
            keywords: [
              "mcp",
              "model context protocol",
              "servers",
              "stdio",
              "sse",
              "sqlite",
              "postgres",
              "filesystem",
              "github",
            ],
          },
        ],
      },
      {
        title: "Communications",
        items: [
          {
            id: "chat-apps",
            label: "Chat Apps",
            icon: MessageSquare,
            badge:
              stats.activeChannelsCount !== undefined && stats.activeChannelsCount > 0
                ? `${stats.activeChannelsCount} active`
                : undefined,
            badgeVariant: stats.activeChannelsCount && stats.activeChannelsCount > 0 ? "success" : "default",
            description: "WhatsApp QR session, Telegram bot, Discord, Slack integration",
            keywords: [
              "chat apps",
              "messaging",
              "telegram",
              "whatsapp",
              "discord",
              "slack",
              "signal",
              "devices",
              "channels",
              "bot token",
            ],
          },
          {
            id: "webhooks",
            label: "Webhooks",
            icon: Radio,
            description: "Inbound HTTP webhook endpoints and automated routine tester",
            keywords: [
              "webhooks",
              "events",
              "triggers",
              "endpoints",
              "simulator",
              "payloads",
              "post",
              "curl",
              "delivery logs",
            ],
          },
        ],
      },
      {
        title: "System",
        items: [
          {
            id: "storage",
            label: "Storage",
            icon: FolderOpen,
            badge: stats.vaultNotes > 0 ? `${stats.vaultNotes} notes` : undefined,
            badgeVariant: "default",
            description: "Directory paths for code, screenshots, and Obsidian memory sync",
            keywords: [
              "storage",
              "vault",
              "memory",
              "obsidian",
              "folders",
              "output",
              "screenshots",
              "backups",
              "snapshots",
              "files",
            ],
          },
          {
            id: "diagnostics",
            label: "Diagnostics",
            icon: Activity,
            badge: stats.omnirouteOnline ? "Healthy" : undefined,
            badgeVariant: stats.omnirouteOnline ? "success" : "warning",
            description: "System health metrics, database WAL telemetry, and cache purge",
            keywords: [
              "diagnostics",
              "health",
              "system",
              "concurrency",
              "wal",
              "cache purge",
              "latency",
              "danger",
              "telemetry",
            ],
          },
          {
            id: "analytics",
            label: "Analytics",
            icon: BarChart3,
            badge: "Live",
            badgeVariant: "info",
            description: "Token consumption, inference cost, and model routing telemetry",
            keywords: [
              "analytics",
              "tokens",
              "costs",
              "metrics",
              "usage",
              "telemetry",
              "latency",
              "models",
              "charts",
            ],
          },
        ],
      },
    ],
    [stats]
  );

  // Filter categories and items based on search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;

    return categories
      .map((cat) => {
        const matchesCategoryTitle = cat.title.toLowerCase().includes(q);
        const filteredItems = cat.items.filter((item) => {
          if (matchesCategoryTitle) return true;
          if (item.label.toLowerCase().includes(q)) return true;
          if (item.description.toLowerCase().includes(q)) return true;
          return item.keywords.some((k) => k.toLowerCase().includes(q));
        });

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter((cat) => cat.items.length > 0);
  }, [categories, searchQuery]);

  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-4">
      {/* Search Input Box */}
      <form
        role="search"
        onSubmit={(e) => e.preventDefault()}
        autoComplete="off"
        className="relative"
      >
        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          name="settings_nav_filter"
          id="settings_nav_filter"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          data-form-type="other"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter settings..."
          className="w-full pl-8.5 pr-8 py-2 text-xs rounded-md border border-input bg-card text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-ring transition-all shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Clear filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </form>

      {/* Navigation Groups (Desktop Sidebar) */}
      <nav className="hidden lg:block space-y-4">
        {filteredCategories.length === 0 ? (
          <div className="p-4 text-center rounded-md bg-card border border-border text-xs text-muted-foreground space-y-1 shadow-2xs">
            <p className="font-medium text-foreground">No matching sections</p>
            <p className="text-[11px]">Try searching for &quot;keys&quot;, &quot;telegram&quot;, or &quot;storage&quot;.</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.title} className="space-y-1">
              <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80 font-mono">
                {category.title}
              </div>
              <div className="space-y-0.5">
                {category.items.map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onTabChange(item.id)}
                      className={`relative w-full flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-all cursor-pointer group text-left ${
                        isActive
                          ? "text-primary font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {/* Active Background Capsule */}
                      {isActive && (
                        <motion.div
                          layoutId="activeSettingsNavCapsule"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                          className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-md -z-10"
                        />
                      )}

                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-sm border shrink-0 transition-colors ${
                            isActive
                              ? "bg-primary text-primary-foreground border-primary"
                              : item.badgeVariant === "success"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : item.badgeVariant === "info"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                              : item.badgeVariant === "warning"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-secondary text-muted-foreground border-border"
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </nav>

      {/* Mobile/Tablet Horizontal Strip (< lg screens) */}
      <div className="lg:hidden flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none border-b border-border/60">
        {categories.flatMap((cat) => cat.items).map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium shrink-0 transition-all cursor-pointer ${
                isActive
                  ? "bg-primary/10 text-primary border border-primary/25 font-semibold"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
              {item.badge && (
                <span className="text-[10px] font-mono px-1 rounded-sm bg-secondary text-muted-foreground">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
