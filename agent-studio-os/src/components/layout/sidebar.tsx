"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Bot,
  Brain,
  Columns3,
  CalendarClock,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Mic,
  Coins,
  Search,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/memory", icon: Brain, label: "Memory" },
  { href: "/kanban", icon: Columns3, label: "Kanban" },
  { href: "/routines", icon: CalendarClock, label: "Routines" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="fixed left-0 top-0 bottom-0 z-50 flex flex-col bg-card border-r border-border"
      >
        {/* Logo Brand Header */}
        <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="overflow-hidden"
            >
              <h1 className="font-semibold text-sm text-foreground tracking-tight whitespace-nowrap">
                Agent Studio
              </h1>
              <p className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                Autonomous OS
              </p>
            </motion.div>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-3 px-2.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors relative group cursor-pointer",
                    isActive
                      ? "text-primary bg-secondary border border-primary/20 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <item.icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform",
                      isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {!collapsed && (
                    <span className="whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                  {isActive && !collapsed && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Quick Cockpit Tools: Voice Orb, Command Palette, Cost Tracker */}
        <div className="px-2.5 py-2 border-t border-border space-y-1">
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-voice-cockpit"))}
            className="flex items-center gap-2.5 px-3 py-1.5 w-full rounded-lg text-xs font-semibold text-foreground bg-[#e6f3fe] dark:bg-primary/10 border border-[#0075de]/30 text-[#0075de] dark:text-primary hover:bg-[#e6f3fe]/80 transition cursor-pointer"
            title="Launch Gemini Live Voice Cockpit (Alt+V)"
          >
            <Mic className="w-4 h-4 shrink-0 text-primary" />
            {!collapsed && <span className="truncate">Live Voice</span>}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-command-palette"))}
            className="flex items-center justify-between px-3 py-1.5 w-full rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Command Palette (Ctrl+K)"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Search className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="truncate">Commands</span>}
            </div>
            {!collapsed && (
              <kbd className="text-[10px] font-mono px-1 rounded bg-secondary border border-border">
                ⌘K
              </kbd>
            )}
          </button>

          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-cost-tracker"))}
            className="flex items-center gap-2.5 px-3 py-1.5 w-full rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Token & Cost Telemetry"
          >
            <Coins className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">Cost & Usage</span>}
          </button>
        </div>

        {/* Color Theme Switcher */}
        <div className="px-3 py-3 border-t border-border">
          <ThemeToggle collapsed={collapsed} />
        </div>

        {/* Collapse toggle */}
        <div className="px-3 py-2.5 border-t border-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.aside>

      {/* Spacer to match sidebar width */}
      <div
        className={cn(
          "shrink-0 transition-all duration-200",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      />
    </>
  );
}
