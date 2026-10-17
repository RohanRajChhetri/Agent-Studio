"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
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
  Code,
  Users,
  Menu,
  X,
  Workflow,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

const navItems = [
  { href: "/", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/agents", icon: Bot, label: "Agents" },
  { href: "/workflows", icon: Workflow, label: "Workflows" },
  { href: "/conference", icon: Users, label: "Conference" },
  { href: "/memory", icon: Brain, label: "Memory" },
  { href: "/kanban", icon: Columns3, label: "Kanban" },
  { href: "/code", icon: Code, label: "Code" },
  { href: "/routines", icon: CalendarClock, label: "Routines" },
  { href: "/chat", icon: MessageSquare, label: "Chat" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

interface SidebarContentProps {
  isMobile?: boolean;
  collapsed: boolean;
  pathname: string;
  setMobileOpen: (open: boolean) => void;
  setCollapsed: (collapsed: boolean) => void;
}

function SidebarContent({
  isMobile = false,
  collapsed,
  pathname,
  setMobileOpen,
  setCollapsed,
}: SidebarContentProps) {
  return (
    <>
      {/* Logo Brand Header */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        {(!collapsed || isMobile) && (
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
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
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
                {(!collapsed || isMobile) && (
                  <span className="whitespace-nowrap">
                    {item.label}
                  </span>
                )}
                {isActive && (!collapsed || isMobile) && (
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
          {(!collapsed || isMobile) && <span className="truncate">Live Voice</span>}
        </button>

        <button
          onClick={() => window.dispatchEvent(new CustomEvent("open-cost-tracker"))}
          className="flex items-center gap-2.5 px-3 py-1.5 w-full rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
          title="Token & Cost Telemetry"
        >
          <Coins className="w-4 h-4 shrink-0" />
          {(!collapsed || isMobile) && <span className="truncate">Cost & Usage</span>}
        </button>
      </div>

      {/* Auth Controls */}
      <div className="px-2.5 py-2.5 border-t border-border">
        <Show when="signed-out">
          <div className={cn("flex gap-2", collapsed && !isMobile ? "flex-col items-center" : "items-center")}>
            <SignInButton mode="modal">
              <button className={cn(
                "w-full text-xs font-medium py-1.5 px-2.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition text-center cursor-pointer shadow-sm",
                collapsed && !isMobile && "text-[10px] px-1"
              )}>
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className={cn(
                "w-full text-xs font-medium py-1.5 px-2.5 rounded-lg border border-border bg-secondary hover:bg-muted text-foreground transition text-center cursor-pointer",
                collapsed && !isMobile && "hidden"
              )}>
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </Show>
        <Show when="signed-in">
          <div className={cn("flex items-center gap-2.5", collapsed && !isMobile ? "justify-center" : "px-1")}>
            <UserButton
              showName={!collapsed || isMobile}
              appearance={{
                elements: {
                  userButtonAvatarBox: "w-7 h-7",
                  userButtonOuterIdentifier: "text-xs font-medium text-foreground truncate max-w-[130px]",
                  userButtonBox: "flex-row-reverse gap-2",
                },
              }}
            />
          </div>
        </Show>
      </div>

      {/* Color Theme Switcher */}
      <div className="px-3 py-3 border-t border-border">
        <ThemeToggle collapsed={collapsed && !isMobile} />
      </div>

      {/* Collapse toggle (desktop only) */}
      {!isMobile && (
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
      )}
    </>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-3 left-3 z-[60] p-2 rounded-xl bg-card border border-border shadow-lg lg:hidden cursor-pointer hover:bg-secondary transition"
        title="Open menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-[60] w-[280px] flex flex-col bg-card border-r border-border lg:hidden shadow-2xl"
            >
              <SidebarContent
                isMobile
                collapsed={collapsed}
                pathname={pathname}
                setMobileOpen={setMobileOpen}
                setCollapsed={setCollapsed}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 72 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="fixed left-0 top-0 bottom-0 z-50 hidden lg:flex flex-col bg-card border-r border-border"
      >
        <SidebarContent
          collapsed={collapsed}
          pathname={pathname}
          setMobileOpen={setMobileOpen}
          setCollapsed={setCollapsed}
        />
      </motion.aside>

      {/* Spacer to match sidebar width (desktop only) */}
      <div
        className={cn(
          "shrink-0 transition-all duration-200 hidden lg:block",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      />

      {/* Mobile top padding spacer */}
      <div className="h-0 lg:h-0" />
    </>
  );
}
