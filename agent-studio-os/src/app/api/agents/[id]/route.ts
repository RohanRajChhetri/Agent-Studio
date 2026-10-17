import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deleteProfile as hermesDeleteProfile, setConfig, showProfile } from "@/lib/hermes";
import { getUserScopedWhere, getAuthUserId } from "@/lib/user-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const agent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({ id }),
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

    const agent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({ id }),
    });
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
    const agent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({ id }),
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    // 1. Unlink subordinate agents so they become top-level orchestrators
    await prisma.agent.updateMany({
      where: { reportsToId: id },
      data: { reportsToId: null },
    });

    // 2. Unlink tasks and routines so user backlog items are preserved safely
    await prisma.task.updateMany({
      where: { agentId: id },
      data: { agentId: null },
    });
    await prisma.routine.updateMany({
      where: { agentId: id },
      data: { agentId: null },
    });

    // 3. Clean up agent tools and communication channel integrations
    await prisma.agentTool.deleteMany({ where: { agentId: id } });
    await prisma.agentIntegration.deleteMany({ where: { agentId: id } });

    // 4. Clean up chat messages and sessions
    await prisma.chatMessage.deleteMany({ where: { agentId: id } });
    await prisma.chatSession.deleteMany({ where: { agentId: id } });

    // 5. Delete Hermes profile safely
    if (agent.name && agent.name !== "default") {
      try {
        await hermesDeleteProfile(agent.name);
      } catch (error) {
        console.warn(`Hermes profile deletion skipped/failed for ${agent.name}:`, error);
      }
    }

    // 6. Delete the agent record
    await prisma.agent.delete({ where: { id } });

    await prisma.activityLog.create({
      data: {
        type: "agent_deleted",
        message: `Agent "${agent.displayName}" deleted`,
        userId: await getAuthUserId(),
      },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (error: any) {
    console.error("Agent delete error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete agent" },
      { status: 500 }
    );
  }
}
