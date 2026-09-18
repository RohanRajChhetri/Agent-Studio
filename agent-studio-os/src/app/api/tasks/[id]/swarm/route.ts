import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify, formatResponseTime } from "@/lib/utils";


export interface SwarmStep {
  stepIndex: number;
  agentName: string;
  agentDisplayName: string;
  role: string;
  subtask: string;
  output: string;
  latency: number;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const customAgents = body.agentIds as string[] | undefined;

    const task = await prisma.task.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Set task to in_progress
    await prisma.task.update({
      where: { id },
      data: { status: "in_progress" },
    });

    // 1. Resolve swarm agents
    let swarmAgents: any[] = [];
    if (customAgents && customAgents.length > 0) {
      swarmAgents = await prisma.agent.findMany({
        where: { id: { in: customAgents } },
      });
    }

    if (swarmAgents.length === 0) {
      // Pick active specialists (Athena, Mercury, Vulcan, etc.)
      swarmAgents = await prisma.agent.findMany({
        take: 3,
        orderBy: { createdAt: "asc" },
      });
    }

    // Identify orchestrator
    const orchestrator =
      (await prisma.agent.findFirst({ where: { role: "orchestrator" } })) ||
      task.agent ||
      swarmAgents[0];

    const swarmSteps: SwarmStep[] = [];
    let cumulativeContext = "";

    // 2. Sequential Swarm Pipeline Execution
    for (let i = 0; i < swarmAgents.length; i++) {
      const agent = swarmAgents[i];
      const startStep = Date.now();

      let subtaskPrompt = "";
      if (agent.name.includes("athena") || agent.role.includes("research") || i === 0) {
        subtaskPrompt = `You are ${agent.displayName}. PHASE 1: RESEARCH & STRATEGY.
Perform deep research, competitive analysis, data gathering, or technical exploration for:
Title: "${task.title}"
Details: "${task.description || "N/A"}"

Provide a structured, cited research brief.`;
      } else if (agent.name.includes("mercury") || agent.role.includes("copy") || i === 1) {
        subtaskPrompt = `You are ${agent.displayName}. PHASE 2: COPYWRITING & COMMUNICATIONS.
Using the preliminary research:
${cumulativeContext.slice(-1500)}

Draft high-impact messaging, campaign frameworks, executive copy, or client-ready deliverables for:
Title: "${task.title}"`;
      } else {
        subtaskPrompt = `You are ${agent.displayName}. PHASE 3: TECHNICAL EXECUTION & INFRASTRUCTURE.
Using the preceding outputs:
${cumulativeContext.slice(-1500)}

Provide concrete implementation steps, architecture decisions, code snippets, or deployment configs for:
Title: "${task.title}"`;
      }

      const res = await executeChatCompletion({
        prompt: subtaskPrompt,
        model: agent.model || "auto/fast",
        systemPrompt: agent.systemPrompt,
        agentName: agent.name,
        useVaultRAG: true,
        useEpisodicMemory: true,
      });

      swarmSteps.push({
        stepIndex: i + 1,
        agentName: agent.name,
        agentDisplayName: agent.displayName,
        role: agent.role,
        subtask: subtaskPrompt.split("\n")[0],
        output: res.content,
        latency: Date.now() - startStep,
      });

      cumulativeContext += `\n\n### Deliverable by ${agent.displayName} (${agent.name}):\n${res.content}\n`;
    }

    // 3. Final Orchestrator Synthesis
    const synthesisPrompt = `You are ${orchestrator ? orchestrator.displayName : "Swarm Orchestrator"}.
A multi-agent swarm has completed execution of the task: "${task.title}".

Here are the individual specialist deliverables:
${cumulativeContext}

YOUR MISSION:
Synthesize these inputs into a single, cohesive, C-level executive report. Include:
1. Executive Summary
2. Strategic & Research Insights
3. Core Deliverable / Implementation Plan
4. Next Actions & Verification Matrix
5. Obsidian Wikilinks [[tasks]], [[agents]]`;

    const finalSynthesis = await executeChatCompletion({
      prompt: synthesisPrompt,
      model: orchestrator?.model || "auto/fast",
      systemPrompt: orchestrator?.systemPrompt,
      agentName: orchestrator?.name,
      useVaultRAG: true,
      useEpisodicMemory: true,
    });

    const fullSwarmReport = `# Swarm Collective Deliverable: ${task.title}

> [!NOTE]
> Autonomous multi-agent swarm execution completed by **${swarmAgents.map((a) => a.displayName).join(", ")}** orchestrated by **${orchestrator ? orchestrator.displayName : "Orchestrator"}**.

## 👑 Executive Synthesis
${finalSynthesis.content}

---

## ⚡ Specialist Breakdown
${swarmSteps
  .map(
    (step) => `### Step ${step.stepIndex}: ${step.agentDisplayName} (${step.role})
*Execution Time: ${formatResponseTime(step.latency)}*

${step.output}`
  )
  .join("\n\n---\n\n")}

`;

    // 4. Update task & Save to Obsidian Vault
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "review",
        result: fullSwarmReport,
      },
      include: { agent: true },
    });

    try {
      await ensureVaultExists();
      const filename = `tasks/swarm-${slugify(task.title || "swarm-task")}.md`;
      const vaultFileContent = `---
title: "Swarm: ${task.title.replace(/"/g, '\\"')}"
status: "review"
priority: "${task.priority}"
type: "swarm_pipeline"
orchestrator: "${orchestrator ? orchestrator.displayName : "System"}"
specialists: [${swarmAgents.map((a) => `"${a.name}"`).join(", ")}]
date: "${new Date().toISOString()}"
tags:
  - swarm
  - multi-agent
  - deliverable
---

${fullSwarmReport}
`;
      await writeVaultFile(filename, vaultFileContent);
    } catch (vaultErr) {
      console.warn("Failed to write swarm output to vault:", vaultErr);
    }

    await prisma.activityLog.create({
      data: {
        type: "task_moved",
        message: `Swarm pipeline completed "${task.title}" with ${swarmAgents.length} agents (moved to Review)`,
        agentId: orchestrator?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      steps: swarmSteps,
      synthesis: finalSynthesis.content,
      deliverable: fullSwarmReport,
    });
  } catch (error) {
    console.error("[API Task Swarm] Error:", error);
    return NextResponse.json(
      {
        error: "Swarm execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
