"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Terminal,
  Search,
  Users,
  GitBranch,
  Pencil,
  Crown,
  Shield,
  Zap,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Radio,
  X,
  Layers,
  ArrowRight,
  GripVertical,
  ArrowUpCircle,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

interface AgentHierarchyViewProps {
  agents: AgentProfile[];
  onOpenHermes: (agent: AgentProfile) => void;
  onRefresh?: () => void;
  onEdit?: (agent: AgentProfile) => void;
  onDelete?: (agent: AgentProfile) => void;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; badgeClass: string; borderClass: string; icon: React.ElementType }
> = {
  orchestrator: {
    label: "Orchestrator",
    badgeClass: "bg-[#e6f3fe] text-[#0075de] border-[#0075de]/30",
    borderClass: "border-[#0075de]/40 hover:border-[#0075de]",
    icon: Crown,
  },
  manager: {
    label: "Manager",
    badgeClass: "bg-secondary text-foreground border-border",
    borderClass: "border-border hover:border-foreground/40",
    icon: Shield,
  },
  specialist: {
    label: "Specialist",
    badgeClass: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    borderClass: "border-purple-500/30 hover:border-purple-500/70",
    icon: Zap,
  },
  worker: {
    label: "Worker",
    badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    borderClass: "border-emerald-500/30 hover:border-emerald-500/70",
    icon: CheckCircle2,
  },
};

const NODE_WIDTH = 230;
const NODE_HEIGHT = 88;
const LEVEL_HEIGHT = 165;
const NODE_GAP = 36;

interface PositionedNode {
  agent: AgentProfile;
  x: number;
  y: number;
  level: number;
  children: PositionedNode[];
  parentId?: string;
}

