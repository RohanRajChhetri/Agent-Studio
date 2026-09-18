"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Plus,
  Trash2,
  ArrowDown,
  ArrowUp,
  Sparkles,
  CheckCircle2,
  Loader2,
  Save,
  FolderDown,
  Layers,
  ChevronRight,
  Clock,
  ExternalLink,
  Code2,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { formatResponseTime } from "@/lib/utils";


export interface PipelineStage {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  outputKey?: string;
}

interface AgentPipelineBuilderProps {
  agents: AgentProfile[];
}

const PRESET_PIPELINES: Array<{
  name: string;
  description: string;
  stages: Array<{ name: string; agentRole: string; prompt: string }>;
}> = [
  {
    name: "Full Feature Autonomous Delivery",
    description: "Multi-agent chain: Deep research -> Architecture -> DevOps Implementation -> Documentation",
    stages: [
      {
        name: "Stage 1: Research & Specifications",
        agentRole: "specialist",
        prompt: "Analyze the technical requirements, edge-cases, and API schemas for this feature. Produce a structured research brief.",
      },
      {
        name: "Stage 2: Implementation & DevOps",
        agentRole: "developer",
        prompt: "Based on the research: {{previous_output}}\n\nImplement the production-ready code with complete error handling and unit tests.",
      },
      {
        name: "Stage 3: Documentation & Executive Brief",
        agentRole: "copywriter",
        prompt: "Review the implementation: {{previous_output}}\n\nWrite concise developer documentation, release highlights, and deployment checklist.",
      },
    ],
  },
  {
    name: "Autonomous Security & Code Health Audit",
    description: "Static inspection -> Vulnerability analysis -> Automated patch generation",
    stages: [
      {
        name: "Stage 1: Vulnerability Scan",
        agentRole: "specialist",
        prompt: "Inspect code patterns for injection vulnerabilities, unauthorized access risks, and resource leaks.",
      },
      {
        name: "Stage 2: Remediation & Patching",
        agentRole: "devops",
        prompt: "Given audit findings: {{previous_output}}\n\nProvide hardened code patches and architectural recommendations to eliminate risks.",
      },
    ],
  },
];

