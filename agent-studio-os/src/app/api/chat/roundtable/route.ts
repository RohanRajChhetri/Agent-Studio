import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";

export interface RoundtableMessage {
  agentId: string;
  agentName: string;
  displayName: string;
  avatar: string;
  themeColor: string;
  roleTitle?: string;
  stance?: string;
  round: number;
  rebuttalTarget?: string;
  content: string;
  latency: number;
}

export interface DebateVerdict {
  summary: string;
  consensusPoints: string[];
  winningStance: string;
  recommendedAction: string;
}

export async function POST(request: Request) {
  try {
    const {
      topic,
      agentIds,
      stances = {},
      rounds = 2,
    } = await request.json();

    if (!topic || !topic.trim()) {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    // 1. Resolve agents
    let agents: any[] = [];
    if (agentIds && Array.isArray(agentIds) && agentIds.length > 0) {
      agents = await prisma.agent.findMany({
        where: { id: { in: agentIds } },
      });
      // Maintain order requested by user
      agents.sort((a, b) => agentIds.indexOf(a.id) - agentIds.indexOf(b.id));
    }

    if (agents.length < 2) {
      // Pick top 3 default agents
      agents = await prisma.agent.findMany({
        take: 3,
        orderBy: { createdAt: "asc" },
      });
    }

    const conversationHistory: RoundtableMessage[] = [];
    let runningContext = `DEBATE TOPIC / MOTION: "${topic}"\n\nPARTICIPANTS & ROLES:\n` +
      agents.map((a) => `- ${a.displayName} (${stances[a.id] || a.role}): ${a.description || a.role}`).join("\n") +
      "\n\n";

    const totalRounds = Math.min(Math.max(1, rounds), 3);

    // 2. Multi-turn structured debate
    for (let r = 1; r <= totalRounds; r++) {
      for (let i = 0; i < agents.length; i++) {
        const agent = agents[i];
        const assignedStance = stances[agent.id] || (i === 0 ? "Proponent" : i === 1 ? "Skeptic / Challenger" : "Pragmatist");
        const prevAgent = i > 0 ? agents[i - 1] : agents[agents.length - 1];
        const rebuttalTarget = r > 1 ? prevAgent.displayName : (i > 0 ? prevAgent.displayName : undefined);

        const start = Date.now();

        let roundDirective = "";
        if (r === 1) {
          roundDirective = `ROUND 1 (Opening Position): State your core thesis clearly from your assigned stance ("${assignedStance}"). Present 2-3 compelling arguments backed by technical and operational reasoning.`;
        } else if (r === 2) {
          roundDirective = `ROUND 2 (Cross-Examination & Rebuttal): Directly challenge the points made by ${rebuttalTarget || "the previous speaker"}. Poke holes in their assumptions, highlight failure modes, and defend your position with sharp counter-arguments.`;
        } else {
          roundDirective = `ROUND 3 (Closing Arguments & Synthesis): Deliver your closing statement. Acknowledge valid points from your peers, clarify your bottom-line requirement, and propose a concrete path forward.`;
        }

        const debatePrompt = `You are an elite AI specialist competing in a high-stakes executive debate.
${runningContext}

YOUR IDENTITY: ${agent.displayName} (${agent.role})
ASSIGNED STANCE: ${assignedStance}
ROUND: ${r} of ${totalRounds}

${roundDirective}

GUIDELINES:
1. Maintain your distinct persona and assigned stance vigorously.
2. Directly quote or address opposing points to create genuine debate tension and intellectual rigor.
3. Be punchy, structured, and avoid boilerplate intro text. Begin directly with your argument.
4. Keep within 2-3 tightly reasoned paragraphs.`;

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
          roleTitle: agent.role,
          stance: assignedStance,
          round: r,
          rebuttalTarget,
          content: res.content,
          latency: Date.now() - start,
        };

        conversationHistory.push(entry);
        runningContext += `${agent.displayName} [${assignedStance}] (Round ${r}):\n${res.content}\n\n`;

        // Persist message to database
        try {
          await prisma.chatMessage.create({
            data: {
              role: "assistant",
              content: `**[Debate Round ${r} - ${assignedStance}]**\n\n${res.content}`,
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

    // 3. Generate Executive Verdict & Synthesis
    let verdict: DebateVerdict = {
      summary: `The specialists conducted a ${totalRounds}-round debate on "${topic}".`,
      consensusPoints: [
        "Identified core trade-offs between performance and architectural simplicity.",
        "Highlighted critical edge cases and resilience requirements."
      ],
      winningStance: "Pragmatic Hybrid Approach",
      recommendedAction: "Adopt incremental rollout with automated benchmark verification."
    };

    try {
      const verdictPrompt = `You are an impartial Chief Technology Officer / Executive Arbiter reviewing the following debate:
${runningContext}

Provide an Executive Verdict JSON object with the following fields:
{
  "summary": "1-2 sentence executive summary of the debate outcome",
  "consensusPoints": ["Point 1 of agreement or synthesis", "Point 2 of agreement"],
  "winningStance": "Which stance or argument was most persuasive and well-defended",
  "recommendedAction": "1 clear, actionable decision/next step for the team"
}
Output only valid JSON.`;

      const verdictRes = await executeChatCompletion({
        prompt: verdictPrompt,
        model: "auto/fast",
        systemPrompt: "You are an objective executive arbiter who synthesizes debates into crisp actionable decisions. Output only valid JSON.",
      });

      const parsed = JSON.parse(verdictRes.content.replace(/```json/g, "").replace(/```/g, "").trim());
      if (parsed.summary && parsed.consensusPoints) {
        verdict = parsed;
      }
    } catch (e) {
      console.warn("[Roundtable Verdict] Could not parse AI verdict, using fallback:", e);
    }

    return NextResponse.json({
      success: true,
      topic,
      messages: conversationHistory,
      verdict,
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
