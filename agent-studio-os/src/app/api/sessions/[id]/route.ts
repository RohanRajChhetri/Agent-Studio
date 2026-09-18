import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        agent: {
          select: {
            id: true,
            displayName: true,
            avatar: true,
            name: true,
            themeColor: true,
            systemPrompt: true,
            model: true,
            description: true,
          },
        },
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...session,
      messageCount: session.messages.length,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Session GET ID] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const body = await request.json();
    const { title, pinned, summary, model } = body;

    const dataToUpdate: any = {};
    if (typeof title === "string" && title.trim()) {
      dataToUpdate.title = title.trim();
    }
    if (typeof pinned === "boolean") {
      dataToUpdate.pinned = pinned;
    }
    if (typeof summary === "string") {
      dataToUpdate.summary = summary.trim();
    }
    if (typeof model === "string") {
      dataToUpdate.model = model;
    }

    const updated = await prisma.chatSession.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error("[Session PATCH] Error:", error);
    return NextResponse.json(
      { error: "Failed to update chat session" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;

    const existing = await prisma.chatSession.findUnique({
      where: { id },
      select: { id: true, title: true, agentId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Chat session not found" },
        { status: 404 }
      );
    }

    await prisma.chatSession.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: `Deleted session "${existing.title}"`,
    });
  } catch (error) {
    console.error("[Session DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
}