export function AgentPipelineBuilder({ agents }: AgentPipelineBuilderProps) {
  const [pipelineName, setPipelineName] = useState("Autonomous Feature Delivery");
  const [stages, setStages] = useState<PipelineStage[]>([
    {
      id: "stg-1",
      name: "1. Research & Analysis",
      agentId: agents.find((a) => a.role === "specialist" || a.name.includes("athena"))?.id || agents[0]?.id || "",
      prompt: "Analyze requirements and produce technical specifications.",
    },
    {
      id: "stg-2",
      name: "2. Code Execution & DevOps",
      agentId: agents.find((a) => a.role === "worker" || a.name.includes("vulcan"))?.id || agents[1]?.id || agents[0]?.id || "",
      prompt: "Based on specifications:\n{{previous_output}}\n\nGenerate verified implementation code.",
    },
    {
      id: "stg-3",
      name: "3. Synthesis & Documentation",
      agentId: agents.find((a) => a.name.includes("mercury") || a.role === "manager")?.id || agents[2]?.id || agents[0]?.id || "",
      prompt: "Synthesize findings and write executive deliverable notes.",
    },
  ]);

  const [running, setRunning] = useState(false);
  const [currentRunningIndex, setCurrentRunningIndex] = useState<number | null>(null);
  const [stageOutputs, setStageOutputs] = useState<Record<string, { text: string; latency: number }>>({});
  const [savedToVault, setSavedToVault] = useState<string | null>(null);

  // Add a stage
  const handleAddStage = () => {
    const nextIdx = stages.length + 1;
    setStages((prev) => [
      ...prev,
      {
        id: "stg-" + Date.now(),
        name: `${nextIdx}. Next Specialist Stage`,
        agentId: agents[0]?.id || "",
        prompt: "Execute specialist task using {{previous_output}} context.",
      },
    ]);
  };

  // Remove a stage
  const handleRemoveStage = (id: string) => {
    if (stages.length <= 1) {
      toast.error("Pipeline must have at least one stage");
      return;
    }
    setStages((prev) => prev.filter((s) => s.id !== id));
  };

  // Move stage
  const handleMoveStage = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const copy = [...stages];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setStages(copy);
  };

  // Load preset
  const handleLoadPreset = (preset: typeof PRESET_PIPELINES[0]) => {
    setPipelineName(preset.name);
    const newStages: PipelineStage[] = preset.stages.map((stg, i) => {
      const matchAgent = agents.find((a) =>
        `${a.role || ""} ${a.name} ${a.displayName}`.toLowerCase().includes(stg.agentRole.toLowerCase())
      ) || agents[i % agents.length] || agents[0];

      return {
        id: "stg-" + Date.now() + "-" + i,
        name: stg.name,
        agentId: matchAgent?.id || agents[0]?.id || "",
        prompt: stg.prompt,
      };
    });
    setStages(newStages);
    setStageOutputs({});
    setSavedToVault(null);
    toast.success(`Loaded preset: ${preset.name}`);
  };

  // Execute Pipeline Sequential Runner
  const handleRunPipeline = async () => {
    if (running) return;
    setRunning(true);
    setStageOutputs({});
    setSavedToVault(null);

    let previousOutput = "";

    try {
      for (let i = 0; i < stages.length; i++) {
        const stage = stages[i];
        setCurrentRunningIndex(i);

        const agent = agents.find((a) => a.id === stage.agentId) || agents[0];
        const resolvedPrompt = stage.prompt.replace(/{{previous_output}}/g, previousOutput || "(None - initial stage)");

        const start = Date.now();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: `[Pipeline Stage: ${stage.name}]\n${resolvedPrompt}`,
            model: "auto/fast",
            agentId: agent?.id,
            agentName: agent?.displayName,
          }),
        });

        const data = await res.json();
        const latency = Date.now() - start;

        if (!res.ok) throw new Error(data.error || `Stage ${i + 1} failed`);

        const outputText = data.response || "Stage executed successfully.";
        previousOutput = outputText;

        setStageOutputs((prev) => ({
          ...prev,
          [stage.id]: { text: outputText, latency },
        }));
      }

      // Automatically persist final deliverable to Obsidian Vault
      const vaultRes = await fetch("/api/vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Pipeline_${pipelineName.replace(/\s+/g, "_")}`,
          folder: "swarms",
          tags: ["pipeline", "multi-agent", "deliverable"],
          content: `# Multi-Agent Pipeline: ${pipelineName}\n\nGenerated autonomously across ${stages.length} specialist stages.\n\n${Object.entries(stageOutputs)
            .map(([_, out], idx) => `### Stage ${idx + 1}\n${out.text}\n`)
            .join("\n---\n\n")}\n\n### Final Deliverable\n${previousOutput}`,
        }),
      });

      const vaultData = await vaultRes.json();
      if (vaultData.path) {
        setSavedToVault(vaultData.path);
        toast.success("Pipeline finished & deliverable saved to Obsidian Vault!");
      } else {
        toast.success("Pipeline executed successfully!");
      }
    } catch (err: any) {
      console.error("Pipeline execution error:", err);
      toast.error(err.message || "Pipeline execution interrupted");
    } finally {
      setRunning(false);
      setCurrentRunningIndex(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-lg border border-border glass shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-border font-semibold text-[11px] uppercase tracking-wider">
              Autonomous Pipeline DAG
            </span>
            <span className="text-xs text-muted-foreground">
              {stages.length} Specialist Stages
            </span>
          </div>
          <input
            type="text"
            value={pipelineName}
            onChange={(e) => setPipelineName(e.target.value)}
            className="text-lg sm:text-xl font-bold bg-transparent text-foreground outline-none border-b border-transparent hover:border-border focus:border-amber-600 transition-colors w-full max-w-md"
            title="Click to rename pipeline"
          />
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset templates */}
          <div className="flex items-center gap-1.5">
            {PRESET_PIPELINES.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleLoadPreset(p)}
                disabled={running}
                className="px-2.5 py-1.5 rounded-xl border border-border hover:border-border bg-secondary/50 text-xs text-muted-foreground hover:text-foreground transition-all"
                title={p.description}
              >
                <span>Template: {p.name.split(" ")[0]}</span>
              </button>
            ))}
          </div>

          <button
            onClick={handleAddStage}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Stage</span>
          </button>

          <button
            onClick={handleRunPipeline}
            disabled={running || stages.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary text-primary-foreground text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50"
          >
            {running ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-current" />
            )}
            <span>{running ? "Executing Pipeline..." : "Run Pipeline"}</span>
          </button>
        </div>
      </div>

      {/* Saved to Vault Notification */}
      {savedToVault && (
        <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-emerald-300 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-foreground shrink-0" />
            <span>Deliverable archived to Obsidian Vault: <strong>{savedToVault}</strong></span>
          </div>
          <a
            href="/memory"
            className="text-foreground hover:underline font-semibold text-xs"
          >
            View in Memory Galaxy &rarr;
          </a>
        </div>
      )}

      {/* Pipeline Stage DAG Visual Flow */}
      <div className="space-y-3">
        {stages.map((stage, idx) => {
          const isCurrent = running && currentRunningIndex === idx;
          const output = stageOutputs[stage.id];
          const assignedAgent = agents.find((a) => a.id === stage.agentId) || agents[0];

          return (
            <div key={stage.id} className="relative group">
              {/* Step Card */}
              <div
                className={`p-4 rounded-lg border transition-all ${
                  isCurrent
                    ? "border-amber-600 bg-primary/10 text-primary shadow-lg shadow-indigo-500/15 ring-2 ring-indigo-500/30"
                    : output
                    ? "border-emerald-500/40 glass shadow-sm"
                    : "border-border glass hover:border-border/80"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-primary/15 text-primary border border-border flex items-center justify-center text-xs font-bold font-mono">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={stage.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        setStages((prev) =>
                          prev.map((s) => (s.id === stage.id ? { ...s, name: val } : s))
                        );
                      }}
                      className="text-xs font-bold text-foreground bg-transparent outline-none border-b border-transparent hover:border-border focus:border-amber-600"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Agent Selector */}
                    <div className="flex items-center gap-1.5 bg-secondary px-2.5 py-1 rounded-xl border border-border text-xs">
                      <span className="text-sm">{assignedAgent?.avatar || "🤖"}</span>
                      <select
                        value={stage.agentId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setStages((prev) =>
                            prev.map((s) => (s.id === stage.id ? { ...s, agentId: val } : s))
                          );
                        }}
                        className="bg-transparent text-xs text-foreground outline-none cursor-pointer font-medium"
                      >
                        {agents.map((a) => (
                          <option key={a.id} value={a.id} className="bg-popover text-popover-foreground">
                            {a.displayName} ({a.role || "Specialist"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Move Up/Down Controls */}
                    <button
                      onClick={() => handleMoveStage(idx, "up")}
                      disabled={idx === 0 || running}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                      title="Move stage up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveStage(idx, "down")}
                      disabled={idx === stages.length - 1 || running}
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary disabled:opacity-30 transition-colors"
                      title="Move stage down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Stage */}
                    <button
                      onClick={() => handleRemoveStage(stage.id)}
                      disabled={running}
                      className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Delete stage"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Prompt Instruction Area */}
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Specialist Directive Prompt (Use {"{{previous_output}}"} to chain context)
                  </label>
                  <textarea
                    rows={2}
                    value={stage.prompt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setStages((prev) =>
                        prev.map((s) => (s.id === stage.id ? { ...s, prompt: val } : s))
                      );
                    }}
                    placeholder="Enter instructions for this stage..."
                    className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground outline-none focus:border-border resize-y"
                  />
                </div>

                {/* Status / Output Display */}
                {isCurrent && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-foreground p-2.5 rounded-xl bg-primary/10 text-primary border border-border">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Agent {assignedAgent?.displayName} is synthesizing stage outputs...</span>
                  </div>
                )}

                {output && (
                  <div className="mt-3 p-3 rounded-xl bg-background border border-emerald-500/30 text-xs font-mono space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="text-foreground font-bold uppercase">Stage Output</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatResponseTime(output.latency)}
                      </span>

                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                      {output.text}
                    </p>
                  </div>
                )}
              </div>

              {/* Connecting Connector Arrow */}
              {idx < stages.length - 1 && (
                <div className="flex justify-center my-1.5">
                  <div className="w-6 h-6 rounded-md bg-secondary border border-border flex items-center justify-center text-muted-foreground shadow-sm">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
