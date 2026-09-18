import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteProfile as hermesDeleteProfile, setConfig, showProfile } from "@/lib/hermes";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await prisma.agent.findUnique({
      where: { id },
      include: { tools: true, integrations: true, tasks: true, reportsTo: true, subordinates: true },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    return NextResponse.json(agent);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch agent" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const {
      displayName,
      avatar,
      systemPrompt,
      model,
      themeColor,
      description,
      role,
      department,
      reportsToId,
      integrations,
    } = body;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Update Hermes config if profile exists
    if (agent.profilePath) {
      try {
        if (model !== undefined) {
          await setConfig("model.default", model, agent.name);
        }
        if (systemPrompt !== undefined) {
          await setConfig("agent.system_prompt", systemPrompt, agent.name);
        }
      } catch (error) {
        console.error("Hermes config update error:", error);
      }
    }

    // If integrations array is supplied, sync AgentIntegration records
    if (Array.isArray(integrations)) {
      // Remove integrations not in list
      await prisma.agentIntegration.deleteMany({
        where: {
          agentId: id,
          platform: { notIn: integrations },
        },
      });

      // Upsert integrations that are in list
      for (const platform of integrations) {
        await prisma.agentIntegration.upsert({
          where: {
            agentId_platform: {
              agentId: id,
              platform,
            },
          },
          create: {
            agentId: id,
            platform,
            enabled: true,
          },
          update: {
            enabled: true,
          },
        });
      }
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: {
        ...(displayName !== undefined && { displayName }),
        ...(avatar !== undefined && { avatar }),
        ...(systemPrompt !== undefined && { systemPrompt }),
        ...(model !== undefined && { model }),
        ...(themeColor !== undefined && { themeColor }),
        ...(description !== undefined && { description }),
        ...(role !== undefined && { role }),
        ...(department !== undefined && { department }),
        ...(reportsToId !== undefined && { reportsToId: reportsToId || null }),
      },
      include: { tools: true, integrations: true, reportsTo: true, subordinates: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update agent" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // Delete Hermes profile
    if (agent.profilePath && agent.name !== "default") {
      try {
        await hermesDeleteProfile(agent.name);
      } catch (error) {
        console.error("Hermes profile deletion error:", error);
      }
    }

    await prisma.agent.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        type: "agent_deleted",
        message: `Agent "${agent.displayName}" deleted`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete agent" },
      { status: 500 }
    );
  }
}
