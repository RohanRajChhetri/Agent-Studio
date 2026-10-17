import { NextResponse } from "next/server";
import type { Agent, AgentTool } from "@prisma/client";
import { prisma } from "./prisma";
import type { LLMResponse } from "./router-types";
import { getUserScopedWhere, getAuthUserId } from "./user-auth";

export type AgentWithTools = Agent & { tools?: AgentTool[] };

export interface ResolvedAgentSession {
  targetAgent: AgentWithTools | null;
  activeSessionId: string | null;
}

/**
 * Resolves an agent by ID or Name, and resolves or initializes an active ChatSession.
 */
export async function resolveAgentAndSession(params: {
  agentId?: string | null;
  agentName?: string | null;
  sessionId?: string | null;
  prompt?: string;
  effectiveModel?: string;
}): Promise<ResolvedAgentSession> {
  const { agentId, agentName, sessionId, prompt, effectiveModel = "auto/fast" } = params;
  const userId = await getAuthUserId();

  let targetAgent: AgentWithTools | null = null;

  // 1. Resolve agent profile scoped to current user
  if (agentId || agentName) {
    targetAgent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({
        OR: [
          ...(agentId ? [{ id: agentId }] : []),
          ...(agentName ? [{ name: agentName }, { displayName: agentName }] : []),
        ],
      }),
      include: { tools: true },
    });
  }

  // 2. Resolve or create ChatSession
  let activeSessionId = sessionId || null;
  if (targetAgent?.id) {
    if (activeSessionId) {
      try {
        const existingSession = await prisma.chatSession.findFirst({
          where: await getUserScopedWhere({ id: activeSessionId }),
          include: { _count: { select: { messages: true } } },
        });

        if (!existingSession) {
          // Passed sessionId doesn't exist, create a clean session
          const title = prompt
            ? prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim() || "New Session"
            : "New Session";
          const newSession = await prisma.chatSession.create({
            data: {
              agentId: targetAgent.id,
              title,
              model: effectiveModel,
              userId,
            },
          });
          activeSessionId = newSession.id;
        } else if (prompt) {
          // Re-use session and auto-title if empty
          const shouldAutoTitle =
            existingSession.title === "New Session" ||
            existingSession._count.messages === 0;

          const autoTitle = prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim();
          if (shouldAutoTitle && autoTitle) {
            await prisma.chatSession.update({
              where: { id: activeSessionId },
              data: {
                title: autoTitle,
                updatedAt: new Date(),
              },
            }).catch(() => {});
          }
        }
      } catch {
        // Fallback on lookup failure
      }
    } else {
      // Always create a new session for brand new conversations
      const title = prompt
        ? prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim() || "New Session"
        : "New Session";
      const newSession = await prisma.chatSession.create({
        data: {
          agentId: targetAgent.id,
          title,
          model: effectiveModel,
          userId,
        },
      });
      activeSessionId = newSession.id;
    }
  }

  return { targetAgent, activeSessionId };
}

/**
 * Persist user and assistant chat messages into the database
 */
export async function persistChatMessages(params: {
  agentId?: string | null;
  sessionId?: string | null;
  prompt: string;
  response: string;
  model: string;
  latency: number;
}): Promise<void> {
  const { agentId, sessionId, prompt, response, model, latency } = params;
  if (!agentId) return;

  try {
    const userId = await getAuthUserId();

    // Validate agent exists before creating messages (prevents FK P2003 error)
    const agentExists = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agentExists) {
      console.warn(`[API Middleware] Agent ${agentId} not found, skipping message persistence`);
      return;
    }

    // Validate session exists if provided (prevents FK P2003 error)
    let validSessionId = sessionId || null;
    if (validSessionId) {
      const sessionExists = await prisma.chatSession.findUnique({ where: { id: validSessionId }, select: { id: true } });
      if (!sessionExists) {
        console.warn(`[API Middleware] Session ${validSessionId} not found, creating new session`);
        try {
          const newSession = await prisma.chatSession.create({
            data: {
              agentId,
              title: prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim() || "New Session",
              model,
              userId,
            },
          });
          validSessionId = newSession.id;
        } catch {
          validSessionId = null;
        }
      }
    }

    await prisma.chatMessage.create({
      data: {
        agentId,
        sessionId: validSessionId,
        role: "user",
        content: prompt,
        model,
        userId,
      },
    });

    await prisma.chatMessage.create({
      data: {
        agentId,
        sessionId: validSessionId,
        role: "assistant",
        content: response,
        model,
        latency,
        userId,
      },
    });
  } catch (saveErr) {
    console.warn("[API Middleware] Failed to persist chat message:", saveErr);
  }
}

/**
 * Formats a successful chat completion API response envelope
 */
export function formatApiResponse(params: {
  result: LLMResponse;
  targetAgent?: AgentWithTools | null;
  fallbackAgentName?: string;
  activeSessionId?: string | null;
  effectiveModel: string;
}): NextResponse {
  const { result, targetAgent, fallbackAgentName, activeSessionId, effectiveModel } = params;
  const responseText = result.content;

  return NextResponse.json({
    response: responseText,
    message: responseText,
    content: responseText,
    latency: result.latency,
    source: result.source,
    model: effectiveModel,
    agentName: targetAgent?.displayName || fallbackAgentName || "Hermes Agent",
    agentId: targetAgent?.id || null,
    sessionId: activeSessionId,
    hermesProfile: targetAgent?.name || "default",
    ragCitations: result.ragCitations,
    toolCalls: result.toolCalls,
  });
}

/**
 * Standardized API error handling wrapper returning JSON responses
 */
export function handleApiError(
  error: unknown,
  context: string = "API",
  userMessage: string = "Failed to process request",
  statusCode: number = 500
): NextResponse {
  console.error(`[${context}] Error:`, error);
  const errorMessage = error instanceof Error ? error.message : "Unknown server error";

  return NextResponse.json(
    {
      error: userMessage,
      response: errorMessage,
    },
    { status: statusCode }
  );
}
