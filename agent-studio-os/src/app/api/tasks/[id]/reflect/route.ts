import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { appendAgentLearning } from "@/lib/episodic-memory";
import { writeVaultFile, ensureVaultExists } from "@/lib/vault";
import { slugify } from "@/lib/utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const feedback = body.feedback || body.critique;

    if (!feedback || !feedback.trim()) {
      return NextResponse.json(
        { error: "Critique feedback is required for self-reflection" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const agent = task.agent || (await prisma.agent.findFirst());
    const previousResult = task.result || "(No previous deliverable found)";

    // 1. Construct Self-Reflection Prompt
    const reflectionPrompt = `You are ${agent ? agent.displayName : "Autonomous Specialist"}.
You previously executed the task: "${task.title}".
PREVIOUS DELIVERABLE:
${previousResult.slice(0, 3000)}

THE USER REVIEWED YOUR WORK AND GAVE THIS CRITIQUE/FEEDBACK:
"${feedback}"

YOUR MISSION (SELF-REFLECTION & REVISION):
1. **Self-Reflection & Critique Analysis**: Explain what you learned from this feedback and how you are adjusting your approach.
2. **Iteration Changelog**: List the 3-4 specific enhancements made in this revision.
3. **Revised Production Deliverable (v2)**: Provide the complete, polished, upgraded deliverable addressing every point of user feedback with production-grade quality.
4. **Obsidian Wikilinks**: Include relevant wikilinks [[tasks]], [[concepts]], etc.`;

    const execution = await executeChatCompletion({
      prompt: reflectionPrompt,
      model: agent?.model || "auto/fast",
      systemPrompt: agent?.systemPrompt,
      agentName: agent?.name,
      useVaultRAG: true,
      useEpisodicMemory: true,
    });

    // 2. Persist learning into agent's persistent episodic memory
    if (agent?.name) {
      await appendAgentLearning(
        agent.name,
        `Task: "${task.title}" - Critique: "${feedback}" -> Revision applied.`,
        "Critique Feedback"
      );
    }

    const revisedContent = `> [!TIP]
> **Iteration v2 (Self-Reflected & Revised)**: Enhanced by **${agent ? agent.displayName : "Agent"}** based on user feedback: *"${feedback}"*

${execution.content}
`;

    // 3. Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        status: "review",
        result: revisedContent,
      },
      include: { agent: true },
    });

    // 4. Update Vault File
    try {
      await ensureVaultExists();
      const filename = `tasks/${slugify(task.title)}.md`;
      await writeVaultFile(filename, revisedContent);
    } catch (vaultErr) {
      console.warn("Failed to update vault file:", vaultErr);
    }

    // 5. Activity log
    await prisma.activityLog.create({
      data: {
        type: "task_revised",
        message: `${agent?.displayName || "Agent"} self-reflected and revised "${task.title}" based on feedback`,
        agentId: agent?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      task: updatedTask,
      revisedContent,
      latency: execution.latency,
    });
  } catch (error) {
    console.error("[Reflect API] Error:", error);
    return NextResponse.json(
      {
        error: "Self-reflection failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
