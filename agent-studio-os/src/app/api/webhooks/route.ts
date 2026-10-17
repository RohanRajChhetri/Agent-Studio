import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere, getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const userId = await getAuthUserId();
    const scopedWhere = await getUserScopedWhere();

    // 1. Fetch agents scoped to current user
    const agents = await prisma.agent.findMany({
      where: scopedWhere,
      select: {
        id: true,
        name: true,
        displayName: true,
        role: true,
        avatar: true,
      },
      orderBy: { createdAt: "asc" },
    });

    // 2. Fetch custom webhook settings scoped to user
    const settingKey =
      userId && userId !== PRIMARY_LEGACY_USER_ID
        ? `integration:webhooks_config:${userId}`
        : "integration:webhooks_config";

    const webhookSetting = await prisma.setting.findUnique({
      where: { key: settingKey },
    });

    let customEndpoints: Array<{ id: string; name: string; token: string; agentId?: string }> = [];
    if (webhookSetting?.value) {
      try {
        customEndpoints = JSON.parse(webhookSetting.value);
      } catch {
        customEndpoints = [];
      }
    }

    // Standard endpoints (only bind agent if user has agents)
    const standardEndpoints = [
      {
        id: "default",
        name: "General Inbound Gateway",
        token: "default-secret",
        description: "General trigger that auto-routes to best available agent",
        agentId: agents[0]?.id || null,
        agentName: agents[0]?.displayName || (agents.length > 0 ? "Default Agent" : "Unassigned"),
      },
      {
        id: "github",
        name: "GitHub / CI Pipeline",
        token: "github-deploy",
        description: "Optimized for GitHub push, release, and CI/CD events",
        agentId: agents.find((a) => a.name.includes("devops") || a.name.includes("vulcan"))?.id || agents[0]?.id || null,
        agentName: agents.find((a) => a.name.includes("devops") || a.name.includes("vulcan"))?.displayName || agents[0]?.displayName || (agents.length > 0 ? "DevOps Agent" : "Unassigned"),
      },
      {
        id: "monitoring",
        name: "Telemetry & Sentry Alerts",
        token: "monitoring-alert",
        description: "Direct alerts from server telemetry, Datadog, or Sentry",
        agentId: agents.find((a) => a.name.includes("cipher") || a.name.includes("security"))?.id || agents[0]?.id || null,
        agentName: agents.find((a) => a.name.includes("cipher") || a.name.includes("security"))?.displayName || agents[0]?.displayName || (agents.length > 0 ? "Security Agent" : "Unassigned"),
      },
    ];

    // Combine with agent direct endpoints
    const agentEndpoints = agents.map((a) => ({
      id: `agent-${a.id}`,
      name: `${a.displayName} Direct Hook`,
      token: a.id,
      description: `Directly invokes ${a.displayName} (${a.role})`,
      agentId: a.id,
      agentName: a.displayName,
    }));

    // 3. Fetch recent webhook execution activity logs scoped to user
    const logsWhere = await getUserScopedWhere({
      type: {
        in: ["webhook_received", "webhook_triggered", "routine_triggered"],
      },
    });

    const logs = await prisma.activityLog.findMany({
      where: logsWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const agentMap = new Map(agents.map((a) => [a.id, a]));

    return NextResponse.json({
      endpoints: [...standardEndpoints, ...customEndpoints, ...agentEndpoints],
      recentDeliveries: logs.map((log) => ({
        id: log.id,
        type: log.type,
        message: log.message,
        createdAt: log.createdAt,
        agent: log.agentId ? agentMap.get(log.agentId) || null : null,
      })),
      totalDeliveries: logs.length,
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch webhooks info:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhooks metadata", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, token, agentId } = body;

    if (!token || token.length < 3) {
      return NextResponse.json({ error: "Token must be at least 3 characters" }, { status: 400 });
    }

    if (agentId) {
      const agent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({ id: agentId }),
      });
      if (!agent) {
        return NextResponse.json({ error: "Agent not found or unauthorized" }, { status: 404 });
      }
    }

    const settingKey =
      userId !== PRIMARY_LEGACY_USER_ID
        ? `integration:webhooks_config:${userId}`
        : "integration:webhooks_config";

    const webhookSetting = await prisma.setting.findUnique({
      where: { key: settingKey },
    });

    let customEndpoints: Array<{ id: string; name: string; token: string; agentId?: string }> = [];
    if (webhookSetting?.value) {
      try {
        customEndpoints = JSON.parse(webhookSetting.value);
      } catch {
        customEndpoints = [];
      }
    }

    const newEndpoint = {
      id: `custom-${Date.now()}`,
      name: name || `Custom Hook (${token.slice(0, 8)})`,
      token,
      agentId: agentId || null,
    };

    customEndpoints.push(newEndpoint);

    await prisma.setting.upsert({
      where: { key: settingKey },
      create: {
        key: settingKey,
        value: JSON.stringify(customEndpoints),
      },
      update: {
        value: JSON.stringify(customEndpoints),
      },
    });

    await prisma.activityLog.create({
      data: {
        type: "webhook_created",
        message: `Created webhook endpoint "${newEndpoint.name}"`,
        agentId: agentId || null,
        userId,
      },
    });

    return NextResponse.json({ success: true, endpoint: newEndpoint });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create webhook endpoint" },
      { status: 500 }
    );
  }
}
