"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  Plus,
  Trash2,
  ArrowDown,
  ArrowUp,
  Sparkles,
  CheckCircle2,
  Loader2,
  Save,
  Layers,
  ChevronRight,
  Clock,
  ExternalLink,
  Code2,
  Copy,
  Download,
  RotateCcw,
  ShieldCheck,
  Check,
  Edit3,
  Eye,
  GitCompare,
  FileText,
  Sliders,
  Zap,
  Bot,
  AlertCircle,
  HelpCircle,
  FolderDown,
  Wand2,
  FastForward,
  Workflow,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import type { AgentProfile } from "@/types";
import { formatResponseTime } from "@/lib/utils";
import { AgentAvatar } from "@/components/ui/agent-avatar";

import {
  playTaskCompletedSound,
  playTaskStartedSound,
  playWarningSound,
  playClickSound,
} from "@/lib/sound-effects";

// Backward-compatibility export
export interface PipelineStage {
  id: string;
  name: string;
  agentId: string;
  prompt: string;
  outputKey?: string;
}

export type AssemblyStationRole =
  | "Architecture & Spec"
  | "Code Implementation"
  | "Security & Audit"
  | "Release & Docs"
  | "Research & Analysis"
  | "Custom Station";

export interface AssemblyStation {
  id: string;
  name: string;
  role: AssemblyStationRole;
  agentId: string;
  directive: string;
  status: "idle" | "running" | "inspected" | "completed" | "error";
  latency?: number;
}

export interface ArtifactRevision {
  id: string;
  version: number;
  stationId: string;
  stationName: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  role: string;
  changelog: string;
  notes?: string;
  document: string;
  latency: number;
  timestamp: string;
}

export interface AssemblyPreset {
  id: string;
  name: string;
  description: string;
  defaultMission: string;
  stations: Array<{
    name: string;
    role: AssemblyStationRole;
    preferredRole?: string;
    directive: string;
  }>;
}

const STORAGE_KEY = "agent-studio-assembly-line-state-v1";

// Built-in high-leverage presets
const ASSEMBLY_PRESETS: AssemblyPreset[] = [
  {
    id: "feature-delivery",
    name: "Autonomous Feature Delivery",
    description: "4-stage assembly line: Architecture Spec → Code Implementation → Security Audit → Release Packaging",
    defaultMission: "Build a high-performance token-bucket rate limiter middleware with Redis backend, configurable tier quotas, and graceful degradation headers.",
    stations: [
      {
        name: "1. Architecture & Technical Spec",
        role: "Architecture & Spec",
        preferredRole: "specialist",
        directive: "Analyze the overall mission directive. Produce architectural blueprint, component interfaces, TypeScript type schemas, Redis key lifecycle, and configuration contracts.",
      },
      {
        name: "2. Fullstack Code Implementation",
        role: "Code Implementation",
        preferredRole: "worker",
        directive: "Read the living architecture blueprint in the artifact. Implement production-grade TypeScript components, robust middleware logic, helper methods, and error handling.",
      },
      {
        name: "3. Security & Consensus Audit",
        role: "Security & Audit",
        preferredRole: "specialist",
        directive: "Perform red-team audit on the implemented code and architecture. Check for race conditions, Redis timeout leaks, memory safety, and OWASP boundary sanitization. Patch fixes directly into the document.",
      },
      {
        name: "4. Release Packaging & Docs",
        role: "Release & Docs",
        preferredRole: "manager",
        directive: "Synthesize the final deliverable. Add executive summary, environment variables guide, quickstart integration example, and changelog verification notes.",
      },
    ],
  },
  {
    id: "bug-fix-hardening",
    name: "Autonomous Bug Fix & Hardening",
    description: "3-stage assembly line: Root Cause Analysis → Surgical Code Patch → Regression Testing",
    defaultMission: "Diagnose and resolve intermittent WebSocket connection drops and stale authorization token race conditions under high network jitter.",
    stations: [
      {
        name: "1. Root Cause & Trace Analysis",
        role: "Research & Analysis",
        preferredRole: "specialist",
        directive: "Analyze the reported defect. Map reproduction steps, trace token refresh timing boundaries, and outline specific code modules at fault.",
      },
      {
        name: "2. Surgical Patch Implementation",
        role: "Code Implementation",
        preferredRole: "worker",
        directive: "Based on the root-cause diagnosis, write the surgical code fix. Ensure atomic token swapping, exponential backoff reconnects, and zero breaking changes.",
      },
      {
        name: "3. Regression & Edge-Case Testing",
        role: "Security & Audit",
        preferredRole: "specialist",
        directive: "Audit the patch for edge cases. Provide comprehensive test specifications, boundary mocking scenarios, and verify no regressions are introduced.",
      },
    ],
  },
  {
    id: "deep-research-whitepaper",
    name: "Deep Research & Strategic Whitepaper",
    description: "3-stage assembly line: Technical Investigation → Red Team Fact-Check → Executive Brief",
    defaultMission: "Comparative Evaluation of Autonomous AI Agent Architectures: Topological DAGs vs. Collaborative Assembly Lines vs. Distributed Swarms.",
    stations: [
      {
        name: "1. Technical Intelligence Gathering",
        role: "Research & Analysis",
        preferredRole: "specialist",
        directive: "Conduct deep exploration on the topic. Gather performance benchmarks, coordination topologies, failure modes, state synchronization patterns, and real-world case studies.",
      },
      {
        name: "2. Red Team Fact Check & Critique",
        role: "Security & Audit",
        preferredRole: "specialist",
        directive: "Critically audit the findings. Challenge unsupported assertions, find trade-off blindspots, strengthen logical rigor, and sharpen comparison metrics.",
      },
      {
        name: "3. Executive Whitepaper Synthesis",
        role: "Release & Docs",
        preferredRole: "manager",
        directive: "Synthesize the refined findings into a publication-grade executive whitepaper with actionable decision frameworks, architectural diagrams, and summary recommendations.",
      },
    ],
  },
  {
    id: "custom-blank",
    name: "Custom Blank Assembly Line",
    description: "Design your own custom multi-agent production line from scratch.",
    defaultMission: "Create a custom solution with your specialist team...",
    stations: [
      {
        name: "1. Specialist Draft",
        role: "Architecture & Spec",
        preferredRole: "specialist",
        directive: "Review the mission and produce the initial draft of the living artifact.",
      },
      {
        name: "2. Expert Refinement & Polish",
        role: "Release & Docs",
        preferredRole: "worker",
        directive: "Review the living artifact. Refine, improve, and add execution details.",
      },
    ],
  },
];

