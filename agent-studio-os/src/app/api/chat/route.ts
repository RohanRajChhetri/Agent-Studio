import { NextResponse } from "next/server";
import { executeChatCompletion, normalizeModelName } from "@/lib/llm-router";
import { runOneshot } from "@/lib/hermes";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const sessionId = searchParams.get("sessionId");

    const where: any = {};
    if (sessionId) {
      where.sessionId = sessionId;
    } else if (agentId) {
      where.agentId = agentId;
    }

    const messages = await prisma.chatMessage.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat messages" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const agentId = searchParams.get("agentId");

    if (sessionId) {
      await prisma.chatMessage.deleteMany({ where: { sessionId } });
    } else if (agentId) {
      await prisma.chatMessage.deleteMany({ where: { agentId } });
    } else {
      await prisma.chatMessage.deleteMany({});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const {
      prompt,
      model,
      agentName,
      agentId,
      sessionId,
      useVaultRAG,
      systemPrompt: customSystemPrompt,
    } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const start = Date.now();
    let targetAgent = null;

    // 1. Resolve agent profile from database
    if (agentId || agentName) {
      targetAgent = await prisma.agent.findFirst({
        where: {
          OR: [
            ...(agentId ? [{ id: agentId }] : []),
            ...(agentName ? [{ name: agentName }, { displayName: agentName }] : []),
          ],
        },
        include: { tools: true },
      });
    }

    const effectiveModel = normalizeModelName(
      model || targetAgent?.model || null
    );

    // 2. Resolve or create ChatSession
    let activeSessionId = sessionId || null;
    if (targetAgent?.id) {
      if (!activeSessionId) {
        // Find most recent session or create new
        const latestSession = await prisma.chatSession.findFirst({
          where: { agentId: targetAgent.id },
          orderBy: { updatedAt: "desc" },
        });

        if (latestSession) {
          activeSessionId = latestSession.id;
        } else {
          const title = prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim() || "New Session";
          const newSession = await prisma.chatSession.create({
            data: {
              agentId: targetAgent.id,
              title,
              model: effectiveModel,
            },
          });
          activeSessionId = newSession.id;
        }
      } else {
        // Check if session exists; if title is "New Session", auto-title it
        try {
          const existingSession = await prisma.chatSession.findUnique({
            where: { id: activeSessionId },
            include: { _count: { select: { messages: true } } },
          });

          if (existingSession) {
            const shouldAutoTitle =
              existingSession.title === "New Session" ||
              existingSession._count.messages === 0;

            const autoTitle = prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim();
            await prisma.chatSession.update({
              where: { id: activeSessionId },
              data: {
                ...(shouldAutoTitle && autoTitle ? { title: autoTitle } : {}),
                updatedAt: new Date(),
              },
            });
          }
        } catch {
          // Ignore session title update errors
        }
      }
    }

    // 3. Primary Execution: Execute via LLM Router (Omniroute Primary Brain)
    const result = await executeChatCompletion({
      prompt,
      model: effectiveModel,
      systemPrompt: customSystemPrompt || targetAgent?.systemPrompt || undefined,
      agentName: targetAgent?.name || agentName,
    });

    const responseText = result.content;
    const source = result.source;
    const latency = result.latency || Date.now() - start;

    // 4. Save to chat history linked to session
    try {
      if (targetAgent?.id) {
        await prisma.chatMessage.create({
          data: {
            agentId: targetAgent.id,
            sessionId: activeSessionId,
            role: "user",
            content: prompt,
            model: effectiveModel,
          },
        });

        await prisma.chatMessage.create({
          data: {
            agentId: targetAgent.id,
            sessionId: activeSessionId,
            role: "assistant",
            content: responseText,
            model: effectiveModel,
            latency,
          },
        });
      }
    } catch (saveErr) {
      console.warn("Failed to persist chat message:", saveErr);
    }

    return NextResponse.json({
      response: responseText,
      message: responseText,
      content: responseText,
      latency,
      source,
      model: effectiveModel,
      agentName: targetAgent?.displayName || agentName || "Hermes Agent",
      agentId: targetAgent?.id || null,
      sessionId: activeSessionId,
      hermesProfile: targetAgent?.name || "default",
    });
  } catch (error) {
    console.error("[API Chat] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to process chat",
        response:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
