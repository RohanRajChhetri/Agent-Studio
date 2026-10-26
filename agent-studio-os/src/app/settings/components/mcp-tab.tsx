"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Server,
  Plus,
  Loader2,
  CheckCircle,
  XCircle,
  X,
  Radio,
  Terminal,
  ExternalLink,
  Trash2,
  Copy,
  Check,
  Wrench,
  Sparkles,
  Database,
  FolderTree,
  GitBranch,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { ConfirmModal } from "@/components/confirm-modal";
import type { MCPServerConfig } from "@/types/mcp";

interface MCPTabProps {
  servers: MCPServerConfig[];
  loading: boolean;
  onToggleServer: (id: string) => Promise<void>;
  onTestServer: (id: string) => Promise<void>;
  onAddServer: (config: {
    name: string;
    description: string;
    transport: "stdio" | "sse";
    command?: string;
    args?: string[];
    url?: string;
  }) => Promise<void>;
  onDeleteServer?: (id: string) => Promise<void>;
  testingMcpId: string | null;
  togglingMcpId: string | null;
}

// Quick 1-click presets for popular MCP servers
const MCP_PRESETS = [
  {
    name: "SQLite Database Inspector",
    description: "Read, inspect schemas, and query local SQLite database tables.",
    transport: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-sqlite --db ./prisma/agent-studio.db",
    icon: Database,
  },
  {
    name: "Filesystem Workspace Sandbox",
    description: "Secure local directory read/write sandboxing for code generation agents.",
    transport: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-filesystem ./agent-workspace",
    icon: FolderTree,
  },
  {
    name: "GitHub Repository Tools",
    description: "Inspect repositories, search commits, manage pull requests and issues.",
    transport: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-github",
    icon: GitBranch,
  },
  {
    name: "PostgreSQL Database Engine",
    description: "Connect to remote PostgreSQL clusters for agent analytical queries.",
    transport: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-postgres postgresql://localhost/agentos",
    icon: Database,
  },
  {
    name: "Brave Web Search API",
    description: "Realtime web querying and document discovery for research agents.",
    transport: "stdio" as const,
    command: "npx",
    args: "-y @modelcontextprotocol/server-brave-search",
    icon: Search,
  },
];

