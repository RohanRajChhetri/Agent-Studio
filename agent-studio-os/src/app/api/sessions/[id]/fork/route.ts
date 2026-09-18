import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    let customTitle: string | undefined;

    try {
      const body = await request.json();
      customTitle = body?.title;
    } catch {
      // Body is optional
    }

    const sourceSession = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        agent: true,
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!sourceSession) {
      return NextResponse.json(
        { error: "Source chat session not found" },
        { status: 404 }
      );
    }

    const forkTitle = customTitle?.trim() || `Branch: ${sourceSession.title}`;

    // Create cloned session
    const forkedSession = await prisma.chatSession.create({
      data: {
        agentId: sourceSession.agentId,
        title: forkTitle,
        model: sourceSession.model,
        summary: sourceSession.summary,
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

    // Clone all messages
    if (sourceSession.messages.length > 0) {
      await prisma.chatMessage.createMany({
        data: sourceSession.messages.map((m) => ({
          sessionId: forkedSession.id,
          agentId: m.agentId,
          role: m.role,
          content: m.content,
          model: m.model,
          latency: m.latency,
          tokens: m.tokens,
          createdAt: m.createdAt,
        })),
      });
    }

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          type: "agent_chat",
          message: `Forked conversation "${sourceSession.title}" into "${forkedSession.title}"`,
          agentId: sourceSession.agentId,
        },
      });
    } catch {
      // Ignore
    }

    return NextResponse.json({
      ...forkedSession,
      messageCount: sourceSession.messages.length,
      lastMessage: sourceSession.messages[sourceSession.messages.length - 1]?.content || null,
      createdAt: forkedSession.createdAt.toISOString(),
      updatedAt: forkedSession.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Session Fork] Error:", error);
    return NextResponse.json(
      { error: "Failed to fork chat session" },
      { status: 500 }
    );
  }
}