// Pure TypeScript line-by-line diff engine
export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
  lineA?: number;
  lineB?: number;
}

function computeLineDiff(oldText: string, newText: string): {
  lines: DiffLine[];
  additions: number;
  deletions: number;
} {
  const linesA = oldText ? oldText.split("\n") : [];
  const linesB = newText ? newText.split("\n") : [];

  // Short-circuit for empty base
  if (linesA.length === 0) {
    return {
      lines: linesB.map((b, i) => ({ type: "added", content: b, lineB: i + 1 })),
      additions: linesB.length,
      deletions: 0,
    };
  }

  // Fast LCS implementation with safety limit for large files
  const M = linesA.length;
  const N = linesB.length;

  if (M > 800 || N > 800) {
    // Fallback naive chunking for massive documents
    const result: DiffLine[] = [];
    let additions = 0;
    let deletions = 0;
    const maxLen = Math.max(M, N);
    for (let i = 0; i < maxLen; i++) {
      if (i < M && i < N) {
        if (linesA[i] === linesB[i]) {
          result.push({ type: "unchanged", content: linesA[i], lineA: i + 1, lineB: i + 1 });
        } else {
          result.push({ type: "removed", content: linesA[i], lineA: i + 1 });
          result.push({ type: "added", content: linesB[i], lineB: i + 1 });
          additions++;
          deletions++;
        }
      } else if (i < M) {
        result.push({ type: "removed", content: linesA[i], lineA: i + 1 });
        deletions++;
      } else {
        result.push({ type: "added", content: linesB[i], lineB: i + 1 });
        additions++;
      }
    }
    return { lines: result, additions, deletions };
  }

  // DP table for LCS
  const dp: number[][] = Array.from({ length: M + 1 }, () => new Array(N + 1).fill(0));
  for (let i = 1; i <= M; i++) {
    for (let j = 1; j <= N; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to extract diff sequence
  const resultReversed: DiffLine[] = [];
  let i = M;
  let j = N;
  let additions = 0;
  let deletions = 0;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      resultReversed.push({
        type: "unchanged",
        content: linesA[i - 1],
        lineA: i,
        lineB: j,
      });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      resultReversed.push({
        type: "added",
        content: linesB[j - 1],
        lineB: j,
      });
      additions++;
      j--;
    } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
      resultReversed.push({
        type: "removed",
        content: linesA[i - 1],
        lineA: i,
      });
      deletions++;
      i--;
    }
  }

  return {
    lines: resultReversed.reverse(),
    additions,
    deletions,
  };
}

interface AgentPipelineBuilderProps {
  agents: AgentProfile[];
}

