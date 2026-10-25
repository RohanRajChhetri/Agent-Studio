/**
 * Visual DAG Workflow Types for Multi-Agent Swarms
 * Supports directed acyclic graph orchestration with:
 * - Parallel fan-out & multi-agent concurrent execution
 * - Aggregation & multi-source deliverable synthesis
 * - Conditional branching and Human-In-The-Loop approval gates
 */

export type DAGNodeType =
  | "trigger"
  | "agent"
  | "parallel_fanout"
  | "aggregator"
  | "condition"
  | "human_gate"
  | "code"
  | "scrapling_scraper"
  | "cua_automator"
  | "storage"
  | "end";

export type DAGNodeStatus =
  | "idle"
  | "running"
  | "self_healing"
  | "completed"
  | "waiting_approval"
  | "failed"
  | "skipped";

export interface DAGNode {
  id: string;
  type: DAGNodeType;
  title: string;
  description?: string;
  position: { x: number; y: number };
  agentId?: string | null;
  agentName?: string;
  agentAvatar?: string;
  agentRole?: string;
  model?: string;
  temperature?: number;
  promptTemplate?: string;
  status: DAGNodeStatus;
  output?: string | null;
  latencyMs?: number;
  error?: string | null;
  config?: Record<string, any>;
}

export interface DAGEdge {
  id: string;
  from: string; // source node id
  to: string; // target node id
  label?: string;
  conditionValue?: boolean | string;
}

export interface DAGWorkflow {
  id: string;
  name: string;
  description: string;
  category: "Software Engineering" | "Research & Intelligence" | "Security & QA" | "Custom";
  nodes: DAGNode[];
  edges: DAGEdge[];
  createdAt: string;
  updatedAt: string;
}

export interface DAGExecutionTraceStep {
  nodeId: string;
  nodeTitle: string;
  nodeType: DAGNodeType;
  agentName?: string;
  status: DAGNodeStatus;
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  outputSnippet?: string;
  error?: string;
}

export interface DAGWorkflowExecutionResult {
  success: boolean;
  workflowId: string;
  workflowName: string;
  trace: DAGExecutionTraceStep[];
  nodeOutputs: Record<string, string>;
  finalDeliverable: string;
  totalLatencyMs: number;
  vaultFile?: {
    fileName: string;
    filePath: string;
  };
  error?: string;
  pausedAtNodeId?: string; // If paused at human_gate
}
