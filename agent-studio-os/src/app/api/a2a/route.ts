import { NextResponse } from "next/server";
import { a2aBroker } from "@/lib/a2a/protocol";
import { invokePeerAgent, requestPeerReview } from "@/lib/a2a/peer-mesh";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || undefined;

    const userAgents = await prisma.agent.findMany({
      where: await getUserScopedWhere(),
      select: { id: true },
    });
    const userAgentIds = new Set(userAgents.map((a) => a.id));

    let history = a2aBroker.getHistory(agentId);
    history = history.filter(
      (m) => userAgentIds.has(m.fromAgentId) || userAgentIds.has(m.toAgentId)
    );

    const stats = {
      totalMessages: history.length,
      completedCount: history.filter((m) => m.status === "completed").length,
      inProgressCount: history.filter((m) => m.status === "in_progress").length,
      failedCount: history.filter((m) => m.status === "failed" || m.status === "rejected").length,
      successRate:
        history.length > 0
          ? Math.round(
              (history.filter((m) => m.status === "completed").length /
                (history.length || 1)) *
                100
            )
          : 100,
    };

    return NextResponse.json({
      success: true,
      stats,
      messages: history,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to retrieve A2A broker logs", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action = "invoke" } = body;

    if (action === "review") {
      const { authorAgentId, reviewerAgentId, artifactTitle, artifactContent, rubricFocus } = body;
      if (!reviewerAgentId || !artifactContent) {
        return NextResponse.json({ error: "reviewerAgentId and artifactContent are required" }, { status: 400 });
      }

      const reviewerAgent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: reviewerAgentId }),
      });
      if (!reviewerAgent) {
        return NextResponse.json({ error: "Reviewer agent not found" }, { status: 404 });
      }

      const review = await requestPeerReview({
        authorAgentId: authorAgentId || "system",
        reviewerAgentId,
        artifactTitle: artifactTitle || "Deliverable",
        artifactContent,
        rubricFocus,
      });

      return NextResponse.json(review);
    }

    // Default: invoke peer
    const { fromAgentId, toAgentId, title, prompt, contextData } = body;
    if (!toAgentId || !prompt) {
      return NextResponse.json({ error: "toAgentId and prompt are required" }, { status: 400 });
    }

    const targetAgent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({ id: toAgentId }),
    });
    if (!targetAgent) {
      return NextResponse.json({ error: "Target agent not found" }, { status: 404 });
    }

    const result = await invokePeerAgent({
      fromAgentId: fromAgentId || "system",
      toAgentId,
      title: title || "A2A Peer Invocation",
      prompt,
      contextData,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[A2A API] Error:", error);
    return NextResponse.json(
      { error: "A2A operation failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
