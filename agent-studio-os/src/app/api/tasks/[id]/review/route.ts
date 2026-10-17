import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";
import { getUserScopedWhere, getAuthUserId } from "@/lib/user-auth";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, feedback, reason, autoExecute = true } = body;

    const task = await prisma.task.findFirst({
      where: await getUserScopedWhere({ id }),
      include: { agent: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const userId = await getAuthUserId();

    // 1. APPROVE
    if (action === "approve") {
      const updated = await prisma.task.update({
        where: { id },
        data: { status: "done" },
        include: { agent: true },
      });

      // Update Obsidian vault file to reflect approved status
      try {
        await ensureVaultExists();
        const filename = `tasks/${slugify(task.title || "task")}.md`;
        const approvalDate = new Date().toISOString();
        const vaultContent = `---
title: "${task.title.replace(/"/g, '\\"')}"
status: "done"
priority: "${task.priority}"
agent: "${task.agent ? task.agent.displayName : "Unassigned"}"
agent_name: "${task.agent ? task.agent.name : "unassigned"}"
approved_at: "${approvalDate}"
tags:
  - task
  - deliverable
  - approved
  - ${task.priority}
---

# ${task.title}

> [!CHECK]
> **Approved Deliverable**: Verified and approved by human reviewer on ${approvalDate}.
> Executed by [[agents/${task.agent ? task.agent.name : "unassigned"}]].

## Task Objective
${task.description || "N/A"}

## Approved Deliverable
${task.result || "Deliverable verified."}

---
*Status: [[tasks]] | Approved*
`;
        await writeVaultFile(filename, vaultContent);
      } catch (vaultErr) {
        console.warn("[Review API] Could not update vault file on approval:", vaultErr);
      }

      await prisma.activityLog.create({
        data: {
          type: "task_moved",
          message: `Human Reviewer approved deliverable for "${task.title}" (moved to Done)`,
          agentId: task.agentId,
          userId,
        },
      });

      return NextResponse.json({
        success: true,
        action: "approved",
        task: updated,
      });
    }

    // 2. REVISE (Request Revision with Critique)
    if (action === "revise") {
      const critique = feedback || reason || "Please review and refine the output.";

      if (autoExecute && task.agent) {
        // Autonomous revision loop: agent refines deliverable with critique
        const revisionPrompt = `You are ${task.agent.displayName} revising an earlier deliverable based on human reviewer critique.

ORIGINAL OBJECTIVE:
- Title: ${task.title}
- Details: ${task.description}

PREVIOUS DELIVERABLE:
${task.result || "(None provided)"}

HUMAN REVIEWER FEEDBACK / REQUIRED CHANGES:
"${critique}"

INSTRUCTIONS:
1. Address all feedback points meticulously.
2. Provide the complete revised, production-grade deliverable in clear Markdown.
3. Include a short 1-sentence note at the top detailing what was improved.`;

        const executionResult = await executeChatCompletion({
          prompt: revisionPrompt,
          model: task.agent.model || null,
          systemPrompt:
            task.agent.systemPrompt ||
            "You are an elite AI specialist. Revise deliverables accurately based on feedback.",
          agentName: task.agent.name,
        });

        const updated = await prisma.task.update({
          where: { id },
          data: {
            status: "review",
            result: executionResult.content,
          },
          include: { agent: true },
        });

        await prisma.activityLog.create({
          data: {
            type: "task_moved",
            message: `${task.agent.displayName} revised "${task.title}" addressing critique: "${critique.slice(0, 80)}" in ${formatResponseTime(executionResult.latency)}`,
            agentId: task.agentId,
            userId,
          },
        });

        return NextResponse.json({
          success: true,
          action: "revised_and_reexecuted",
          feedback: critique,
          task: updated,
          execution: executionResult,
        });
      } else {
        // Move back to in_progress with feedback attached
        const updated = await prisma.task.update({
          where: { id },
          data: {
            status: "in_progress",
            description: `${task.description}\n\n[Revision Requested]: ${critique}`,
          },
          include: { agent: true },
        });

        await prisma.activityLog.create({
          data: {
            type: "task_moved",
            message: `Revision requested on "${task.title}": "${critique.slice(0, 80)}" (moved to In Progress)`,
            agentId: task.agentId,
            userId,
          },
        });

        return NextResponse.json({
          success: true,
          action: "revision_requested",
          task: updated,
        });
      }
    }

    // 3. REJECT
    if (action === "reject") {
      const rejectReason = reason || feedback || "Deliverable did not meet criteria.";
      const updated = await prisma.task.update({
        where: { id },
        data: {
          status: "backlog",
          description: `${task.description}\n\n[Rejected]: ${rejectReason}`,
        },
        include: { agent: true },
      });

      await prisma.activityLog.create({
        data: {
          type: "task_moved",
          message: `Deliverable rejected for "${task.title}": "${rejectReason.slice(0, 80)}" (moved to Backlog)`,
          agentId: task.agentId,
          userId,
        },
      });

      return NextResponse.json({
        success: true,
        action: "rejected",
        task: updated,
      });
    }

    return NextResponse.json(
      { error: "Invalid review action. Must be 'approve', 'revise', or 'reject'." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Review API] Error:", error);
    return NextResponse.json(
      {
        error: "Task review operation failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
