"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  X,
  Check,
  CheckCheck,
  Trash2,
  Bot,
  Monitor,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  ExternalLink,
  Volume2,
  VolumeX,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  AppNotification,
  getStoredNotifications,
  saveStoredNotifications,
  pushNotification,
} from "@/lib/notification-store";
import { isSoundMuted, toggleSoundMute } from "@/lib/sound-effects";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationCenterDrawer({ isOpen, onClose }: NotificationCenterDrawerProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "agents" | "tasks" | "desktop" | "system">("all");
  const [soundMuted, setSoundMuted] = useState(true);

  const loadNotifications = () => {
    setNotifications(getStoredNotifications());
    setSoundMuted(isSoundMuted());
  };

  useEffect(() => {
    loadNotifications();
    const handleUpdate = () => loadNotifications();
    window.addEventListener("agent-notifications-updated", handleUpdate);
    return () => window.removeEventListener("agent-notifications-updated", handleUpdate);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const markSingleAsRead = (id: string) => {
    const updated = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveStoredNotifications(updated);
  };

  const clearAll = () => {
    setNotifications([]);
    saveStoredNotifications([]);
  };

  const handleToggleSound = () => {
    const muted = toggleSoundMute();
    setSoundMuted(muted);
  };

  const handleSendTestNotification = () => {
    pushNotification({
      title: "Agent Mission Dispatched",
      message: "Orchestrator successfully delegated 3 parallel subtasks to specialists.",
      type: "agent",
      category: "agents",
      agentName: "Atlas Executive",
      agentAvatar: "crown",
      link: "/agents",
    });
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "all") return true;
    return n.category === filter;
  });

  const getCategoryCount = (catId: "all" | "agents" | "tasks" | "desktop" | "system") => {
    if (catId === "all") return notifications.length;
    return notifications.filter((n) => n.category === catId).length;
  };

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-end p-0 sm:p-3 pointer-events-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onClose}
          />

          {/* Floating Pop-up Card */}
          <motion.div
            initial={{ x: "100%", opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: "100%", opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="relative w-full sm:w-[440px] max-w-full h-full sm:h-[calc(100vh-1.5rem)] bg-card border-l sm:border border-border text-foreground flex flex-col sm:rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            {/* ========================================================= */}
            {/* 1. HEADER BAR                                             */}
            {/* ========================================================= */}
            <div className="px-4 py-3.5 border-b border-border bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center text-foreground shrink-0 shadow-2xs">
                  <Bell className="w-4 h-4 text-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
                      Notifications
                    </h3>
                    {unreadCount > 0 ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {unreadCount} unread
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground bg-secondary border border-border/60 shrink-0">
                        All caught up
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    Fleet activity, desktop actions & alerts
                  </p>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={handleToggleSound}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition cursor-pointer"
                  title={soundMuted ? "Unmute notification sounds" : "Mute notification sounds"}
                >
                  {soundMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition cursor-pointer"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4" />
                  </button>
                )}

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={clearAll}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 border border-transparent hover:border-destructive/20 transition cursor-pointer"
                    title="Clear all notifications"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition cursor-pointer"
                  title="Close pop-up (Esc)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* ========================================================= */}
            {/* 2. SEGMENTED FILTER TABS                                  */}
            {/* ========================================================= */}
            <div className="px-3 py-2 border-b border-border bg-card shrink-0">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-secondary/50 border border-border/60 overflow-x-auto scrollbar-none">
                {[
                  { id: "all", label: "All" },
                  { id: "agents", label: "Agents" },
                  { id: "tasks", label: "Tasks" },
                  { id: "desktop", label: "Desktop" },
                  { id: "system", label: "System" },
                ].map((t) => {
                  const count = getCategoryCount(t.id as any);
                  const isSelected = filter === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setFilter(t.id as any)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer shrink-0 ${
                        isSelected
                          ? "bg-card text-foreground font-semibold border border-border shadow-2xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
                      }`}
                    >
                      <span>{t.label}</span>
                      {count > 0 && (
                        <span
                          className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                            isSelected
                              ? "bg-secondary text-foreground font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========================================================= */}
            {/* 3. NOTIFICATIONS FEED                                     */}
            {/* ========================================================= */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {filteredNotifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center text-muted-foreground space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-secondary/60 border border-border flex items-center justify-center text-muted-foreground shadow-2xs">
                    <Bell className="w-5 h-5 opacity-60" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">No Notifications</p>
                    <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
                      You are completely caught up. Agent operations, desktop tasks, and system events will appear here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSendTestNotification}
                    className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary hover:bg-secondary/80 text-foreground border border-border transition cursor-pointer shadow-2xs"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Send Test Notification</span>
                  </button>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const isUnread = !notif.read;

                  // High-fidelity icon rendering with AgentAvatar
                  let iconElement: React.ReactNode = <Info className="w-4 h-4 text-foreground" />;
                  let iconBg = "bg-secondary border-border text-foreground";

                  if (notif.type === "success") {
                    iconElement = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
                    iconBg = "bg-emerald-500/10 border-emerald-500/25 text-emerald-500";
                  } else if (notif.type === "desktop") {
                    iconElement = <Monitor className="w-4 h-4 text-blue-500" />;
                    iconBg = "bg-blue-500/10 border-blue-500/25 text-blue-500";
                  } else if (notif.type === "agent") {
                    iconElement = <AgentAvatar avatar={notif.agentAvatar || "bot"} className="w-4 h-4 text-primary" />;
                    iconBg = "bg-primary/10 border-primary/25 text-primary";
                  } else if (notif.type === "warning") {
                    iconElement = <AlertTriangle className="w-4 h-4 text-amber-500" />;
                    iconBg = "bg-amber-500/10 border-amber-500/25 text-amber-500";
                  } else if (notif.type === "error") {
                    iconElement = <AlertCircle className="w-4 h-4 text-rose-500" />;
                    iconBg = "bg-rose-500/10 border-rose-500/25 text-rose-500";
                  }

                  return (
                    <div
                      key={notif.id}
                      onClick={() => markSingleAsRead(notif.id)}
                      className={`group relative p-3 rounded-xl border transition-all duration-150 cursor-pointer ${
                        isUnread
                          ? "bg-card border-border shadow-xs hover:border-primary/40 ring-1 ring-primary/10"
                          : "bg-secondary/30 border-border/60 hover:bg-secondary/60 hover:border-border opacity-90 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon Container */}
                        <div
                          className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs ${iconBg}`}
                        >
                          {iconElement}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="text-xs font-semibold text-foreground truncate">
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                              • {formatTime(notif.timestamp)}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {notif.message}
                          </p>

                          {/* Footer Tags & Actions */}
                          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                            {notif.agentName && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border/80 text-[10px] font-mono font-medium text-foreground">
                                <AgentAvatar avatar={notif.agentAvatar || "bot"} className="w-3 h-3 text-primary shrink-0" />
                                <span>{notif.agentName}</span>
                              </span>
                            )}

                            {notif.link && (
                              <Link
                                href={notif.link}
                                onClick={onClose}
                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary border border-primary/25 text-[11px] font-semibold transition cursor-pointer shadow-2xs"
                              >
                                <span>Inspect</span>
                                <ExternalLink className="w-2.5 h-2.5 opacity-80" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Right Quick Controls */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                        {isUnread && (
                          <span
                            className="w-2 h-2 rounded-full bg-primary ring-2 ring-card animate-pulse"
                            title="Unread notification"
                          />
                        )}
                        <button
                          type="button"
                          onClick={(e) => deleteNotification(notif.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Dismiss notification"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* ========================================================= */}
            {/* 4. FOOTER STATUS BAR                                      */}
            {/* ========================================================= */}
            <div className="px-4 py-2.5 border-t border-border bg-card flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
              <span className="flex items-center gap-1.5">
                <span>Press</span>
                <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[10px] text-foreground font-semibold">
                  Esc
                </kbd>
                <span>to close</span>
              </span>
              <span className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 rounded bg-secondary border border-border font-mono text-[10px] text-foreground font-semibold">
                  Alt+N
                </kbd>
                <span>toggle</span>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
