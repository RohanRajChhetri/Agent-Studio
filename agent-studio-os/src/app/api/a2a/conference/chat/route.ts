import { NextResponse } from "next/server";
import { executeChatCompletion } from "@/lib/llm-router";
import { prisma } from "@/lib/prisma";
import { createProjectFile, readProjectFile } from "@/lib/project-filesystem";
import { saveDocumentFile } from "@/lib/document-generator";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      missionTopic,
      currentDeliverable,
      conferenceFilePath,
      userPrompt,
      history = [],
      orchestratorId,
    } = body;

    if (!userPrompt || !userPrompt.trim()) {
      return NextResponse.json({ error: "userPrompt is required" }, { status: 400 });
    }

    // Resolve orchestrator scoped to user
    const orchestrator = await prisma.agent.findFirst({
      where: await getUserScopedWhere(orchestratorId ? { id: orchestratorId } : { role: "orchestrator" }),
    });

    const orchestratorName = orchestrator?.displayName || "Lead Orchestrator";

    // Detect if this is a change request or a clarification question
    const isChangeRequest =
      /\b(change|update|modify|switch|replace|add|remove|fix|rewrite|revise|instead|alter)\b/i.test(
        userPrompt
      );

    const systemPrompt = `You are ${orchestratorName}, the Executive Orchestrator presiding over the A2A Conference.
The team has convened on the mission: "${missionTopic}".

CURRENT MASTER DELIVERABLE:
${currentDeliverable || "(No deliverable yet)"}

USER INTERACTION MODE:
The human executive has joined the conference room to either:
1. Ask questions regarding what was discussed, the architectural choices, and specialist recommendations.
2. Request modifications, improvements, or direct changes to the deliverables.

INSTRUCTIONS:
${
  isChangeRequest
    ? `The user is requesting changes/revisions.
- Acknowledge their request professionally.
- Explain what modifications are being made across the plan.
- Provide the FULL updated, revised Master Deliverable enclosed inside:
<<<REVISED_DELIVERABLE>>>
[Insert full revised deliverable here in clean markdown]
<<<END_REVISED_DELIVERABLE>>>`
    : `The user is asking a question.
- Answer their question with deep analytical rigor, referencing the conference's architectural choices and specialist outputs.
- Keep the tone confident, articulate, and executive-ready.`
}

Do not repeat robotic greetings or re-introduce yourself. Address the user's prompt directly.`;

    const chatResponse = await executeChatCompletion({
      prompt: userPrompt.trim(),
      systemPrompt,
      history,
      model: orchestrator?.model || "auto/fast",
      agentName: orchestrator?.name || "orchestrator",
    });

    let revisedDeliverable: string | null = null;
    let answerText = chatResponse.content;

    // Check if revised deliverable was produced
    const revisedMatch = chatResponse.content.match(
      /<<<REVISED_DELIVERABLE>>>([\s\S]*?)<<<END_REVISED_DELIVERABLE>>>/
    );

    if (revisedMatch) {
      revisedDeliverable = revisedMatch[1].trim();
      answerText = chatResponse.content
        .replace(/<<<REVISED_DELIVERABLE>>>[\s\S]*?<<<END_REVISED_DELIVERABLE>>>/, "")
        .trim();
      if (!answerText) {
        answerText = `I have updated the Master Executive Deliverable based on your guidance.`;
      }

      // If a conference file path is provided, update it on disk with the revision note
      if (conferenceFilePath) {
        try {
          const existing = await readProjectFile(conferenceFilePath);
          const revisionLog = `\n\n---\n\n## 4. Executive Revision Request & Updated Deliverable\n**Request by User**: "${userPrompt.trim()}"\n**Timestamp**: ${new Date().toLocaleString()}\n\n### Updated Master Deliverable:\n${revisedDeliverable}\n`;
          await createProjectFile(conferenceFilePath, existing.content + revisionLog, {
            overwrite: true,
          });
          // Also update public download
          const baseName = conferenceFilePath.split("/").pop() || "conference_minutes.md";
          await saveDocumentFile(baseName, existing.content + revisionLog);
        } catch (updateErr) {
          console.warn("[Conference Chat] Failed to update minutes file:", updateErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      answer: answerText,
      revisedDeliverable,
      isRevision: Boolean(revisedDeliverable),
      orchestratorName,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Conference Chat Route Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process conference interaction" },
      { status: 500 }
    );
  }
}