export function AgentPipelineBuilder({ agents }: AgentPipelineBuilderProps) {
  // Top-level pipeline state
  const [pipelineName, setPipelineName] = useState("Autonomous Feature Delivery");
  const [missionInput, setMissionInput] = useState(
    "Build a high-performance token-bucket rate limiter middleware with Redis backend, configurable tier quotas, and graceful degradation headers."
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>("feature-delivery");
  const [executionMode, setExecutionMode] = useState<"autonomous" | "inspection">("autonomous");

  // Stations & Revisions
  const [stations, setStations] = useState<AssemblyStation[]>([]);
  const [revisions, setRevisions] = useState<ArtifactRevision[]>([]);
  const [selectedRevisionIndex, setSelectedRevisionIndex] = useState<number>(0);

  // Runtime Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState<number | null>(null);
  const [isPausedForInspection, setIsPausedForInspection] = useState(false);
  const [operatorFeedback, setOperatorFeedback] = useState("");
  const [viewMode, setViewMode] = useState<"formatted" | "diff" | "edit">("formatted");

  // Editable Draft Content
  const [editableDocument, setEditableDocument] = useState<string>("");

  // Obsidian Vault & Export
  const [savedToVault, setSavedToVault] = useState<string | null>(null);
  const [isSyncingVault, setIsSyncingVault] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Stop flag ref for canceling
  const stopRequestedRef = useRef(false);

  // Helper to match best agent by role or fallback
  const resolveAgent = (preferredRole?: string, stationIdx: number = 0) => {
    if (preferredRole) {
      const match = agents.find(
        (a) =>
          a.role?.toLowerCase() === preferredRole.toLowerCase() ||
          a.name.toLowerCase().includes(preferredRole.toLowerCase())
      );
      if (match) return match;
    }
    return agents[stationIdx % agents.length] || agents[0];
  };

  // Load a preset template
  const loadPreset = (presetId: string) => {
    const preset = ASSEMBLY_PRESETS.find((p) => p.id === presetId) || ASSEMBLY_PRESETS[0];
    setSelectedPresetId(preset.id);
    setPipelineName(preset.name);
    setMissionInput(preset.defaultMission);

    const newStations: AssemblyStation[] = preset.stations.map((st, idx) => {
      const matchedAgent = resolveAgent(st.preferredRole, idx);
      return {
        id: `stn-${Date.now()}-${idx}`,
        name: st.name,
        role: st.role,
        agentId: matchedAgent?.id || agents[0]?.id || "",
        directive: st.directive,
        status: "idle",
      };
    });

    setStations(newStations);
    setRevisions([]);
    setSelectedRevisionIndex(0);
    setSavedToVault(null);
    setIsPausedForInspection(false);
    toast.success(`Loaded "${preset.name}" preset`);
  };

  // Initialize from LocalStorage or Default Preset
  useEffect(() => {
    if (agents.length === 0) return;

    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.stations && Array.isArray(parsed.stations) && parsed.stations.length > 0) {
          setPipelineName(parsed.pipelineName || "Custom Assembly Line");
          setMissionInput(parsed.missionInput || "");
          setExecutionMode(parsed.executionMode || "autonomous");
          setSelectedPresetId(parsed.selectedPresetId || "custom-blank");
          setStations(parsed.stations);
          if (parsed.revisions && Array.isArray(parsed.revisions) && parsed.revisions.length > 0) {
            setRevisions(parsed.revisions);
            setSelectedRevisionIndex(parsed.revisions.length - 1);
            setEditableDocument(parsed.revisions[parsed.revisions.length - 1]?.document || "");
          }
          return;
        }
      }
    } catch {
      // Fallback
    }

    loadPreset("feature-delivery");
  }, [agents]);

  // Persist state changes to LocalStorage
  useEffect(() => {
    if (stations.length === 0) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          pipelineName,
          missionInput,
          executionMode,
          selectedPresetId,
          stations,
          revisions,
        })
      );
    } catch (err) {
      console.warn("Failed to save assembly line state:", err);
    }
  }, [pipelineName, missionInput, executionMode, selectedPresetId, stations, revisions]);

  // Sync active revision to editableDocument when selection changes
  const activeRevision = revisions[selectedRevisionIndex] || null;
  useEffect(() => {
    if (activeRevision) {
      setEditableDocument(activeRevision.document);
    }
  }, [selectedRevisionIndex, revisions]);

  // Previous revision for diff comparison
  const previousRevision = useMemo(() => {
    if (selectedRevisionIndex > 0 && revisions[selectedRevisionIndex - 1]) {
      return revisions[selectedRevisionIndex - 1];
    }
    return null;
  }, [selectedRevisionIndex, revisions]);

  // Computed line diff
  const diffData = useMemo(() => {
    const oldText = previousRevision ? previousRevision.document : "";
    const newText = activeRevision ? activeRevision.document : "";
    return computeLineDiff(oldText, newText);
  }, [previousRevision, activeRevision]);

  // Station Management Controls
  const handleAddStation = () => {
    const nextIdx = stations.length + 1;
    const defaultAgent = agents[nextIdx % agents.length] || agents[0];
    const newStation: AssemblyStation = {
      id: `stn-${Date.now()}`,
      name: `${nextIdx}. Expert Polish Station`,
      role: "Code Implementation",
      agentId: defaultAgent?.id || "",
      directive: "Review the living artifact and refine implementation details.",
      status: "idle",
    };
    setStations((prev) => [...prev, newStation]);
    toast.success("Added new station to assembly line");
  };

  const handleRemoveStation = (id: string) => {
    if (stations.length <= 1) {
      toast.error("Assembly line must have at least one station");
      return;
    }
    setStations((prev) => prev.filter((s) => s.id !== id));
    toast.info("Station removed");
  };

  const handleMoveStation = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= stations.length) return;
    const copy = [...stations];
    const temp = copy[index];
    copy[index] = copy[targetIndex];
    copy[targetIndex] = temp;
    setStations(copy);
  };

  const handleUpdateStation = (id: string, updates: Partial<AssemblyStation>) => {
    setStations((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  // Save manual edit to the active revision document
  const handleSaveDocumentEdit = () => {
    if (!activeRevision) return;
    const updatedRevisions = revisions.map((rev, idx) =>
      idx === selectedRevisionIndex
        ? {
          ...rev,
          document: editableDocument,
          changelog: `${rev.changelog} (Operator modified)`,
        }
        : rev
    );
    setRevisions(updatedRevisions);
    setViewMode("formatted");
    toast.success(`Saved operator edits to Revision v${activeRevision.version}`);
  };

  // Convert Assembly Line into Visual DAG Workflow
  const handleConvertToDAG = async () => {
    try {
      const timestamp = Date.now();
      const dagId = `workflow-dag-${timestamp}`;
      const triggerId = `node-trigger-${timestamp}`;
      const endId = `node-end-${timestamp}`;

      const nodes: any[] = [
        {
          id: triggerId,
          type: "trigger",
          title: "Mission Directive",
          description: missionInput.slice(0, 80) + "...",
          position: { x: 60, y: 160 },
          status: "idle",
        },
      ];

      const edges: any[] = [];
      let prevNodeId = triggerId;

      stations.forEach((st, idx) => {
        const stationNodeId = `node-station-${idx}-${timestamp}`;
        const agent = agents.find((a) => a.id === st.agentId) || agents[0];

        nodes.push({
          id: stationNodeId,
          type: "agent",
          title: st.name,
          description: st.role,
          position: { x: 320 + idx * 280, y: 160 },
          agentId: agent?.id,
          agentName: agent?.displayName || agent?.name || "Specialist",
          agentAvatar: agent?.avatar || "bot",
          agentRole: st.role,
          model: agent?.model || "auto/fast",
          temperature: 0.7,
          promptTemplate: `${st.directive}\n\nMission Objective:\n{{input}}\n\nCurrent Living Artifact:\n{{previous_output}}`,
          status: "idle",
        });

        edges.push({
          id: `edge-${prevNodeId}-${stationNodeId}`,
          from: prevNodeId,
          to: stationNodeId,
        });

        prevNodeId = stationNodeId;
      });

      nodes.push({
        id: endId,
        type: "end",
        title: "Assembly Complete",
        description: "Final Living Artifact deliverable",
        position: { x: 320 + stations.length * 280, y: 160 },
        status: "idle",
      });

      edges.push({
        id: `edge-${prevNodeId}-${endId}`,
        from: prevNodeId,
        to: endId,
      });

      const newWorkflow = {
        id: dagId,
        name: `${pipelineName} (DAG)`,
        description: `Converted from Assembly Line: ${pipelineName}`,
        category: "Custom",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        nodes,
        edges,
      };

      // Save to /api/workflows
      await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newWorkflow),
      });

      toast.success("Converted Assembly Line into Visual DAG Workflow!");

      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("tab", "dag");
        url.searchParams.set("id", dagId);
        window.location.href = url.toString();
      }
    } catch (err: any) {
      console.error("Convert to DAG failed:", err);
      toast.error(err.message || "Failed to convert to DAG");
    }
  };

  // Rollback to an earlier revision
  const handleRollbackToRevision = (revIndex: number) => {
    const targetRev = revisions[revIndex];
    if (!targetRev) return;

    const prunedRevisions = revisions.slice(0, revIndex + 1);
    setRevisions(prunedRevisions);
    setSelectedRevisionIndex(prunedRevisions.length - 1);
    setEditableDocument(targetRev.document);

    const targetStationIdx = stations.findIndex((s) => s.id === targetRev.stationId);
    if (targetStationIdx !== -1) {
      setStations((prev) =>
        prev.map((s, idx) =>
          idx <= targetStationIdx
            ? { ...s, status: "completed" }
            : { ...s, status: "idle", latency: undefined }
        )
      );
    }

    toast.info(`Rolled back assembly to Revision v${targetRev.version}`);
  };

  // Run a single station step
  const executeStation = async (
    stationIndex: number,
    currentLivingDocument: string,
    feedbackNote?: string
  ): Promise<ArtifactRevision> => {
    const station = stations[stationIndex];
    const agent = agents.find((a) => a.id === station.agentId) || agents[0];
    const currentVer = revisions.length;

    const systemPromptDirective = `You are a specialist agent operating a station on an Autonomous Multi-Agent Assembly Line.
Your Mission: Collaboratively refine, advance, and elevate the central Living Artifact document.

Assembly Line Name: "${pipelineName}"
Your Station: "${station.name}" (${station.role})
Assigned Specialist: ${agent?.displayName || agent?.name}

OVERALL MISSION OBJECTIVE:
"${missionInput}"

STATION DIRECTIVE:
"${station.directive}"

${feedbackNote ? `OPERATOR INSPECTION FEEDBACK:\n"${feedbackNote}"\n` : ""}

CURRENT LIVING ARTIFACT (Version ${currentVer}):
${currentLivingDocument
        ? currentLivingDocument
        : "*(Initial Station: No artifact exists yet. You are responsible for creating Version 1 from the mission directive.)*"
      }

CRITICAL OUTPUT FORMAT INSTRUCTIONS:
Always format your response with these exact delimiters:
[CHANGELOG]
- Bullet point summary of what you improved, created, or secured.
[/CHANGELOG]

[NOTES]
Advisory flags, caveats, or suggestions for the subsequent station agents (or "None").
[/NOTES]

[DOCUMENT]
(The complete, refined updated living document incorporating your contributions in full markdown format)
[/DOCUMENT]`;

    const start = Date.now();
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: `Execute Assembly Station: ${station.name}\n\n${station.directive}`,
        systemPrompt: systemPromptDirective,
        agentId: agent?.id,
        agentName: agent?.displayName || agent?.name,
        model: agent?.model || "auto/fast",
      }),
    });

    const latency = Date.now() - start;
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Station ${station.name} failed`);
    }

    const data = await res.json();
    const rawOutput = data.content || data.response || "";

    // Parse delimited sections
    const changelogMatch = rawOutput.match(/\[CHANGELOG\]([\s\S]*?)\[\/CHANGELOG\]/i);
    const notesMatch = rawOutput.match(/\[NOTES\]([\s\S]*?)\[\/NOTES\]/i);
    const documentMatch = rawOutput.match(/\[DOCUMENT\]([\s\S]*?)\[\/DOCUMENT\]/i);

    const parsedChangelog = changelogMatch
      ? changelogMatch[1].trim()
      : `Refined and expanded deliverable for ${station.role}`;

    const parsedNotes = notesMatch ? notesMatch[1].trim() : undefined;

    let parsedDocument = documentMatch ? documentMatch[1].trim() : "";
    if (!parsedDocument) {
      // Fallback: strip tags if model returned raw text
      parsedDocument = rawOutput
        .replace(/\[CHANGELOG\][\s\S]*?\[\/CHANGELOG\]/gi, "")
        .replace(/\[NOTES\][\s\S]*?\[\/NOTES\]/gi, "")
        .replace(/\[DOCUMENT\]/gi, "")
        .replace(/\[\/DOCUMENT\]/gi, "")
        .trim();
    }

    if (!parsedDocument) {
      parsedDocument = currentLivingDocument || rawOutput;
    }

    const newRevision: ArtifactRevision = {
      id: `rev-${Date.now()}-${stationIndex}`,
      version: currentVer + 1,
      stationId: station.id,
      stationName: station.name,
      agentId: agent?.id || "",
      agentName: agent?.displayName || agent?.name || "Specialist",
      agentAvatar: agent?.avatar || "bot",
      role: station.role,
      changelog: parsedChangelog,
      notes: parsedNotes,
      document: parsedDocument,
      latency,
      timestamp: new Date().toLocaleTimeString(),
    };

    return newRevision;
  };

  // Main Assembly Line Execution Loop
  const handleStartAssemblyLine = async (startIndex: number = 0) => {
    if (!missionInput.trim()) {
      toast.error("Please enter a mission directive for the assembly line");
      return;
    }

    setIsRunning(true);
    stopRequestedRef.current = false;
    setIsPausedForInspection(false);
    playTaskStartedSound();

    let currentDocument =
      startIndex > 0 && revisions[startIndex - 1]
        ? revisions[startIndex - 1].document
        : "";

    // If starting fresh from 0, reset stations status
    if (startIndex === 0) {
      setRevisions([]);
      setStations((prev) => prev.map((s) => ({ ...s, status: "idle", latency: undefined })));
    }

    try {
      for (let i = startIndex; i < stations.length; i++) {
        if (stopRequestedRef.current) {
          toast.info("Assembly line paused by operator.");
          break;
        }

        const currentStn = stations[i];
        setCurrentStationIndex(i);

        // Mark station running
        setStations((prev) =>
          prev.map((s, idx) => (idx === i ? { ...s, status: "running" } : s))
        );

        toast.loading(`Station ${i + 1}/${stations.length}: ${currentStn.name} running...`, {
          id: `stn-toast-${i}`,
        });

        // Run the station
        const newRevision = await executeStation(i, currentDocument, operatorFeedback);
        currentDocument = newRevision.document;
        setOperatorFeedback("");

        toast.dismiss(`stn-toast-${i}`);

        // Update stations and revisions
        setStations((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, status: "completed", latency: newRevision.latency } : s
          )
        );

        setRevisions((prev) => {
          const updated = [...prev, newRevision];
          setSelectedRevisionIndex(updated.length - 1);
          return updated;
        });

        // If in step-by-step inspection mode and not at the last station, pause for operator review!
        if (executionMode === "inspection" && i < stations.length - 1) {
          setIsPausedForInspection(true);
          setCurrentStationIndex(i);
          playClickSound();
          toast.info(
            `Station ${i + 1} completed! Quality Gate active: review diff and approve to advance.`
          );
          setIsRunning(false);
          return;
        }
      }

      // Completed all stations!
      playTaskCompletedSound();
      toast.success("Assembly line complete! Deliverable ready.");

      // Auto-sync final deliverable to Obsidian Vault
      if (currentDocument) {
        handleSaveToVault(currentDocument);
      }
    } catch (err: any) {
      console.error("Assembly line error:", err);
      playWarningSound();
      toast.error(err.message || "Assembly line execution failed");
      setStations((prev) =>
        prev.map((s, idx) => (idx === currentStationIndex ? { ...s, status: "error" } : s))
      );
    } finally {
      setIsRunning(false);
      setCurrentStationIndex(null);
    }
  };

  // Operator Inspection Gate: Approve and advance to next station
  const handleApproveAndAdvance = () => {
    if (currentStationIndex === null && revisions.length === 0) return;
    const nextIndex = revisions.length;
    if (nextIndex >= stations.length) {
      toast.success("All stations have finished!");
      setIsPausedForInspection(false);
      return;
    }
    handleStartAssemblyLine(nextIndex);
  };

  // Operator Inspection Gate: Rework current station with feedback
  const handleReworkCurrentStation = async () => {
    if (revisions.length === 0) return;
    const targetIdx = revisions.length - 1;
    const priorDocument =
      targetIdx > 0 && revisions[targetIdx - 1] ? revisions[targetIdx - 1].document : "";

    setIsRunning(true);
    setIsPausedForInspection(false);

    try {
      toast.loading(`Reworking station ${targetIdx + 1} with operator feedback...`, {
        id: "rework-toast",
      });

      const refinedRevision = await executeStation(targetIdx, priorDocument, operatorFeedback);
      toast.dismiss("rework-toast");

      // Replace last revision
      setRevisions((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = refinedRevision;
        return copy;
      });

      setOperatorFeedback("");
      toast.success("Station reworked successfully!");

      if (executionMode === "inspection" && targetIdx < stations.length - 1) {
        setIsPausedForInspection(true);
        setCurrentStationIndex(targetIdx);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to rework station");
    } finally {
      setIsRunning(false);
    }
  };

  // Stop/Pause assembly line
  const handleStopAssemblyLine = () => {
    stopRequestedRef.current = true;
    setIsRunning(false);
    setIsPausedForInspection(true);
  };

  // Reset Assembly Line
  const handleResetAssemblyLine = () => {
    setRevisions([]);
    setSelectedRevisionIndex(0);
    setIsPausedForInspection(false);
    setSavedToVault(null);
    setStations((prev) => prev.map((s) => ({ ...s, status: "idle", latency: undefined })));
    toast.info("Assembly line reset.");
  };

  // Save to Obsidian Vault
  const handleSaveToVault = async (docContent?: string) => {
    const documentToSave = docContent || activeRevision?.document;
    if (!documentToSave) {
      toast.error("No document available to save.");
      return;
    }

    setIsSyncingVault(true);
    try {
      const slugName = pipelineName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const title = `Assembly_${slugName}_${Date.now()}`;
      const folder = "assembly";

      const provenanceTable = revisions
        .map(
          (r) =>
            `| v${r.version} | ${r.stationName} | ${r.agentAvatar} ${r.agentName} | ${r.changelog.replace(/\n/g, " ")} | ${r.latency}ms |`
        )
        .join("\n");

      const vaultContent = `---
