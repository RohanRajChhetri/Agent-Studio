"use client";

import { useState, useRef } from "react";
import {
  Plus,
  Search,
  MessageSquare,
  Star,
  Edit3,
  Trash2,
  GitFork,
  FolderDown,
  Loader2,
  Bot,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import type { AgentProfile, ChatSession } from "@/types";
import { timeAgo } from "@/lib/utils";
import { AgentAvatar } from "@/components/ui/agent-avatar";

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onTogglePin: (session: ChatSession) => void;
  onForkSession: (session: ChatSession) => void;
  onExportSession: (session: ChatSession) => void;
  loadingSessions: boolean;
  agents: AgentProfile[];
  selectedAgent: AgentProfile | null;
  onSelectAgent: (agent: AgentProfile) => void;
}

export function ChatSidebar({
  isOpen,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onTogglePin,
  onForkSession,
  onExportSession,
  loadingSessions,
  agents,
  selectedAgent,
  onSelectAgent,
}: ChatSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  // Agent Fleet Dock State
  const [isFleetExpanded, setIsFleetExpanded] = useState(false);
  const [fleetSearch, setFleetSearch] = useState("");
  const [fleetRoleFilter, setFleetRoleFilter] = useState<string>("all");
  const fleetScrollRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleSelectSession = (id: string) => {
    onSelectSession(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleCreateSession = () => {
    onCreateSession();
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  const handleSelectAgent = (agent: AgentProfile) => {
    onSelectAgent(agent);
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      onClose();
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(search.toLowerCase()) ||
    (s.lastMessage && s.lastMessage.toLowerCase().includes(search.toLowerCase()))
  );

  const pinnedSessions = filteredSessions.filter((s) => s.pinned);
  const recentSessions = filteredSessions.filter((s) => !s.pinned);

  const handleStartRename = (s: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  };

  const handleFinishRename = (id: string) => {
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <>
      {/* Mobile Backdrop Overlay (only on mobile screens < 768px) */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
      />

      <div className="fixed inset-y-0 left-0 z-50 w-72 sm:w-80 max-w-[85vw] md:relative md:z-auto md:w-72 lg:w-80 shrink-0 flex flex-col h-full min-h-0 border-r border-border bg-card text-card-foreground backdrop-blur-2xl shadow-2xl md:shadow-none transition-all select-none">
        {/* Top Action: New Chat Button, Mobile Close & Search */}
        <div className="p-3 border-b border-border space-y-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateSession}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:border-border/80 text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-foreground" />
              <span>New Chat</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground md:hidden cursor-pointer"
              title="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Past Chats */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-secondary text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border/80 focus:ring-1 focus:ring-border transition-colors"
            />
          </div>
        </div>

      {/* Middle: Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3.5 scrollbar-thin scrollbar-thumb-muted-foreground/20">
        {loadingSessions ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-foreground" />
            <span className="text-xs">Loading sessions...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground px-4">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>{search ? "No matching conversations" : "No conversations yet"}</p>
            <p className="text-[11px] mt-1 text-muted-foreground/75">
              Click &quot;New Chat&quot; to begin.
            </p>
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedSessions.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                  <span>Pinned</span>
                </div>
                {pinnedSessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    isEditing={editingId === s.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => handleSelectSession(s.id)}
                    onStartRename={(e) => handleStartRename(s, e)}
                    onFinishRename={() => handleFinishRename(s.id)}
                    onCancelRename={() => setEditingId(null)}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      onTogglePin(s);
                    }}
                    onFork={(e) => {
                      e.stopPropagation();
                      onForkSession(s);
                    }}
                    onExport={(e) => {
                      e.stopPropagation();
                      onExportSession(s);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                  />
                ))}
              </div>
            )}

            {/* Recent Chats Section */}
            {recentSessions.length > 0 && (
              <div className="space-y-1">
                <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Recent Chats
                </div>
                {recentSessions.map((s) => (
                  <SessionItem
                    key={s.id}
                    session={s}
                    isActive={s.id === activeSessionId}
                    isEditing={editingId === s.id}
                    editTitle={editTitle}
                    setEditTitle={setEditTitle}
                    onSelect={() => handleSelectSession(s.id)}
                    onStartRename={(e) => handleStartRename(s, e)}
                    onFinishRename={() => handleFinishRename(s.id)}
                    onCancelRename={() => setEditingId(null)}
                    onTogglePin={(e) => {
                      e.stopPropagation();
                      onTogglePin(s);
                    }}
                    onFork={(e) => {
                      e.stopPropagation();
                      onForkSession(s);
                    }}
                    onExport={(e) => {
                      e.stopPropagation();
                      onExportSession(s);
                    }}
                    onDelete={(e) => {
                      e.stopPropagation();
                      onDeleteSession(s.id);
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Fleet Dock: Redesigned Expandable & Searchable Fleet Navigator */}
      {(() => {
        const filteredAgents = agents.filter((ag) => {
          const matchesSearch =
            fleetSearch.trim() === "" ||
            ag.displayName.toLowerCase().includes(fleetSearch.toLowerCase()) ||
            ag.name.toLowerCase().includes(fleetSearch.toLowerCase()) ||
            ag.role?.toLowerCase().includes(fleetSearch.toLowerCase()) ||
            ag.department?.toLowerCase().includes(fleetSearch.toLowerCase());
          const matchesRole =
            fleetRoleFilter === "all" ||
            ag.role?.toLowerCase() === fleetRoleFilter.toLowerCase();
          return matchesSearch && matchesRole;
        });

        return (
          <div className="border-t border-border bg-card/95 shrink-0 transition-all select-none">
            {/* Header Bar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <Bot className="w-3.5 h-3.5 text-foreground" />
                <span className="text-[10px] font-bold text-foreground uppercase tracking-wider">
                  Agent Fleet
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground">
                  {agents.length}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsFleetExpanded((prev) => !prev)}
                className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground px-2 py-0.5 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
                title={isFleetExpanded ? "Collapse fleet tray" : "Expand all 27 agents"}
              >
                <span>{isFleetExpanded ? "Collapse" : "Expand All"}</span>
                {isFleetExpanded ? (
                  <ChevronDown className="w-3 h-3 text-muted-foreground" />
                ) : (
                  <ChevronUp className="w-3 h-3 text-muted-foreground" />
                )}
              </button>
            </div>

            {/* Expanded Mode: Filter, Search & Full List */}
            {isFleetExpanded ? (
              <div className="p-2.5 space-y-2 max-h-72 flex flex-col">
                {/* Search Bar */}
                <div className="relative shrink-0">
                  <Search className="w-3 h-3 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search specialists, roles..."
                    value={fleetSearch}
                    onChange={(e) => setFleetSearch(e.target.value)}
                    className="w-full pl-7 pr-7 py-1 text-[11px] rounded-lg border border-border bg-secondary text-foreground placeholder:text-muted-foreground outline-none focus:border-border/80 focus:ring-1 focus:ring-border transition-colors"
                  />
                  {fleetSearch && (
                    <button
                      type="button"
                      onClick={() => setFleetSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Role Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none shrink-0">
                  {[
                    { id: "all", label: "All" },
                    { id: "specialist", label: "Specialists" },
                    { id: "orchestrator", label: "Orchestrator" },
                    { id: "worker", label: "Workers" },
                    { id: "manager", label: "Managers" },
                  ].map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setFleetRoleFilter(role.id)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors shrink-0 cursor-pointer ${
                        fleetRoleFilter === role.id
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                      }`}
                    >
                      {role.label}
                    </button>
                  ))}
                </div>

                {/* Agents Grid/List */}
                <div className="flex-1 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 max-h-48">
                  {filteredAgents.length === 0 ? (
                    <div className="py-4 text-center text-[11px] text-muted-foreground">
                      No agents match your filter
                    </div>
                  ) : (
                    filteredAgents.map((ag) => {
                      const isSelected = selectedAgent?.id === ag.id;
                      return (
                        <button
                          key={ag.id}
                          type="button"
                          onClick={() => handleSelectAgent(ag)}
                          className={`w-full flex items-center justify-between p-1.5 rounded-xl border text-left transition-all cursor-pointer ${
                            isSelected
                              ? "bg-secondary border-primary/30 text-foreground shadow-xs ring-1 ring-primary/20"
                              : "bg-card border-border hover:border-border/80 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <AgentAvatar avatar={ag.avatar} className="w-4 h-4 text-primary shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {ag.displayName}
                              </p>
                              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-mono">
                                <span className="capitalize">{ag.role || "specialist"}</span>
                                {ag.department && (
                                  <>
                                    <span>•</span>
                                    <span className="truncate">{ag.department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {isSelected ? (
                              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                <Check className="w-2.5 h-2.5" />
                                Active
                              </span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                            )}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Collapsed Mode: Horizontal Reel of All Agents */
              <div className="p-2.5 space-y-1.5">
                <div
                  ref={fleetScrollRef}
                  className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted-foreground/20"
                >
                  {agents.map((ag) => {
                    const isSelected = selectedAgent?.id === ag.id;
                    return (
                      <button
                        key={ag.id}
                        type="button"
                        onClick={() => handleSelectAgent(ag)}
                        title={`${ag.displayName} • ${ag.role || "Specialist"} (${ag.department || "General"})`}
                        className={`relative p-2 rounded-xl border flex flex-col items-center justify-center shrink-0 min-w-[64px] transition-all cursor-pointer group ${
                          isSelected
                            ? "bg-secondary border-primary/40 text-foreground shadow-md ring-1 ring-primary/20"
                            : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary hover:border-border/80"
                        }`}
                      >
                        <div className="w-5 h-5 flex items-center justify-center transform group-hover:scale-110 transition-transform">
                          <AgentAvatar avatar={ag.avatar} className="w-5 h-5 text-primary" />
                        </div>
                        <span className="text-[9.5px] font-medium truncate max-w-[56px] mt-1 text-center">
                          {ag.displayName.split(" ")[0]}
                        </span>
                        {/* Live pulse indicator for selected agent */}
                        {isSelected && (
                          <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-0.5">
                  <span>Scroll to view all {agents.length}</span>
                  <button
                    type="button"
                    onClick={() => setIsFleetExpanded(true)}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-2 cursor-pointer"
                  >
                    Search & Filter
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      </div>
    </>
  );
}

function SessionItem({
  session,
  isActive,
  isEditing,
  editTitle,
  setEditTitle,
  onSelect,
  onStartRename,
  onFinishRename,
  onCancelRename,
  onTogglePin,
  onFork,
  onExport,
  onDelete,
}: {
  session: ChatSession;
  isActive: boolean;
  isEditing: boolean;
  editTitle: string;
  setEditTitle: (val: string) => void;
  onSelect: () => void;
  onStartRename: (e: React.MouseEvent) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onTogglePin: (e: React.MouseEvent) => void;
  onFork: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`group relative flex flex-col p-2.5 rounded-xl border cursor-pointer transition-all ${
        isActive
          ? "bg-secondary text-foreground border-border shadow-xs"
          : "bg-card border-border hover:bg-secondary/50 text-muted-foreground hover:text-foreground"
      }`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {session.pinned && (
            <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
          )}

          {isEditing ? (
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onFinishRename();
                if (e.key === "Escape") onCancelRename();
              }}
              onBlur={onFinishRename}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className="bg-secondary px-1.5 py-0.5 rounded text-xs font-semibold text-foreground border border-border outline-none w-full"
            />
          ) : (
            <span className="text-xs font-semibold truncate text-foreground">
              {session.title}
            </span>
          )}
        </div>

        <span className="text-[10px] text-muted-foreground font-mono shrink-0">
          {timeAgo(session.updatedAt)}
        </span>
      </div>

      {session.lastMessage && (
        <p className="text-[11px] text-muted-foreground truncate mt-0.5 line-clamp-1">
          {session.lastMessage}
        </p>
      )}

      {/* Hover action toolbar */}
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/50 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="font-mono">{session.messageCount || 0} msgs</span>
        <div className="flex items-center gap-1">
          <button
            onClick={onTogglePin}
            title={session.pinned ? "Unpin session" : "Pin session"}
            className="p-1 hover:text-amber-400 hover:bg-secondary rounded transition-colors"
          >
            <Star
              className={`w-3 h-3 ${session.pinned ? "fill-amber-400 text-amber-400" : ""}`}
            />
          </button>
          <button
            onClick={onStartRename}
            title="Rename session"
            className="p-1 hover:text-foreground hover:bg-secondary rounded transition-colors"
          >
            <Edit3 className="w-3 h-3" />
          </button>
          <button
            onClick={onFork}
            title="Fork session"
            className="p-1 hover:text-foreground hover:bg-secondary rounded transition-colors"
          >
            <GitFork className="w-3 h-3" />
          </button>
          <button
            onClick={onExport}
            title="Export to Obsidian Vault"
            className="p-1 hover:text-emerald-500 hover:bg-secondary rounded transition-colors"
          >
            <FolderDown className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            title="Delete session"
            className="p-1 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
