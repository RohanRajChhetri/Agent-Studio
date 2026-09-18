"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Search,
  ExternalLink,
  Sparkles,
  Layers,
  FileText,
  Info,
} from "lucide-react";
import type { GalaxyData, GalaxyNode, GalaxyLink } from "@/lib/vault";

interface ObsidianGraphProps {
  data: GalaxyData | null;
  selectedPath?: string;
  onSelectNote: (notePath: string) => void;
  isDark?: boolean;
}

interface SimNode extends GalaxyNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface SimLink {
  source: SimNode;
  target: SimNode;
  type: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  task: "#a855f7",      // Purple
  research: "#06b6d4",  // Cyan
  strategy: "#f59e0b",  // Amber
  concept: "#10b981",   // Emerald
  system: "#6366f1",    // Indigo
};

export function ObsidianGraph({
  data,
  selectedPath,
  onSelectNote,
  isDark = true,
}: ObsidianGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation State Refs (mutable without triggering React re-renders)
  const nodesRef = useRef<SimNode[]>([]);
  const linksRef = useRef<SimLink[]>([]);
  const animFrameIdRef = useRef<number | null>(null);
  const isSimulatingRef = useRef<boolean>(true);

  // Viewport / Camera Transform
  const transformRef = useRef<{ x: number; y: number; k: number }>({
    x: 0,
    y: 0,
    k: 1,
  });

  // Interaction State
  const [hoveredNode, setHoveredNode] = useState<SimNode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showLabels, setShowLabels] = useState(true);
  const draggingNodeRef = useRef<SimNode | null>(null);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Initialize and update simulation graph data
  useEffect(() => {
    if (!data || !data.nodes || data.nodes.length === 0) return;

    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;

    // Center camera
    transformRef.current = {
      x: width / 2,
      y: height / 2,
      k: 0.95,
    };

    // Calculate node degree (link count)
    const degreeMap = new Map<string, number>();
    data.links.forEach((l) => {
      degreeMap.set(l.source, (degreeMap.get(l.source) || 0) + 1);
      degreeMap.set(l.target, (degreeMap.get(l.target) || 0) + 1);
    });

    // Create simulation nodes with distributed initial positions
    const nodeMap = new Map<string, SimNode>();
    const count = data.nodes.length;
    const radiusSpread = Math.min(width, height) * 0.35;

    const simNodes: SimNode[] = data.nodes.map((n, i) => {
      const angle = (i / count) * 2 * Math.PI;
      const dist = 40 + Math.random() * radiusSpread;
      const deg = degreeMap.get(n.id) || 1;
      const nodeRadius = Math.min(12, Math.max(4.5, 4 + Math.sqrt(deg) * 2.2));

      const sn: SimNode = {
        ...n,
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: nodeRadius,
      };
      nodeMap.set(n.id, sn);
      return sn;
    });

    // Map links to node references
    const simLinks: SimLink[] = [];
    data.links.forEach((l) => {
      const source = nodeMap.get(l.source);
      const target = nodeMap.get(l.target);
      if (source && target && source !== target) {
        simLinks.push({ source, target, type: l.type });
      }
    });

    nodesRef.current = simNodes;
    linksRef.current = simLinks;
    isSimulatingRef.current = true;
    startSimulationLoop();

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [data]);

  // Main simulation & render loop
  const startSimulationLoop = useCallback(() => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);

    const stepSimulation = () => {
      const nodes = nodesRef.current;
      const links = linksRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Physical Force Calculation (if simulation is active)
      let totalKineticEnergy = 0;
      if (isSimulatingRef.current) {
        const linkDistance = 75;
        const linkStrength = 0.045;
        const charge = 450;
        const centerGravity = 0.008;
        const damping = 0.86;

        // Hooke's Law: Spring force along links
        for (let i = 0; i < links.length; i++) {
          const l = links[i];
          const dx = l.target.x - l.source.x;
          const dy = l.target.y - l.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const delta = dist - linkDistance;
          const force = delta * linkStrength;

          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (l.target !== draggingNodeRef.current) {
            l.target.vx -= fx;
            l.target.vy -= fy;
          }
          if (l.source !== draggingNodeRef.current) {
            l.source.vx += fx;
            l.source.vy += fy;
          }
        }

        // Coulomb's Law: Node-to-node repulsion with spatial partitioning
        const gridSize = 30; // Size of each grid cell
        const gridMap = new Map<string, SimNode[]>();

        // Assign nodes to grid cells
        for (const node of nodes) {
          const gridX = Math.floor(node.x / gridSize);
          const gridY = Math.floor(node.y / gridSize);
          const gridKey = `${gridX},${gridY}`;
          if (!gridMap.has(gridKey)) {
            gridMap.set(gridKey, []);
          }
          gridMap.get(gridKey)!.push(node);
        }

        // Check nodes in same or adjacent cells
        for (const node of nodes) {
          const gridX = Math.floor(node.x / gridSize);
          const gridY = Math.floor(node.y / gridSize);

          // Check this cell and adjacent cells
          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const neighborKey = `${gridX + dx},${gridY + dy}`;
              const neighborNodes = gridMap.get(neighborKey) || [];

              for (const other of neighborNodes) {
                // Skip self-check and duplicate checks (only check when other comes after node in array)
                if (other === other && other !== node && nodes.indexOf(other) > nodes.indexOf(node)) {
                  const dx = other.x - node.x;
                  const dy = other.y - node.y;
                  const distSq = dx * dx + dy * dy || 1;

                  if (distSq < 45000) {
                    const dist = Math.sqrt(distSq);
                    const force = charge / (distSq + 10);
                    const fx = (dx / dist) * force;
                    const fy = (dy / dist) * force;

                    if (node !== draggingNodeRef.current) {
                      node.vx -= fx;
                      node.vy -= fy;
                    }
                    if (other !== draggingNodeRef.current) {
                      other.vx += fx;
                      other.vy += fy;
                    }
                  }
                }
              }
            }
          }
        }

        // Center Gravity
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          if (a !== draggingNodeRef.current) {
            a.vx -= a.x * centerGravity;
            a.vy -= a.y * centerGravity;

            // Velocity integration & damping
            a.vx *= damping;
            a.vy *= damping;
            a.x += a.vx;
            a.y += a.vy;

            totalKineticEnergy += Math.abs(a.vx) + Math.abs(a.vy);
          }
        }
      }

      // Automatic energy sleep threshold to save 100% idle CPU
      if (totalKineticEnergy < 0.04 && !draggingNodeRef.current) {
        isSimulatingRef.current = false;
      }

      // 2. Render Graph to Canvas
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.save();
      const { x: cx, y: cy, k: zoom } = transformRef.current;
      ctx.translate(cx, cy);
      ctx.scale(zoom, zoom);

      // Filter set
      const query = searchQuery.toLowerCase().trim();
      const filteredSet = new Set<string>();
      nodes.forEach((n) => {
        const matchesCat = activeCategory === "all" || n.category === activeCategory;
        const matchesQuery = !query || n.name.toLowerCase().includes(query) || n.path.toLowerCase().includes(query);
        if (matchesCat && matchesQuery) {
          filteredSet.add(n.id);
        }
      });

      // Connected neighbors set when hovering
      const neighborSet = new Set<string>();
      if (hoveredNode) {
        neighborSet.add(hoveredNode.id);
        links.forEach((l) => {
          if (l.source.id === hoveredNode.id) neighborSet.add(l.target.id);
          if (l.target.id === hoveredNode.id) neighborSet.add(l.source.id);
        });
      }

      // Draw Edges / Links
      ctx.lineWidth = 1;
      for (let i = 0; i < links.length; i++) {
        const l = links[i];
        const isHoverConnected =
          hoveredNode &&
          (l.source.id === hoveredNode.id || l.target.id === hoveredNode.id);
        const inFilter = filteredSet.has(l.source.id) && filteredSet.has(l.target.id);

        if (hoveredNode) {
          if (isHoverConnected) {
            ctx.strokeStyle = isDark ? "rgba(99, 102, 241, 0.75)" : "rgba(79, 70, 229, 0.85)";
            ctx.lineWidth = 1.8;
          } else {
            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.04)" : "rgba(0, 0, 0, 0.04)";
            ctx.lineWidth = 0.8;
          }
        } else {
          ctx.lineWidth = 1;
          if (inFilter) {
            ctx.strokeStyle = isDark ? "rgba(148, 163, 184, 0.22)" : "rgba(100, 116, 139, 0.28)";
          } else {
            ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.06)";
          }
        }

        ctx.beginPath();
        ctx.moveTo(l.source.x, l.source.y);
        ctx.lineTo(l.target.x, l.target.y);
        ctx.stroke();
      }

      // Draw Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const isSelected = selectedPath && n.path === selectedPath;
        const isHovered = hoveredNode && n.id === hoveredNode.id;
        const isNeighbor = hoveredNode && neighborSet.has(n.id);
        const isFiltered = filteredSet.has(n.id);

        const nodeColor = CATEGORY_COLORS[n.category] || "#6366f1";

        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);

        // Opacity & Highlight determination
        if (hoveredNode) {
          if (isHovered) {
            ctx.fillStyle = "#ffffff";
            ctx.shadowColor = nodeColor;
            ctx.shadowBlur = 16;
          } else if (isNeighbor) {
            ctx.fillStyle = nodeColor;
            ctx.shadowColor = nodeColor;
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = isDark ? "rgba(100, 116, 139, 0.15)" : "rgba(148, 163, 184, 0.25)";
            ctx.shadowBlur = 0;
          }
        } else if (isFiltered) {
          ctx.fillStyle = isSelected ? "#ffffff" : nodeColor;
          ctx.shadowColor = nodeColor;
          ctx.shadowBlur = isSelected ? 14 : 4;
        } else {
          ctx.fillStyle = isDark ? "rgba(100, 116, 139, 0.2)" : "rgba(148, 163, 184, 0.3)";
          ctx.shadowBlur = 0;
        }

        ctx.fill();

        // Node outline ring
        ctx.lineWidth = isSelected ? 2.5 : 1;
        ctx.strokeStyle = isSelected
          ? "#6366f1"
          : isDark
          ? "rgba(0, 0, 0, 0.4)"
          : "rgba(255, 255, 255, 0.8)";
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Labels
        const shouldDrawLabel =
          (showLabels && isFiltered && (zoom >= 0.8 || isNeighbor || isHovered || isSelected)) ||
          isHovered;

        if (shouldDrawLabel) {
          ctx.font = `${isHovered || isSelected ? "bold " : ""}10px Inter, -apple-system, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "top";

          // Text shadow outline for readability
          ctx.lineWidth = 3;
          ctx.strokeStyle = isDark ? "rgba(9, 10, 15, 0.9)" : "rgba(248, 250, 252, 0.9)";
          ctx.strokeText(n.name, n.x, n.y + n.radius + 3.5);

          ctx.fillStyle = isHovered
            ? (isDark ? "#ffffff" : "#0f172a")
            : isNeighbor || isSelected
            ? (isDark ? "#e2e8f0" : "#1e293b")
            : (isDark ? "#94a3b8" : "#64748b");
          ctx.fillText(n.name, n.x, n.y + n.radius + 3.5);
        }
      }

      ctx.restore();

      // Keep animation running if active
      if (isSimulatingRef.current || draggingNodeRef.current || isPanningRef.current) {
        animFrameIdRef.current = requestAnimationFrame(stepSimulation);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(stepSimulation);
  }, [searchQuery, activeCategory, showLabels, hoveredNode, selectedPath, isDark]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
      }

      isSimulatingRef.current = true;
      startSimulationLoop();
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [startSimulationLoop]);

  // Screen to World coordinate conversion
  const screenToWorld = useCallback((screenX: number, screenY: number) => {
    const { x: cx, y: cy, k: zoom } = transformRef.current;
    return {
      x: (screenX - cx) / zoom,
      y: (screenY - cy) / zoom,
    };
  }, []);

  // Mouse interaction handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    // Check if a node was clicked
    let clickedNode: SimNode | null = null;
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldPos.x - n.x;
      const dy = worldPos.y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 4) * (n.radius + 4)) {
        clickedNode = n;
        break;
      }
    }

    if (clickedNode) {
      draggingNodeRef.current = clickedNode;
      isSimulatingRef.current = true;
      startSimulationLoop();
    } else {
      isPanningRef.current = true;
      panStartRef.current = {
        x: mouseX - transformRef.current.x,
        y: mouseY - transformRef.current.y,
      };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (draggingNodeRef.current) {
      const worldPos = screenToWorld(mouseX, mouseY);
      draggingNodeRef.current.x = worldPos.x;
      draggingNodeRef.current.y = worldPos.y;
      draggingNodeRef.current.vx = 0;
      draggingNodeRef.current.vy = 0;
      isSimulatingRef.current = true;
      startSimulationLoop();
      return;
    }

    if (isPanningRef.current) {
      transformRef.current.x = mouseX - panStartRef.current.x;
      transformRef.current.y = mouseY - panStartRef.current.y;
      startSimulationLoop();
      return;
    }

    // Hover detection
    const worldPos = screenToWorld(mouseX, mouseY);
    let foundNode: SimNode | null = null;
    const nodes = nodesRef.current;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = worldPos.x - n.x;
      const dy = worldPos.y - n.y;
      if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) {
        foundNode = n;
        break;
      }
    }

    if (foundNode !== hoveredNode) {
      setHoveredNode(foundNode);
      startSimulationLoop();
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If clicked without panning/dragging far, select the node
    if (draggingNodeRef.current) {
      const dragged = draggingNodeRef.current;
      draggingNodeRef.current = null;
      onSelectNote(dragged.path);
    }
    isPanningRef.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;

    const currentZoom = transformRef.current.k;
    const nextZoom = Math.min(3.5, Math.max(0.25, currentZoom * zoomFactor));

    // Zoom centered around mouse pointer
    transformRef.current.x = mouseX - (mouseX - transformRef.current.x) * (nextZoom / currentZoom);
    transformRef.current.y = mouseY - (mouseY - transformRef.current.y) * (nextZoom / currentZoom);
    transformRef.current.k = nextZoom;

    startSimulationLoop();
  };

  const handleResetZoom = () => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    transformRef.current = {
      x: width / 2,
      y: height / 2,
      k: 0.95,
    };
    isSimulatingRef.current = true;
    startSimulationLoop();
  };

  const handleZoom = (factor: number) => {
    const width = containerRef.current?.clientWidth || 800;
    const height = containerRef.current?.clientHeight || 600;
    const currentZoom = transformRef.current.k;
    const nextZoom = Math.min(3.5, Math.max(0.25, currentZoom * factor));

    transformRef.current.x = (width / 2) - ((width / 2) - transformRef.current.x) * (nextZoom / currentZoom);
    transformRef.current.y = (height / 2) - ((height / 2) - transformRef.current.y) * (nextZoom / currentZoom);
    transformRef.current.k = nextZoom;

    startSimulationLoop();
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[550px] bg-card rounded-2xl border border-border overflow-hidden select-none"
    >
      {/* Interactive 2D Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Top Floating Control Bar */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Search & Category Filter */}
        <div className="flex items-center gap-2 pointer-events-auto bg-card/90 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-md">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-secondary/60 border border-border/50 text-xs">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search graph notes..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                startSimulationLoop();
              }}
              className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-36 sm:w-48"
            />
          </div>

          <div className="hidden sm:flex items-center gap-1">
            {["all", "task", "research", "strategy", "concept", "system"].map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat);
                  startSimulationLoop();
                }}
                className={`px-2 py-1 rounded-lg text-[11px] font-medium capitalize transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-primary/20 text-primary border border-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/40 border border-transparent"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* View Controls & Obsidian URI Deep Link */}
        <div className="flex items-center gap-2 pointer-events-auto bg-card/90 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-md">
          <button
            onClick={() => {
              setShowLabels(!showLabels);
              startSimulationLoop();
            }}
            title={showLabels ? "Hide text labels" : "Show text labels"}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
              showLabels
                ? "bg-secondary text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Labels</span>
          </button>

          <div className="h-4 w-px bg-border mx-0.5" />

          <button
            onClick={() => handleZoom(1.2)}
            title="Zoom In"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(0.83)}
            title="Zoom Out"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            title="Reset View"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {data?.obsidianUri && (
            <>
              <div className="h-4 w-px bg-border mx-0.5" />
              <a
                href={data.obsidianUri}
                title="Open directly in Obsidian Desktop"
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-border text-xs font-medium transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Obsidian Desktop</span>
              </a>
            </>
          )}
        </div>
      </div>

      {/* Bottom Info & Telemetry Pill */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-card/90 backdrop-blur-md border border-border text-xs shadow-md pointer-events-auto">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Obsidian Graph</span>
          </div>
          <span className="text-muted-foreground">&bull;</span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {data?.stats.totalNotes || 0} notes
          </span>
          <span className="text-muted-foreground">&bull;</span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {data?.stats.totalLinks || 0} links
          </span>
        </div>

        {hoveredNode && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg pointer-events-auto">
            <FileText className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground max-w-[220px] truncate">
              {hoveredNode.name}
            </span>
            <span
              className="text-[10px] px-1.5 py-0.5 rounded capitalize font-medium text-white"
              style={{ backgroundColor: CATEGORY_COLORS[hoveredNode.category] || "#6366f1" }}
            >
              {hoveredNode.category}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {hoveredNode.linksCount} {hoveredNode.linksCount === 1 ? "link" : "links"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}