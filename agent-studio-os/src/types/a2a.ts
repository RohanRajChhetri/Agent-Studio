/**
 * Agent-to-Agent (A2A) Protocol Types
 * Enables autonomous specialists to negotiate, delegate, and collaborate across:
 * 1. Hierarchical Chain-of-Command (Orchestrator -> Manager -> Specialist)
 * 2. Event-Driven Peer Mesh & Dynamic Tool Calling
 * 3. Roundtable Consensus to Autonomous Kanban Dispatch
 */

export type A2AMessageType =
  | "task_delegation"
  | "clarification_request"
  | "peer_review"
  | "task_result"
  | "critique"
  | "handshake"
  | "consensus_dispatch"
  | "hierarchy_command";

export type A2ATaskStatus =
  | "proposed"
  | "accepted"
  | "in_progress"
  | "completed"
  | "rejected"
  | "failed";

export interface A2AMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  type: A2AMessageType;
  taskTitle: string;
  payload: Record<string, unknown>;
  status: A2ATaskStatus;
  result?: unknown;
  error?: string;
  createdAt: string;
  completedAt?: string;
  latencyMs?: number;
}

export interface A2ADelegationContract {
  taskId: string;
  title: string;
  delegator: string;
  delegatee: string;
  objective: string;
  inputData: Record<string, unknown>;
  expectedOutputSchema?: string;
  timeoutMs?: number;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface A2AHierarchyNodeExecution {
  agentId: string;
  agentName: string;
  agentRole: string;
  avatar: string;
  taskTitle: string;
  directive: string;
  status: "pending" | "running" | "completed" | "failed";
  output?: string;
  latencyMs?: number;
  subordinates?: A2AHierarchyNodeExecution[];
}

export interface ConferenceFileDeliverable {
  fileName: string;
  filePath: string;
  fileUrl: string;
  size: number;
}

export interface A2AHierarchyExecutionResult {
  missionId: string;
  missionTopic: string;
  orchestratorId: string;
  orchestratorName: string;
  rootSummary: string;
  finalDeliverable: string;
  executionTree: A2AHierarchyNodeExecution;
  totalSubtasks: number;
  totalLatencyMs: number;
  createdAt: string;
  dedicatedFolder?: string;
  conferenceFile?: ConferenceFileDeliverable;
}

export interface A2ADispatchedTaskItem {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  assignedAgentId: string;
  assignedAgentName: string;
  contractId: string;
}

export interface A2AKanbanDispatchResult {
  success: boolean;
  topic: string;
  winningStance?: string;
  createdTasks: A2ADispatchedTaskItem[];
  contracts: A2AMessage[];
}
