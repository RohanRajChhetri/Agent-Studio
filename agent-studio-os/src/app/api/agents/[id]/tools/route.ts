import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enableTool, disableTool } from "@/lib/hermes";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { toolId, enabled } = body;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Update in Hermes
    if (agent.profilePath) {
      try {
        if (enabled) {
          await enableTool(toolId, agent.name);
        } else {
          await disableTool(toolId, agent.name);
        }
      } catch (error) {
        console.error("Hermes tool toggle error:", error);
      }
    }

    // Update in database
    await prisma.agentTool.upsert({
      where: {
        agentId_toolId: { agentId: id, toolId },
      },
      update: { enabled },
      create: { agentId: id, toolId, enabled },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update tool" },
      { status: 500 }
    );
  }
}
