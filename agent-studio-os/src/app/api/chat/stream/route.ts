import { NextResponse } from "next/server";
import { normalizeModelName, buildDefaultSystemPrompt } from "@/lib/llm-router";
import { streamUniversalCompletion } from "@/lib/llm-streaming";
import { queryVaultRAG, formatRAGPromptContext } from "@/lib/rag";
import { formatEpisodicMemoryPrompt } from "@/lib/episodic-memory";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const {
      prompt,
      model,
      agentName,
      agentId,
      sessionId,
      useVaultRAG = true,
      useEpisodicMemory = true,
      history = [],
    } = await request.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const start = Date.now();

    // 1. Resolve agent profile from database
    let targetAgent = null;
    if (agentId || agentName) {
      targetAgent = await prisma.agent.findFirst({
        where: {
          OR: [
            ...(agentId ? [{ id: agentId }] : []),
            ...(agentName ? [{ name: agentName }, { displayName: agentName }] : []),
          ],
        },
      });
    }

    const effectiveModel = normalizeModelName(
      model || targetAgent?.model || "auto/fast"
    );

    // 2. Resolve or create ChatSession
    let activeSessionId = sessionId || null;
    if (targetAgent?.id) {
      if (!activeSessionId) {
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
          // Ignore auto-titling errors
        }
      }
    }

    // 3. Prepare Context (Elite System Prompt + RAG + Episodic Memory)
    let augmentedSystem = buildDefaultSystemPrompt({
      agentName: targetAgent?.displayName || targetAgent?.name,
      role: targetAgent?.role,
      systemPrompt: targetAgent?.systemPrompt,
      description: targetAgent?.description,
    });
    let citations: Array<{ title: string; relPath: string; excerpt: string }> = [];

    if (useVaultRAG) {
      try {
        const ragChunks = await queryVaultRAG(prompt, { limit: 3 });
        if (ragChunks.length > 0) {
          augmentedSystem += formatRAGPromptContext(ragChunks);
          citations = ragChunks
            .filter((c) => c.score >= 5.0)
            .map((c) => ({
              title: c.title,
              relPath: c.relPath,
              excerpt: c.excerpt,
            }));
        }
      } catch (ragErr) {
        console.warn("[Stream API] RAG query error:", ragErr);
      }
    }

    if (useEpisodicMemory && targetAgent?.name) {
      try {
        const memorySnippet = await formatEpisodicMemoryPrompt(targetAgent.name);
        if (memorySnippet) {
          augmentedSystem += memorySnippet;
        }
      } catch (memErr) {
        console.warn("[Stream API] Episodic memory error:", memErr);
      }
    }

    // Format conversation history turns for LLM context (last 8 turns max to avoid token blowout)
    const validHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && h.content && typeof h.content === "string" && h.content.trim())
          .slice(-8)
          .map((h: any) => ({
            role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: h.content,
          }))
      : [];

    const messages = [
      { role: "system" as const, content: augmentedSystem },
      ...validHistory,
      { role: "user" as const, content: prompt },
    ];

    // Prepare TransformStream for SSE
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    const encoder = new TextEncoder();

    // Async worker to produce SSE chunks
    (async () => {
      let fullContent = "";
      try {
        // Send initial start event immediately so client is active
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "start",
              model: effectiveModel,
              agentName: targetAgent?.displayName || "Agent",
              sessionId: activeSessionId,
              citations,
            })}\n\n`
          )
        );

        const result = await streamUniversalCompletion({
          model: effectiveModel,
          messages,
          prompt,
          history: validHistory,
          systemPrompt: augmentedSystem,
          agentName: targetAgent?.name,
          signal: request.signal,
          onChunk: async (chunk) => {
            fullContent += chunk;
            await writer.write(
              encoder.encode(
                `data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`
              )
            );
          },
        });
        fullContent = result.fullContent;

        const latency = Date.now() - start;
        const actualModelUsed = result.modelUsed || effectiveModel;

        // Persist to database
        if (targetAgent?.id) {
          try {
            await prisma.chatMessage.create({
              data: {
                agentId: targetAgent.id,
                sessionId: activeSessionId,
                role: "user",
                content: prompt,
                model: actualModelUsed,
              },
            });

            await prisma.chatMessage.create({
              data: {
                agentId: targetAgent.id,
                sessionId: activeSessionId,
                role: "assistant",
                content: fullContent,
                model: actualModelUsed,
                latency,
              },
            });
          } catch (dbErr) {
            console.warn("[Stream API] Failed to persist message:", dbErr);
          }
        }

        // Send done signal
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              fullText: fullContent,
              latency,
              sessionId: activeSessionId,
              source: result.source,
              modelUsed: actualModelUsed,
              totalTokens: result.totalTokens,
            })}\n\n`
          )
        );
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } catch (streamErr) {
        console.error("[Stream API] Execution error:", streamErr);
        await writer.write(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "error",
              error:
                streamErr instanceof Error
                  ? streamErr.message
                  : "Streaming error occurred",
            })}\n\n`
          )
        );
        await writer.write(encoder.encode("data: [DONE]\n\n"));
      } finally {
        await writer.close();
      }
    })();

    return new Response(stream.readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Stream API] Handler error:", error);
    return NextResponse.json(
      { error: "Failed to initiate stream" },
      { status: 500 }
    );
  }
}
