import { NextResponse } from "next/server";
import { dispatchConsensusToKanban } from "@/lib/a2a/kanban-dispatch";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topic, verdict, participatingAgentIds, targetStatus, executeNow } = body;

    if (!topic || !verdict) {
      return NextResponse.json(
        { error: "topic and verdict are required for consensus dispatch" },
        { status: 400 }
      );
    }

    const result = await dispatchConsensusToKanban({
      topic,
      verdict,
      participatingAgentIds,
      targetStatus: targetStatus || "todo",
      executeNow: !!executeNow,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[A2A Dispatch Route] Error:", error);
    return NextResponse.json(
      {
        error: "Consensus dispatch to Kanban failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
