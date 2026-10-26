import { NextResponse } from "next/server";
import { executeChatCompletion, normalizeModelName } from "@/lib/llm-router";
import { runAgenticLoop } from "@/lib/agentic-tool-loop";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  resolveAgentAndSession,
  persistChatMessages,
  formatApiResponse,
  handleApiError,
} from "@/lib/api-middleware";
import { dispatchAutonomousAction } from "@/lib/autonomous-action-dispatcher";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const sessionId = searchParams.get("sessionId");

    const where: Prisma.ChatMessageWhereInput = {};
    if (sessionId) {
      where.sessionId = sessionId;
    } else if (agentId) {
      where.agentId = agentId;
    }

    const scopedWhere = await getUserScopedWhere(where);

    const messages = await prisma.chatMessage.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return NextResponse.json(messages);
  } catch (error) {
    return handleApiError(error, "API Chat GET", "Failed to fetch chat messages", 500);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    const agentId = searchParams.get("agentId");

    const where: any = {};
    if (sessionId) {
      where.sessionId = sessionId;
    } else if (agentId) {
      where.agentId = agentId;
    }

    const scopedWhere = await getUserScopedWhere(where);
    await prisma.chatMessage.deleteMany({ where: scopedWhere });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "API Chat DELETE", "Failed to clear chat history", 500);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      prompt,
      model,
      agentName,
      agentId,
      sessionId,
      useVaultRAG,
      systemPrompt: customSystemPrompt,
      attachments,
    } = body;

    const images = Array.isArray(attachments)
      ? attachments
          .filter((a: any) => a && (a.type === "image" || a.mimeType?.startsWith("image/")) && a.content)
          .map((a: any) => ({
            mimeType: a.mimeType || "image/png",
            data: a.content,
            name: a.name,
          }))
      : body.images || undefined;

    // 1. Validate prompt with early return
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 2. Resolve agent and active session via reusable middleware
    const { targetAgent, activeSessionId } = await resolveAgentAndSession({
      agentId,
      agentName,
      sessionId,
      prompt,
      effectiveModel: normalizeModelName(model || null),
    });

    const effectiveModel = normalizeModelName(model || targetAgent?.model || null);

    // 3. Autonomous Action Engine: Check if user prompt requests direct fleet action, Kanban execution, or delegation
    const actionResult = await dispatchAutonomousAction(prompt, {
      agentId: targetAgent?.id,
      targetAgent,
      skipActionDispatch: body.skipActionDispatch,
      isCodeWorkspace: body.isCodeWorkspace,
      skipDirectTask: true,
    });

    if (actionResult.handled) {
      // Persist the executed action and output to chat history
      await persistChatMessages({
        agentId: targetAgent?.id,
        sessionId: activeSessionId,
        prompt,
        response: actionResult.content,
        model: effectiveModel,
        latency: 45,
      });

      return NextResponse.json({
        content: actionResult.content,
        agent: {
          id: targetAgent?.id || "autonomous-specialist",
          name: actionResult.agentName || targetAgent?.name || "Specialist",
          displayName: actionResult.agentName || targetAgent?.displayName || "Specialist Agent",
          avatar: actionResult.agentAvatar || targetAgent?.avatar || "zap",
        },
        sessionId: activeSessionId,
        model: effectiveModel,
        latency: 45,
        actionExecuted: actionResult.actionType,
        task: actionResult.task,
        metadata: actionResult.metadata,
      });
    }

    // 3.5 Retrieve conversation history for context continuity
    let sessionHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (activeSessionId) {
      try {
        const dbMessages = await prisma.chatMessage.findMany({
          where: { sessionId: activeSessionId },
          orderBy: { createdAt: "desc" },
          take: 12,
        });
        if (dbMessages.length > 0) {
          sessionHistory = dbMessages.reverse().map((m) => ({
            role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
            content: m.content,
          }));
        }
      } catch (err) {
        console.warn("[API Chat] Error fetching session history:", err);
      }
    }

    // If db had no prior messages for this session yet, fallback to client-provided history
    if (sessionHistory.length === 0 && Array.isArray(body.history) && body.history.length > 0) {
      sessionHistory = body.history
        .filter((h: any) => h && h.content && typeof h.content === "string")
        .slice(-10)
        .map((h: any) => ({
          role: (h.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: h.content,
        }));
    }

    // 4. Primary Execution via Autonomous Agentic Multi-Step Loop
    const loopResult = await runAgenticLoop({
      prompt,
      model: effectiveModel,
      systemPrompt: customSystemPrompt || targetAgent?.systemPrompt || undefined,
      agentName: targetAgent?.name || agentName,
      useVaultRAG,
      history: sessionHistory,
      images,
    });

    // 5. Persist chat messages non-blockingly
    await persistChatMessages({
      agentId: targetAgent?.id,
      sessionId: activeSessionId,
      prompt,
      response: loopResult.content,
      model: effectiveModel,
      latency: loopResult.latency,
    });

    // 6. Standardized response formatting with multiple outputs support
    const baseResponse = formatApiResponse({
      result: {
        content: loopResult.content,
        latency: loopResult.latency,
        modelUsed: loopResult.model,
        source: "omniroute"
      },
      targetAgent,
      fallbackAgentName: agentName,
      activeSessionId,
      effectiveModel,
    });

    // Augment with rich outputs array and executed tools metadata
    return NextResponse.json({
      content: loopResult.content,
      response: loopResult.content,
      message: loopResult.content,
      outputs: loopResult.outputs,
      toolsExecuted: loopResult.toolsExecuted,
      agent: {
        id: targetAgent?.id || "autonomous-specialist",
        name: targetAgent?.name || agentName || "Specialist",
        displayName: targetAgent?.displayName || agentName || "Autonomous Specialist",
        avatar: targetAgent?.avatar || "bot",
      },
      sessionId: activeSessionId,
      model: loopResult.model || effectiveModel,
      latency: loopResult.latency,
    });
  } catch (error) {
    return handleApiError(error, "API Chat POST", "Failed to process chat", 500);
  }
}