title: "${pipelineName}"
type: "assembly_line_deliverable"
mission: "${missionInput.replace(/"/g, '\\"')}"
date: "${new Date().toISOString()}"
stations_count: ${stations.length}
revisions_count: ${revisions.length}
tags: [assembly-line, multi-agent, living-artifact, agent-studio]
---

# ${pipelineName}

> **Mission Objective**: ${missionInput}  
> **Archived on**: \`${new Date().toLocaleString()}\` • **Stations**: \`${stations.length}\` • **Final Version**: \`v${revisions.length}\`

---

## Station Revision Audit Trail

| Version | Station | Specialist Agent | Changelog / Contribution | Latency |
| :--- | :--- | :--- | :--- | :--- |
${provenanceTable}

---

## Final Living Deliverable

${documentToSave}
`;

      const res = await fetch("/api/vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          folder,
          tags: ["assembly-line", "multi-agent", "deliverable"],
          content: vaultContent,
        }),
      });

      const data = await res.json();
      if (data.path || data.success) {
        const savedPath = data.path || `${folder}/${title}.md`;
        setSavedToVault(savedPath);
        toast.success(`Archived to Obsidian Vault: ${savedPath}`);
      } else {
        toast.success("Synchronized to Obsidian Vault!");
      }
    } catch (err: any) {
      console.error("Vault sync error:", err);
      toast.error(err.message || "Failed to sync to Obsidian Vault");
    } finally {
      setIsSyncingVault(false);
    }
  };

  // Copy deliverable
  const handleCopyDeliverable = () => {
    if (!activeRevision?.document) return;
    navigator.clipboard.writeText(activeRevision.document);
    setIsCopied(true);
    toast.success("Living artifact copied to clipboard!");
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Download Markdown file
  const handleDownloadMarkdown = () => {
    if (!activeRevision?.document) return;
    const blob = new Blob([activeRevision.document], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pipelineName.toLowerCase().replace(/\s+/g, "-")}-v${activeRevision.version}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Downloaded artifact markdown file");
  };

  return (
    <div className="flex flex-col xl:flex-row gap-4 h-full min-h-[calc(100vh-12rem)]">
      {/* ========================================================= */}
      {/* LEFT PANEL: Assembly Line Stations & Controls Track       */}
      {/* ========================================================= */}
      <div className="w-full xl:w-[460px] 2xl:w-[500px] shrink-0 flex flex-col gap-3">
        {/* Top Mission & Controls Card */}
        <div className="p-4 rounded-lg bg-card border border-border shadow-2xs space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shadow-2xs">
                <Layers className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider font-mono">
                  Agent Assembly Line
                </h3>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {stations.length} Specialist Stations • {revisions.length} Revisions
                </span>
              </div>
            </div>

            {/* Actions: Convert to DAG & Presets Dropdown */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handleConvertToDAG}
                className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-primary/10 border border-primary/25 text-primary font-semibold hover:bg-primary/20 transition cursor-pointer shadow-2xs"
                title="Convert this assembly line into a Visual DAG Workflow canvas"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Convert to DAG</span>
              </button>

              <select
                value={selectedPresetId}
                onChange={(e) => loadPreset(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-md bg-secondary border border-border text-foreground font-semibold outline-none cursor-pointer hover:bg-secondary/80 transition"
                title="Load Pre-configured Assembly Line Template"
              >
                <optgroup label="Ready Presets">
                  {ASSEMBLY_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
          </div>

          {/* Pipeline Name Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider font-mono">
              Assembly Line Name
            </label>
            <input
              type="text"
              value={pipelineName}
              onChange={(e) => setPipelineName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-md bg-secondary/40 border border-input text-xs sm:text-sm font-bold text-foreground outline-none focus:ring-1 focus:ring-ring transition"
              placeholder="e.g. Autonomous Feature Delivery"
            />
          </div>

          {/* Mission Objective Directive */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 font-mono">
                <span>Central Mission Objective</span>
                <span className="text-primary">*</span>
              </label>
              <span className="text-[10px] text-muted-foreground">
                Passed as shared context to all stations
              </span>
            </div>
            <textarea
              rows={3}
              value={missionInput}
              onChange={(e) => setMissionInput(e.target.value)}
              placeholder="Specify the exact product feature, bug fix, or research objective to manufacture..."
              className="w-full px-3 py-2 rounded-md bg-secondary/30 border border-input text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring transition resize-y leading-relaxed"
            />
          </div>

          {/* Execution Mode Selector: Autonomous vs Step-by-Step */}
          <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1 p-0.5 rounded-md bg-muted border border-border text-xs">
              <button
                type="button"
                onClick={() => setExecutionMode("autonomous")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-sm transition-colors cursor-pointer text-xs font-semibold ${executionMode === "autonomous"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
                title="Continuous hands-free execution across all stations"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
                <span>Autonomous Run</span>
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode("inspection")}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-sm transition-colors cursor-pointer text-xs font-semibold ${executionMode === "inspection"
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
                title="Pause at each station for operator diff inspection and approval"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-violet-500" />
                <span>Step-by-Step Inspection</span>
              </button>
            </div>

            {/* Run / Stop / Reset Buttons */}
            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleStopAssemblyLine}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/20 transition cursor-pointer shadow-2xs"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>Pause</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleStartAssemblyLine(0)}
                  disabled={!missionInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 disabled:opacity-40 transition cursor-pointer shadow-2xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Start Line</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleResetAssemblyLine}
                className="p-1.5 rounded-md border border-border bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition cursor-pointer shadow-2xs"
                title="Reset assembly line and clear revisions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Stations Conveyor List */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Assembly Stations Sequence
            </span>
            <button
              type="button"
              onClick={handleAddStation}
              className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Station</span>
            </button>
          </div>

          {stations.map((stn, idx) => {
            const isCurrent = currentStationIndex === idx && isRunning;
            const assignedAgent = agents.find((a) => a.id === stn.agentId) || agents[0];
            const hasCompleted = stn.status === "completed";

            return (
              <div
                key={stn.id}
                className={`p-3.5 rounded-lg border transition-all shadow-2xs ${isCurrent
                    ? "bg-primary/5 border-primary shadow-xs ring-2 ring-primary/20"
                    : hasCompleted
                      ? "bg-card border-emerald-500/30"
                      : "bg-card border-border hover:border-border/80"
                  }`}
              >
                {/* Station Top Row */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`w-6 h-6 rounded-sm flex items-center justify-center text-xs font-mono font-bold shrink-0 ${isCurrent
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : hasCompleted
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}
                    >
                      {hasCompleted ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        idx + 1
                      )}
                    </span>

                    <input
                      type="text"
                      value={stn.name}
                      onChange={(e) => handleUpdateStation(stn.id, { name: e.target.value })}
                      className="text-xs font-bold text-foreground bg-transparent outline-none border-b border-transparent hover:border-border focus:border-primary truncate"
                    />
                  </div>

                  {/* Reorder and Delete Controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleMoveStation(idx, "up")}
                      disabled={idx === 0 || isRunning}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 transition"
                      title="Move station up"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveStation(idx, "down")}
                      disabled={idx === stations.length - 1 || isRunning}
                      className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-20 transition"
                      title="Move station down"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveStation(stn.id)}
                      disabled={isRunning}
                      className="p-1 rounded-md text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition"
                      title="Remove station"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Agent & Role Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2 text-xs">
                  {/* Specialist Agent Picker */}
                  <div className="flex items-center gap-1.5 bg-secondary/40 px-2.5 py-1 rounded-md border border-border">
                    <span className="relative inline-flex items-center justify-center shrink-0 w-5 h-5 rounded-md bg-secondary text-primary">
                      <AgentAvatar avatar={assignedAgent?.avatar} className="w-3.5 h-3.5" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-1 ring-card" />
                    </span>
                    <select
                      value={stn.agentId}
                      onChange={(e) => handleUpdateStation(stn.id, { agentId: e.target.value })}
                      className="w-full bg-transparent text-foreground outline-none font-medium cursor-pointer text-xs truncate"
                    >
                      {agents.map((a) => (
                        <option key={a.id} value={a.id} className="bg-popover text-popover-foreground">
                          {a.displayName} ({a.role || "Specialist"})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Station Role Picker */}
                  <div className="flex items-center gap-1 bg-secondary/40 px-2.5 py-1 rounded-md border border-border">
                    <Bot className="w-3.5 h-3.5 text-primary shrink-0" />
                    <select
                      value={stn.role}
                      onChange={(e) =>
                        handleUpdateStation(stn.id, {
                          role: e.target.value as AssemblyStationRole,
                        })
                      }
                      className="w-full bg-transparent text-foreground outline-none font-medium cursor-pointer text-xs truncate"
                    >
                      <option value="Architecture & Spec">Architecture & Spec</option>
                      <option value="Code Implementation">Code Implementation</option>
                      <option value="Security & Audit">Security & Audit</option>
                      <option value="Release & Docs">Release & Docs</option>
                      <option value="Research & Analysis">Research & Analysis</option>
                      <option value="Custom Station">Custom Station</option>
                    </select>
                  </div>
                </div>

                {/* Station Directive Prompt */}
                <div>
                  <textarea
                    rows={2}
                    value={stn.directive}
                    onChange={(e) => handleUpdateStation(stn.id, { directive: e.target.value })}
                    placeholder="Instructions for this specialist station..."
                    className="w-full px-2.5 py-1.5 rounded-md bg-background border border-border text-[11px] text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring transition resize-y leading-relaxed"
                  />
                </div>

                {/* Station Running Status / Latency Badge */}
                {isCurrent && (
                  <div className="mt-2 flex items-center gap-2 p-2 rounded-md bg-primary/10 text-primary text-[11px] font-medium border border-primary/20">
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                    <span className="truncate">
                      {assignedAgent?.displayName} is manufacturing Revision v{revisions.length + 1}...
                    </span>
                  </div>
                )}

                {hasCompleted && stn.latency && (
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1 text-emerald-500 font-semibold font-mono">
                      <CheckCircle2 className="w-3 h-3" />
                      Station Completed
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {formatResponseTime(stn.latency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT PANEL: Living Artifact & Visual Diff Workbench      */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col rounded-lg bg-card border border-border shadow-2xs overflow-hidden min-h-[500px]">
        {/* Workbench Top Toolbar: Versions, Views & Actions */}
        <div className="p-3.5 border-b border-border bg-secondary/30 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Version Selector Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-0.5">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mr-1 hidden sm:inline">
              Revisions:
            </span>

            {revisions.length === 0 ? (
              <span className="text-xs text-muted-foreground italic px-2 py-1">
                Awaiting first assembly run...
              </span>
            ) : (
              revisions.map((rev, idx) => {
                const isSelected = selectedRevisionIndex === idx;
                return (
                  <button
                    key={rev.id}
                    type="button"
                    onClick={() => setSelectedRevisionIndex(idx)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold font-mono transition cursor-pointer shrink-0 border ${isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs font-bold"
                        : "bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground border-border"
                      }`}
                  >
                    <span>{rev.agentAvatar}</span>
                    <span>v{rev.version}</span>
                    <span className="text-[10px] opacity-80 hidden md:inline">
                      ({rev.role.split(" ")[0]})
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* View Mode & Workbench Controls */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* View Switcher: Formatted vs Diff vs Edit */}
            {activeRevision && (
              <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-muted border border-border text-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setViewMode("formatted")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-sm transition-colors cursor-pointer text-xs font-semibold ${viewMode === "formatted"
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="Rendered formatted view"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("diff")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-sm transition-colors cursor-pointer text-xs font-semibold ${viewMode === "diff"
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="Line-by-line visual diff against previous station revision"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Visual Diff</span>
                  {diffData.additions > 0 && (
                    <span className="text-[9px] px-1 rounded-sm bg-emerald-500/20 text-emerald-500 font-mono font-bold">
                      +{diffData.additions}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("edit")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-sm transition-colors cursor-pointer text-xs font-semibold ${viewMode === "edit"
                      ? "bg-card text-foreground shadow-2xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                    }`}
                  title="Directly edit artifact text in-place"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit Raw</span>
                </button>
              </div>
            )}

            {/* Rollback to Revision Button */}
            {activeRevision && selectedRevisionIndex < revisions.length - 1 && (
              <button
                type="button"
                onClick={() => handleRollbackToRevision(selectedRevisionIndex)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-bold transition cursor-pointer shadow-2xs"
                title={`Roll back assembly state to Revision v${activeRevision.version}`}
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Rollback to v{activeRevision.version}</span>
              </button>
            )}

            {/* Copy Button */}
            {activeRevision && (
              <button
                type="button"
                onClick={handleCopyDeliverable}
                className="p-1.5 rounded-md border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shadow-2xs"
                title="Copy living artifact to clipboard"
              >
                {isCopied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {/* Download Button */}
            {activeRevision && (
              <button
                type="button"
                onClick={handleDownloadMarkdown}
                className="p-1.5 rounded-md border border-border bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer shadow-2xs"
                title="Download artifact as Markdown file"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Sync to Obsidian Vault Button */}
            {activeRevision && (
              <button
                type="button"
                onClick={() => handleSaveToVault()}
                disabled={isSyncingVault}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition cursor-pointer shadow-2xs"
                title="Permanently sync deliverable & provenance to Obsidian Vault"
              >
                {isSyncingVault ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FolderDown className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">Sync Vault</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Revision Provenance Banner */}
        {activeRevision && (
          <div className="px-4 py-2.5 border-b border-border bg-secondary/15 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base">{activeRevision.agentAvatar}</span>
              <span className="font-bold text-foreground">
                {activeRevision.agentName}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border font-mono">
                {activeRevision.stationName}
              </span>
              <span className="text-muted-foreground hidden sm:inline">•</span>
              <span className="text-muted-foreground text-[11px] truncate max-w-sm lg:max-w-md">
                <strong>Changelog:</strong> {activeRevision.changelog}
              </span>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <span>{activeRevision.timestamp}</span>
              <span>•</span>
              <span className="text-emerald-500 font-semibold">
                {formatResponseTime(activeRevision.latency)}
              </span>
            </div>
          </div>
        )}

        {/* Advisory Notes Callout (if present) */}
        {activeRevision?.notes && activeRevision.notes.toLowerCase() !== "none" && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Station Advisory Flags:</span>{" "}
              <span>{activeRevision.notes}</span>
            </div>
          </div>
        )}

        {/* Obsidian Vault Success Banner */}
        {savedToVault && (
          <div className="mx-4 mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Archived to Obsidian Vault note: <strong>{savedToVault}</strong>
              </span>
            </div>
            <a
              href="/memory"
              className="text-primary hover:underline font-semibold text-xs ml-2"
            >
              Open in Memory Galaxy &rarr;
            </a>
          </div>
        )}

        {/* Workbench Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4 font-sans text-foreground">
          {revisions.length === 0 ? (
            <div className="h-full min-h-[350px] flex flex-col items-center justify-center text-center p-8 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                <Layers className="w-7 h-7" />
              </div>
              <div className="max-w-md space-y-1.5">
                <h4 className="text-sm font-bold text-foreground">
                  Living Artifact Ready for Assembly
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Enter your mission directive on the left and click <strong>Start Line</strong>.
                  Specialist agents will iteratively draft, implement, red-team audit, and package
                  your deliverable with revision history and visual diffs.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleStartAssemblyLine(0)}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 shadow-md shadow-primary/20 transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Begin Assembly Run</span>
              </button>
            </div>
          ) : viewMode === "edit" ? (
            /* Direct Textarea Editor */
            <div className="h-full flex flex-col space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold text-foreground">
                  <Edit3 className="w-3.5 h-3.5 text-primary" />
                  Editing Living Artifact Revision v{activeRevision?.version}
                </span>
                <button
                  type="button"
                  onClick={handleSaveDocumentEdit}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition cursor-pointer shadow-xs"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Edits</span>
                </button>
              </div>
              <textarea
                value={editableDocument}
                onChange={(e) => setEditableDocument(e.target.value)}
                className="flex-1 w-full p-4 rounded-xl bg-background border border-border font-mono text-xs sm:text-sm text-foreground outline-none focus:border-primary transition resize-none leading-relaxed min-h-[380px]"
                placeholder="Edit artifact markdown directly..."
              />
            </div>
          ) : viewMode === "diff" ? (
            /* Line-by-Line Visual Diff Viewer */
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-border">
                <span className="font-semibold text-muted-foreground">
                  Comparing:{" "}
                  <strong className="text-foreground">
                    v{activeRevision?.version}
                  </strong>{" "}
                  against{" "}
                  <strong className="text-foreground">
                    {previousRevision ? `v${previousRevision.version}` : "Initial Baseline"}
                  </strong>
                </span>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  <span className="text-emerald-500 font-bold">
                    +{diffData.additions} lines
                  </span>
                  <span className="text-rose-500 font-bold">
                    -{diffData.deletions} lines
                  </span>
                </div>
              </div>

              <div className="font-mono text-xs rounded-xl border border-border overflow-x-auto bg-background/50 divide-y divide-border/40">
                {diffData.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start py-0.5 px-2.5 leading-relaxed ${line.type === "added"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-l-2 border-emerald-500"
                        : line.type === "removed"
                          ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-l-2 border-rose-500 line-through opacity-75"
                          : "text-foreground/90 hover:bg-secondary/40"
                      }`}
                  >
                    <span className="w-5 shrink-0 text-center text-muted-foreground select-none font-bold">
                      {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
                    </span>
                    <pre className="font-mono text-xs whitespace-pre-wrap break-all flex-1">
                      {line.content || " "}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Formatted Markdown Preview */
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
              {activeRevision?.document}
            </div>
          )}
        </div>

        {/* Operator Inspection Gate & Approval Bar (Pinned Bottom) */}
        {(isPausedForInspection || (executionMode === "inspection" && isRunning)) && (
          <div className="p-3.5 border-t border-border bg-secondary/80 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <span className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-500 border border-violet-500/20 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-foreground">
                  Operator Inspection Quality Gate
                </h4>
                <p className="text-[11px] text-muted-foreground truncate">
                  Inspect the changes made by Station {revisions.length}. Approve to advance or request rework.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Optional Rework Directive Input */}
              <input
                type="text"
                value={operatorFeedback}
                onChange={(e) => setOperatorFeedback(e.target.value)}
                placeholder="Optional operator notes for rework..."
                className="px-2.5 py-1.5 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary w-full sm:w-56"
              />

              <button
                type="button"
                onClick={handleReworkCurrentStation}
                disabled={isRunning}
                className="px-3 py-1.5 rounded-xl border border-border bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition cursor-pointer"
                title="Re-run the current station with your feedback"
              >
                Rework Station
              </button>

              <button
                type="button"
                onClick={handleApproveAndAdvance}
                disabled={isRunning}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition cursor-pointer shadow-md shadow-primary/25"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Approve & Advance</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
