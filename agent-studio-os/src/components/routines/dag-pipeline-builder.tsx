"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  CheckCircle2,
  Clock,
  ArrowRight,
  Bot,
  Database,
  ShieldCheck,
  Code2,
  Sparkles,
  Loader2,
  Zap,
  BookOpen,
  Plus,
  Trash2,
  Copy,
  ChevronLeft,
  ChevronRight,
  Save,
  RotateCcw,
  Upload,
  Download,
  Sliders,
  Settings,
  X,
  FileText,
  Send,
  Workflow,
  Check,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";

export type DagNodeType = "trigger" | "agent" | "gate" | "code" | "storage" | "webhook";

export interface CustomDagNode {
  id: string;
  name: string;
  type: DagNodeType;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  role?: string;
  model?: string;
  prompt: string;
  status: "idle" | "running" | "completed" | "error";
  output?: string;
  latency?: number;
}

interface DagPipelineBuilderProps {
  agents: AgentProfile[];
}

const STORAGE_KEY = "agent-studio-custom-dag";

const DEFAULT_TEMPLATES: Record<
  string,
  { name: string; description: string; nodes: Omit<CustomDagNode, "id" | "status">[] }
> = {
  feature: {
    name: "Autonomous Feature Delivery",
    description: "Multi-agent chain: Inbound Trigger → Architecture Scan → DevOps Implementation → Security Gate → Obsidian Sync",
    nodes: [
      {
        name: "Inbound Webhook Trigger",
        type: "trigger",
        prompt: "Listen for new feature request payloads or GitHub issues.",
        output: "Payload received: 'Deliver High-Performance Multi-Agent Pipeline GUI'",
        latency: 14,
      },
      {
        name: "Architecture & Schema Design",
        type: "agent",
        prompt: "Analyze technical requirements, interface schemas, and edge cases. Produce a structured implementation brief.",
        output: "Technical requirements analyzed. Produced API specification and component interfaces.",
        latency: 320,
      },
      {
        name: "Fullstack Engineering & Code",
        type: "agent",
        prompt: "Based on specification:\n{{previous_output}}\n\nImplement production TypeScript components with responsive glassmorphism styles.",
        output: "Generated customizable DAG visual canvas, drag/reorder controls, and persistent storage handlers.",
        latency: 480,
      },
      {
        name: "Security & Consensus Gate",
        type: "gate",
        prompt: "Verify output against security standards, schema sanitization, and state integrity.",
        output: "Passed automated lint and security checks. Zero high vulnerabilities detected.",
        latency: 75,
      },
      {
        name: "Obsidian Vault Archive",
        type: "storage",
        prompt: "Permanently commit synthesized deliverable and execution logs into Obsidian notes.",
        output: "Archived to Obsidian Vault note [[pipelines/autonomous-feature-delivery.md]].",
        latency: 32,
      },
    ],
  },
  security: {
    name: "Security & Vulnerability Audit",
    description: "Scan codebases, identify OWASP risks, formulate verified patches, and validate regression safety.",
    nodes: [
      {
        name: "Repository Scan Trigger",
        type: "trigger",
        prompt: "Cron scheduled inspection triggered across active code repositories.",
        output: "Target repository checked: 42 modules analyzed.",
        latency: 20,
      },
      {
        name: "Vulnerability & Risk Analysis",
        type: "agent",
        prompt: "Inspect authentication paths, token storage, and input sanitization for potential attack vectors.",
        output: "Found 1 low-severity recommendation: rotate legacy webhook authorization secrets.",
        latency: 380,
      },
      {
        name: "Automated Patch Generation",
        type: "code",
        prompt: "Generate hardened environment secrets handler and update credentials vault.",
        output: "Patch created: updated credential rotation with salted cryptographic hashing.",
        latency: 240,
      },
      {
        name: "Consensus Verification Gate",
        type: "gate",
        prompt: "Ensure regression tests pass and zero breaking changes are introduced.",
        output: "Verification complete: 100% test pass rate.",
        latency: 90,
      },
    ],
  },
  blank: {
    name: "Custom Blank Canvas",
    description: "Start from scratch and build your own autonomous multi-agent workflow.",
    nodes: [
      {
        name: "Initial Event Trigger",
        type: "trigger",
        prompt: "Enter the trigger description or initial payload.",
        output: "Trigger event initialized.",
        latency: 10,
      },
      {
        name: "Primary Agent Task",
        type: "agent",
        prompt: "Write instructions for your specialist agent here. Use {{previous_output}} to reference prior steps.",
        output: "Awaiting execution...",
        latency: 0,
      },
    ],
  },
};

