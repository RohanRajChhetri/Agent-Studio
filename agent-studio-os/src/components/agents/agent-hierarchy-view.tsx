"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Terminal,
  Search,
  Users,
  GitBranch,
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crown,
  Shield,
  Zap,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowDown,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  UserCheck,
  X,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface AgentHierarchyViewProps {
  agents: AgentProfile[];
  onOpenHermes: (agent: AgentProfile) => void;
  onRefresh?: () => void;
}

const ROLE_META = {
  orchestrator: {
    label: "Orchestrator",
    color: "#f59e0b",
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    text: "text-amber-300",
    glow: "shadow-amber-500/20",
    icon: Crown,
    desc: "Autonomous fleet director & strategy leader",
  },
  manager: {
    label: "Manager",
    color: "#818cf8",
    border: "border-border",
    bg: "bg-primary/10 text-primary",
    text: "text-primary",
    glow: "shadow-indigo-500/20",
    icon: Shield,
    desc: "Department supervisor & task dispatcher",
  },
  specialist: {
    label: "Specialist",
    color: "#06b6d4",
    border: "border-cyan-500/40",
    bg: "bg-cyan-500/10",
    text: "text-cyan-300",
    glow: "shadow-cyan-500/20",
    icon: Zap,
    desc: "Domain expert & specialized tooling executor",
  },
  worker: {
    label: "Worker",
    color: "#10b981",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    text: "text-emerald-300",
    glow: "shadow-emerald-500/20",
    icon: CheckCircle2,
    desc: "Operational worker & workflow task handler",
  },
};

