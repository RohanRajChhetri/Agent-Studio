import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";
import { notifyWhatsAppUser } from "@/lib/whatsapp-service";


export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const overrideAgentId = body.agentId;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Determine executing agent
    let agent = task.agent;
    if (overrideAgentId) {
      const found = await prisma.agent.findUnique({
        where: { id: overrideAgentId },
      });
      if (found) agent = found;
    }

    if (!agent) {
      // Pick first available agent
      agent = await prisma.agent.findFirst();
    }

    // Set task to in_progress first
    await prisma.task.update({
      where: { id },
      data: {
        status: "in_progress",
        agentId: agent?.id || null,
      },
    });

    await prisma.activityLog.create({
      data: {
        type: "task_moved",
        message: `${agent ? agent.displayName : "Agent"} started working on "${task.title}"`,
        agentId: agent?.id || null,
      },
    });

    // Construct structured prompt for the agent
    const prompt = `You are ${agent ? `${agent.displayName} (${agent.name})` : "an autonomous AI Specialist"} executing an assigned task in Agent Studio OS.
TASK TO EXECUTE:
- Title: ${task.title}
- Details & Requirements: ${task.description || "Thorough execution requested."}
- Priority: ${task.priority.toUpperCase()}

EXECUTION GUIDELINES:
1. Executive Summary: Provide a 1-2 sentence overview of what was accomplished.
2. Complete Deliverables:
   - If this task requests code, provide complete, production-grade, bug-free runnable code in fenced code blocks with language identifiers.
   - If this task requests research or strategy, provide deep analysis, concrete numbers/tables, comparison matrices, and clear citations.
   - If this task requests copy or marketing, provide ready-to-publish drafts.
3. Verification & Instructions: Give step-by-step instructions for testing or utilizing the deliverable.
4. Obsidian Links: Incorporate relevant wikilinks like [[tasks]], [[agents]], or relevant research topics.`;

    const executionResult = await executeChatCompletion({
      prompt,
      model: agent?.model || null,
      systemPrompt:
        agent?.systemPrompt ||
        "You are an elite autonomous AI specialist in Agent Studio OS. Deliver complete, structured, production-grade outputs.",
      agentName: agent?.name,
    });

    // Update task to 'review' with the result deliverable
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "review",
        result: executionResult.content,
        agentId: agent?.id || null,
      },
      include: { agent: true },
    });

    // Save deliverable to shared Obsidian vault
    try {
      await ensureVaultExists();
      const filename = `tasks/${slugify(task.title || "task")}.md`;
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

## Deliverable
${executionResult.content}

---
*Assigned Agent: [[agents/${agent ? agent.name : "unassigned"}]] | Vault: [[tasks]]*
`;
      await writeVaultFile(filename, vaultContent);
    } catch (vaultErr) {
      console.warn("Could not save task output to vault:", vaultErr);
    }

    // Log completion
    await prisma.activityLog.create({
      data: {
        type: "task_moved",
        message: `${agent ? agent.displayName : "Agent"} completed "${task.title}" in ${formatResponseTime(executionResult.latency)} (moved to Review)`,
        agentId: agent?.id || null,
      },
    });

    // Relay notification via WhatsApp if enabled
    notifyWhatsAppUser(
      `Task Completed: ${task.title}`,
      executionResult.content.slice(0, 300) + "...",
      {
        agentName: agent ? agent.displayName : "Autonomous Agent",
        status: "Review Required",
      }
    ).catch(() => {});

    return NextResponse.json({
      success: true,
      task: updatedTask,
      execution: executionResult,
    });
  } catch (error) {
    console.error("Task run error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
