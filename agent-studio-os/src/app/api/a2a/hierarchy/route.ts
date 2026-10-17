import { NextResponse } from "next/server";
import { executeHierarchicalMission } from "@/lib/a2a/hierarchy-executor";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orchestratorId, missionTopic, missionDetails } = body;

    if (!missionTopic || !missionTopic.trim()) {
      return NextResponse.json({ error: "missionTopic is required" }, { status: 400 });
    }

    let targetOrchestratorId: string | null = null;
    if (orchestratorId) {
      const found = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: orchestratorId }),
      });
      targetOrchestratorId = found?.id || null;
    }

    if (!targetOrchestratorId) {
      // Find top orchestrator or first agent for this user
      const orchestrator = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ role: "orchestrator" }),
      });
      targetOrchestratorId = orchestrator?.id || null;

      if (!targetOrchestratorId) {
        const anyAgent = await prisma.agent.findFirst({
          where: await getUserScopedWhere(),
        });
        targetOrchestratorId = anyAgent?.id || null;
      }
    }

    if (!targetOrchestratorId) {
      return NextResponse.json({ error: "No agents found for this user" }, { status: 404 });
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