export function AgentHierarchyView({
  agents,
  onOpenHermes,
  onRefresh,
  onEdit,
  onDelete,
}: AgentHierarchyViewProps) {
  const [localAgents, setLocalAgents] = useState<AgentProfile[]>(agents);
  const [viewMode, setViewMode] = useState<"graph" | "tree">("graph");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [collapsedBranches, setCollapsedBranches] = useState<Record<string, boolean>>({});

  // Drag and Drop hierarchy reassignment state
  const [draggedAgentId, setDraggedAgentId] = useState<string | null>(null);
  const [dragOverTargetId, setDragOverTargetId] = useState<string | null>(null);
  const [isOverTopLevelZone, setIsOverTopLevelZone] = useState(false);

  // Canvas pan & zoom state
  const [pan, setPan] = useState({ x: 50, y: 60 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Sync with incoming agents prop
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

  // Fast agent map
  const agentMap = useMemo(() => {
    const map = new Map<string, AgentProfile>();
    localAgents.forEach((a) => map.set(a.id, a));
    return map;
  }, [localAgents]);

  // Build tree hierarchy structure
  const { rootNodes, childrenMap } = useMemo(() => {
    const cMap = new Map<string, AgentProfile[]>();
    const roots: AgentProfile[] = [];

    localAgents.forEach((a) => {
      if (a.reportsToId && agentMap.has(a.reportsToId)) {
        const list = cMap.get(a.reportsToId) || [];
        list.push(a);
        cMap.set(a.reportsToId, list);
      } else {
        roots.push(a);
      }
    });

    return { rootNodes: roots, childrenMap: cMap };
  }, [localAgents, agentMap]);

  // Helper to check if potentialChildId is already an ancestor/descendant
  const isDescendant = useCallback(
    (parentId: string, targetChildId: string): boolean => {
      if (parentId === targetChildId) return true;
      const children = childrenMap.get(parentId) || [];
      for (const child of children) {
        if (child.id === targetChildId || isDescendant(child.id, targetChildId)) {
          return true;
        }
      }
      return false;
    },
    [childrenMap]
  );

  // Reassign an agent's manager via drag-and-drop
  const handleReassignManager = async (draggedId: string, newManagerId: string | null) => {
    if (!draggedId) return;
    if (draggedId === newManagerId) return;

    const dragged = agentMap.get(draggedId);
    if (!dragged) return;

    if (newManagerId) {
      if (isDescendant(draggedId, newManagerId)) {
        toast.error(`Cannot assign "${dragged.displayName}" under its own subordinate`);
        return;
      }
    }

    const manager = newManagerId ? agentMap.get(newManagerId) : null;

    // Optimistic update
    setLocalAgents((prev) =>
      prev.map((a) => (a.id === draggedId ? { ...a, reportsToId: newManagerId } : a))
    );

    try {
      const res = await fetch(`/api/agents/${draggedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportsToId: newManagerId }),
      });

      if (res.ok) {
        if (manager) {
          toast.success(`Reassigned "${dragged.displayName}" to report to "${manager.displayName}"`);
        } else {
          toast.success(`Promoted "${dragged.displayName}" to Top-Level (Independent / Orchestrator)`);
        }
        onRefresh?.();
      } else {
        toast.error("Failed to update agent hierarchy");
        onRefresh?.();
      }
    } catch {
      toast.error("Network error updating hierarchy");
      onRefresh?.();
    }
  };

  // Toggle collapsing a branch
  const toggleBranch = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCollapsedBranches((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Calculate layout coordinates for tree graph
  const { positionedNodes, totalWidth, totalHeight, connections } = useMemo(() => {
    const nodes: PositionedNode[] = [];
    const conns: {
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }[] = [];

    // Calculate width of a subtree recursively
    function getSubtreeWidth(agent: AgentProfile): number {
      if (collapsedBranches[agent.id]) return NODE_WIDTH;
      const children = childrenMap.get(agent.id) || [];
      if (children.length === 0) return NODE_WIDTH;
      const childrenWidth = children.reduce(
        (sum, child) => sum + getSubtreeWidth(child) + NODE_GAP,
        -NODE_GAP
      );
      return Math.max(NODE_WIDTH, childrenWidth);
    }

    // Position a subtree recursively
    function layoutNode(
      agent: AgentProfile,
      startX: number,
      level: number,
      parentId?: string
    ): PositionedNode {
      const subtreeWidth = getSubtreeWidth(agent);
      const isCollapsed = Boolean(collapsedBranches[agent.id]);
      const children = isCollapsed ? [] : childrenMap.get(agent.id) || [];

      // Center this node within its allocated subtree width
      const nodeX = startX + (subtreeWidth - NODE_WIDTH) / 2;
      const nodeY = 40 + level * LEVEL_HEIGHT;

      const posNode: PositionedNode = {
        agent,
        x: nodeX,
        y: nodeY,
        level,
        children: [],
        parentId,
      };

      if (parentId) {
        const parentPos = nodes.find((n) => n.agent.id === parentId);
        if (parentPos) {
          conns.push({
            fromId: parentId,
            toId: agent.id,
            x1: parentPos.x + NODE_WIDTH / 2,
            y1: parentPos.y + NODE_HEIGHT,
            x2: nodeX + NODE_WIDTH / 2,
            y2: nodeY,
          });
        }
      }

      nodes.push(posNode);

      let currentChildX = startX;
      children.forEach((child) => {
        const childSubtreeWidth = getSubtreeWidth(child);
        const childNode = layoutNode(child, currentChildX, level + 1, agent.id);
        posNode.children.push(childNode);
        currentChildX += childSubtreeWidth + NODE_GAP;
      });

      return posNode;
    }

    let currentRootX = 50;
    rootNodes.forEach((root) => {
      const rootWidth = getSubtreeWidth(root);
      layoutNode(root, currentRootX, 0);
      currentRootX += rootWidth + NODE_GAP * 1.5;
    });

    const maxX = nodes.reduce((max, n) => Math.max(max, n.x + NODE_WIDTH + 80), 900);
    const maxY = nodes.reduce((max, n) => Math.max(max, n.y + NODE_HEIGHT + 100), 550);

    return {
      positionedNodes: nodes,
      totalWidth: maxX,
      totalHeight: maxY,
      connections: conns,
    };
  }, [rootNodes, childrenMap, collapsedBranches]);

  // Check if an agent matches search or department
  const isAgentMatched = useCallback(
    (agent: AgentProfile) => {
      if (selectedDept !== "all" && agent.department !== selectedDept) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        agent.displayName.toLowerCase().includes(q) ||
        (agent.role || "").toLowerCase().includes(q) ||
        (agent.department || "").toLowerCase().includes(q) ||
        (agent.model || "").toLowerCase().includes(q)
      );
    },
    [searchQuery, selectedDept]
  );

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest(".agent-node-card") ||
      (e.target as HTMLElement).closest("button") ||
      (e.target as HTMLElement).closest("a")
    ) {
      return;
    }
    setIsPanning(true);
    panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: e.clientX - panStartRef.current.x,
      y: e.clientY - panStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleResetFit = () => {
    setPan({ x: 50, y: 60 });
    setZoom(1);
  };

  const draggedAgent = draggedAgentId ? agentMap.get(draggedAgentId) : null;

  return (
    <div className="space-y-4 w-full">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 sm:p-4 rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-medium text-[#0075de] bg-[#e6f3fe] px-2.5 py-0.5 rounded-full border border-[#0075de]/20 inline-flex items-center gap-1.5">
              <GitBranch className="w-3 h-3 text-[#0075de]" />
              Interactive Hierarchy Graph
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {localAgents.length} Agents • Drag cards to reassign reports
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Drag any agent card onto another to restructure command reporting lines
          </p>
        </div>

        {/* View Switcher & Graph Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {viewMode === "graph" && (
            <div className="flex items-center gap-1 bg-secondary/50 p-1 rounded-lg border border-border text-xs">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Zoom in"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))}
                className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                title="Zoom out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleResetFit}
                className="px-2 py-0.5 rounded hover:bg-secondary text-[11px] font-mono text-muted-foreground hover:text-foreground transition cursor-pointer flex items-center gap-1"
                title="Reset view"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{Math.round(zoom * 100)}%</span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted border border-border text-xs">
            <button
              onClick={() => setViewMode("graph")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "graph"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Interactive Graph
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                viewMode === "tree"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tree List
            </button>
          </div>
        </div>
      </div>

      {/* Filter Row: Search & Department Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search agents in graph..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition"
          />
        </div>

        {departments.length > 0 && (
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              onClick={() => setSelectedDept("all")}
              className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                selectedDept === "all"
                  ? "bg-[#e6f3fe] text-[#0075de] border border-[#0075de]/30"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              All Departments
            </button>
            {departments.map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDept(dept)}
                className={`px-2.5 py-1 rounded-full font-medium transition cursor-pointer whitespace-nowrap ${
                  selectedDept === dept
                    ? "bg-[#e6f3fe] text-[#0075de] border border-[#0075de]/30"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {viewMode === "graph" ? (
        <div className="relative w-full rounded-2xl border border-border bg-card/60 backdrop-blur-xs overflow-hidden shadow-xs">
          {/* Top-Level Drop Target Zone (Visible while dragging) */}
          {draggedAgent && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setIsOverTopLevelZone(true);
              }}
              onDragLeave={() => setIsOverTopLevelZone(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsOverTopLevelZone(false);
                if (draggedAgentId) {
                  handleReassignManager(draggedAgentId, null);
                  setDraggedAgentId(null);
                  setDragOverTargetId(null);
                }
              }}
              className={`absolute top-3 left-1/2 -translate-x-1/2 z-30 px-5 py-2.5 rounded-xl border-2 border-dashed transition-all flex items-center gap-2 text-xs font-semibold shadow-md ${
                isOverTopLevelZone
                  ? "bg-[#0075de] text-white border-[#0075de] scale-105"
                  : "bg-card/95 text-foreground border-[#0075de]/50 hover:border-[#0075de]"
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>
                Drop here to promote <b>{draggedAgent.displayName}</b> to Top-Level (Orchestrator)
              </span>
            </div>
          )}

          {/* Interactive Graph Canvas */}
          <div
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className={`w-full h-[620px] overflow-hidden select-none relative bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-secondary/15 via-background to-background ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
          >
            {/* Pannable & Zoomable Container */}
            <div
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "0 0",
                width: totalWidth,
                height: totalHeight,
                position: "absolute",
                top: 0,
                left: 0,
                transition: isPanning ? "none" : "transform 0.15s ease-out",
              }}
            >
              {/* SVG Connector Lines */}
              <svg
                width={totalWidth}
                height={totalHeight}
                className="absolute inset-0 pointer-events-none z-0"
              >
                {connections.map((conn) => {
                  const isHighlighted =
                    draggedAgentId === conn.toId || dragOverTargetId === conn.fromId;
                  const midY = (conn.y1 + conn.y2) / 2;
                  const pathD = `M ${conn.x1} ${conn.y1} C ${conn.x1} ${midY}, ${conn.x2} ${midY}, ${conn.x2} ${conn.y2}`;

                  return (
                    <g key={`${conn.fromId}-${conn.toId}`}>
                      {isHighlighted && (
                        <path
                          d={pathD}
                          fill="none"
                          stroke="#0075de"
                          strokeWidth="3.5"
                          strokeOpacity="0.4"
                        />
                      )}
                      <path
                        d={pathD}
                        fill="none"
                        stroke={isHighlighted ? "#0075de" : "currentColor"}
                        strokeWidth={isHighlighted ? "2" : "1.25"}
                        strokeDasharray={isHighlighted ? "none" : "4,3"}
                        className={isHighlighted ? "" : "text-border dark:text-border/80"}
                      />
                    </g>
                  );
                })}
              </svg>

              {/* Node Cards with Drag-and-Drop */}
              {positionedNodes.map((node) => {
                const agent = node.agent;
                const isDraggingThis = draggedAgentId === agent.id;
                const isDragTarget = dragOverTargetId === agent.id && draggedAgentId !== agent.id;
                const isMatched = isAgentMatched(agent);
                const roleMeta = ROLE_CONFIG[agent.role || "specialist"] || ROLE_CONFIG.specialist;
                const RoleIcon = roleMeta.icon;
                const childrenCount = (childrenMap.get(agent.id) || []).length;
                const isCollapsed = Boolean(collapsedBranches[agent.id]);

                return (
                  <div
                    key={agent.id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", agent.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggedAgentId(agent.id);
                    }}
                    onDragEnd={() => {
                      setDraggedAgentId(null);
                      setDragOverTargetId(null);
                      setIsOverTopLevelZone(false);
                    }}
                    onDragOver={(e) => {
                      if (draggedAgentId && draggedAgentId !== agent.id) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDragEnter={(e) => {
                      if (draggedAgentId && draggedAgentId !== agent.id) {
                        e.preventDefault();
                        setDragOverTargetId(agent.id);
                      }
                    }}
                    onDragLeave={(e) => {
                      if (dragOverTargetId === agent.id) {
                        setDragOverTargetId(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverTargetId(null);
                      if (draggedAgentId && draggedAgentId !== agent.id) {
                        handleReassignManager(draggedAgentId, agent.id);
                        setDraggedAgentId(null);
                      }
                    }}
                    style={{
                      position: "absolute",
                      left: node.x,
                      top: node.y,
                      width: NODE_WIDTH,
                      height: NODE_HEIGHT,
                    }}
                    className={`agent-node-card rounded-xl border p-2.5 transition-all duration-150 shadow-xs z-10 select-none flex flex-col justify-between ${
                      isDraggingThis
                        ? "opacity-40 scale-95 border-[#0075de] ring-2 ring-[#0075de]"
                        : isDragTarget
                        ? "bg-[#e6f3fe]/40 border-2 border-dashed border-[#0075de] ring-4 ring-[#0075de]/20 scale-105 shadow-lg"
                        : isMatched
                        ? `bg-card ${roleMeta.borderClass} hover:shadow-md cursor-grab active:cursor-grabbing`
                        : "bg-card/40 border-border/50 opacity-40"
                    }`}
                  >
                    {/* Drop target badge overlay */}
                    {isDragTarget && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-[#0075de] text-white text-[10px] font-semibold tracking-wide whitespace-nowrap shadow-sm pointer-events-none">
                        ↳ Place under {agent.displayName}
                      </div>
                    )}

                    {/* Top Row: Drag Handle, Avatar, Name, Role */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab shrink-0">
                        <GripVertical className="w-3.5 h-3.5" />
                      </div>

                      <div className="w-8 h-8 rounded-lg bg-secondary/80 border border-border flex items-center justify-center text-base shrink-0">
                        {agent.avatar || "🤖"}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {agent.displayName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-medium border ${roleMeta.badgeClass}`}
                          >
                            <RoleIcon className="w-2.5 h-2.5" />
                            {roleMeta.label}
                          </span>
                          {agent.department && (
                            <span className="text-[10px] text-muted-foreground truncate">
                              {agent.department}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Direct reports badge & action buttons */}
                    <div className="flex items-center justify-between text-[10px] pt-1.5 border-t border-border/60 text-muted-foreground">
                      {childrenCount > 0 ? (
                        <button
                          type="button"
                          onClick={(e) => toggleBranch(agent.id, e)}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition cursor-pointer ${
                            isCollapsed
                              ? "bg-secondary text-foreground font-semibold"
                              : "hover:bg-muted text-muted-foreground"
                          }`}
                          title={isCollapsed ? "Expand direct reports" : "Collapse branch"}
                        >
                          {isCollapsed ? (
                            <ChevronRight className="w-2.5 h-2.5" />
                          ) : (
                            <ChevronDown className="w-2.5 h-2.5" />
                          )}
                          <span>
                            {childrenCount} {childrenCount === 1 ? "report" : "reports"}
                          </span>
                        </button>
                      ) : (
                        <span className="text-muted-foreground/60 text-[10px] truncate max-w-[100px]">
                          {agent.model ? agent.model.split("/").pop() : "Specialist"}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <Link
                          href={`/chat?agentId=${agent.id}`}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Chat with agent"
                        >
                          <MessageSquare className="w-3 h-3" />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onOpenHermes(agent)}
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Hermes Terminal"
                        >
                          <Terminal className="w-3 h-3" />
                        </button>
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(agent)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                            title="Edit agent"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(agent)}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition cursor-pointer"
                            title="Delete agent"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Instruction tooltip in corner */}
            <div className="absolute left-3 bottom-3 text-[11px] text-muted-foreground bg-card/85 backdrop-blur-md px-2.5 py-1 rounded-lg border border-border pointer-events-none shadow-xs">
              Drag an agent onto another to reassign manager • Drag canvas to pan
            </div>
          </div>
        </div>
      ) : (
        /* Alternative Tree List Mode */
        <div className="space-y-3">
          {rootNodes.map((root) => {
            const children = childrenMap.get(root.id) || [];
            const isMatched = isAgentMatched(root);

            return (
              <div
                key={root.id}
                className="p-3.5 rounded-xl border border-border bg-card space-y-2 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-base shrink-0">
                      {root.avatar || "🤖"}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground">
                          {root.displayName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e6f3fe] text-[#0075de] font-medium border border-[#0075de]/20">
                          {root.role}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate max-w-md">
                        {root.description || root.department}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/chat?agentId=${root.id}`}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-secondary text-foreground hover:bg-secondary/80 border border-border flex items-center gap-1"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>Chat</span>
                    </Link>
                    {onEdit && (
                      <button
                        type="button"
                        onClick={() => onEdit(root)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
                        title="Edit agent"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(root)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                        title="Delete agent"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {children.length > 0 && (
                  <div className="pl-6 border-l-2 border-border/70 ml-4 space-y-2 pt-1">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 border border-border/60 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span>{child.avatar || "🤖"}</span>
                          <span className="font-medium text-foreground">{child.displayName}</span>
                          <span className="text-[10px] text-muted-foreground">({child.role})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/chat?agentId=${child.id}`}
                            className="text-xs text-[#0075de] hover:underline"
                          >
                            Chat &rarr;
                          </Link>
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(child)}
                              className="text-muted-foreground hover:text-foreground p-0.5 transition cursor-pointer"
                              title="Edit agent"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(child)}
                              className="text-muted-foreground hover:text-red-500 p-0.5 transition cursor-pointer"
                              title="Delete agent"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
