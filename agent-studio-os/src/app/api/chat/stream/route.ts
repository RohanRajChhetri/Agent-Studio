import { NextResponse } from "next/server";
import { normalizeModelName, buildDefaultSystemPrompt } from "@/lib/llm-router";
import { parseToolCalls, executeTool } from "@/lib/agentic-tool-loop";
import { compileAndDeliverFile } from "@/lib/file-deliverable-engine";
import { streamUniversalCompletion } from "@/lib/llm-streaming";
import { queryVaultRAG, formatRAGPromptContext } from "@/lib/rag";
import { formatEpisodicMemoryPrompt } from "@/lib/episodic-memory";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere, getAuthUserId } from "@/lib/user-auth";

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
    const userId = await getAuthUserId();

    // 1. Resolve agent profile from database scoped to user
    let targetAgent = null;
    if (agentId || agentName) {
      targetAgent = await prisma.agent.findFirst({
        where: await getUserScopedWhere({
          OR: [
            ...(agentId ? [{ id: agentId }] : []),
            ...(agentName ? [{ name: agentName }, { displayName: agentName }] : []),
          ],
        }),
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
          where: await getUserScopedWhere({ agentId: targetAgent.id }),
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
              userId,
            },
          });
          activeSessionId = newSession.id;
        }
      } else {
        try {
          const existingSession = await prisma.chatSession.findFirst({
            where: await getUserScopedWhere({ id: activeSessionId }),
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
          } else {
            // Specified session does not belong to user, create isolated session
            const title = prompt.slice(0, 45).replace(/[\r\n]+/g, " ").trim() || "New Session";
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
    let validHistory = Array.isArray(history)
      ? history
          .filter((h: any) => h && h.content && typeof h.content === "string" && h.content.trim())
          .slice(-8)
          .map((h: any) => ({
            role: (h.role === "user" ? "user" : "assistant") as "user" | "assistant",
            content: h.content,
          }))
      : [];

    if (validHistory.length === 0 && activeSessionId) {
      try {
        const dbMsgs = await prisma.chatMessage.findMany({
          where: { sessionId: activeSessionId },
          orderBy: { createdAt: "desc" },
          take: 8,
        });
        validHistory = dbMsgs.reverse().map((m) => ({
          role: (m.role === "assistant" ? "assistant" : "user") as "user" | "assistant",
          content: m.content,
        }));
      } catch (dbHistErr) {
        console.warn("[Stream API] Error reading history:", dbHistErr);
      }
    }

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
        let isWriterClosed = false;
        const safeWrite = async (data: string) => {
          if (isWriterClosed) return;
          try {
            await writer.write(encoder.encode(data));
          } catch {
            isWriterClosed = true;
          }
        };

        // Send initial start event immediately so client is active
        await safeWrite(
          `data: ${JSON.stringify({
            type: "start",
            model: effectiveModel,
            agent: targetAgent?.displayName || "Specialist Agent",
            sessionId: activeSessionId,
            citations,
          })}\n\n`
        );

        let result: any = { fullContent: "" };
        try {
          result = await streamUniversalCompletion({
            model: effectiveModel,
            messages,
            prompt,
            history: validHistory,
            systemPrompt: augmentedSystem,
            agentName: targetAgent?.name,
            // Do not pass abort signal directly to LLM so generation can complete in background if user switches pages
            onChunk: async (chunk) => {
              fullContent += chunk;
              await safeWrite(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`);
            },
          });
          fullContent = result.fullContent || fullContent;
        } catch (llmErr) {
          console.warn("[Stream API] LLM stream partial completion:", llmErr);
        }

        // Check if the stream emitted tool calls (such as file.create, web, etc.)
        const toolCalls = parseToolCalls(fullContent);
        let deliverableLink = "";

        if (toolCalls.length > 0) {
          let resolvedBody = "";

          for (const tc of toolCalls) {
            try {
              const execResult = await executeTool(tc);
              if (execResult.metadata?.fileUrl) {
                deliverableLink = `\n\n### 📄 Deliverable Ready for Download\n\n- **File**: \`${execResult.metadata.path}\`\n- **Direct Download**: [Download ${execResult.metadata.path}](${execResult.metadata.fileUrl})\n\n> You can open this file directly in Microsoft Word, Google Docs, or any text editor.`;
              }
              if (execResult.metadata?.content) {
                resolvedBody = execResult.metadata.content;
              }
            } catch (toolErr) {
              console.warn("[Stream API] Tool execution error:", toolErr);
            }
          }

          if (resolvedBody) {
            fullContent = resolvedBody + deliverableLink;
          } else {
            // Clean unparsed tool tokens
            fullContent = fullContent
              .replace(/<\|tool_call[_:](?:start|begin)\|?>[\s\S]*?<\|tool_call[_:](?:end|finish)\|?>/gi, "")
              .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
              .trim();
            if (deliverableLink) fullContent += deliverableLink;
          }
        }

        // Automatic File Deliverable Compiler: Ensure requested PDF/Doc/CSV files are compiled and delivered
        try {
          const autoDeliverable = await compileAndDeliverFile({
            userPrompt: prompt,
            assistantContent: fullContent,
          });

          if (autoDeliverable && autoDeliverable.hasDeliverable) {
            if (!fullContent.includes(autoDeliverable.fileUrl)) {
              await safeWrite(
                `data: ${JSON.stringify({
                  type: "chunk",
                  text: autoDeliverable.downloadCardMarkdown,
                })}\n\n`
              );
              fullContent = autoDeliverable.cleanedContent || `${fullContent}${autoDeliverable.downloadCardMarkdown}`;
            }
          }
        } catch (delivErr) {
          console.warn("[Stream API] Auto deliverable error:", delivErr);
        }

        const latency = Date.now() - start;
        const actualModelUsed = result?.modelUsed || effectiveModel;

        // Persist to database (ensuring user prompt & generated content are recorded even if user navigated away)
        if (targetAgent?.id && fullContent.trim()) {
          try {
            await prisma.chatMessage.create({
              data: {
                agentId: targetAgent.id,
                sessionId: activeSessionId,
                role: "user",
                content: prompt,
                model: actualModelUsed,
                userId,
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
                userId,
              },
            });
          } catch (dbErr) {
            console.warn("[Stream API] Failed to persist message:", dbErr);
          }
        }

        // Send done signal
        await safeWrite(
          `data: ${JSON.stringify({
            type: "done",
            fullText: fullContent,
            latency,
            sessionId: activeSessionId,
            source: result?.source,
            modelUsed: actualModelUsed,
            totalTokens: result?.totalTokens,
          })}\n\n`
        );
        await safeWrite("data: [DONE]\n\n");
      } catch (streamErr) {
        console.error("[Stream API] Execution error:", streamErr);
        try {
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
        } catch {
          // Socket already closed, ignore
        }
      } finally {
        try {
          await writer.close();
        } catch {
          // Already closed
        }
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
