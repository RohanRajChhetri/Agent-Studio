import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createProfile, deleteProfile as hermesDeleteProfile, listProfiles, setConfig, enableTool, disableTool } from "@/lib/hermes";
import { slugify } from "@/lib/utils";
import { TOOL_DEFINITIONS, INTEGRATION_DEFINITIONS } from "@/types";

export async function GET() {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        tools: true,
        integrations: true,
        reportsTo: true,
        subordinates: true,
        _count: { select: { tasks: true, subordinates: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Try to sync with Hermes profiles
    let hermesProfiles: string[] = [];
    try {
      const profiles = await listProfiles();
      hermesProfiles = profiles.map((p) => p.name);
    } catch {
      // Hermes CLI might not be available
    }

    const agentsWithSync = agents.map((agent) => ({
      ...agent,
      hermesLinked: hermesProfiles.includes(agent.name),
      taskCount: agent._count.tasks,
    }));

    return NextResponse.json(agentsWithSync);
  } catch (error) {
    console.error("Error listing agents:", error);
    return NextResponse.json(
      { error: "Failed to list agents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      displayName,
      avatar = "🤖",
      systemPrompt = "",
      model,
      themeColor = "#6366f1",
      tools = [],
      integrations = [],
      description = "",
      role = "specialist",
      department = "General",
      reportsToId = null,
    } = body;

    if (!displayName) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    let uniqueName = slugify(displayName) || "agent";
    let candidate = uniqueName;
    let counter = 1;
    while (await prisma.agent.findUnique({ where: { name: candidate } })) {
      candidate = `${uniqueName}-${counter++}`;
    }
    const name = candidate;

    // Create Hermes profile with 3.5s fast timeout
    let profilePath: string | null = null;
    try {
      const hermesSync = async () => {
        await createProfile(name, {
          cloneFrom: "default",
          description: description || `${displayName} agent`,
        });

        if (model) {
          await setConfig("model.default", model, name);
        }

        if (systemPrompt) {
          await setConfig("agent.system_prompt", systemPrompt, name);
        }

        for (const toolDef of TOOL_DEFINITIONS) {
          const shouldEnable = tools.includes(toolDef.id);
          try {
            if (shouldEnable) {
              await enableTool(toolDef.id, name);
            } else {
              await disableTool(toolDef.id, name);
            }
          } catch {
            // Tool config optional
          }
        }
        return name;
      };

      profilePath = await Promise.race([
        hermesSync(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);
    } catch (error) {
      console.error("Hermes profile creation error:", error);
      // Continue anyway — the agent will be saved to DB
    }

    // Save to database
    const agent = await prisma.agent.create({
      data: {
        name,
        displayName,
        avatar,
        systemPrompt,
        model,
        themeColor,
        description,
        profilePath,
        role: role || "specialist",
        department: department || "General",
        reportsToId: reportsToId || null,
        tools: {
          create: TOOL_DEFINITIONS.map((t) => ({
            toolId: t.id,
            enabled: tools.includes(t.id),
          })),
        },
        integrations: {
          create: (integrations as string[]).map((platform: string) => ({
            platform,
            enabled: true,
          })),
        },
      },
      include: { tools: true, integrations: true, reportsTo: true, subordinates: true },
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "agent_created",
        message: `Agent "${displayName}" created`,
        agentId: agent.id,
      },
    });

    return NextResponse.json(agent, { status: 201 });
  } catch (error) {
    console.error("Error creating agent:", error);
    const message = error instanceof Error ? error.message : "Failed to create agent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
