"use client";

import { useState } from "react";
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
} from "lucide-react";
import type { AgentProfile, ChatSession } from "@/types";
import { timeAgo } from "@/lib/utils";

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

  if (!isOpen) return null;

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
    <div className="w-72 lg:w-80 shrink-0 flex flex-col h-full min-h-0 border-r border-border/80 bg-card/75 backdrop-blur-xl transition-all select-none">
      {/* Top Action: New Chat Button */}
      <div className="p-3 border-b border-border/70 space-y-2.5">
        <button
          onClick={onCreateSession}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-semibold shadow-sm hover:shadow-md transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        {/* Search Past Chats */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border/70 bg-secondary/40 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Middle: Sessions List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {loadingSessions ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-xs">Loading sessions...</span>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground px-4">
            <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>{search ? "No matching conversations" : "No conversations yet"}</p>
            <p className="text-[11px] mt-1 text-muted-foreground/80">
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
                    onSelect={() => onSelectSession(s.id)}
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
                    onSelect={() => onSelectSession(s.id)}
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

      {/* Bottom Fleet Dock: Quick Agent Switching */}
      <div className="p-3 border-t border-border/70 bg-secondary/30 shrink-0">
        <div className="flex items-center justify-between px-1 mb-2">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Bot className="w-3 h-3 text-primary" />
            <span>Agent Fleet</span>
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">
            {agents.length} active
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {agents.slice(0, 5).map((ag) => {
            const isSelected = selectedAgent?.id === ag.id;
            return (
              <button
                key={ag.id}
                onClick={() => onSelectAgent(ag)}
                title={`${ag.displayName} (${ag.role || "Specialist"})`}
                className={`p-1.5 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/20 border-primary text-primary shadow-sm ring-1 ring-primary/40"
                    : "bg-card border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary/70 hover:border-border"
                }`}
              >
                <span className="text-base leading-none">{ag.avatar}</span>
                <span className="text-[9px] font-semibold truncate max-w-[42px] mt-0.5">
                  {ag.displayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
          ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
          : "bg-secondary/30 border-transparent hover:bg-secondary/70 hover:border-border/60 text-muted-foreground hover:text-foreground"
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
              className="bg-card px-1.5 py-0.5 rounded text-xs font-semibold text-foreground border border-primary outline-none w-full"
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
      <div className="flex items-center justify-between pt-1 mt-1 border-t border-border/40 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
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
            className="p-1 hover:text-emerald-400 hover:bg-secondary rounded transition-colors"
          >
            <FolderDown className="w-3 h-3" />
          </button>
          <button
            onClick={onDelete}
            title="Delete session"
            className="p-1 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
