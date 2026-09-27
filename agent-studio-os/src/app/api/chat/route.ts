import { NextResponse } from "next/server";
import { executeChatCompletion, normalizeModelName } from "@/lib/llm-router";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  resolveAgentAndSession,
  persistChatMessages,
  formatApiResponse,
  handleApiError,
} from "@/lib/api-middleware";
import { dispatchAutonomousAction } from "@/lib/autonomous-action-dispatcher";

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

    const messages = await prisma.chatMessage.findMany({
      where,
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

    if (sessionId) {
      await prisma.chatMessage.deleteMany({ where: { sessionId } });
    } else if (agentId) {
      await prisma.chatMessage.deleteMany({ where: { agentId } });
    } else {
      await prisma.chatMessage.deleteMany({});
    }

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
    } = body;

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
          avatar: actionResult.agentAvatar || targetAgent?.avatar || "⚡",
        },
        sessionId: activeSessionId,
        model: effectiveModel,
        latency: 45,
        actionExecuted: actionResult.actionType,
        task: actionResult.task,
        metadata: actionResult.metadata,
      });
    }

    // 4. Primary Execution via Universal LLM Router
    const result = await executeChatCompletion({
      prompt,
      model: effectiveModel,
      systemPrompt: customSystemPrompt || targetAgent?.systemPrompt || undefined,
      agentName: targetAgent?.name || agentName,
      useVaultRAG,
    });

    // 4. Persist chat messages non-blockingly
    await persistChatMessages({
      agentId: targetAgent?.id,
      sessionId: activeSessionId,
      prompt,
      response: result.content,
      model: effectiveModel,
      latency: result.latency,
    });

    // 5. Standardized response formatting
    return formatApiResponse({
      result,
      targetAgent,
      fallbackAgentName: agentName,
      activeSessionId,
      effectiveModel,
    });
  } catch (error) {
    return handleApiError(error, "API Chat POST", "Failed to process chat", 500);
  }
}
