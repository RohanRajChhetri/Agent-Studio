import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists, readVaultFile } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";
import { isOmnirouteOnline } from "@/lib/omniroute";

export interface MobileCommandResult {
  handled: boolean;
  replyText: string;
  parseMode?: "Markdown" | "HTML";
}

/**
 * Omnichannel Mobile Command Router
 * Dispatches two-way interactive commands from Telegram and WhatsApp.
 */
export async function routeMobileCommand(
  text: string,
  context: {
    sender: string;
    channel: "telegram" | "whatsapp";
    defaultAgent?: {
      id?: string;
      name?: string;
      displayName?: string | null;
      model?: string | null;
      systemPrompt?: string | null;
      userId?: string | null;
    } | null;
  }
): Promise<MobileCommandResult> {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return { handled: false, replyText: "" };
  }

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ").trim();
  const aName = context.defaultAgent?.displayName || "Agent Studio OS";
  const userFilter = context.defaultAgent?.userId ? { userId: context.defaultAgent.userId } : {};

  // 1. HELP & START
  if (command === "/start" || command === "/help") {
    const helpMsg = `*Agent Studio OS — Mobile Command Center*
Connected as: **${aName}**
User: **${context.sender}**

*Available Commands:*
• \`/tasks\` — List active & pending Kanban tasks
• \`/run <id>\` — Execute a task autonomously
• \`/approve <id>\` — Approve deliverable & move to Done
• \`/ask <agent> <query>\` — Chat with a specific specialist
• \`/briefing\` — Receive latest Executive Briefing
• \`/status\` — System & fleet health diagnostics
• \`/help\` — Show this command directory

_Tip: You can also send any normal text to chat directly with your primary agent!_`;

    return { handled: true, replyText: helpMsg, parseMode: "Markdown" };
  }

  // 2. STATUS & FLEET OVERVIEW
  if (command === "/status") {
    const [agentCount, taskCounts, omniOnline] = await Promise.all([
      prisma.agent.count({ where: userFilter }),
      prisma.task.groupBy({ by: ["status"], where: userFilter, _count: { id: true } }),
      isOmnirouteOnline().catch(() => false),
    ]);

    const counts: Record<string, number> = {};
    for (const t of taskCounts) {
      counts[t.status] = t._count.id;
    }

    const statusMsg = `*Agent Studio OS — System Status*
• Primary Brain (Omniroute): ${omniOnline ? "Online (`127.0.0.1:20128`)" : "Direct Cloud Fallbacks Active"}
• Active Workforce: **${agentCount} agents**
• Active Tasks: **${counts["in_progress"] || 0} in progress**, **${counts["review"] || 0} in review**, **${counts["backlog"] || 0} backlog**
• Completed Deliverables: **${counts["done"] || 0} done**`;

    return { handled: true, replyText: statusMsg, parseMode: "Markdown" };
  }

  // 3. TASKS
  if (command === "/tasks" || command === "/task") {
    const tasks = await prisma.task.findMany({
      where: {
        status: { in: ["backlog", "in_progress", "review"] },
        ...userFilter,
      },
      include: { agent: true },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
      take: 12,
    });

    if (tasks.length === 0) {
      return {
        handled: true,
        replyText: `*Kanban Workspace*\nAll caught up! No active tasks pending in Backlog, In Progress, or Review.`,
        parseMode: "Markdown",
      };
    }

    const reviewTasks = tasks.filter((t) => t.status === "review");
    const progressTasks = tasks.filter((t) => t.status === "in_progress");
    const backlogTasks = tasks.filter((t) => t.status === "backlog");

    const lines: string[] = [`*Active Tasks (${tasks.length})*`];

    if (reviewTasks.length > 0) {
      lines.push(`\n*NEEDS REVIEW (${reviewTasks.length}):*`);
      for (const t of reviewTasks) {
        const shortId = t.id.slice(0, 7);
        lines.push(`• \`${shortId}\` *${t.title}* (${t.agent?.displayName || "Unassigned"})\n  ↳ Use \`/approve ${shortId}\` or \`/run ${shortId}\``);
      }
    }

    if (progressTasks.length > 0) {
      lines.push(`\n*IN PROGRESS (${progressTasks.length}):*`);
      for (const t of progressTasks) {
        const shortId = t.id.slice(0, 7);
        lines.push(`• \`${shortId}\` *${t.title}* (${t.agent?.displayName || "Agent executing..."})`);
      }
    }

    if (backlogTasks.length > 0) {
      lines.push(`\n*BACKLOG (${backlogTasks.length}):*`);
      for (const t of backlogTasks.slice(0, 5)) {
        const shortId = t.id.slice(0, 7);
        lines.push(`• \`${shortId}\` *${t.title}* [${t.priority.toUpperCase()}]\n  ↳ Use \`/run ${shortId}\` to execute`);
      }
    }

    return { handled: true, replyText: lines.join("\n"), parseMode: "Markdown" };
  }

  // 4. RUN TASK (/run <id>)
  if (command === "/run") {
    if (!args) {
      return {
        handled: true,
        replyText: "Please specify a Task ID. Example: `/run 3abc45` (Find IDs using `/tasks`)",
        parseMode: "Markdown",
      };
    }

    // Match task by prefix or exact ID scoped to user
    const target = await prisma.task.findFirst({
      where: { id: { startsWith: args }, ...userFilter },
      include: { agent: true },
    });

    if (!target) {
      return {
        handled: true,
        replyText: `Task not found matching prefix "${args}". Run \`/tasks\` to view available task IDs.`,
        parseMode: "Markdown",
      };
    }

    // Set to in_progress
    await prisma.task.update({
      where: { id: target.id },
      data: { status: "in_progress" },
    });

    const agent = target.agent || (await prisma.agent.findFirst({ where: userFilter }));
    const prompt = `You are ${agent ? agent.displayName : "an autonomous AI specialist"} executing an assigned task in Agent Studio OS.
TASK TO EXECUTE:
- Title: ${target.title}
- Requirements: ${target.description || "Thorough execution requested."}
- Priority: ${target.priority.toUpperCase()}

Provide a concise Executive Summary followed by the complete, production-grade deliverable with necessary code, numbers, or guidelines.`;

    try {
      const execution = await executeChatCompletion({
        prompt,
        model: agent?.model || null,
        systemPrompt: agent?.systemPrompt || "You are an elite autonomous AI specialist.",
        agentName: agent?.name,
      });

      await prisma.task.update({
        where: { id: target.id },
        data: {
          status: "review",
          result: execution.content,
        },
        include: { agent: true },
      });

      // Save to Obsidian Vault
      try {
        await ensureVaultExists();
        const filename = `tasks/${slugify(target.title || "task")}.md`;
        const vaultDoc = `---
title: "${target.title.replace(/"/g, '\\"')}"
status: "review"
agent: "${agent?.displayName || "Agent"}"
model: "${execution.modelUsed}"
latency: "${formatResponseTime(execution.latency)}"
date: "${new Date().toISOString()}"
---

# ${target.title}

${execution.content}
`;
        await writeVaultFile(filename, vaultDoc);
      } catch {}

      await prisma.activityLog.create({
        data: {
          type: "task_moved",
          message: `${agent?.displayName || "Agent"} completed "${target.title}" in ${formatResponseTime(execution.latency)} via Mobile Command`,
          agentId: agent?.id || null,
          userId: context.defaultAgent?.userId || null,
        },
      });

      const preview = execution.content.length > 800
        ? execution.content.slice(0, 800) + "\n\n...(Full deliverable saved to Obsidian Vault)"
        : execution.content;

      const reply = `*Task Completed & Ready for Review!*\n*${target.title}*\nSpecialist: **${agent?.displayName || "Agent"}** (${execution.modelUsed})\nExecution Time: **${formatResponseTime(execution.latency)}**\n\n*Deliverable Preview:*\n${preview}\n\n↳ Use \`/approve ${target.id.slice(0, 7)}\` to approve & finalize!`;

      return { handled: true, replyText: reply, parseMode: "Markdown" };
    } catch (err: unknown) {
      await prisma.task.update({
        where: { id: target.id },
        data: { status: "backlog" },
      });
      return {
        handled: true,
        replyText: `Execution failed for "${target.title}": ${err instanceof Error ? err.message : String(err)}`,
        parseMode: "Markdown",
      };
    }
  }

  // 5. APPROVE TASK (/approve <id>)
  if (command === "/approve") {
    if (!args) {
      return {
        handled: true,
        replyText: "Please specify a Task ID to approve. Example: `/approve 3abc45`",
        parseMode: "Markdown",
      };
    }

    const target = await prisma.task.findFirst({
      where: { id: { startsWith: args }, ...userFilter },
      include: { agent: true },
    });

    if (!target) {
      return {
        handled: true,
        replyText: `Task not found matching prefix "${args}". Run \`/tasks\` to view available task IDs.`,
        parseMode: "Markdown",
      };
    }

    await prisma.task.update({
      where: { id: target.id },
      data: { status: "done" },
    });

    await prisma.activityLog.create({
      data: {
        type: "task_moved",
        message: `Human Reviewer approved "${target.title}" via Mobile Command (moved to Done)`,
        agentId: target.agentId,
        userId: context.defaultAgent?.userId || null,
      },
    });

    return {
      handled: true,
      replyText: `*Task Approved!*\n*${target.title}* is now marked **Done** and synced to your Obsidian knowledge vault.`,
      parseMode: "Markdown",
    };
  }

  // 6. ASK SPECIFIC AGENT (/ask <agent> <query>)
  if (command === "/ask") {
    const askMatch = args.match(/^(\S+)\s+([\s\S]+)$/);
    if (!askMatch) {
      const agents = await prisma.agent.findMany({
        where: userFilter,
        select: { name: true, displayName: true },
      });
      const agentList = agents.map((a) => `• \`${a.name}\` (${a.displayName})`).join("\n");
      return {
        handled: true,
        replyText: `Usage: \`/ask <agent_name> <your query>\`\n\n*Available Agents:*\n${agentList}`,
        parseMode: "Markdown",
      };
    }

    const targetName = askMatch[1].toLowerCase();
    const query = askMatch[2];

    const targetAgent = await prisma.agent.findFirst({
      where: {
        ...userFilter,
        OR: [
          { name: { equals: targetName } },
          { displayName: { contains: targetName } },
        ],
      },
    });

    if (!targetAgent) {
      return {
        handled: true,
        replyText: `Agent "${targetName}" not found. Run \`/ask\` without arguments to list all active agents.`,
        parseMode: "Markdown",
      };
    }

    try {
      const completion = await executeChatCompletion({
        prompt: query,
        model: targetAgent.model || null,
        systemPrompt:
          targetAgent.systemPrompt ||
          `You are ${targetAgent.displayName}, an expert AI agent in Agent Studio OS.`,
        agentName: targetAgent.name,
        useVaultRAG: true,
        useEpisodicMemory: true,
      });

      const reply = `*${targetAgent.displayName}* (${completion.modelUsed || "AI"})\n\n${completion.content}`;
      return { handled: true, replyText: reply, parseMode: "Markdown" };
    } catch (err: unknown) {
      return {
        handled: true,
        replyText: `Failed to get response from ${targetAgent.displayName}: ${err instanceof Error ? err.message : String(err)}`,
        parseMode: "Markdown",
      };
    }
  }

  // 7. EXECUTIVE BRIEFING (/briefing)
  if (command === "/briefing") {
    try {
      const today = new Date().toISOString().split("T")[0];
      const cleanUserId = context.defaultAgent?.userId?.replace(/[^a-zA-Z0-9_-]/g, "_");
      const briefingRelPath = cleanUserId
        ? `briefings/Daily_Briefing_${cleanUserId}_${today}.md`
        : `briefings/Daily_Briefing_${today}.md`;
      const cached = await readVaultFile(briefingRelPath).catch(() => null);
      if (cached && cached.content) {
        const preview = cached.content.length > 1000
          ? cached.content.slice(0, 1000) + "\n\n...(Full briefing saved to Obsidian Vault `briefings/`)"
          : cached.content;
        return {
          handled: true,
          replyText: `*Daily Executive Briefing (${today})*\n\n${preview}`,
          parseMode: "Markdown",
        };
      }

      // Generate on-demand summary
      const [tasks, agents] = await Promise.all([
        prisma.task.findMany({ where: userFilter, include: { agent: true } }),
        prisma.agent.findMany({ where: userFilter }),
      ]);

      const reviewCount = tasks.filter((t) => t.status === "review").length;
      const progressCount = tasks.filter((t) => t.status === "in_progress").length;
      const doneCount = tasks.filter((t) => t.status === "done").length;

      const summary = `*Daily Executive Briefing (${today})*
• Workforce: **${agents.length} agents deployed**
• Workload: **${progressCount} active tasks**, **${reviewCount} deliverables awaiting review**, **${doneCount} completed**
• Next Action: Check \`/tasks\` to review pending deliverables!`;

      return { handled: true, replyText: summary, parseMode: "Markdown" };
    } catch (err: unknown) {
      return {
        handled: true,
        replyText: `Could not generate briefing: ${err instanceof Error ? err.message : String(err)}`,
        parseMode: "Markdown",
      };
    }
  }

  return { handled: false, replyText: "" };
}