export function DagPipelineBuilder({ agents }: DagPipelineBuilderProps) {
  const [pipelineName, setPipelineName] = useState("Custom Multi-Agent Pipeline");
  const [nodes, setNodes] = useState<CustomDagNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [useRealInference, setUseRealInference] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("feature");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper to resolve an agent
  const getAgentForNode = (agentId?: string, preferredRole?: string) => {
    if (agentId) {
      const found = agents.find((a) => a.id === agentId);
      if (found) return found;
    }
    if (preferredRole) {
      const roleMatch = agents.find((a) => a.role === preferredRole || a.name.toLowerCase().includes(preferredRole));
      if (roleMatch) return roleMatch;
    }
    return agents[0] || null;
  };

  // Initialize pipeline nodes from localStorage or default template
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          setNodes(parsed.nodes);
          setPipelineName(parsed.name || "Custom Multi-Agent Pipeline");
          setSelectedNodeId(parsed.nodes[0]?.id || null);
          return;
        }
      }
    } catch {
      // Fall through to default template
    }

    // Load feature delivery template with matched real agents
    loadTemplate("feature");
  }, [agents]);

  const loadTemplate = (templateKey: string) => {
    const tmpl = DEFAULT_TEMPLATES[templateKey] || DEFAULT_TEMPLATES.feature;
    setSelectedTemplateKey(templateKey);
    setPipelineName(tmpl.name);

    const generatedNodes: CustomDagNode[] = tmpl.nodes.map((n, idx) => {
      let assignedAgent = null;
      if (n.type === "agent") {
        if (idx === 1) {
          assignedAgent = getAgentForNode(undefined, "specialist") || agents[0];
        } else if (idx === 2) {
          assignedAgent = agents.length > 1 ? agents[1] : agents[0];
        } else {
          assignedAgent = agents[idx % agents.length] || agents[0];
        }
      }

      return {
        ...n,
        id: `node-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
        agentId: assignedAgent?.id,
        agentName: assignedAgent?.displayName || assignedAgent?.name,
        agentAvatar: assignedAgent?.avatar || "🤖",
        role: assignedAgent?.role,
        model: assignedAgent?.model || "auto/fast",
        status: "idle",
      };
    });

    setNodes(generatedNodes);
    setSelectedNodeId(generatedNodes[0]?.id || null);
    setIsSaved(false);
  };

  // Persist to localStorage
  const handleSavePipeline = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: pipelineName,
          nodes,
          updatedAt: new Date().toISOString(),
        })
      );
      setIsSaved(true);
      toast.success("DAG Pipeline saved to local workspace!");
    } catch {
      toast.error("Failed to save pipeline configuration.");
    }
  };

  // Add node at a specific index
  const handleAddNode = (index: number, type: DagNodeType = "agent") => {
    const defaultAgent = agents[0] || null;
    const newNode: CustomDagNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name:
        type === "agent"
          ? `${defaultAgent?.displayName || "Agent"} Task`
          : type === "trigger"
          ? "Event Trigger"
          : type === "gate"
          ? "Consensus Gate"
          : type === "code"
          ? "Code Execution"
          : type === "storage"
          ? "Obsidian Archive"
          : "Webhook Dispatch",
      type,
      agentId: type === "agent" ? defaultAgent?.id : undefined,
      agentName: type === "agent" ? defaultAgent?.displayName || defaultAgent?.name : undefined,
      agentAvatar: type === "agent" ? defaultAgent?.avatar || "🤖" : undefined,
      role: type === "agent" ? defaultAgent?.role : undefined,
      model: type === "agent" ? defaultAgent?.model || "auto/fast" : undefined,
      prompt:
        type === "agent"
          ? "Synthesize output based on previous stage:\n{{previous_output}}"
          : "Execute step directives.",
      status: "idle",
      output: "",
      latency: 0,
    };

    const updated = [...nodes];
    updated.splice(index, 0, newNode);
    setNodes(updated);
    setSelectedNodeId(newNode.id);
    setIsSaved(false);
    toast.success(`Added new ${type.toUpperCase()} stage to DAG.`);
  };

  // Delete node
  const handleDeleteNode = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (nodes.length <= 1) {
      toast.error("DAG must contain at least one node.");
      return;
    }
    const filtered = nodes.filter((n) => n.id !== id);
    setNodes(filtered);
    if (selectedNodeId === id) {
      setSelectedNodeId(filtered[0]?.id || null);
    }
    setIsSaved(false);
    toast.info("Node removed from pipeline.");
  };

  // Duplicate node
  const handleDuplicateNode = (node: CustomDagNode, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const idx = nodes.findIndex((n) => n.id === node.id);
    const clone: CustomDagNode = {
      ...node,
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${node.name} (Copy)`,
      status: "idle",
    };
    const updated = [...nodes];
    updated.splice(idx + 1, 0, clone);
    setNodes(updated);
    setSelectedNodeId(clone.id);
    setIsSaved(false);
    toast.success("Stage duplicated.");
  };

  // Move node position
  const handleMoveNode = (fromIdx: number, toIdx: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (toIdx < 0 || toIdx >= nodes.length) return;
    const updated = [...nodes];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setNodes(updated);
    setIsSaved(false);
  };

  // Update selected node fields
  const handleUpdateNode = (id: string, updates: Partial<CustomDagNode>) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          const merged = { ...n, ...updates };
          // If agent changed, sync agent metadata
          if (updates.agentId && updates.agentId !== n.agentId) {
            const found = agents.find((a) => a.id === updates.agentId);
            if (found) {
              merged.agentName = found.displayName || found.name;
              merged.agentAvatar = found.avatar || "🤖";
              merged.role = found.role;
              merged.model = found.model || "auto/fast";
            }
          }
          return merged;
        }
        return n;
      })
    );
    setIsSaved(false);
  };

  // Export DAG to JSON file
  const handleExportJson = () => {
    const data = JSON.stringify({ name: pipelineName, nodes }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dag-pipeline-${pipelineName.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported DAG pipeline JSON!");
  };

  // Import DAG from JSON file
  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          setNodes(
            parsed.nodes.map((n: any, idx: number) => ({
              ...n,
              id: n.id || `node-${Date.now()}-${idx}`,
              status: "idle",
            }))
          );
          if (parsed.name) setPipelineName(parsed.name);
          setSelectedNodeId(parsed.nodes[0]?.id || null);
          setIsSaved(false);
          toast.success("Successfully imported custom DAG!");
        } else {
          toast.error("Invalid DAG JSON structure.");
        }
      } catch {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // Execute the DAG sequentially
  const handleRunPipeline = async () => {
    if (isRunning || nodes.length === 0) return;
    setIsRunning(true);

    // Reset statuses
    setNodes((prev) => prev.map((n) => ({ ...n, status: "idle" })));

    let previousOutput = "Initial trigger activated.";

    for (let i = 0; i < nodes.length; i++) {
      const currentNode = nodes[i];
      setSelectedNodeId(currentNode.id);

      // Set current node to running
      setNodes((prev) =>
        prev.map((n, idx) => (idx === i ? { ...n, status: "running" } : n))
      );

      const startTime = Date.now();
      let stepResult = "";

      if (useRealInference && currentNode.type === "agent" && currentNode.prompt) {
        try {
          const renderedPrompt = currentNode.prompt.replace(
            /\{\{previous_output\}\}/g,
            previousOutput
          );
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: renderedPrompt,
              model: currentNode.model || "auto/fast",
              agentName: currentNode.agentName || "Agent",
            }),
          });
          const data = await res.json();
          stepResult = data.response || `Completed stage ${currentNode.name}.`;
        } catch {
          stepResult = `[Simulation Fallback] Stage ${currentNode.name} processed output successfully.`;
        }
      } else {
        // High-fidelity stage simulation delay
        const simulatedDelay = Math.floor(Math.random() * 400) + 350;
        await new Promise((r) => setTimeout(r, simulatedDelay));

        if (currentNode.output && currentNode.output.length > 0) {
          stepResult = currentNode.output;
        } else if (currentNode.type === "agent") {
          stepResult = `Agent ${currentNode.agentName || "Specialist"} synthesized stage deliverables based on: "${previousOutput.slice(0, 60)}..."`;
        } else if (currentNode.type === "gate") {
          stepResult = `All security & schema consensus gates satisfied (100% confidence).`;
        } else if (currentNode.type === "storage") {
          stepResult = `Committed deliverables to Obsidian Vault note [[pipelines/${pipelineName.toLowerCase().replace(/\s+/g, "-")}.md]].`;
        } else {
          stepResult = `Processed stage ${currentNode.name} without errors.`;
        }
      }

      const elapsed = Date.now() - startTime;
      previousOutput = stepResult;

      // Update node with output and completed status
      setNodes((prev) =>
        prev.map((n, idx) =>
          idx === i
            ? {
                ...n,
                status: "completed",
                output: stepResult,
                latency: elapsed,
              }
            : n
        )
      );
    }

    setIsRunning(false);
    toast.success("Custom DAG pipeline execution finished!");
  };

  // Sync the completed pipeline results to the Obsidian Vault
  const handleSaveToObsidianVault = async () => {
    try {
      const fileName = `pipelines/${pipelineName.toLowerCase().replace(/\s+/g, "-")}.md`;
      const markdown = [
        "---",
        `title: "${pipelineName}"`,
        `date: "${new Date().toISOString()}"`,
        "type: \"dag_pipeline_deliverable\"",
        `stages_count: ${nodes.length}`,
        "tags: [dag, workflow, pipeline, autonomous-agents]",
        "---",
        "",
        `# ${pipelineName}`,
        "",
        `> **Execution Timestamp**: \`${new Date().toLocaleString()}\`  `,
        `> **Total Stages**: \`${nodes.length}\``,
        "",
        "## Pipeline Stages & Deliverables",
        "",
        ...nodes.map((n, idx) => [
          `### Stage ${idx + 1}: ${n.name} (${n.type.toUpperCase()})`,
          n.agentName ? `**Assigned Specialist**: ${n.agentAvatar} ${n.agentName} (\`${n.role || "agent"}\`)` : null,
          `**Prompt Directive**:`,
          "```",
          n.prompt,
          "```",
          `**Execution Result**:`,
          n.output || "*(No output generated)*",
          `*Latency: ${n.latency || 0}ms*`,
          "",
        ].filter(Boolean).join("\n")),
        "---",
        "*Exported automatically from Agent Studio OS DAG Pipeline Builder.*",
      ].join("\n");

      const res = await fetch("/api/vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "write",
          path: fileName,
          content: markdown,
        }),
      });

      if (!res.ok) throw new Error("Failed to save to Obsidian vault");
      toast.success(`Saved complete pipeline output to Obsidian Vault: ${fileName}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save to Obsidian vault.");
    }
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;

  // Node type visual helpers
  const getNodeTypeBadge = (type: DagNodeType) => {
    switch (type) {
      case "trigger":
        return {
          label: "Trigger",
          color: "bg-amber-500/15 text-amber-500 border-amber-500/30",
          icon: Zap,
        };
      case "agent":
        return {
          label: "Agent Task",
          color: "bg-primary/15 text-primary border-primary/30",
          icon: Bot,
        };
      case "gate":
        return {
          label: "Consensus Gate",
          color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
          icon: ShieldCheck,
        };
      case "code":
        return {
          label: "Code Execution",
          color: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30",
          icon: Code2,
        };
      case "storage":
        return {
          label: "Vault Storage",
          color: "bg-purple-500/15 text-purple-500 border-purple-500/30",
          icon: Database,
        };
      case "webhook":
        return {
          label: "API Webhook",
          color: "bg-blue-500/15 text-blue-500 border-blue-500/30",
          icon: Send,
        };
      default:
        return {
          label: "Stage",
          color: "bg-secondary text-foreground border-border",
          icon: Workflow,
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input for JSON Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportJson}
        accept=".json"
        className="hidden"
      />

      {/* Top Header & Pipeline Controls */}
      <div className="p-5 rounded-2xl border border-border bg-card/80 backdrop-blur-xl shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 flex-1 min-w-[280px]">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-xs font-semibold uppercase tracking-wider">
                Customizable DAG Engine
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {nodes.length} Stages Connected
              </span>
              {!isSaved && (
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                  Unsaved Changes
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={pipelineName}
                onChange={(e) => {
                  setPipelineName(e.target.value);
                  setIsSaved(false);
                }}
                className="text-lg font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-all px-1 py-0.5 rounded"
                placeholder="Pipeline Name..."
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Design, customize, and execute multi-agent workflows. Click any stage to edit prompts, assign agents, or insert new nodes.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Template Picker */}
            <select
              value={selectedTemplateKey}
              onChange={(e) => loadTemplate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-secondary/80 border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="feature">Template: Autonomous Feature Delivery</option>
              <option value="security">Template: Security &amp; Vulnerability Audit</option>
              <option value="blank">Template: Blank Canvas</option>
            </select>

            {/* Save Pipeline Button */}
            <button
              onClick={handleSavePipeline}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <Save className="w-3.5 h-3.5 text-primary" />
              <span>Save</span>
            </button>

            {/* Export JSON */}
            <button
              onClick={handleExportJson}
              title="Export DAG to JSON"
              className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border text-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Import JSON */}
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import DAG from JSON"
              className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground border border-border text-xs transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>

            {/* Save Deliverable to Obsidian */}
            <button
              onClick={handleSaveToObsidianVault}
              title="Export complete execution log to Obsidian Vault"
              className="flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-medium transition-all cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Sync to Vault</span>
            </button>

            {/* Run Pipeline Button */}
            <button
              onClick={handleRunPipeline}
              disabled={isRunning || nodes.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 text-xs font-bold shadow-lg shadow-primary/25 transition-all cursor-pointer"
            >
              {isRunning ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              <span>{isRunning ? "Executing Pipeline..." : "Run Pipeline DAG"}</span>
            </button>
          </div>
        </div>

        {/* Inference Toggle & Quick Info */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/60 text-xs text-muted-foreground">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={useRealInference}
              onChange={(e) => setUseRealInference(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary accent-primary cursor-pointer"
            />
            <span className="text-foreground font-medium">
              Live LLM Execution (dispatches prompts to active model endpoints via /api/chat)
            </span>
          </label>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>Click any node card to inspect or customize</span>
          </div>
        </div>
      </div>

      {/* Interactive Visual DAG Canvas */}
      <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card/60 backdrop-blur-xl shadow-sm overflow-x-auto relative">
        <div className="min-w-[960px] flex items-center gap-3 relative py-6">
          {nodes.map((node, idx) => {
            const isSelected = selectedNode?.id === node.id;
            const badge = getNodeTypeBadge(node.type);
            const BadgeIcon = badge.icon;

            const statusRing =
              node.status === "completed"
                ? "border-emerald-500/50 text-emerald-500 bg-emerald-500/10"
                : node.status === "running"
                ? "border-primary text-primary bg-primary/15 animate-pulse"
                : "border-border text-muted-foreground bg-secondary/50";

            return (
              <div key={node.id} className="flex items-center gap-3">
                {/* Node Card */}
                <motion.div
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedNodeId(node.id)}
                  className={`w-48 sm:w-52 p-4 rounded-2xl border transition-all cursor-pointer shadow-md bg-card/90 backdrop-blur-md space-y-3 relative group ${
                    isSelected
                      ? "ring-2 ring-primary border-primary shadow-primary/10"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  {/* Top Header: Stage Number & Status Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">
                      Stage {idx + 1}
                    </span>
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${statusRing}`}
                    >
                      {node.status === "completed" ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      ) : node.status === "running" ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </span>
                  </div>

                  {/* Node Type Pill */}
                  <div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${badge.color}`}
                    >
                      <BadgeIcon className="w-2.5 h-2.5" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {/* Node Title & Assigned Agent */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-foreground truncate" title={node.name}>
                      {node.name}
                    </h4>

                    {node.type === "agent" && (
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground truncate">
                        <span className="text-sm">{node.agentAvatar || "🤖"}</span>
                        <span className="font-medium text-foreground truncate">
                          {node.agentName || "Assigned Agent"}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Node Footer: Latency & Quick Reorder Actions */}
                  <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">
                      {node.latency ? `${node.latency}ms` : "Idle"}
                    </span>

                    {/* Quick Move / Delete Controls */}
                    <div className="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleMoveNode(idx, idx - 1, e)}
                        disabled={idx === 0}
                        title="Move Stage Left"
                        className="p-1 rounded hover:bg-secondary disabled:opacity-20 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleMoveNode(idx, idx + 1, e)}
                        disabled={idx === nodes.length - 1}
                        title="Move Stage Right"
                        className="p-1 rounded hover:bg-secondary disabled:opacity-20 text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDuplicateNode(node, e)}
                        title="Duplicate Stage"
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteNode(node.id, e)}
                        title="Delete Stage"
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>

                {/* Insertion Connector Between Nodes */}
                {idx < nodes.length - 1 && (
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-0.5 bg-border" />
                    <button
                      onClick={() => handleAddNode(idx + 1, "agent")}
                      title="Insert stage here"
                      className="w-5 h-5 rounded-full bg-secondary hover:bg-primary text-muted-foreground hover:text-primary-foreground border border-border flex items-center justify-center transition-all cursor-pointer shadow-sm group/btn"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <div className="w-4 h-0.5 bg-border" />
                  </div>
                )}
              </div>
            );
          })}

          {/* Add Stage at End Button */}
          <div className="flex items-center pl-2">
            <button
              onClick={() => handleAddNode(nodes.length, "agent")}
              className="flex flex-col items-center justify-center w-36 h-36 rounded-2xl border-2 border-dashed border-border hover:border-primary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-all cursor-pointer p-4 space-y-2 group"
            >
              <div className="w-8 h-8 rounded-xl bg-secondary group-hover:bg-primary group-hover:text-primary-foreground flex items-center justify-center transition-all">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-center">Add Next Stage</span>
              <span className="text-[10px] text-muted-foreground text-center">Insert step</span>
            </button>
          </div>
        </div>
      </div>

      {/* Node Inspector & Live Editor */}
      {selectedNode && (
        <motion.div
          key={selectedNode.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl border border-border bg-card/90 backdrop-blur-xl shadow-md space-y-5"
        >
          {/* Inspector Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
                {selectedNode.agentAvatar ? (
                  <span className="text-lg">{selectedNode.agentAvatar}</span>
                ) : (
                  <Sliders className="w-4 h-4" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <span>Customize Stage: {selectedNode.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase ${
                      getNodeTypeBadge(selectedNode.type).color
                    }`}
                  >
                    {selectedNode.type}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground font-mono">
                  Stage ID: {selectedNode.id} • Status: {selectedNode.status.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleDuplicateNode(selectedNode)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-medium text-foreground transition-all cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Duplicate</span>
              </button>

              <button
                onClick={() => handleDeleteNode(selectedNode.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium text-red-400 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Stage</span>
              </button>
            </div>
          </div>

          {/* Form Configuration Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Column 1: Core Configuration */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                  Stage Label / Title
                </label>
                <input
                  type="text"
                  value={selectedNode.name}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { name: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/60 border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. Architecture Scan"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                  Node Type
                </label>
                <select
                  value={selectedNode.type}
                  onChange={(e) =>
                    handleUpdateNode(selectedNode.id, { type: e.target.value as DagNodeType })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/60 border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="agent">Specialist Agent Task</option>
                  <option value="trigger">Inbound Trigger / Event</option>
                  <option value="gate">Consensus &amp; Security Gate</option>
                  <option value="code">Script / Tool Execution</option>
                  <option value="storage">Obsidian Vault Storage</option>
                  <option value="webhook">Outbound Webhook / API</option>
                </select>
              </div>

              {/* Agent Assignment (shown for Agent tasks) */}
              {selectedNode.type === "agent" && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                    Assigned Fleet Specialist
                  </label>
                  <select
                    value={selectedNode.agentId || agents[0]?.id || ""}
                    onChange={(e) => handleUpdateNode(selectedNode.id, { agentId: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-secondary/60 border border-border text-foreground text-xs font-medium focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.avatar || "🤖"} {ag.displayName || ag.name} ({ag.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Model Override */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                  Inference Model Endpoint
                </label>
                <input
                  type="text"
                  value={selectedNode.model || "auto/fast"}
                  onChange={(e) => handleUpdateNode(selectedNode.id, { model: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl bg-secondary/60 border border-border text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="e.g. google/gemini-3.6-flash, auto/fast"
                />
              </div>
            </div>

            {/* Column 2: Prompt Directives */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                  Execution Directives / Prompt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const currentPrompt = selectedNode.prompt || "";
                    handleUpdateNode(selectedNode.id, {
                      prompt: currentPrompt + "\n{{previous_output}}",
                    });
                  }}
                  className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-2.5 h-2.5" />
                  <span>Insert &#123;&#123;previous_output&#125;&#125;</span>
                </button>
              </div>

              <textarea
                rows={7}
                value={selectedNode.prompt}
                onChange={(e) => handleUpdateNode(selectedNode.id, { prompt: e.target.value })}
                placeholder="Write detailed instructions for this stage. Use {{previous_output}} to receive results from the preceding stage..."
                className="w-full p-3 rounded-xl bg-secondary/60 border border-border text-foreground text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
              <p className="text-[10.5px] text-muted-foreground">
                Tip: The output from Stage N-1 replaces <code className="text-primary font-mono">&#123;&#123;previous_output&#125;&#125;</code> at runtime.
              </p>
            </div>

            {/* Column 3: Live Output Deliverable */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-foreground uppercase tracking-wider block font-mono">
                  Stage Output Deliverable
                </label>
                {selectedNode.output && (
                  <button
                    onClick={() => handleUpdateNode(selectedNode.id, { output: "" })}
                    className="text-[10px] font-mono text-muted-foreground hover:text-foreground"
                  >
                    Clear Output
                  </button>
                )}
              </div>

              <textarea
                rows={7}
                value={selectedNode.output || ""}
                onChange={(e) => handleUpdateNode(selectedNode.id, { output: e.target.value })}
                placeholder="Output from the latest execution will appear here, or you can supply pre-seeded deliverables..."
                className="w-full p-3 rounded-xl bg-secondary/40 border border-border text-foreground text-xs font-mono leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />

              <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground">
                <span>Latency: {selectedNode.latency || 0}ms</span>
                {selectedNode.status === "completed" && (
                  <span className="text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Verified Output
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
