import type {
  A2AMessage,
  A2ADelegationContract,
  A2ATaskStatus,
  A2AMessageType,
} from "@/types/a2a";
import { prisma } from "@/lib/prisma";

/**
 * Agent-to-Agent (A2A) Message Broker
 * Handles inter-agent communication, subtask delegation, peer review, and contract fulfillment.
 */
class A2ABroker {
  private messageLog: A2AMessage[] = [];

  /**
   * Delegate a task from one agent to another
   */
  public async delegateTask(
    contract: A2ADelegationContract,
    fromAgent: { id: string; name: string },
    toAgent: { id: string; name: string }
  ): Promise<A2AMessage> {
    const message: A2AMessage = {
      id: "a2a-" + Math.random().toString(36).slice(2, 10),
      fromAgentId: fromAgent.id,
      fromAgentName: fromAgent.name,
      toAgentId: toAgent.id,
      toAgentName: toAgent.name,
      type: "task_delegation",
      taskTitle: contract.title,
      payload: {
        objective: contract.objective,
        inputData: contract.inputData,
        expectedOutputSchema: contract.expectedOutputSchema,
        priority: contract.priority || "medium",
      },
      status: "in_progress",
      createdAt: new Date().toISOString(),
    };

    this.messageLog.unshift(message);

    // Keep log to reasonable length
    if (this.messageLog.length > 500) {
      this.messageLog.pop();
    }

    // Persist activity log if database is accessible
    try {
      await prisma.activityLog.create({
        data: {
          type: "a2a_delegation",
          message: `[A2A] ${fromAgent.name} delegated "${contract.title}" to ${toAgent.name}`,
          agentId: fromAgent.id,
        },
      });
    } catch {
      // Non-blocking fallback
    }

    return message;
  }

  /**
   * Complete an in-flight A2A message with result
   */
  public completeTask(
    messageId: string,
    result: any,
    status: A2ATaskStatus = "completed",
    latencyMs?: number
  ): A2AMessage | undefined {
    const msg = this.messageLog.find((m) => m.id === messageId);
    if (msg) {
      msg.status = status;
      msg.result = result;
      msg.completedAt = new Date().toISOString();
      if (latencyMs !== undefined) {
        msg.latencyMs = latencyMs;
      }

      // Persist completion
      prisma.activityLog
        .create({
          data: {
            type: "a2a_completed",
            message: `[A2A] ${msg.toAgentName} fulfilled contract "${msg.taskTitle}" for ${msg.fromAgentName}`,
            agentId: msg.toAgentId,
          },
        })
        .catch(() => {});
    }
    return msg;
  }

  /**
   * Log peer review or critique message
   */
  public async logPeerReview(
    fromAgent: { id: string; name: string },
    toAgent: { id: string; name: string },
    taskTitle: string,
    critique: string,
    rubricScores?: Record<string, number>
  ): Promise<A2AMessage> {
    const message: A2AMessage = {
      id: "a2a-" + Math.random().toString(36).slice(2, 10),
      fromAgentId: fromAgent.id,
      fromAgentName: fromAgent.name,
      toAgentId: toAgent.id,
      toAgentName: toAgent.name,
      type: "peer_review",
      taskTitle,
      payload: {
        critique,
        rubricScores: rubricScores || {},
      },
      status: "completed",
      result: critique,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    this.messageLog.unshift(message);
    return message;
  }

  /**
   * Get message history between agents
   */
  public getHistory(agentId?: string): A2AMessage[] {
    if (!agentId) return [...this.messageLog];
    return this.messageLog.filter(
      (m) => m.fromAgentId === agentId || m.toAgentId === agentId
    );
  }

  /**
   * Get summary statistics of A2A operations
   */
  public getStats() {
    const total = this.messageLog.length;
    const completed = this.messageLog.filter((m) => m.status === "completed").length;
    const inProgress = this.messageLog.filter((m) => m.status === "in_progress").length;
    const failed = this.messageLog.filter((m) => m.status === "failed" || m.status === "rejected").length;

    return {
      totalMessages: total,
      completedCount: completed,
      inProgressCount: inProgress,
      failedCount: failed,
      successRate: total > 0 ? Math.round((completed / (completed + failed || 1)) * 100) : 100,
    };
  }

  /**
   * Clear message history
   */
  public clearHistory(): void {
    this.messageLog = [];
  }
}

export const a2aBroker = new A2ABroker();
