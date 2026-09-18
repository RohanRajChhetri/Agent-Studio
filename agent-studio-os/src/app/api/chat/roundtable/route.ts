import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";

export interface RoundtableMessage {
  agentId: string;
  agentName: string;
  displayName: string;
  avatar: string;
  themeColor: string;
  round: number;
  content: string;
  latency: number;
}

export async function POST(request: Request) {
  try {
    const { topic, agentIds, rounds = 1 } = await request.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // 1. Resolve agents
    let agents: any[] = [];
    if (agentIds && agentIds.length > 0) {
      agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } },
      });
    }

    if (agents.length < 2) {
      // Pick top 3 default agents
      agents = await prisma.agent.findMany({
        take: 3,
        orderBy: { createdAt: "asc" },
      });
    }

    const conversationHistory: RoundtableMessage[] = [];
    let runningContext = `TOPIC OF DISCUSSION: "${topic}"\n\n`;

    // 2. Multi-turn debate/roundtable
    for (let r = 1; r <= Math.min(rounds, 2); r++) {
      for (const agent of agents) {
        const start = Date.now();

        const debatePrompt = `You are participating in an autonomous executive roundtable debate with fellow AI specialists.
${runningContext}

YOUR IDENTITY: ${agent.displayName} (${agent.role})
YOUR EXPERTISE: ${agent.description || agent.systemPrompt.slice(0, 150)}

INSTRUCTIONS:
1. Address the topic directly, build on previous agents' points, offer counterpoints or technical critique, and contribute your specialized domain expertise.
2. Keep your response focused, punchy, and under 3-4 paragraphs.
3. Conclude with 1 actionable recommendation or provocative question.`;

        const res = await executeChatCompletion({
          prompt: debatePrompt,
          model: agent.model || "auto/fast",
          systemPrompt: agent.systemPrompt,
          agentName: agent.name,
          useVaultRAG: true,
          useEpisodicMemory: true,
        });

        const entry: RoundtableMessage = {
          agentId: agent.id,
          agentName: agent.name,
          displayName: agent.displayName,
          avatar: agent.avatar,
          themeColor: agent.themeColor,
          round: r,
          content: res.content,
          latency: Date.now() - start,
        };

        conversationHistory.push(entry);
        runningContext += `${agent.displayName} (Round ${r}):\n${res.content}\n\n`;

        // Persist message to database
        try {
          await prisma.chatMessage.create({
            data: {
              role: "assistant",
              content: `**[Roundtable Round ${r}]**\n\n${res.content}`,
              agentId: agent.id,
              model: agent.model || "auto/fast",
              latency: Date.now() - start,
            },
          });
        } catch {
          // Ignore persist errors
        }
      }
    }

    return NextResponse.json({
      success: true,
      topic,
      messages: conversationHistory,
      agentCount: agents.length,
    });
  } catch (error) {
    console.error("[Roundtable API] Error:", error);
    return NextResponse.json(
      {
        error: "Roundtable session failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
