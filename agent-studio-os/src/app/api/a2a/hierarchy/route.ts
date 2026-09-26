import { NextResponse } from "next/server";
import { executeHierarchicalMission } from "@/lib/a2a/hierarchy-executor";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orchestratorId, missionTopic, missionDetails } = body;

    if (!missionTopic || !missionTopic.trim()) {
      return NextResponse.json({ error: "missionTopic is required" }, { status: 400 });
    }

    let targetOrchestratorId = orchestratorId;
    if (!targetOrchestratorId) {
      // Find top orchestrator or first agent
      const orchestrator = await prisma.agent.findFirst({
        where: { role: "orchestrator" },
      });
      targetOrchestratorId = orchestrator?.id;

      if (!targetOrchestratorId) {
        const anyAgent = await prisma.agent.findFirst();
        targetOrchestratorId = anyAgent?.id;
      }
    }

    if (!targetOrchestratorId) {
      return NextResponse.json({ error: "No agents found in database" }, { status: 404 });
    }

    const result = await executeHierarchicalMission({
      orchestratorId: targetOrchestratorId,
      missionTopic: missionTopic.trim(),
      missionDetails,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[A2A Hierarchy Route] Error:", error);
    return NextResponse.json(
      {
        error: "Hierarchical execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