export function MCPTab({
  servers,
  loading,
  onToggleServer,
  onTestServer,
  onAddServer,
  onDeleteServer,
  testingMcpId,
  togglingMcpId,
}: MCPTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal form states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transport, setTransport] = useState<"stdio" | "sse">("stdio");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState("");
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverToDelete, setServerToDelete] = useState<MCPServerConfig | null>(null);
  const [isDeletingServer, setIsDeletingServer] = useState(false);

  const handleConfirmDeleteServer = async () => {
    if (!serverToDelete || !onDeleteServer) return;
    setIsDeletingServer(true);
    try {
      await onDeleteServer(serverToDelete.id);
      toast.success(`Removed MCP server "${serverToDelete.name}"`);
      setServerToDelete(null);
    } catch {
      toast.error("Failed to remove MCP server");
    } finally {
      setIsDeletingServer(false);
    }
  };

  const applyPreset = (preset: typeof MCP_PRESETS[0]) => {
    setName(preset.name);
    setDescription(preset.description);
    setTransport(preset.transport);
    setCommand(preset.command);
    setArgs(preset.args);
    setUrl("");
    toast.info(`Applied preset: ${preset.name}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please provide a server name");
      return;
    }
    setSubmitting(true);
    try {
      await onAddServer({
        name: name.trim(),
        description: description.trim(),
        transport,
        command: transport === "stdio" ? command.trim() : undefined,
        args: transport === "stdio" ? args.split(" ").filter(Boolean) : undefined,
        url: transport === "sse" ? url.trim() : undefined,
      });
      setShowAddModal(false);
      setName("");
      setDescription("");
      setArgs("");
      setUrl("");
    } catch {
      // Error handled upstream
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyCmd = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Command copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeCount = servers.filter((s) => s.enabled).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* MCP Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Model Context Protocol (MCP) Hub</h3>
              <p className="text-xs text-muted-foreground">
                Connect external tool servers, sandboxed filesystem access, and databases for your autonomous agent fleet
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden md:block">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">Status</span>
            <span className="text-xs font-mono font-bold text-foreground">
              {activeCount} of {servers.length} Connected
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add MCP Server</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-16 text-center text-xs text-muted-foreground flex flex-col items-center gap-3 bg-card rounded-2xl border border-border">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <span>Discovering Model Context Protocol services...</span>
        </div>
      ) : servers.length === 0 ? (
        <div className="p-16 text-center text-muted-foreground bg-card rounded-2xl border border-border space-y-4">
          <Server className="w-10 h-10 mx-auto opacity-30 text-muted-foreground" />
          <div>
            <h4 className="text-sm font-semibold text-foreground">No MCP Servers Configured</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Add external tool servers using STDIO or SSE to give your agent fleet filesystem and database superpowers.
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Server</span>
          </button>
        </div>
      ) : (
        /* Server Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((server) => {
            const isToggling = togglingMcpId === server.id;
            const isTesting = testingMcpId === server.id;
            const cmdText =
              server.transport === "stdio"
                ? `${server.command || ""} ${(server.args || []).join(" ")}`.trim()
                : server.url || "";

            return (
              <div
                key={server.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-primary/40 transition-all duration-200"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center shrink-0 border border-border">
                        <Server className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1">{server.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border uppercase">
                            {server.transport}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
                            {server.id}
                          </span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[10.5px] px-2.5 py-0.5 rounded-full font-medium border shrink-0 flex items-center gap-1.5 ${
                        server.enabled
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          : "bg-secondary text-muted-foreground border-border"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          server.enabled ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/40"
                        }`}
                      />
                      {server.enabled ? "Active" : "Disabled"}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {server.description || "Model Context Protocol provider"}
                  </p>

                  {/* Command preview box */}
                  {cmdText && (
                    <div className="flex items-center justify-between p-2 rounded-xl bg-secondary/50 border border-border text-xs font-mono text-muted-foreground">
                      <div className="flex items-center gap-1.5 truncate pr-2">
                        <Terminal className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate select-all text-[11px] text-foreground/80">{cmdText}</span>
                      </div>
                      <button
                        onClick={() => handleCopyCmd(server.id, cmdText)}
                        className="p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                        title="Copy command"
                      >
                        {copiedId === server.id ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Actions Row */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onTestServer(server.id)}
                      disabled={isTesting}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-medium border border-border bg-secondary hover:bg-secondary/80 text-foreground transition cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                      title="Ping server health"
                    >
                      {isTesting ? (
                        <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      ) : (
                        <Radio className="w-3 h-3 text-primary" />
                      )}
                      <span>Ping</span>
                    </button>

                    {onDeleteServer && (
                      <button
                        onClick={() => setServerToDelete(server)}
                        className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete server"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => onToggleServer(server.id)}
                    disabled={isToggling}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      server.enabled
                        ? "bg-secondary hover:bg-muted text-foreground border border-border"
                        : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                    }`}
                  >
                    {isToggling && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>{server.enabled ? "Disable" : "Enable"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add MCP Server Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-xl rounded-2xl border border-border bg-card p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">Register Model Context Protocol Server</h3>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1-Click Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Quick Presets (Click to autofill)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MCP_PRESETS.map((p) => {
                    const PresetIcon = p.icon;
                    return (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => applyPreset(p)}
                        className="text-left p-2.5 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/70 hover:border-primary/40 transition cursor-pointer flex items-start gap-2.5 group"
                      >
                        <PresetIcon className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                            {p.name}
                          </div>
                          <div className="text-[10.5px] text-muted-foreground line-clamp-1">{p.description}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Manual Form */}
              <form onSubmit={handleSubmit} className="space-y-3.5 text-xs pt-2 border-t border-border">
                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Server Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. SQLite Inspector or Linear API"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Description</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What tools or resources does this server provide?"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-foreground block mb-1">Transport</label>
                  <select
                    value={transport}
                    onChange={(e: any) => setTransport(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground outline-none focus:border-primary"
                  >
                    <option value="stdio">stdio (Local Subprocess)</option>
                    <option value="sse">sse (Server-Sent Events / Remote URL)</option>
                  </select>
                </div>

                {transport === "stdio" ? (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="text-[11px] font-semibold text-foreground block mb-1">Command</label>
                        <input
                          type="text"
                          value={command}
                          onChange={(e) => setCommand(e.target.value)}
                          placeholder="npx or node"
                          className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground font-mono"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[11px] font-semibold text-foreground block mb-1">
                          Arguments (space-separated)
                        </label>
                        <input
                          type="text"
                          value={args}
                          onChange={(e) => setArgs(e.target.value)}
                          placeholder="-y @modelcontextprotocol/server-sqlite --db ./prisma/agent-studio.db"
                          className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground font-mono"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="text-[11px] font-semibold text-foreground block mb-1">SSE URL</label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://mcp.internal.company.com/sse"
                      className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/40 text-foreground font-mono"
                    />
                  </div>
                )}

                <div className="pt-3 flex justify-end gap-2 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-border bg-secondary text-foreground hover:bg-secondary/80 font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !name.trim()}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition cursor-pointer disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Register Server</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete MCP Server Confirm Modal */}
      <ConfirmModal
        isOpen={!!serverToDelete}
        onClose={() => {
          if (!isDeletingServer) setServerToDelete(null);
        }}
        onConfirm={handleConfirmDeleteServer}
        title="Remove MCP Server"
        description="Are you sure you want to remove this MCP server configuration?"
        itemTitle={serverToDelete?.name}
        dangerDetails="Connected tool capabilities will be unmounted from your orchestrators."
        confirmText="Remove Server"
        variant="danger"
        loading={isDeletingServer}
      />
    </motion.div>
  );
}
