import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";
import type { Task, Agent } from "@prisma/client";
import { getUserScopedWhere, getAuthUserId } from "@/lib/user-auth";
import { compileAndDeliverFile } from "@/lib/file-deliverable-engine";

export interface TaskExecutionResult {
  success: boolean;
  task?: Task & { agent?: Agent | null };
  deliverable?: string;
  vaultPath?: string;
  latency?: number;
  modelUsed?: string;
  error?: string;
  message?: string;
}

/**
 * Execute an existing task autonomously with a qualified agent.
 * Transitions task: pending -> in_progress -> review, saves output to Obsidian vault,
 * and creates activity logs.
 */
export async function executeTask(
  task: Task & { agent?: Agent | null },
  options?: { overrideAgentId?: string }
): Promise<TaskExecutionResult> {
  const originalStatus = task.status;
  try {
    let agent = task.agent;
    if (options?.overrideAgentId) {
      const found = await prisma.agent.findUnique({
        where: { id: options.overrideAgentId },
      });
      if (found) agent = found;
    }

    if (!agent) {
      agent = await prisma.agent.findFirst();
    }

    // 1. Transition to in_progress
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "in_progress",
        agentId: agent?.id || null,
      },
    });

    const authUserId = task.userId || (await getAuthUserId());
    await prisma.activityLog.create({
      data: {
        type: "task_moved",
        message: `${agent ? agent.displayName : "Agent"} started working on "${task.title}"`,
        agentId: agent?.id || null,
        userId: authUserId,
      },
    });

    // 2. Build thorough execution prompt
    const prompt = `You are ${agent ? `${agent.displayName} (${agent.name})` : "an autonomous AI Specialist"} executing an assigned task in Agent Studio OS.
TASK TO EXECUTE:
- Title: ${task.title}
- Details & Requirements: ${task.description || "Thorough, production-grade execution requested."}
- Priority: ${task.priority.toUpperCase()}

EXECUTION GUIDELINES:
1. Executive Summary: Provide a 1-2 sentence overview of what was accomplished.
2. Complete Deliverables:
   - If this task requests code, provide complete, production-grade, runnable code in fenced code blocks with language identifiers.
   - If this task requests research, provide deep analysis, concrete numbers, comparison tables, and citations.
   - If this task requests copy or documentation, provide ready-to-publish drafts.
3. Verification & Instructions: Provide clear testing or usage instructions.
4. Obsidian Links: Incorporate relevant wikilinks like [[tasks]], [[agents]], or relevant memory topics.`;

    const executionResult = await executeChatCompletion({
      prompt,
      model: agent?.model || null,
      systemPrompt:
        agent?.systemPrompt ||
        "You are an elite autonomous AI specialist in Agent Studio OS. Deliver complete, structured, production-grade outputs.",
      agentName: agent?.name,
    });

    let finalContent = executionResult.content;
    try {
      const compiled = await compileAndDeliverFile({
        userPrompt: `${task.title}\n${task.description || ""}`,
        assistantContent: executionResult.content,
      });
      if (compiled && compiled.downloadCardMarkdown) {
        finalContent = compiled.cleanedContent || `${executionResult.content}\n${compiled.downloadCardMarkdown}`;
      }
    } catch (deliverableErr) {
      console.warn("Could not auto-compile file deliverable:", deliverableErr);
    }

    // 3. Transition to review with result
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "review",
        result: finalContent,
        agentId: agent?.id || null,
      },
      include: { agent: true },
    });

    // 4. Save deliverable to shared Obsidian vault
    const vaultPath = `tasks/${slugify(task.title || "task")}.md`;
    try {
      await ensureVaultExists();
      const vaultContent = `---
title: "${task.title.replace(/"/g, '\\"')}"
status: "review"
priority: "${task.priority}"
agent: "${agent ? agent.displayName : "Unassigned"}"
agent_name: "${agent ? agent.name : "unassigned"}"
date: "${new Date().toISOString()}"
model: "${executionResult.modelUsed}"
latency: "${formatResponseTime(executionResult.latency)}"
tags:
  - task
  - deliverable
  - ${task.priority}
---

# ${task.title}

> [!NOTE]
> Autonomous deliverable created by **${agent ? agent.displayName : "Agent"}** (${executionResult.modelUsed}) in ${formatResponseTime(executionResult.latency)}.

## Task Objective
${task.description || "N/A"}

## Execution Deliverable
${finalContent}

## Verification
- Status: Ready for Human-in-the-loop review
- Priority: ${task.priority.toUpperCase()}
`;
      await writeVaultFile(vaultPath, vaultContent);
    } catch (vErr) {
      console.warn("Could not save deliverable to vault:", vErr);
    }

    // 5. Activity log
    await prisma.activityLog.create({
      data: {
        type: "task_completed",
        message: `${agent ? agent.displayName : "Agent"} completed deliverable for "${task.title}" (moved to Review)`,
        agentId: agent?.id || null,
        userId: task.userId || (await getAuthUserId()),
      },
    });

    return {
      success: true,
      task: updatedTask,
      deliverable: finalContent,
      vaultPath,
      latency: executionResult.latency,
      modelUsed: executionResult.modelUsed,
    };
  } catch (error: any) {
    // Revert status in DB so task is never permanently stranded in 'in_progress'
    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: originalStatus === "in_progress" ? "backlog" : originalStatus,
      },
    }).catch(() => {});

    return {
      success: false,
      error: error.message || "Execution failed",
    };
  }
}