export function AgentHierarchyView({
  agents,
  onOpenHermes,
  onRefresh,
}: AgentHierarchyViewProps) {
  const [localAgents, setLocalAgents] = useState<AgentProfile[]>(agents);
  const [viewMode, setViewMode] = useState<"graph" | "matrix">("graph");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [zoom, setZoom] = useState<number>(1);
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Drag-and-drop hierarchy state
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [reassignModalAgent, setReassignModalAgent] = useState<AgentProfile | null>(null);

  useEffect(() => {
    setLocalAgents(agents);
  }, [agents]);

  // Departments list
  const departments = useMemo(() => {
    const set = new Set<string>();
    localAgents.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set);
  }, [localAgents]);

  // Fast lookup maps
  const agentMap = useMemo(() => {
    const map = new Map<string, AgentProfile>();
    localAgents.forEach((a) => map.set(a.id, a));
    return map;
  }, [localAgents]);

  // Children mapping (subordinates)
  const childrenMap = useMemo(() => {
    const map = new Map<string, AgentProfile[]>();
    localAgents.forEach((a) => {
      if (a.reportsToId) {
        const existing = map.get(a.reportsToId) || [];
        existing.push(a);
        map.set(a.reportsToId, existing);
      }
    });
    return map;
  }, [localAgents]);

  // Root agents: No reportsToId or reportsToId not in agent list
  const rootAgents = useMemo(() => {
    return localAgents.filter((a) => !a.reportsToId || !agentMap.has(a.reportsToId));
  }, [localAgents, agentMap]);

  // Tiers mapping
  const tiers = useMemo(
    () => ({
      orchestrators: localAgents.filter((a) => a.role === "orchestrator"),
      managers: localAgents.filter((a) => a.role === "manager"),
      specialists: localAgents.filter((a) => a.role === "specialist"),
      workers: localAgents.filter((a) => a.role === "worker" || !a.role),
    }),
    [localAgents]
  );

  // Hierarchy stats
  const stats = useMemo(() => {
    const total = localAgents.length;
    const managersCount = localAgents.filter(
      (a) => (childrenMap.get(a.id) || []).length > 0
    ).length;
    const rootsCount = rootAgents.length;
    return { total, managersCount, rootsCount };
  }, [localAgents, childrenMap, rootAgents]);

  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const collapseAll = () => {
    const newCollapsed: Record<string, boolean> = {};
    localAgents.forEach((a) => {
      if ((childrenMap.get(a.id) || []).length > 0) {
        newCollapsed[a.id] = true;
      }
    });
    setCollapsedNodes(newCollapsed);
  };

  const expandAll = () => {
    setCollapsedNodes({});
  };

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.min(1.4, Math.max(0.65, +(prev + delta).toFixed(2))));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  // Reassign supervisor handler
  const handleReassignSupervisor = async (
    agentId: string,
    newSupervisorId: string | null
  ) => {
    if (agentId === newSupervisorId) {
      toast.error("An agent cannot report to itself.");
      return;
    }

    // Check for circular reference
    const getDescendants = (parentId: string): string[] => {
      const kids = childrenMap.get(parentId) || [];
      return kids.reduce<string[]>(
        (acc, k) => [...acc, k.id, ...getDescendants(k.id)],
        []
      );
    };

    if (newSupervisorId && getDescendants(agentId).includes(newSupervisorId)) {
      toast.error("Circular hierarchy prevented: An agent cannot report to its own subordinate!");
      return;
    }

    const previousState = [...localAgents];
    const targetAgent = localAgents.find((a) => a.id === agentId);
    const supervisor = newSupervisorId ? localAgents.find((a) => a.id === newSupervisorId) : null;

    // Optimistic UI update
    setLocalAgents((prev) =>
      prev.map((a) => (a.id === agentId ? { ...a, reportsToId: newSupervisorId } : a))
    );
    setReassignModalAgent(null);
    setDraggedAgentId(null);
    setDropTargetId(null);

    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportsToId: newSupervisorId }),
      });

      if (!res.ok) throw new Error("Server rejected hierarchy change");

      toast.success(
        supervisor
          ? `Reassigned ${targetAgent?.displayName} under ${supervisor.displayName}`
          : `Promoted ${targetAgent?.displayName} to Org Root`
      );

      if (onRefresh) onRefresh();
    } catch {
      setLocalAgents(previousState);
      toast.error("Failed to reassign supervisor");
    }
  };

  // Check if an agent matches search or department
  const isAgentMatch = (agent: AgentProfile): boolean => {
    if (selectedDept !== "all" && agent.department !== selectedDept) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      agent.displayName.toLowerCase().includes(q) ||
      agent.name.toLowerCase().includes(q) ||
      Boolean(agent.role && agent.role.toLowerCase().includes(q)) ||
      Boolean(agent.department && agent.department.toLowerCase().includes(q)) ||
      Boolean(agent.model && agent.model.toLowerCase().includes(q))
    );
  };

  // Hover lineage detection
  const hoveredAgent = hoveredAgentId ? agentMap.get(hoveredAgentId) : null;
  const isLineageHighlighted = (agentId: string) => {
    if (!hoveredAgentId) return false;
    if (hoveredAgentId === agentId) return true;
    if (hoveredAgent?.reportsToId === agentId) return true;
    const childList = childrenMap.get(hoveredAgentId) || [];
    if (childList.some((c) => c.id === agentId)) return true;
    return false;
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header & Controls Toolbar */}
      <div className="p-4 rounded-lg border border-border bg-card/70 backdrop-blur-xl space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Title & Stats */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-card /20 border border-border flex items-center justify-center text-primary">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground tracking-tight">
                  Agent Hierarchy Graph
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-border">
                  {stats.total} Agents
                </span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-muted-foreground dark:text-muted-foreground">
                  {stats.rootsCount} Org Root{stats.rootsCount === 1 ? "" : "s"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Visual chain of command & interactive drag-and-drop supervisor restructuring
              </p>
            </div>
          </div>

          {/* View Switcher & Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-1 rounded-xl bg-secondary/80 border border-border text-xs">
              <button
                onClick={() => setViewMode("graph")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === "graph"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                <span>Graph View</span>
              </button>
              <button
                onClick={() => setViewMode("matrix")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                  viewMode === "matrix"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Tier Matrix</span>
              </button>
            </div>

            {/* Tree Collapse / Expand controls */}
            {viewMode === "graph" && (
              <div className="flex items-center gap-1 bg-secondary/70 border border-border rounded-xl p-1 text-xs">
                <button
                  onClick={expandAll}
                  title="Expand all branches"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={collapseAll}
                  title="Collapse all branches"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <ChevronsDownUp className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Zoom Controls */}
            {viewMode === "graph" && (
              <div className="flex items-center gap-1 bg-secondary/70 border border-border rounded-xl p-1 text-xs">
                <button
                  onClick={() => handleZoom(-0.15)}
                  title="Zoom Out"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-muted-foreground px-1 min-w-[40px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => handleZoom(0.15)}
                  title="Zoom In"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={resetZoom}
                  title="Reset Zoom (100%)"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find agent, role, or model..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-secondary/60 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-border"
            />
          </div>

          {/* Department Filter Pills */}
          {departments.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] text-muted-foreground font-medium">Dept:</span>
              <button
                onClick={() => setSelectedDept("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  selectedDept === "all"
                    ? "bg-primary/30 text-primary border border-border text-primary"
                    : "border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                All ({localAgents.length})
              </button>
              {departments.map((dept) => {
                const count = localAgents.filter((a) => a.department === dept).length;
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      selectedDept === dept
                        ? "bg-primary/30 text-primary border border-border text-primary"
                        : "border border-border bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    {dept} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {/* Role Badges Legend */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground ml-auto">
            {Object.entries(ROLE_META).map(([key, meta]) => {
              const count = localAgents.filter((a) => (a.role || "worker") === key).length;
              return (
                <div
                  key={key}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg border border-border bg-secondary/40"
                >
                  <span
                    className="w-2 h-2 rounded-md shadow-sm"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="capitalize">{meta.label}</span>
                  <span className="text-muted-foreground font-mono text-[10px]">({count})</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      {viewMode === "graph" ? (
        <div className="relative w-full rounded-lg border border-border bg-card/80 backdrop-blur-xl overflow-hidden min-h-[620px] flex flex-col">
          {/* Subtle Grid Background */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.15) 1px, transparent 0)",
              backgroundSize: "28px 28px",
            }}
          />

          {/* Dragging Active Drop Zone: Promote to Org Root */}
          <AnimatePresence>
            {draggedAgentId && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                onDragOver={(e: any) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                  setDropTargetId("root-dropzone");
                }}
                onDragLeave={() => setDropTargetId(null)}
                onDrop={(e: any) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const droppedId = e.dataTransfer?.getData("text/plain") || draggedAgentId;
                  if (droppedId) handleReassignSupervisor(droppedId, null);
                }}
                className={`m-4 p-3 rounded-xl border-2 border-dashed text-center transition-all z-20 ${
                  dropTargetId === "root-dropzone"
                    ? "border-amber-400 bg-amber-500/20 text-amber-200 ring-2 ring-amber-400/40"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                <div className="flex items-center justify-center gap-2 text-xs font-semibold">
                  <Crown className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />
                  <span>Drop here to promote agent to Org Root (Lead / Unsupervised)</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Interactive Graph Canvas */}
          <div className="relative flex-1 overflow-auto p-8 sm:p-12">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "top center",
                transition: "transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
              className="flex justify-center min-w-max pb-16"
            >
              {rootAgents.length === 0 ? (
                <div className="py-24 text-center text-muted-foreground text-sm">
                  No agents found in fleet.
                </div>
              ) : (
                <div className="flex gap-12 sm:gap-16 items-start justify-center">
                  {rootAgents.map((root) => (
                    <GraphTreeNode
                      key={root.id}
                      agent={root}
                      childrenMap={childrenMap}
                      agentMap={agentMap}
                      collapsedNodes={collapsedNodes}
                      onToggleCollapse={toggleCollapse}
                      onOpenHermes={onOpenHermes}
                      hoveredAgentId={hoveredAgentId}
                      setHoveredAgentId={setHoveredAgentId}
                      isLineageHighlighted={isLineageHighlighted}
                      isAgentMatch={isAgentMatch}
                      onDragStart={(id) => setDraggedAgentId(id)}
                      onDragEnd={() => {
                        setDraggedAgentId(null);
                        setDropTargetId(null);
                      }}
                      onDropTarget={setDropTargetId}
                      dropTargetId={dropTargetId}
                      draggedAgentId={draggedAgentId}
                      onReassignSupervisor={handleReassignSupervisor}
                      onOpenReassignModal={(agent) => setReassignModalAgent(agent)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Graph Footer */}
          <div className="px-5 py-2.5 border-t border-border bg-card/90 backdrop-blur-xl flex items-center justify-between text-[11px] text-muted-foreground z-10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>
                Drag any card onto another agent to reassign its supervisor, or onto the top banner to make it an Org Root.
              </span>
            </div>
            <span className="font-mono text-muted-foreground">
              {localAgents.length} Nodes Active
            </span>
          </div>
        </div>
      ) : (
        /* Command Tier Matrix View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          {(
            [
              { key: "orchestrator", label: "Orchestrators", list: tiers.orchestrators },
              { key: "manager", label: "Managers", list: tiers.managers },
              { key: "specialist", label: "Specialists", list: tiers.specialists },
              { key: "worker", label: "Workers", list: tiers.workers },
            ] as const
          ).map((tier) => {
            const meta = ROLE_META[tier.key];
            const Icon = meta.icon;
            const filteredList = tier.list.filter(isAgentMatch);

            return (
              <div
                key={tier.key}
                className="flex flex-col rounded-lg border border-border bg-card/70 backdrop-blur-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center border ${meta.border} ${meta.bg}`}
                    >
                      <Icon className={`w-4 h-4 ${meta.text}`} />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">{tier.label}</h4>
                      <p className="text-[10px] text-muted-foreground">{meta.desc}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground">
                    {filteredList.length}
                  </span>
                </div>

                <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[580px] pr-0.5">
                  {filteredList.length === 0 ? (
                    <div className="py-12 text-center border border-dashed border-border rounded-xl text-xs text-muted-foreground">
                      No agents in tier
                    </div>
                  ) : (
                    filteredList.map((agent) => {
                      const supervisor = agent.reportsToId
                        ? agentMap.get(agent.reportsToId)
                        : null;
                      const reports = childrenMap.get(agent.id) || [];

                      return (
                        <div
                          key={agent.id}
                          onMouseEnter={() => setHoveredAgentId(agent.id)}
                          onMouseLeave={() => setHoveredAgentId(null)}
                          className={`p-3 rounded-xl border transition-all space-y-2 group ${
                            isLineageHighlighted(agent.id)
                              ? "border-border bg-primary/10 text-primary shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40"
                              : "border-border bg-secondary/50 hover:bg-card hover:border-border"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-xl shrink-0">{agent.avatar || "🤖"}</span>
                              <div className="min-w-0">
                                <h5 className="text-xs font-bold text-foreground truncate">
                                  {agent.displayName}
                                </h5>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">
                                  @{agent.name}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                onClick={() => setReassignModalAgent(agent)}
                                className="p-1.5 rounded-lg border border-border bg-secondary/80 text-muted-foreground hover:text-amber-300 hover:bg-amber-500/20 transition-colors"
                                title="Reassign supervisor"
                              >
                                <UserCheck className="w-3 h-3" />
                              </button>
                              <Link
                                href={`/chat?agentId=${agent.id}`}
                                className="p-1.5 rounded-lg border border-border bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-primary/20 text-primary transition-colors"
                                title="Chat with agent"
                              >
                                <MessageSquare className="w-3 h-3" />
                              </Link>
                              <button
                                onClick={() => onOpenHermes(agent)}
                                className="p-1.5 rounded-lg border border-border bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary dark:bg-secondary transition-colors"
                                title="Open Hermes CLI"
                              >
                                <Terminal className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1 text-[10px]">
                            {supervisor && (
                              <span className="px-2 py-0.5 rounded bg-secondary/80 border border-border text-muted-foreground flex items-center gap-1">
                                <ArrowDown className="w-2.5 h-2.5 text-foreground rotate-180" />
                                <span>Reports to: {supervisor.displayName}</span>
                              </span>
                            )}
                            {reports.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-border text-primary flex items-center gap-1">
                                <Users className="w-2.5 h-2.5" />
                                <span>{reports.length} Reports</span>
                              </span>
                            )}
                            {agent.department && (
                              <span className="px-2 py-0.5 rounded bg-secondary/50 text-muted-foreground">
                                {agent.department}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Accessible Reassign Supervisor Modal */}
      <AnimatePresence>
        {reassignModalAgent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-card border border-border rounded-lg p-5 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-foreground" />
                  <h4 className="text-sm font-bold text-foreground">
                    Reassign Supervisor for {reassignModalAgent.displayName}
                  </h4>
                </div>
                <button
                  onClick={() => setReassignModalAgent(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Choose which agent oversees this specialist, or promote them to an independent Org Root.
              </p>

              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {/* Option 1: Org Root */}
                <button
                  onClick={() => handleReassignSupervisor(reassignModalAgent.id, null)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                    !reassignModalAgent.reportsToId
                      ? "bg-amber-500/15 border-amber-500/50 text-amber-200"
                      : "bg-secondary/50 border-border text-muted-foreground hover:bg-card"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">None (Org Root)</span>
                      <p className="text-[10px] text-muted-foreground">Autonomous fleet leader</p>
                    </div>
                  </div>
                  {!reassignModalAgent.reportsToId && (
                    <span className="text-[10px] font-semibold text-muted-foreground dark:text-muted-foreground">Current</span>
                  )}
                </button>

                {/* Other Agents */}
                {localAgents
                  .filter((a) => a.id !== reassignModalAgent.id)
                  .map((candidate) => {
                    const isCurrent = reassignModalAgent.reportsToId === candidate.id;
                    const meta = ROLE_META[(candidate.role || "worker") as keyof typeof ROLE_META] || ROLE_META.worker;

                    return (
                      <button
                        key={candidate.id}
                        onClick={() => handleReassignSupervisor(reassignModalAgent.id, candidate.id)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                          isCurrent
                            ? "bg-primary/15 text-primary border-border text-foreground ring-1 ring-indigo-500/40"
                            : "bg-secondary/50 border-border text-muted-foreground hover:bg-card"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg shrink-0">{candidate.avatar || "🤖"}</span>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-foreground truncate">
                                {candidate.displayName}
                              </span>
                              <span
                                className={`text-[9px] px-1.5 py-0.2 rounded-md border ${meta.border} ${meta.bg} ${meta.text}`}
                              >
                                {meta.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">
                              @{candidate.name} {candidate.department ? `• ${candidate.department}` : ""}
                            </p>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="text-[10px] font-semibold text-foreground shrink-0">Current</span>
                        )}
                      </button>
                    );
                  })}
              </div>

              <div className="pt-2 border-t border-border flex justify-end">
                <button
                  onClick={() => setReassignModalAgent(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==========================================
// Recursive Graph Tree Node Component
// ==========================================

interface GraphTreeNodeProps {
  agent: AgentProfile;
  childrenMap: Map<string, AgentProfile[]>;
  agentMap: Map<string, AgentProfile>;
  collapsedNodes: Record<string, boolean>;
  onToggleCollapse: (id: string) => void;
  onOpenHermes: (agent: AgentProfile) => void;
  hoveredAgentId: string | null;
  setHoveredAgentId: (id: string | null) => void;
  isLineageHighlighted: (id: string) => boolean;
  isAgentMatch: (agent: AgentProfile) => boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTarget: (id: string | null) => void;
  dropTargetId: string | null;
  draggedAgentId: string | null;
  onReassignSupervisor: (agentId: string, supervisorId: string | null) => void;
  onOpenReassignModal: (agent: AgentProfile) => void;
}

function GraphTreeNode({
  agent,
  childrenMap,
  agentMap,
  collapsedNodes,
  onToggleCollapse,
  onOpenHermes,
  hoveredAgentId,
  setHoveredAgentId,
  isLineageHighlighted,
  isAgentMatch,
  onDragStart,
  onDragEnd,
  onDropTarget,
  dropTargetId,
  draggedAgentId,
  onReassignSupervisor,
  onOpenReassignModal,
}: GraphTreeNodeProps) {
  const children = childrenMap.get(agent.id) || [];
  const hasChildren = children.length > 0;
  const isCollapsed = !!collapsedNodes[agent.id];

  const role = (agent.role || "worker") as keyof typeof ROLE_META;
  const meta = ROLE_META[role] || ROLE_META.worker;
  const RoleIcon = meta.icon;

  const matchesFilter = isAgentMatch(agent);
  const isHighlighted = isLineageHighlighted(agent.id);
  const isDropTarget = dropTargetId === agent.id && draggedAgentId !== agent.id;

  return (
    <div className="flex flex-col items-center select-none">
      {/* Node Card */}
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{
          opacity: matchesFilter ? 1 : 0.35,
          scale: isDropTarget ? 1.05 : 1,
        }}
        transition={{ duration: 0.2 }}
        draggable={true}
        onDragStart={(e: any) => {
          e.stopPropagation();
          if (e.dataTransfer) {
            e.dataTransfer.setData("text/plain", agent.id);
            e.dataTransfer.effectAllowed = "move";
          }
          onDragStart(agent.id);
        }}
        onDragEnd={onDragEnd}
        onDragOver={(e: any) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
          }
          if (draggedAgentId && draggedAgentId !== agent.id) {
            onDropTarget(agent.id);
          }
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dropTargetId === agent.id) {
            onDropTarget(null);
          }
        }}
        onDrop={(e: any) => {
          e.preventDefault();
          e.stopPropagation();
          const droppedId = e.dataTransfer?.getData("text/plain") || draggedAgentId;
          if (droppedId && droppedId !== agent.id) {
            onReassignSupervisor(droppedId, agent.id);
          }
        }}
        onMouseEnter={() => setHoveredAgentId(agent.id)}
        onMouseLeave={() => setHoveredAgentId(null)}
        className={`relative group w-72 rounded-lg border transition-all duration-200 z-10 cursor-grab active:cursor-grabbing ${
          isDropTarget
            ? "border-emerald-400 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-2xl shadow-emerald-500/40 ring-2 ring-emerald-400"
            : isHighlighted
            ? "border-amber-600 bg-secondary/95 shadow-xl shadow-indigo-500/25 ring-2 ring-indigo-500/50"
            : "border-border bg-card/90 backdrop-blur-xl hover:border-border hover:bg-secondary/90 shadow-md"
        }`}
      >
        {/* Glowing Top Accent Bar */}
        <div
          className="h-1 w-full rounded-t-2xl transition-all"
          style={{
            backgroundColor: isDropTarget ? "#10b981" : meta.color,
            boxShadow: `0 0 12px ${isDropTarget ? "#10b981" : meta.color}50`,
          }}
        />

        {isDropTarget && (
          <div className="bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/40 px-3 py-1 text-center">
            <span className="text-[10.5px] font-bold text-emerald-200 animate-pulse">
              ⬇ Drop to assign under {agent.displayName}
            </span>
          </div>
        )}

        <div className="p-3.5 space-y-2.5">
          {/* Top Row: Avatar, Names, Role Badge */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl border shrink-0 relative"
                style={{
                  borderColor: `${meta.color}40`,
                  backgroundColor: `${meta.color}15`,
                }}
              >
                {agent.avatar || "🤖"}
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-md bg-emerald-500 border-2 border-zinc-950 shadow-sm" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  <h4 className="text-xs font-bold text-foreground truncate group-hover:text-foreground transition-colors">
                    {agent.displayName}
                  </h4>
                </div>
                <p className="text-[10.5px] text-muted-foreground font-mono truncate">
                  @{agent.name}
                </p>
              </div>
            </div>

            {/* Role Badge */}
            <span
              className={`text-[9.5px] font-semibold px-2 py-0.5 rounded-md border flex items-center gap-1 shrink-0 ${meta.border} ${meta.bg} ${meta.text}`}
            >
              <RoleIcon className="w-2.5 h-2.5" />
              <span className="capitalize">{meta.label}</span>
            </span>
          </div>

          {/* Middle Row: Model & Department */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {agent.department && (
              <span className="px-2 py-0.5 rounded-md border border-border bg-secondary/90 text-muted-foreground font-medium">
                {agent.department}
              </span>
            )}
            {agent.model && (
              <span className="px-2 py-0.5 rounded-md border border-border bg-primary/10 text-primary font-mono">
                {agent.model.split("/").pop() || agent.model}
              </span>
            )}
          </div>

          {/* Bottom Row: Direct Reports Button & Actions */}
          <div className="pt-2 border-t border-border flex items-center justify-between text-xs">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCollapse(agent.id);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition-all border ${
                  isCollapsed
                    ? "bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25"
                    : "bg-primary/15 text-primary border-border text-primary hover:bg-primary/25 text-primary"
                }`}
                title={isCollapsed ? "Expand subordinates" : "Collapse subordinates"}
              >
                <Users className="w-3 h-3" />
                <span>
                  {children.length} Report{children.length === 1 ? "" : "s"}
                </span>
                {isCollapsed ? (
                  <ChevronRight className="w-3 h-3" />
                ) : (
                  <ChevronDown className="w-3 h-3" />
                )}
              </button>
            ) : (
              <span className="text-[10px] text-muted-foreground italic px-1">
                Direct Contributor
              </span>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onOpenReassignModal(agent)}
                className="p-1.5 rounded-lg border border-border bg-card hover:bg-amber-500/20 hover:text-amber-300 text-muted-foreground transition-colors"
                title="Reassign Supervisor"
              >
                <UserCheck className="w-3 h-3" />
              </button>
              <Link
                href={`/chat?agentId=${agent.id}`}
                className="p-1.5 rounded-lg border border-border bg-card hover:bg-primary/90 hover:text-foreground text-muted-foreground transition-colors"
                title="Direct Chat"
              >
                <MessageSquare className="w-3 h-3" />
              </Link>
              <button
                onClick={() => onOpenHermes(agent)}
                className="p-1.5 rounded-lg border border-border bg-card hover:bg-secondary hover:text-foreground text-muted-foreground transition-colors"
                title="Hermes CLI"
              >
                <Terminal className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tree Connectors & Children */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col items-center w-full">
          <div className="w-0.5 h-6 bg-card /30 relative">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-md bg-indigo-400 shadow-sm" />
          </div>

          <div className="relative flex justify-center pt-0">
            {children.map((child, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === children.length - 1;
              const isSingleChild = children.length === 1;

              return (
                <div
                  key={child.id}
                  className="relative px-5 sm:px-8 flex flex-col items-center"
                >
                  {!isSingleChild && (
                    <div
                      className={`absolute top-0 h-0.5 bg-primary/30 text-primary ${
                        isFirst
                          ? "left-1/2 right-0"
                          : isLast
                          ? "left-0 right-1/2"
                          : "left-0 right-0"
                      }`}
                    />
                  )}

                  <div className="w-0.5 h-6 bg-primary/30 text-primary mb-0 relative">
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-md bg-indigo-400/60" />
                  </div>

                  <GraphTreeNode
                    agent={child}
                    childrenMap={childrenMap}
                    agentMap={agentMap}
                    collapsedNodes={collapsedNodes}
                    onToggleCollapse={onToggleCollapse}
                    onOpenHermes={onOpenHermes}
                    hoveredAgentId={hoveredAgentId}
                    setHoveredAgentId={setHoveredAgentId}
                    isLineageHighlighted={isLineageHighlighted}
                    isAgentMatch={isAgentMatch}
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                    onDropTarget={onDropTarget}
                    dropTargetId={dropTargetId}
                    draggedAgentId={draggedAgentId}
                    onReassignSupervisor={onReassignSupervisor}
                    onOpenReassignModal={onOpenReassignModal}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
