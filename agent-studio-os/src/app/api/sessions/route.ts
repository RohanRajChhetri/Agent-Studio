import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const search = searchParams.get("search");

    const whereClause: any = {};
    if (agentId) {
      whereClause.agentId = agentId;
    }
    if (search && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { title: { contains: q } },
        { summary: { contains: q } },
        {
          messages: {
            some: {
              content: { contains: q },
            },
          },
        },
      ];
    }

    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            name: true,
            themeColor: true,
          },
        },
        _count: {
          select: { messages: true },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
          select: {
            content: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    });

    const formatted = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      agentId: s.agentId,
      agent: s.agent,
      model: s.model,
      pinned: s.pinned,
      summary: s.summary,
      messageCount: s._count.messages,
      lastMessage: s.messages[0]?.content || null,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("[Sessions GET] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, title, model } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: "agentId is required to create a session" },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    const session = await prisma.chatSession.create({
      data: {
        agentId,
        title: title?.trim() || "New Session",
        model: model || agent.model || null,
      },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            name: true,
            themeColor: true,
          },
        },
      },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          type: "agent_chat",
          message: `Created new session "${session.title}" for ${agent.displayName}`,
          agentId: agent.id,
        },
      });
    } catch {
      // Ignore logging failures
    }

    return NextResponse.json({
      ...session,
      messageCount: 0,
      lastMessage: null,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Sessions POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    );
  }
}
