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
  Code,
  Users,
  Menu,
  X,
  Workflow,
  Bell,
  LogIn,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { getStoredNotifications } from "@/lib/notification-store";

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      try {
        const notifs = getStoredNotifications();
        setUnreadCount(notifs.filter((n) => !n.read).length);
      } catch {}
    };
    updateCount();
    window.addEventListener("agent-notifications-updated", updateCount);
    return () => window.removeEventListener("agent-notifications-updated", updateCount);
  }, []);

  return (
    <>
      {/* Logo Brand Header */}
      <div className={cn(
        "flex items-center h-14 border-b border-sidebar-border shrink-0 transition-all",
        collapsed && !isMobile ? "justify-center px-0" : "gap-3 px-3.5"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-foreground text-background font-bold text-xs shrink-0 shadow-xs">
          <Sparkles className="w-4 h-4" />
        </div>
        {(!collapsed || isMobile) && (
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            className="overflow-hidden min-w-0"
          >
            <h1 className="font-semibold text-xs tracking-tight text-sidebar-foreground truncate">
              Agent Studio OS
            </h1>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              Control Plane
            </p>
          </motion.div>
        )}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(false)}
            className="ml-auto p-1.5 rounded-md hover:bg-sidebar-accent text-muted-foreground hover:text-sidebar-foreground transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <nav className={cn(
        "flex-1 py-2.5 space-y-1 overflow-y-auto overflow-x-hidden",
        collapsed && !isMobile ? "px-0 flex flex-col items-center" : "px-2"
      )}>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(collapsed && !isMobile && "flex justify-center w-full")}
              title={collapsed && !isMobile ? item.label : undefined}
            >
              <div
                className={cn(
                  "flex items-center text-xs font-medium transition-all relative group cursor-pointer",
                  collapsed && !isMobile
                    ? "w-9 h-9 justify-center rounded-md"
                    : "gap-2.5 px-2.5 py-1.5 rounded-md",
                  isActive
                    ? "text-sidebar-foreground bg-sidebar-accent font-semibold shadow-2xs border border-sidebar-border"
                    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon
                  className={cn(
                    "w-4 h-4 shrink-0 transition-transform group-hover:scale-105",
                    isActive ? "text-sidebar-foreground" : "text-muted-foreground group-hover:text-sidebar-foreground"
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

      {/* Unified Bottom Footer */}
      {collapsed && !isMobile ? (
        <div className="border-t border-sidebar-border py-2 px-0 flex flex-col items-center gap-1.5 bg-sidebar shrink-0 w-full">
          {/* Notifications */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-notifications"))}
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer relative group"
            title="Notification Center (Alt+N)"
          >
            <Bell className="w-4 h-4 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-sidebar" />
            )}
          </button>

          {/* Live Voice */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("open-voice-cockpit"))}
            className="w-9 h-9 rounded-md flex items-center justify-center text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 transition-all cursor-pointer relative group"
            title="Launch Gemini Live Voice Cockpit (Alt+V)"
          >
            <Mic className="w-4 h-4 text-primary group-hover:scale-105 transition-transform" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </button>

          {/* Subtle Hairline Divider */}
          <div className="w-6 h-px bg-sidebar-border my-0.5" />

          {/* Auth Controls */}
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                className="w-9 h-9 rounded-md flex items-center justify-center text-sidebar-foreground hover:bg-sidebar-accent border border-sidebar-border transition-all cursor-pointer"
                title="Sign In"
              >
                <LogIn className="w-4 h-4" />
              </button>
            </SignInButton>
          </Show>
          <Show when="signed-in">
            <div
              className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-sidebar-accent transition-all cursor-pointer"
              title="User Account"
            >
              <div className="relative rounded-full p-0.5 ring-1 ring-sidebar-border bg-sidebar flex items-center justify-center">
                <UserButton
                  showName={false}
                  appearance={{
                    elements: {
                      userButtonAvatarBox: "w-6 h-6 rounded-full",
                      userButtonPopoverCard: "shadow-xl border border-border bg-card",
                    },
                  }}
                />
              </div>
            </div>
          </Show>

          {/* Theme Switcher */}
          <ThemeToggle collapsed={true} />

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer group"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      ) : (
        <div className="border-t border-sidebar-border p-2.5 space-y-2 bg-sidebar shrink-0">
          {/* Quick Cockpit Actions (Alerts & Live Voice) */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-notifications"))}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium text-muted-foreground hover:text-sidebar-foreground bg-sidebar-accent/50 hover:bg-sidebar-accent border border-sidebar-border transition-all cursor-pointer relative group"
              title="Notification Center (Alt+N)"
            >
              <div className="relative shrink-0">
                <Bell className="w-3.5 h-3.5 text-muted-foreground group-hover:text-sidebar-foreground transition-colors" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary ring-2 ring-sidebar" />
                )}
              </div>
              <span className="truncate text-[11px]">Alerts</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-sm text-[9px] font-mono font-semibold bg-primary text-primary-foreground">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-voice-cockpit"))}
              className="flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/25 transition-all cursor-pointer group"
              title="Launch Gemini Live Voice Cockpit (Alt+V)"
            >
              <Mic className="w-3.5 h-3.5 shrink-0 text-primary group-hover:scale-105 transition-transform" />
              <span className="truncate text-[11px]">Live Voice</span>
            </button>
          </div>

          {/* Auth Controls */}
          <Show when="signed-out">
            <div className="flex items-center gap-2">
              <SignInButton mode="modal">
                <button className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition text-center cursor-pointer shadow-xs">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="flex-1 text-xs font-medium py-1.5 px-3 rounded-md border border-sidebar-border bg-sidebar hover:bg-sidebar-accent text-sidebar-foreground transition text-center cursor-pointer">
                  Sign Up
                </button>
              </SignUpButton>
            </div>
          </Show>
          <Show when="signed-in">
            <div className="p-2 rounded-md bg-sidebar-accent/50 border border-sidebar-border flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="shrink-0 rounded-full p-0.5 ring-1 ring-sidebar-border bg-sidebar flex items-center justify-center">
                  <UserButton
                    appearance={{
                      elements: {
                        userButtonAvatarBox: "w-6 h-6 rounded-full",
                        userButtonOuterIdentifier: "text-xs font-medium text-sidebar-foreground truncate max-w-[110px]",
                        userButtonBox: "flex-row-reverse gap-2",
                      },
                    }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="text-xs font-medium text-sidebar-foreground truncate">Operator</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">Autonomous System</p>
                </div>
              </div>
            </div>
          </Show>

          {/* Color Theme Switcher */}
          <ThemeToggle collapsed={false} />

          {/* Collapse toggle (desktop only) */}
          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-all cursor-pointer group"
              title="Collapse sidebar"
            >
              <span className="text-[11px] font-medium">Collapse Sidebar</span>
              <div className="w-5 h-5 rounded-md flex items-center justify-center bg-sidebar-accent group-hover:bg-sidebar-accent/80 text-muted-foreground group-hover:text-sidebar-foreground transition-all">
                <ChevronLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              </div>
            </button>
          )}
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
        className="fixed top-3 left-3 z-[60] p-2 rounded-md bg-card border border-border shadow-md lg:hidden cursor-pointer hover:bg-secondary transition"
        title="Open menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile notifications button */}
      <button
        onClick={() => window.dispatchEvent(new CustomEvent("open-notifications"))}
        className="fixed top-3 right-3 z-[60] p-2 rounded-md bg-card border border-border shadow-md lg:hidden cursor-pointer hover:bg-secondary transition"
        title="Open notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
      </button>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[55] bg-black/60 backdrop-blur-xs lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 z-[60] w-[280px] flex flex-col bg-sidebar border-r border-sidebar-border lg:hidden shadow-2xl"
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
        transition={{ duration: 0.15, ease: "easeInOut" }}
        className="fixed left-0 top-0 bottom-0 z-50 hidden lg:flex flex-col bg-sidebar border-r border-sidebar-border"
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
