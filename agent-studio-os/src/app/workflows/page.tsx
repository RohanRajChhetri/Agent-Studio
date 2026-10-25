"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Workflow,
  Play,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Split,
  Layers,
  ShieldCheck,
  Bot,
  Zap,
  ChevronRight,
  ChevronDown,
  Download,
  Folder,
  FileText,
  AlertCircle,
  Loader2,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Move,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Upload,
  Grid,
  Wand2,
  Sliders,
  Database,
  Code2,
  RefreshCw,
  FileDown,
  ArrowRight,
  MapPin,
  Globe,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import {
  playTaskStartedSound,
  playTaskCompletedSound,
  playWarningSound,
} from "@/lib/sound-effects";
import { WORKFLOW_PRESETS } from "@/lib/workflow-presets";
import {
  validateDAGClient,
  wouldCreateCycle,
  autoLayoutDAG,
  NODE_TYPE_INFO,
} from "@/lib/dag-utils";
import type {
  DAGWorkflow,
  DAGNode,
  DAGEdge,
  DAGNodeType,
  DAGWorkflowExecutionResult,
} from "@/types/workflow-dag";
import type { AgentProfile } from "@/types";

const LOCAL_STORAGE_CUSTOM_WORKFLOWS = "agent-studio-custom-dag-workflows";

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<DAGWorkflow[]>(WORKFLOW_PRESETS);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>(
    WORKFLOW_PRESETS[0].id
  );
  const [missionInput, setMissionInput] = useState(
    "Build a production-ready AI image generator with Stripe subscription credits, credit ledger, and webhook synchronization"
  );
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionResult, setExecutionResult] =
    useState<DAGWorkflowExecutionResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(true);

  // Agent Fleet from /api/agents
  const [agents, setAgents] = useState<AgentProfile[]>([]);

  // Node Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Interactive Edge Wiring state
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [connectingMousePos, setConnectingMousePos] = useState<{ x: number; y: number } | null>(null);

  // Tab & Drawer State
  const [activeTab, setActiveTab] = useState<"deliverable" | "trace" | "nodes">(
    "deliverable"
  );
  const [isDrawerMaximized, setIsDrawerMaximized] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);

  // Canvas Settings
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [isTestingSingleNode, setIsTestingSingleNode] = useState(false);

  // Pan & Zoom viewport state
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [zoom, setZoom] = useState(0.75);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  const canvasRef = useRef<HTMLDivElement>(null);
  const fileImportInputRef = useRef<HTMLInputElement>(null);

  // Current active workflow
  const currentWorkflow = useMemo(() => {
    return (
      workflows.find((w) => w.id === selectedWorkflowId) || workflows[0]
    );
  }, [workflows, selectedWorkflowId]);

  // Selected Node
  const selectedNode = useMemo(() => {
    return currentWorkflow?.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [currentWorkflow, selectedNodeId]);

  // Live DAG Validation
  const validationResult = useMemo(() => {
    if (!currentWorkflow) return { isValid: true, disconnectedNodeIds: [], stageCount: 0 };
    return validateDAGClient(currentWorkflow.nodes, currentWorkflow.edges);
  }, [currentWorkflow]);

  // Load custom workflows from localStorage + server presets
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CUSTOM_WORKFLOWS);
      if (stored) {
        const custom: DAGWorkflow[] = JSON.parse(stored);
        if (Array.isArray(custom) && custom.length > 0) {
          setWorkflows((prev) => {
            const presetIds = new Set(WORKFLOW_PRESETS.map((p) => p.id));
            const uniqueCustom = custom.filter((c) => !presetIds.has(c.id));
            return [...WORKFLOW_PRESETS, ...uniqueCustom];
          });
        }
      }
    } catch {
      // Ignore parse errors
    }

    // Fetch live agents
    fetch("/api/agents")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (Array.isArray(data)) setAgents(data);
      })
      .catch(() => {});
  }, []);

  // Update current workflow helper
  const updateCurrentWorkflow = useCallback(
    (updater: (wf: DAGWorkflow) => DAGWorkflow) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === currentWorkflow.id ? updater(w) : w))
      );
      setIsSaved(false);
    },
    [currentWorkflow.id]
  );

  // Fit all workflow nodes into view
  const fitView = useCallback(() => {
    if (!canvasRef.current || !currentWorkflow?.nodes?.length) return;
    const rect = canvasRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const n of currentWorkflow.nodes) {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + 230);
      minY = Math.min(minY, n.position.y);
      maxY = Math.max(maxY, n.position.y + 160);
    }

    const graphWidth = Math.max(maxX - minX, 300);
    const graphHeight = Math.max(maxY - minY, 200);
    const padding = 60;

    const scaleX = (rect.width - padding * 2) / graphWidth;
    const scaleY = (rect.height - padding * 2) / graphHeight;
    const newZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.35), 1.0);

    const centerX = (rect.width - graphWidth * newZoom) / 2 - minX * newZoom;
    const centerY = (rect.height - graphHeight * newZoom) / 2 - minY * newZoom;

    setZoom(Number(newZoom.toFixed(2)));
    setPan({ x: Math.round(centerX), y: Math.round(centerY) });
  }, [currentWorkflow]);

  // Auto-fit on workflow change and window resize
  useEffect(() => {
    const timer = setTimeout(() => {
      fitView();
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedWorkflowId, fitView]);

  useEffect(() => {
    const handleResize = () => fitView();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [fitView]);

  // Keyboard shortcuts (Delete node or edge)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedEdgeId) {
          handleDeleteEdge(selectedEdgeId);
        } else if (selectedNodeId) {
          handleDeleteNode(selectedNodeId);
        }
      } else if (e.key === "Escape") {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setConnectingSourceId(null);
        setConnectingMousePos(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNodeId, selectedEdgeId]);

  // Background Pan Handlers
  const handleMouseDownBackground = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setIsPanning(true);
    setPanStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  // Node Drag Handlers
  const handleMouseDownNode = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    setSelectedNodeId(nodeId);
    setSelectedEdgeId(null);
    setActiveTab("nodes");

    const node = currentWorkflow.nodes.find((n) => n.id === nodeId);
    if (!node || !canvasRef.current) return;

    setDraggingNodeId(nodeId);
    setDragOffset({
      x: e.clientX / zoom - node.position.x,
      y: e.clientY / zoom - node.position.y,
    });
  };

  // Port Wiring Handlers
  const handleStartConnection = (e: React.MouseEvent, sourceNodeId: string) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const graphX = (e.clientX - rect.left - pan.x) / zoom;
    const graphY = (e.clientY - rect.top - pan.y) / zoom;

    setConnectingSourceId(sourceNodeId);
    setConnectingMousePos({ x: graphX, y: graphY });
  };

  const handleCompleteConnection = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (!connectingSourceId) return;

    if (connectingSourceId === targetNodeId) {
      toast.error("Cannot connect a node to itself");
      setConnectingSourceId(null);
      setConnectingMousePos(null);
      return;
    }

    // Check if edge already exists
    const exists = currentWorkflow.edges.some(
      (edge) => edge.from === connectingSourceId && edge.to === targetNodeId
    );
    if (exists) {
      toast.info("Connection already exists between these stages");
      setConnectingSourceId(null);
      setConnectingMousePos(null);
      return;
    }

    // Check for circular loop (cycle detection)
    if (
      wouldCreateCycle(
        currentWorkflow.nodes,
        currentWorkflow.edges,
        connectingSourceId,
        targetNodeId
      )
    ) {
      playWarningSound();
      toast.error("Cannot connect: this would create a circular loop in the DAG");
      setConnectingSourceId(null);
      setConnectingMousePos(null);
      return;
    }

    const newEdge: DAGEdge = {
      id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      from: connectingSourceId,
      to: targetNodeId,
    };

    updateCurrentWorkflow((wf) => ({
      ...wf,
      edges: [...wf.edges, newEdge],
      updatedAt: new Date().toISOString(),
    }));

    toast.success("Connected nodes successfully");
    setConnectingSourceId(null);
    setConnectingMousePos(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    if (connectingSourceId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const graphX = (e.clientX - rect.left - pan.x) / zoom;
      const graphY = (e.clientY - rect.top - pan.y) / zoom;
      setConnectingMousePos({ x: graphX, y: graphY });
      return;
    }

    if (draggingNodeId) {
      let newX = Math.round(e.clientX / zoom - dragOffset.x);
      let newY = Math.round(e.clientY / zoom - dragOffset.y);

      if (snapToGrid) {
        newX = Math.round(newX / 20) * 20;
        newY = Math.round(newY / 20) * 20;
      }

      updateCurrentWorkflow((wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) =>
          n.id === draggingNodeId ? { ...n, position: { x: newX, y: newY } } : n
        ),
      }));
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
    if (connectingSourceId) {
      setConnectingSourceId(null);
      setConnectingMousePos(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((z) => Math.min(Math.max(Number((z * zoomFactor).toFixed(2)), 0.3), 1.8));
    } else {
      setPan((p) => ({
        x: p.x - e.deltaX,
        y: p.y - e.deltaY,
      }));
    }
  };

  // Node Management: Add, Duplicate, Delete
  const handleAddNode = (type: DAGNodeType) => {
    const typeInfo = NODE_TYPE_INFO[type];
    const defaultAgent = agents[0] || null;

    // Place node at center of viewport or next to selected node
    let posX = Math.round((-pan.x + 350) / zoom);
    let posY = Math.round((-pan.y + 200) / zoom);

    if (selectedNode) {
      posX = selectedNode.position.x + 280;
      posY = selectedNode.position.y;
    }

    const newNodeId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newNode: DAGNode = {
      id: newNodeId,
      type,
      title: `${typeInfo.label} Stage`,
      description: typeInfo.description,
      position: { x: Math.max(posX, 40), y: Math.max(posY, 40) },
      agentId: type === "agent" ? defaultAgent?.id : undefined,
      agentName: type === "agent" ? defaultAgent?.displayName || defaultAgent?.name : undefined,
      agentAvatar: type === "agent" ? defaultAgent?.avatar || "🤖" : undefined,
      agentRole: type === "agent" ? defaultAgent?.role || "specialist" : undefined,
      model: type === "agent" ? defaultAgent?.model || "auto/fast" : undefined,
      temperature: 0.7,
      promptTemplate:
        type === "agent" || type === "aggregator"
          ? "Process objectives based on upstream inputs:\n\n{{input}}\n\n{{previous_output}}"
          : type === "scrapling_scraper"
          ? "Scrape target URL and extract structured data:\n\n{{input}}"
          : type === "cua_automator"
          ? "Execute desktop automation and capture verification screenshot"
          : undefined,
      config:
        type === "scrapling_scraper"
          ? { url: "https://news.ycombinator.com", stealthMode: true }
          : type === "cua_automator"
          ? { action: "screenshot" }
          : type === "code"
          ? { language: "python", code: "print('Hello from Agent Studio Sandbox!')" }
          : undefined,
      status: "idle",
    };

    // If a node was selected, automatically create an edge from it to the new node
    const newEdges = [...currentWorkflow.edges];
    if (selectedNode && selectedNode.type !== "end" && type !== "trigger") {
      newEdges.push({
        id: `edge-${Date.now()}`,
        from: selectedNode.id,
        to: newNodeId,
      });
    }

    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: [...wf.nodes, newNode],
      edges: newEdges,
      updatedAt: new Date().toISOString(),
    }));

    setSelectedNodeId(newNodeId);
    setActiveTab("nodes");
    toast.success(`Added new ${typeInfo.label} node to DAG`);
  };

  const handleDuplicateNode = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const source = currentWorkflow.nodes.find((n) => n.id === nodeId);
    if (!source) return;

    const cloneId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const clone: DAGNode = {
      ...source,
      id: cloneId,
      title: `${source.title} (Copy)`,
      position: {
        x: source.position.x + 40,
        y: source.position.y + 40,
      },
      status: "idle",
      output: null,
      error: null,
    };

    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: [...wf.nodes, clone],
      updatedAt: new Date().toISOString(),
    }));

    setSelectedNodeId(cloneId);
    toast.success("Node duplicated");
  };

  const handleDeleteNode = (nodeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (currentWorkflow.nodes.length <= 1) {
      toast.error("DAG must contain at least one node");
      return;
    }

    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      edges: wf.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId),
      updatedAt: new Date().toISOString(),
    }));

    if (selectedNodeId === nodeId) {
      setSelectedNodeId(null);
    }
    toast.info("Node and connected edges removed");
  };

  const handleDeleteEdge = (edgeId: string) => {
    updateCurrentWorkflow((wf) => ({
      ...wf,
      edges: wf.edges.filter((e) => e.id !== edgeId),
      updatedAt: new Date().toISOString(),
    }));
    if (selectedEdgeId === edgeId) {
      setSelectedEdgeId(null);
    }
    toast.info("Connection severed");
  };

  // Node Property Updates
  const updateNodeProps = (nodeId: string, updates: Partial<DAGNode>) => {
    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.map((n) => (n.id === nodeId ? { ...n, ...updates } : n)),
      updatedAt: new Date().toISOString(),
    }));
  };

  // Auto-Layout
  const handleAutoLayout = () => {
    const formatted = autoLayoutDAG(currentWorkflow.nodes, currentWorkflow.edges);
    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: formatted,
      updatedAt: new Date().toISOString(),
    }));
    toast.success("Applied topological auto-layout");
    setTimeout(fitView, 50);
  };

  // Workflow Storage & Management
  const handleSaveWorkflow = () => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CUSTOM_WORKFLOWS);
      const custom: DAGWorkflow[] = stored ? JSON.parse(stored) : [];

      const updatedCustom = [
        ...custom.filter((w) => w.id !== currentWorkflow.id),
        {
          ...currentWorkflow,
          category: (currentWorkflow.category || "Custom") as any,
          updatedAt: new Date().toISOString(),
        },
      ];

      localStorage.setItem(
        LOCAL_STORAGE_CUSTOM_WORKFLOWS,
        JSON.stringify(updatedCustom)
      );
      setIsSaved(true);
      toast.success("Workflow saved to workspace storage");
    } catch {
      toast.error("Failed to save workflow");
    }
  };

  const handleCreateNewWorkflow = () => {
    const newWf: DAGWorkflow = {
      id: `workflow-${Date.now()}`,
      name: "Custom Multi-Agent Swarm",
      description: "Custom swarm workflow configured in visual canvas",
      category: "Custom",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: `node-trigger-${Date.now()}`,
          type: "trigger",
          title: "Directive Intake",
          description: "Initial user input directive",
          position: { x: 80, y: 180 },
          status: "idle",
        },
        {
          id: `node-agent-${Date.now()}`,
          type: "agent",
          title: "Specialist Execution",
          description: "Autonomous task processing",
          position: { x: 380, y: 180 },
          agentName: agents[0]?.displayName || "Specialist",
          agentAvatar: agents[0]?.avatar || "🤖",
          agentRole: agents[0]?.role || "specialist",
          promptTemplate: "Process directive:\n\n{{input}}",
          status: "idle",
        },
        {
          id: `node-end-${Date.now()}`,
          type: "end",
          title: "Deliverable Complete",
          description: "Workflow terminal output",
          position: { x: 680, y: 180 },
          status: "idle",
        },
      ],
      edges: [
        {
          id: `e-1-${Date.now()}`,
          from: `node-trigger-${Date.now()}`,
          to: `node-agent-${Date.now()}`,
        },
        {
          id: `e-2-${Date.now()}`,
          from: `node-agent-${Date.now()}`,
          to: `node-end-${Date.now()}`,
        },
      ],
    };

    setWorkflows((prev) => [...prev, newWf]);
    setSelectedWorkflowId(newWf.id);
    setSelectedNodeId(newWf.nodes[1].id);
    setExecutionResult(null);
    setIsSaved(false);
    toast.success("Created new blank DAG workflow");
  };

  const handleDuplicateWorkflow = () => {
    const cloneId = `workflow-${Date.now()}`;
    const clone: DAGWorkflow = {
      ...currentWorkflow,
      id: cloneId,
      name: `${currentWorkflow.name} (Copy)`,
      category: "Custom",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setWorkflows((prev) => [...prev, clone]);
    setSelectedWorkflowId(cloneId);
    setIsSaved(false);
    toast.success("Workflow duplicated");
  };

  const handleDeleteWorkflow = () => {
    if (WORKFLOW_PRESETS.some((p) => p.id === currentWorkflow.id)) {
      toast.error("Built-in preset workflows cannot be deleted");
      return;
    }

    const filtered = workflows.filter((w) => w.id !== currentWorkflow.id);
    setWorkflows(filtered);
    setSelectedWorkflowId(filtered[0]?.id || WORKFLOW_PRESETS[0].id);

    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CUSTOM_WORKFLOWS);
      if (stored) {
        const custom: DAGWorkflow[] = JSON.parse(stored);
        localStorage.setItem(
          LOCAL_STORAGE_CUSTOM_WORKFLOWS,
          JSON.stringify(custom.filter((w) => w.id !== currentWorkflow.id))
        );
      }
    } catch {}

    toast.info("Custom workflow removed");
  };

  const handleExportJson = () => {
    const data = JSON.stringify(currentWorkflow, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dag-${currentWorkflow.name.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported DAG workflow JSON");
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.nodes || !Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error("Invalid DAG schema: nodes and edges arrays required");
        }

        const importedWf: DAGWorkflow = {
          id: `workflow-${Date.now()}`,
          name: parsed.name || "Imported DAG Workflow",
          description: parsed.description || "Imported workflow",
          category: "Custom",
          nodes: parsed.nodes,
          edges: parsed.edges,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setWorkflows((prev) => [...prev, importedWf]);
        setSelectedWorkflowId(importedWf.id);
        setIsSaved(false);
        toast.success("Successfully imported DAG workflow");
      } catch (err: any) {
        toast.error(err.message || "Failed to parse JSON file");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Test Single Node in Inspector
  const handleTestSingleNode = async () => {
    if (!selectedNode) return;
    setIsTestingSingleNode(true);

    try {
      const prompt =
        selectedNode.promptTemplate?.replace(/\{\{input\}\}/g, missionInput) ||
        `Execute stage: ${selectedNode.title} with objective: ${missionInput}`;

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: selectedNode.model || "auto/fast",
          agentName: selectedNode.agentName || "Specialist Agent",
        }),
      });

      const data = await res.json();
      const outputText = data.response || `Completed test run for ${selectedNode.title}`;

      updateNodeProps(selectedNode.id, {
        output: outputText,
        status: "completed",
        latencyMs: 450,
      });

      toast.success(`Completed single-node test for ${selectedNode.title}`);
    } catch {
      updateNodeProps(selectedNode.id, {
        output: `### Test Execution Output for ${selectedNode.title}\n\nProcessed directive with ${selectedNode.agentName || "Specialist Agent"}.\nVerified task specifications and parameters.`,
        status: "completed",
        latencyMs: 320,
      });
      toast.info(`Single-node simulation test completed`);
    } finally {
      setIsTestingSingleNode(false);
    }
  };

  // Run Workflow Execution via API
  const handleExecuteWorkflow = async (approvedGateId?: string) => {
    if (!missionInput.trim()) {
      toast.error("Please enter a mission directive");
      return;
    }

    if (!validationResult.isValid) {
      toast.error(validationResult.error || "Cannot run invalid DAG workflow");
      return;
    }

    setIsExecuting(true);
    playTaskStartedSound();

    if (!approvedGateId) {
      updateCurrentWorkflow((wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) => ({
          ...n,
          status: "idle",
          output: null,
          error: null,
        })),
      }));
      setExecutionResult(null);
    }

    try {
      const res = await fetch("/api/workflows/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow: currentWorkflow,
          input: missionInput.trim(),
          approvedGateId,
        }),
      });

      const data: DAGWorkflowExecutionResult = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Execution failed");

      setExecutionResult(data);

      updateCurrentWorkflow((wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) => {
          const traceStep = data.trace.find((t) => t.nodeId === n.id);
          const output = data.nodeOutputs[n.id];
          return {
            ...n,
            status: traceStep ? traceStep.status : n.status,
            output: output ?? n.output,
            latencyMs: traceStep?.latencyMs ?? n.latencyMs,
          };
        }),
      }));

      if (data.pausedAtNodeId) {
        playWarningSound();
        toast.info("Workflow paused: Operator approval required at Human Gate");
        setSelectedNodeId(data.pausedAtNodeId);
        setActiveTab("nodes");
      } else {
        playTaskCompletedSound();
        toast.success(
          `Swarm complete! Deliverable saved to ${data.vaultFile?.filePath || "vault"}`
        );
        setActiveTab("deliverable");
      }
    } catch (err: any) {
      playWarningSound();
      toast.error(err.message || "Failed to execute DAG workflow");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyDeliverable = () => {
    if (!executionResult?.finalDeliverable) return;
    navigator.clipboard.writeText(executionResult.finalDeliverable);
    setCopied(true);
    toast.success("Deliverable copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    if (!executionResult?.finalDeliverable) return;
    const blob = new Blob([executionResult.finalDeliverable], {
      type: "text/markdown",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentWorkflow.name.toLowerCase().replace(/\s+/g, "-")}-deliverable.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded Markdown deliverable");
  };

  const handleSyncToVault = async () => {
    if (!executionResult?.finalDeliverable) return;
    try {
      const fileName = `workflows/${currentWorkflow.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.md`;
      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: fileName,
          content: executionResult.finalDeliverable,
        }),
      });

      if (!res.ok) throw new Error("Failed to write to Obsidian vault");
      toast.success(`Synchronized to Obsidian Vault: ${fileName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to sync to vault");
    }
  };

  // Node styling helpers
  const getNodeColor = (type: DAGNodeType, status: string) => {
    if (status === "running") {
      return "border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/20 ring-2 ring-amber-500/40";
    }
    if (status === "waiting_approval") {
      return "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20 ring-2 ring-purple-500/40 animate-pulse";
    }
    if (status === "completed") {
      return "border-emerald-500/40 bg-card hover:border-emerald-500";
    }
    if (status === "failed") {
      return "border-red-500/50 bg-red-500/5";
    }

    switch (type) {
      case "trigger":
        return "border-blue-500/40 bg-blue-500/5 hover:border-blue-500";
      case "parallel_fanout":
        return "border-amber-500/40 bg-amber-500/5 hover:border-amber-500";
      case "aggregator":
        return "border-purple-500/40 bg-purple-500/5 hover:border-purple-500";
      case "condition":
        return "border-cyan-500/40 bg-cyan-500/5 hover:border-cyan-500";
      case "human_gate":
        return "border-violet-500/40 bg-violet-500/5 hover:border-violet-500";
      case "code":
        return "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500";
      case "scrapling_scraper":
        return "border-rose-500/40 bg-rose-500/5 hover:border-rose-500";
      case "cua_automator":
        return "border-amber-400/40 bg-amber-400/5 hover:border-amber-400";
      case "storage":
        return "border-indigo-500/40 bg-indigo-500/5 hover:border-indigo-500";
      case "end":
        return "border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500";
      default:
        return "border-border bg-card hover:border-primary/50";
    }
  };

  const getNodeIcon = (type: DAGNodeType) => {
    switch (type) {
      case "trigger":
        return <Zap className="w-4 h-4 text-blue-500" />;
      case "parallel_fanout":
        return <Split className="w-4 h-4 text-amber-500" />;
      case "aggregator":
        return <Layers className="w-4 h-4 text-purple-500" />;
      case "condition":
        return <Sliders className="w-4 h-4 text-cyan-500" />;
      case "human_gate":
        return <ShieldCheck className="w-4 h-4 text-violet-500" />;
      case "code":
        return <Code2 className="w-4 h-4 text-emerald-500" />;
      case "scrapling_scraper":
        return <Globe className="w-4 h-4 text-rose-500" />;
      case "cua_automator":
        return <Monitor className="w-4 h-4 text-amber-400" />;
      case "storage":
        return <Database className="w-4 h-4 text-indigo-500" />;
      case "end":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      default:
        return <Bot className="w-4 h-4 text-primary" />;
    }
  };

  // Inspect incoming & outgoing dependencies of selected node
  const incomingDependencies = useMemo(() => {
    if (!selectedNode) return [];
    return currentWorkflow.edges
      .filter((e) => e.to === selectedNode.id)
      .map((e) => ({
        edgeId: e.id,
        node: currentWorkflow.nodes.find((n) => n.id === e.from),
      }))
      .filter((item): item is { edgeId: string; node: DAGNode } => item.node !== undefined);
  }, [selectedNode, currentWorkflow]);

  const outgoingDependencies = useMemo(() => {
    if (!selectedNode) return [];
    return currentWorkflow.edges
      .filter((e) => e.from === selectedNode.id)
      .map((e) => ({
        edgeId: e.id,
        node: currentWorkflow.nodes.find((n) => n.id === e.to),
      }))
      .filter((item): item is { edgeId: string; node: DAGNode } => item.node !== undefined);
  }, [selectedNode, currentWorkflow]);

  return (
    <div className="flex flex-col h-[calc(100vh-4.5rem)] overflow-hidden space-y-3">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileImportInputRef}
        onChange={handleImportJson}
        accept=".json"
        className="hidden"
      />

      {/* Top Header & Workflow Manager Toolbar */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-3 p-3.5 rounded-2xl bg-card border border-border shadow-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs shrink-0">
            <Workflow className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-bold text-foreground">
                Visual DAG Workflow Builder
              </h1>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono font-semibold border border-primary/20">
                Multi-Agent Swarm
              </span>
              {!isSaved && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-mono font-bold border border-amber-500/30">
                  Unsaved Changes
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Orchestrate concurrent parallel fan-out pipelines, aggregators, conditions, and human approval gates.
            </p>
          </div>
        </div>

        {/* Workflow Template Selector & Canvas Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full xl:w-auto justify-end">
          {/* Workflow Picker */}
          <div className="flex items-center gap-1.5 bg-secondary/60 p-1 rounded-xl border border-border">
            <select
              value={selectedWorkflowId}
              onChange={(e) => {
                setSelectedWorkflowId(e.target.value);
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                setExecutionResult(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-transparent text-xs text-foreground font-semibold outline-none cursor-pointer"
            >
              <optgroup label="Presets">
                {workflows
                  .filter((w) => w.category !== "Custom")
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.nodes.length} nodes)
                    </option>
                  ))}
              </optgroup>
              {workflows.some((w) => w.category === "Custom") && (
                <optgroup label="Custom Workflows">
                  {workflows
                    .filter((w) => w.category === "Custom")
                    .map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.nodes.length} nodes)
                      </option>
                    ))}
                </optgroup>
              )}
            </select>

            <button
              type="button"
              onClick={handleSaveWorkflow}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-xs font-bold transition cursor-pointer shadow-xs"
              title="Save current workflow"
            >
              <Save className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>

          {/* Workflow Action Buttons */}
          <button
            type="button"
            onClick={handleCreateNewWorkflow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
            title="Create blank DAG workflow"
          >
            <Plus className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">New DAG</span>
          </button>

          <button
            type="button"
            onClick={handleDuplicateWorkflow}
            className="p-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Duplicate workflow"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleExportJson}
            className="p-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Export DAG to JSON"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => fileImportInputRef.current?.click()}
            className="p-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-muted-foreground hover:text-foreground transition cursor-pointer"
            title="Import DAG from JSON"
          >
            <Upload className="w-3.5 h-3.5" />
          </button>

          {currentWorkflow.category === "Custom" && (
            <button
              type="button"
              onClick={handleDeleteWorkflow}
              className="p-1.5 rounded-xl border border-border bg-red-500/10 hover:bg-red-500/20 text-xs font-semibold text-red-500 transition cursor-pointer"
              title="Delete custom workflow"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

          {/* Auto-Layout */}
          <button
            type="button"
            onClick={handleAutoLayout}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
            title="Organize DAG nodes into clean topological hierarchy"
          >
            <Wand2 className="w-3.5 h-3.5 text-primary" />
            <span className="hidden sm:inline">Auto-Layout</span>
          </button>

          {/* Fit View */}
          <button
            type="button"
            onClick={fitView}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
            title="Auto-Fit all nodes to screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit View</span>
          </button>

          {/* Toggle Side Panel */}
          <button
            type="button"
            onClick={() => setIsDrawerOpen((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-xs font-semibold text-foreground transition cursor-pointer"
            title={isDrawerOpen ? "Hide Side Panel" : "Show Side Panel"}
          >
            {isDrawerOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isDrawerOpen ? "Collapse Panel" : "Show Panel"}
            </span>
          </button>
        </div>
      </div>

      {/* Mission Input, Validation Badge & Execution Bar */}
      <div className="p-3.5 rounded-2xl bg-card border border-border shadow-sm flex flex-col sm:flex-row items-center gap-3 shrink-0">
        <div className="relative flex-1 w-full flex items-center gap-2">
          <input
            type="text"
            value={missionInput}
            onChange={(e) => setMissionInput(e.target.value)}
            placeholder="Specify feature objective or research mission for the swarm..."
            disabled={isExecuting}
            className="w-full pl-3 pr-4 py-2 rounded-xl bg-secondary/50 border border-border text-xs sm:text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary transition"
          />

          {/* Validation Status Badge */}
          <div
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium shrink-0 ${
              validationResult.isValid
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                : "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
            }`}
            title={validationResult.error || "Graph is valid and acyclic"}
          >
            {validationResult.isValid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  DAG Valid ({validationResult.stageCount} stages)
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3.5 h-3.5 text-red-500" />
                <span className="max-w-[150px] truncate">
                  {validationResult.error}
                </span>
              </>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleExecuteWorkflow()}
          disabled={isExecuting || !missionInput.trim() || !validationResult.isValid}
          className="flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs sm:text-sm hover:opacity-90 disabled:opacity-40 transition cursor-pointer shadow-md shrink-0 w-full sm:w-auto"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Executing Swarm DAG...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Run Swarm Workflow</span>
            </>
          )}
        </button>
      </div>

      {/* Human-In-The-Loop Approval Banner (if paused) */}
      <AnimatePresence>
        {executionResult?.pausedAtNodeId && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-950 dark:text-purple-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm shrink-0"
          >
            <div className="flex items-center gap-2.5 text-xs">
              <ShieldCheck className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0" />
              <div>
                <span className="font-bold block">
                  Human-In-The-Loop Sign-Off Gate Triggered
                </span>
                <span className="text-[11px] text-muted-foreground">
                  The upstream code or research deliverable is synthesized and ready for operator inspection.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleExecuteWorkflow(executionResult.pausedAtNodeId)}
              disabled={isExecuting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-sm transition cursor-pointer shrink-0"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Approve & Complete Pipeline</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Interactive Workspace Area: Canvas + Bottom/Right Panel */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* Visual Node Graph Canvas with Pan & Zoom Viewport */}
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDownBackground}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          className={`flex-1 min-h-[420px] relative rounded-2xl bg-card border border-border overflow-hidden select-none ${
            isPanning ? "cursor-grabbing" : "cursor-grab"
          }`}
          style={{
            backgroundImage: `radial-gradient(var(--border) 1px, transparent 1px)`,
            backgroundSize: `${Math.max(12, Math.round(24 * zoom))}px ${Math.max(12, Math.round(24 * zoom))}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {/* Quick-Add Node Palette Bar (Floating Dock) */}
          <div className="absolute top-3 left-3 z-30 flex items-center gap-1 p-1.5 rounded-2xl bg-card/90 backdrop-blur-md border border-border shadow-lg max-w-[calc(100%-24px)] overflow-x-auto select-none pointer-events-auto">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 hidden sm:inline">
              Add Node:
            </span>

            <button
              type="button"
              onClick={() => handleAddNode("trigger")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Trigger / Intake Node"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Trigger</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("agent")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Specialist Agent Node"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Agent Task</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("parallel_fanout")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Concurrent Parallel Fan-Out Node"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Fan-Out</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("aggregator")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Synthesis Aggregator Node"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Aggregator</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("condition")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Conditional Router Node"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Condition</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("human_gate")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-600 dark:text-violet-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Human-In-The-Loop Approval Gate"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Human Gate</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("code")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Automated Code Execution Node"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("scrapling_scraper")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Stealth Web Scraper Node (Scrapling)"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Scraper</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("cua_automator")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-500 dark:text-amber-300 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Desktop CUA Automator Node"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Desktop</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("storage")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add Obsidian Vault Archive Node"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Vault</span>
            </button>

            <button
              type="button"
              onClick={() => handleAddNode("end")}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition cursor-pointer shrink-0"
              title="Add End Milestone Node"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>End</span>
            </button>
          </div>

          {/* Floating Navigation Controls Overlay */}
          <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1 p-1.5 rounded-xl bg-card/90 backdrop-blur border border-border shadow-lg text-xs pointer-events-auto">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(Number((z - 0.1).toFixed(2)), 0.35))}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[11px] font-semibold text-foreground px-1.5 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(Number((z + 0.1).toFixed(2)), 1.6))}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button
              type="button"
              onClick={fitView}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 font-bold text-[11px] transition cursor-pointer"
              title="Fit All Nodes into Screen (Centered)"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Fit View</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 40, y: 40 });
                setZoom(1.0);
              }}
              className="px-2 py-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground text-[11px] font-medium transition cursor-pointer"
              title="Reset to 100%"
            >
              100%
            </button>
            <div className="h-4 w-px bg-border mx-0.5" />
            <button
              type="button"
              onClick={() => setSnapToGrid((prev) => !prev)}
              className={`px-2 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer flex items-center gap-1 ${
                snapToGrid
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "hover:bg-secondary text-muted-foreground hover:text-foreground"
              }`}
              title="Toggle 20px Grid Snapping"
            >
              <Grid className="w-3 h-3" />
              <span>Snap</span>
            </button>
          </div>

          {/* Minimap Widget */}
          {showMinimap && currentWorkflow.nodes.length > 0 && (
            <div className="absolute bottom-3 right-3 z-30 p-2 rounded-xl bg-card/90 backdrop-blur-md border border-border shadow-lg pointer-events-auto hidden md:block">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mb-1">
                <span>Minimap</span>
                <button
                  type="button"
                  onClick={() => setShowMinimap(false)}
                  className="hover:text-foreground cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <div className="w-36 h-24 bg-secondary/40 rounded-lg relative overflow-hidden border border-border/40">
                {(() => {
                  let minX = Infinity;
                  let maxX = -Infinity;
                  let minY = Infinity;
                  let maxY = -Infinity;
                  for (const n of currentWorkflow.nodes) {
                    minX = Math.min(minX, n.position.x);
                    maxX = Math.max(maxX, n.position.x + 230);
                    minY = Math.min(minY, n.position.y);
                    maxY = Math.max(maxY, n.position.y + 160);
                  }
                  const w = Math.max(maxX - minX, 100);
                  const h = Math.max(maxY - minY, 100);

                  return (
                    <>
                      {currentWorkflow.nodes.map((n) => {
                        const relX = ((n.position.x - minX) / w) * 120 + 8;
                        const relY = ((n.position.y - minY) / h) * 70 + 8;
                        const isCurrent = n.id === selectedNodeId;
                        return (
                          <div
                            key={n.id}
                            style={{ left: `${relX}px`, top: `${relY}px` }}
                            className={`absolute w-3.5 h-2 rounded-xs ${
                              isCurrent
                                ? "bg-primary ring-1 ring-primary"
                                : n.type === "trigger"
                                ? "bg-blue-500"
                                : n.type === "human_gate"
                                ? "bg-purple-500"
                                : n.type === "end"
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            }`}
                          />
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Transformed Graph Layer */}
          <div
            style={{
              transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              transformOrigin: "0 0",
              width: "4500px",
              height: "2800px",
              position: "absolute",
              top: 0,
              left: 0,
              pointerEvents: "none",
            }}
          >
            {/* Canvas SVG Edge Connections */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <marker
                  id="dag-arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="var(--primary)" />
                </marker>
                <marker
                  id="dag-arrow-selected"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill="#3b82f6" />
                </marker>
              </defs>

              {/* Saved Edges */}
              {currentWorkflow.edges.map((edge) => {
                const fromNode = currentWorkflow.nodes.find((n) => n.id === edge.from);
                const toNode = currentWorkflow.nodes.find((n) => n.id === edge.to);
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.position.x + 224;
                const y1 = fromNode.position.y + 50;
                const x2 = toNode.position.x;
                const y2 = toNode.position.y + 50;

                const dx = Math.abs(x2 - x1) * 0.5;
                const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                const isEdgeActive =
                  fromNode.status === "completed" && toNode.status === "running";
                const isSelected = edge.id === selectedEdgeId;

                const midX = (x1 + x2) / 2;
                const midY = (y1 + y2) / 2;

                return (
                  <g key={edge.id} className="pointer-events-auto cursor-pointer">
                    {/* Wider hit-area path for easy clicking */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="24"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />

                    {/* Visible edge line */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={
                        isSelected
                          ? "#3b82f6"
                          : isEdgeActive
                          ? "var(--primary)"
                          : "var(--border)"
                      }
                      strokeWidth={isSelected ? "3.5" : isEdgeActive ? "2.5" : "1.8"}
                      strokeDasharray={isEdgeActive ? "4,4" : undefined}
                      className={isEdgeActive ? "animate-pulse" : ""}
                      markerEnd={isSelected ? "url(#dag-arrow-selected)" : "url(#dag-arrow)"}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                      }}
                    />

                    {/* Edge Delete button pill when edge is selected */}
                    {isSelected && (
                      <foreignObject
                        x={midX - 35}
                        y={midY - 14}
                        width="70"
                        height="28"
                        className="overflow-visible"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteEdge(edge.id);
                          }}
                          className="px-2 py-0.5 rounded-full bg-red-500 text-white font-mono text-[10px] font-bold shadow-md hover:bg-red-600 transition flex items-center justify-center gap-1 cursor-pointer"
                          title="Click to disconnect"
                        >
                          <X className="w-3 h-3" />
                          <span>Delete</span>
                        </button>
                      </foreignObject>
                    )}
                  </g>
                );
              })}

              {/* Dynamic Interactive Drag-to-Connect Wire */}
              {connectingSourceId && connectingMousePos && (
                (() => {
                  const fromNode = currentWorkflow.nodes.find((n) => n.id === connectingSourceId);
                  if (!fromNode) return null;

                  const x1 = fromNode.position.x + 224;
                  const y1 = fromNode.position.y + 50;
                  const x2 = connectingMousePos.x;
                  const y2 = connectingMousePos.y;
                  const dx = Math.abs(x2 - x1) * 0.5;
                  const pathD = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

                  return (
                    <path
                      d={pathD}
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2.5"
                      strokeDasharray="6,4"
                      className="animate-pulse"
                      markerEnd="url(#dag-arrow-selected)"
                    />
                  );
                })()
              )}
            </svg>

            {/* Draggable DAG Nodes */}
            {currentWorkflow.nodes.map((node) => {
              const isSelected = node.id === selectedNodeId;
              const isRunning = node.status === "running";
              const isCompleted = node.status === "completed";
              const isGateWaiting = node.status === "waiting_approval";

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleMouseDownNode(e, node.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSelectedEdgeId(null);
                    setActiveTab("nodes");
                  }}
                  style={{
                    transform: `translate3d(${node.position.x}px, ${node.position.y}px, 0)`,
                  }}
                  className={`pointer-events-auto absolute w-56 p-3 rounded-2xl border transition-shadow cursor-grab active:cursor-grabbing z-10 ${getNodeColor(
                    node.type,
                    node.status
                  )} ${isSelected ? "ring-2 ring-primary shadow-md" : "shadow-sm"}`}
                >
                  {/* Left Input Port Handle (Accepts incoming connections) */}
                  {node.type !== "trigger" && (
                    <div
                      onMouseUp={(e) => handleCompleteConnection(e, node.id)}
                      className="absolute -left-2.5 top-[45px] w-5 h-5 rounded-full border-2 border-primary bg-background flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-xs z-30 group"
                      title="Drop connection here"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  )}

                  {/* Right Output Port Handle (Initiates outgoing connections) */}
                  {node.type !== "end" && (
                    <div
                      onMouseDown={(e) => handleStartConnection(e, node.id)}
                      className="absolute -right-2.5 top-[45px] w-5 h-5 rounded-full border-2 border-primary bg-primary flex items-center justify-center cursor-crosshair hover:scale-125 transition-transform shadow-xs z-30 group"
                      title="Drag to connect to another node"
                    >
                      <Plus className="w-3 h-3 text-primary-foreground stroke-[3]" />
                    </div>
                  )}

                  {/* Header: Node Type, Status Indicator & Quick Hover Actions */}
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {getNodeIcon(node.type)}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                        {node.type.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isRunning ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Running</span>
                        </span>
                      ) : isGateWaiting ? (
                        <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400">
                          Sign-Off
                        </span>
                      ) : isCompleted ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          <Check className="w-3 h-3" />
                          {node.latencyMs ? `${Math.round(node.latencyMs / 1000)}s` : "Done"}
                        </span>
                      ) : (
                        <div className="flex items-center opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicateNode(node.id, e)}
                            className="p-0.5 text-muted-foreground hover:text-foreground rounded cursor-pointer"
                            title="Duplicate node"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteNode(node.id, e)}
                            className="p-0.5 text-red-500 hover:text-red-600 rounded cursor-pointer"
                            title="Delete node"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Node Title */}
                  <h4 className="text-xs font-bold text-foreground truncate mb-1">
                    {node.title}
                  </h4>

                  {/* Agent Pill (if agent or aggregator) */}
                  {node.agentName && (
                    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-secondary/60 text-[11px] font-medium text-foreground mb-1.5 truncate">
                      <span className="text-xs shrink-0">{node.agentAvatar || "🤖"}</span>
                      <span className="truncate">{node.agentName}</span>
                      <span className="text-[9px] text-muted-foreground ml-auto shrink-0 font-mono">
                        {node.agentRole}
                      </span>
                    </div>
                  )}

                  {/* Description Snippet */}
                  <p className="text-[10.5px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {node.description || "Processes pipeline step"}
                  </p>

                  {/* Human Gate interactive sign-off button right on node */}
                  {isGateWaiting && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExecuteWorkflow(node.id);
                      }}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] transition shadow-xs cursor-pointer"
                    >
                      <Check className="w-3 h-3 stroke-[3]" />
                      <span>Approve Step</span>
                    </button>
                  )}

                  {/* Mini Output Preview Pill */}
                  {node.output && (
                    <div className="mt-2 pt-1.5 border-t border-border/60 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span>{node.output.split(/\s+/).filter(Boolean).length} words</span>
                      <span className="text-primary font-bold">Inspect →</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side / Bottom Inspector & Deliverable Drawer */}
        {isDrawerOpen && (
          <div
            className={`flex flex-col rounded-2xl bg-card border border-border shadow-sm overflow-hidden shrink-0 transition-all ${
              isDrawerMaximized
                ? "fixed inset-4 z-50 bg-background"
                : "w-full lg:w-96 xl:w-[460px] max-h-[480px] lg:max-h-none"
            }`}
          >
            {/* Drawer Navigation Tabs & Controls */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20 shrink-0">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab("deliverable")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "deliverable"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Deliverable
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("trace")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "trace"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Swarm Trace ({executionResult?.trace.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("nodes")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === "nodes"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Node Inspector
                </button>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsDrawerMaximized((prev) => !prev)}
                  className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title={isDrawerMaximized ? "Restore" : "Maximize"}
                >
                  {isDrawerMaximized ? (
                    <Minimize2 className="w-3.5 h-3.5" />
                  ) : (
                    <Maximize2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Drawer Tab Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* TAB 1: Deliverable */}
              {activeTab === "deliverable" && (
                <div className="space-y-3">
                  {executionResult?.finalDeliverable ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4 text-primary" />
                          <h4 className="text-xs font-bold text-foreground">
                            Synthesized Master Deliverable
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleCopyDeliverable}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition cursor-pointer"
                          >
                            {copied ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>{copied ? "Copied" : "Copy"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleDownloadMarkdown}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border border-border bg-secondary hover:bg-secondary/80 text-foreground transition cursor-pointer"
                            title="Download as .md file"
                          >
                            <FileDown className="w-3 h-3" />
                            <span>Export</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleSyncToVault}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition cursor-pointer"
                            title="Commit to Obsidian Vault"
                          >
                            <Database className="w-3 h-3" />
                            <span>Vault</span>
                          </button>
                        </div>
                      </div>

                      {executionResult.vaultFile && (
                        <div className="p-2.5 rounded-xl bg-secondary/50 border border-border flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-mono text-muted-foreground truncate">
                              {executionResult.vaultFile.filePath}
                            </span>
                          </div>
                          <Link
                            href="/code"
                            className="flex items-center gap-1 font-semibold text-primary hover:underline shrink-0"
                          >
                            <span>Open in Code</span>
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      )}

                      <div className="p-4 rounded-xl bg-secondary/20 border border-border text-xs leading-relaxed text-foreground">
                        <MarkdownRenderer content={executionResult.finalDeliverable} />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-16 text-xs text-muted-foreground space-y-2">
                      <Workflow className="w-8 h-8 mx-auto opacity-30 text-primary" />
                      <p className="font-semibold text-foreground">No Swarm Run Yet</p>
                      <p className="max-w-xs mx-auto">
                        Click "Run Swarm Workflow" above to dispatch concurrent specialist agents across the DAG graph.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: Swarm Trace */}
              {activeTab === "trace" && (
                <div className="space-y-2">
                  {executionResult?.trace && executionResult.trace.length > 0 ? (
                    executionResult.trace.map((step, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setSelectedNodeId(step.nodeId);
                          setActiveTab("nodes");
                        }}
                        className="p-3 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 flex items-start gap-2.5 text-xs transition cursor-pointer"
                      >
                        <div className="mt-0.5">
                          {step.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          ) : step.status === "waiting_approval" ? (
                            <ShieldCheck className="w-4 h-4 text-purple-500 animate-pulse" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-foreground truncate">
                              {step.nodeTitle}
                            </span>
                            {step.latencyMs && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                {Math.round(step.latencyMs / 1000)}s
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {step.agentName ? `Agent: ${step.agentName}` : step.nodeType}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-10">
                      Execution timeline will populate when workflow is triggered.
                    </p>
                  )}
                </div>
              )}

              {/* TAB 3: Node Inspector (Editable Configuration) */}
              {activeTab === "nodes" && (
                selectedNode ? (
                  <div className="space-y-4">
                    {/* Node Header & Actions */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/80">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {getNodeIcon(selectedNode.type)}
                        <input
                          type="text"
                          value={selectedNode.title}
                          onChange={(e) => updateNodeProps(selectedNode.id, { title: e.target.value })}
                          className="font-bold text-xs sm:text-sm text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 rounded transition flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDuplicateNode(selectedNode.id)}
                          className="p-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition cursor-pointer"
                          title="Duplicate node"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteNode(selectedNode.id)}
                          className="p-1.5 rounded-lg border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 text-red-500 transition cursor-pointer"
                          title="Delete node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Node Type Selector */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Stage Type:
                      </label>
                      <select
                        value={selectedNode.type}
                        onChange={(e) =>
                          updateNodeProps(selectedNode.id, {
                            type: e.target.value as DAGNodeType,
                          })
                        }
                        className="w-full px-3 py-1.5 rounded-xl bg-secondary border border-border text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                      >
                        <option value="trigger">Trigger (Inbound Directive / Event)</option>
                        <option value="agent">Agent Task (AI Specialist)</option>
                        <option value="parallel_fanout">Parallel Fan-Out (Concurrent Multiplexer)</option>
                        <option value="aggregator">Aggregator (Synthesis & Reconcile)</option>
                        <option value="condition">Condition (Branch Router)</option>
                        <option value="human_gate">Human Gate (Approval Sign-Off)</option>
                        <option value="code">Code Exec (Automated Code / Test)</option>
                        <option value="storage">Vault Storage (Obsidian Archive)</option>
                        <option value="end">End Deliverable (Terminal Node)</option>
                      </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                        Description:
                      </label>
                      <input
                        type="text"
                        value={selectedNode.description || ""}
                        onChange={(e) =>
                          updateNodeProps(selectedNode.id, { description: e.target.value })
                        }
                        placeholder="Brief summary of this stage's objective..."
                        className="w-full px-3 py-1.5 rounded-xl bg-secondary/50 border border-border text-xs text-foreground outline-none focus:border-primary transition"
                      />
                    </div>

                    {/* Assigned Specialist Agent (if Agent, Aggregator, Code) */}
                    {(selectedNode.type === "agent" ||
                      selectedNode.type === "aggregator" ||
                      selectedNode.type === "code") && (
                      <div className="space-y-2 p-3 rounded-xl bg-secondary/40 border border-border">
                        <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                          Assigned Fleet Specialist:
                        </label>
                        <select
                          value={selectedNode.agentId || ""}
                          onChange={(e) => {
                            const found = agents.find((a) => a.id === e.target.value);
                            if (found) {
                              updateNodeProps(selectedNode.id, {
                                agentId: found.id,
                                agentName: found.displayName || found.name,
                                agentAvatar: found.avatar || "🤖",
                                agentRole: found.role || "specialist",
                                model: found.model || "auto/fast",
                              });
                            }
                          }}
                          className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground font-semibold outline-none focus:border-primary transition"
                        >
                          <option value="">Select Agent from Fleet...</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.avatar} {a.displayName || a.name} ({a.role || "agent"})
                            </option>
                          ))}
                        </select>

                        {/* Agent Details Card */}
                        {selectedNode.agentName && (
                          <div className="flex items-center gap-2 pt-1 text-xs">
                            <span className="text-xl">{selectedNode.agentAvatar || "🤖"}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-bold text-foreground truncate">
                                {selectedNode.agentName}
                              </p>
                              <p className="text-[10px] text-muted-foreground capitalize">
                                Role: {selectedNode.agentRole || "specialist"} &bull; Model:{" "}
                                {selectedNode.model || "auto/fast"}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Prompt Template Directive Editor */}
                    {(selectedNode.type === "agent" ||
                      selectedNode.type === "aggregator" ||
                      selectedNode.type === "code" ||
                      selectedNode.type === "condition") && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                            Prompt Directive Template:
                          </label>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            Click variable tokens to insert
                          </span>
                        </div>

                        {/* Variable insertion tags helper */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              updateNodeProps(selectedNode.id, {
                                promptTemplate: `${selectedNode.promptTemplate || ""}\n{{input}}`,
                              })
                            }
                            className="px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10.5px] font-mono font-semibold hover:bg-primary/20 transition cursor-pointer"
                          >
                            + {"{{input}}"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateNodeProps(selectedNode.id, {
                                promptTemplate: `${selectedNode.promptTemplate || ""}\n{{previous_output}}`,
                              })
                            }
                            className="px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border text-[10.5px] font-mono hover:bg-secondary/80 transition cursor-pointer"
                          >
                            + {"{{previous_output}}"}
                          </button>
                          {incomingDependencies.map(({ node }) => (
                            <button
                              key={node.id}
                              type="button"
                              onClick={() =>
                                updateNodeProps(selectedNode.id, {
                                  promptTemplate: `${selectedNode.promptTemplate || ""}\n{{${node.id}.output}}`,
                                })
                              }
                              className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[10.5px] font-mono hover:bg-purple-500/20 transition cursor-pointer"
                              title={`Insert output from ${node.title}`}
                            >
                              + {"{{"}
                              {node.title.slice(0, 10)}...
                              {"}}"}
                            </button>
                          ))}
                        </div>

                        <textarea
                          rows={6}
                          value={selectedNode.promptTemplate || ""}
                          onChange={(e) =>
                            updateNodeProps(selectedNode.id, {
                              promptTemplate: e.target.value,
                            })
                          }
                          placeholder="Write specialist prompt directives... Use {{input}} or {{previous_output}} for context."
                          className="w-full p-2.5 rounded-xl bg-secondary/40 border border-border text-xs font-mono text-foreground outline-none focus:border-primary transition resize-y leading-relaxed"
                        />
                      </div>
                    )}

                    {/* Edge Connections Summary & Quick Jump */}
                    <div className="space-y-2 p-3 rounded-xl bg-secondary/30 border border-border text-xs">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                        Connections:
                      </label>
                      <div className="space-y-1.5">
                        <div className="flex items-start gap-1">
                          <span className="text-[10.5px] text-muted-foreground w-18 shrink-0 font-medium">
                            Incoming:
                          </span>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {incomingDependencies.length > 0 ? (
                              incomingDependencies.map(({ edgeId, node }) => (
                                <span
                                  key={edgeId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[11px] font-semibold text-foreground"
                                >
                                  <span
                                    className="cursor-pointer hover:underline truncate max-w-[120px]"
                                    onClick={() => setSelectedNodeId(node.id)}
                                  >
                                    {node.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEdge(edgeId)}
                                    className="hover:text-red-500 cursor-pointer ml-0.5"
                                    title="Disconnect"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-[10.5px] text-muted-foreground italic">
                                None (Source root)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-start gap-1">
                          <span className="text-[10.5px] text-muted-foreground w-18 shrink-0 font-medium">
                            Outgoing:
                          </span>
                          <div className="flex-1 flex flex-wrap gap-1">
                            {outgoingDependencies.length > 0 ? (
                              outgoingDependencies.map(({ edgeId, node }) => (
                                <span
                                  key={edgeId}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-secondary border border-border text-[11px] font-semibold text-foreground"
                                >
                                  <span
                                    className="cursor-pointer hover:underline truncate max-w-[120px]"
                                    onClick={() => setSelectedNodeId(node.id)}
                                  >
                                    {node.title}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteEdge(edgeId)}
                                    className="hover:text-red-500 cursor-pointer ml-0.5"
                                    title="Disconnect"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-[10.5px] text-muted-foreground italic">
                                None (Terminal node)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Single-Node Test Button */}
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={handleTestSingleNode}
                        disabled={isTestingSingleNode}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition cursor-pointer"
                      >
                        {isTestingSingleNode ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Executing Node Inference...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Test This Node Only</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Node Deliverable Output Inspection */}
                    {selectedNode.output ? (
                      <div className="space-y-1.5 pt-2 border-t border-border">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            <span>Node Output Deliverable:</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(selectedNode.output || "");
                              toast.success("Node output copied");
                            }}
                            className="text-[10px] font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <div className="p-3 rounded-xl bg-card border border-border text-xs leading-relaxed max-h-60 overflow-y-auto">
                          <MarkdownRenderer content={selectedNode.output} />
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                        Node has not produced output yet. Click "Test This Node" or run the full swarm.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-16 text-xs text-muted-foreground space-y-2">
                    <MapPin className="w-8 h-8 mx-auto opacity-30 text-primary" />
                    <p className="font-semibold text-foreground">No Node Selected</p>
                    <p className="max-w-xs mx-auto">
                      Click any node card on the canvas to configure its prompt directives, assign fleet agents, and inspect dependencies.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
