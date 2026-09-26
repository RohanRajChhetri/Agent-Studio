import { NextResponse } from "next/server";
import { a2aBroker } from "@/lib/a2a/protocol";
import { invokePeerAgent, requestPeerReview } from "@/lib/a2a/peer-mesh";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId") || undefined;

    const history = a2aBroker.getHistory(agentId);
    const stats = a2aBroker.getStats();

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