/**
 * Execute a task by its ID
 */
export async function executeTaskById(
  taskId: string,
  overrideAgentId?: string
): Promise<TaskExecutionResult> {
  const task = await prisma.task.findFirst({
    where: await getUserScopedWhere({ id: taskId }),
    include: { agent: true },
  });

  if (!task) {
    return { success: false, error: `Task with ID "${taskId}" not found.` };
  }

  return executeTask(task, { overrideAgentId });
}

/**
 * Find the most relevant pending task and execute it.
 * If query is provided, searches by title/desc.
 * If no query, picks the top priority task in in_progress or backlog.
 */
export async function findAndExecuteMatchingTask(
  query?: string,
  overrideAgentId?: string
): Promise<TaskExecutionResult> {
  const cleanQuery = (query || "").trim();
  let task = null;

  if (cleanQuery && cleanQuery !== "all" && cleanQuery.length > 2) {
    // 1. Try finding by ID first scoped to user
    task = await prisma.task.findFirst({
      where: await getUserScopedWhere({ id: cleanQuery }),
      include: { agent: true },
    });

    // 2. Try searching by title or description scoped to user
    if (!task) {
      task = await prisma.task.findFirst({
        where: await getUserScopedWhere({
          OR: [
            { title: { contains: cleanQuery } },
            { description: { contains: cleanQuery } },
          ],
        }),
        include: { agent: true },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      });
    }
  }

  // 3. Fallback: find highest-priority pending task on the board scoped to user
  if (!task) {
    task = await prisma.task.findFirst({
      where: await getUserScopedWhere({
        status: { in: ["in_progress", "backlog", "review"] },
      }),
      include: { agent: true },
      orderBy: [
        { status: "desc" }, // in_progress first, then backlog
        { priority: "asc" }, // urgent > high > medium > low
        { createdAt: "asc" },
      ],
    });
  }

  if (!task) {
    return {
      success: false,
      message: "No active tasks are currently pending on the Kanban board.",
    };
  }

  return executeTask(task, { overrideAgentId });
}

/**
 * Create a new task and optionally execute it immediately
 */
export async function createAndAssignTask(params: {
  title: string;
  description?: string;
  agentId?: string | null;
  priority?: "low" | "medium" | "high" | "urgent";
  executeImmediately?: boolean;
}): Promise<TaskExecutionResult> {
  const {
    title,
    description = "",
    agentId = null,
    priority = "medium",
    executeImmediately = false,
  } = params;

  let assignedAgentId = agentId;
  const userId = await getAuthUserId();

  // If no agentId passed, pick an agent scoped to user
  if (!assignedAgentId) {
    const agents = await prisma.agent.findMany({
      where: await getUserScopedWhere(),
    });
    if (agents.length > 0) {
      // Find agent whose name or role matches the task
      const lower = (title + " " + description).toLowerCase();
      const matched = agents.find(
        (a) =>
          lower.includes(a.displayName.toLowerCase()) ||
          lower.includes(a.role.toLowerCase()) ||
          (a.department && lower.includes(a.department.toLowerCase()))
      );
      assignedAgentId = matched ? matched.id : agents[0].id;
    }
  }

  // Count existing tasks for position scoped to user
  const count = await prisma.task.count({
    where: await getUserScopedWhere({ status: "backlog" }),
  });

  const createdTask = await prisma.task.create({
    data: {
      title,
      description: description || "Autonomous task dispatched from Mission Control",
      priority,
      status: "backlog",
      position: count + 1,
      agentId: assignedAgentId,
      userId,
    },
    include: { agent: true },
  });

  await prisma.activityLog.create({
    data: {
      type: "task_created",
      message: `Created task "${createdTask.title}" and assigned to ${
        createdTask.agent?.displayName || "Specialist"
      }`,
      agentId: assignedAgentId,
      userId,
    },
  });

  if (executeImmediately) {
    return executeTask(createdTask);
  }

  return {
    success: true,
    task: createdTask,
    message: `Task "${createdTask.title}" successfully queued on Kanban board.`,
  };
}

/**
 * Approve a task in review and mark it done
 */
export async function approveTaskByQuery(query?: string): Promise<{
  success: boolean;
  task?: Task & { agent?: Agent | null };
  message: string;
}> {
  const clean = (query || "").trim();
  let task = null;

  if (clean && clean.length > 2) {
    task = await prisma.task.findFirst({
      where: await getUserScopedWhere({
        status: "review",
        OR: [
          { id: clean },
          { title: { contains: clean } },
        ],
      }),
      include: { agent: true },
    });
  }

  if (!task) {
    // Top task in review scoped to user
    task = await prisma.task.findFirst({
      where: await getUserScopedWhere({ status: "review" }),
      include: { agent: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  if (!task) {
    return {
      success: false,
      message: "No tasks are currently waiting in the 'Review' column to approve.",
    };
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { status: "done" },
    include: { agent: true },
  });

  const authUserId = task.userId || (await getAuthUserId());
  await prisma.activityLog.create({
    data: {
      type: "task_completed",
      message: `Approved deliverable for "${task.title}" (moved to Done)`,
      agentId: task.agentId,
      userId: authUserId,
    },
  });

  return {
    success: true,
    task: updated,
    message: `Task "${task.title}" has been approved and moved to Done!`,
  };
}
