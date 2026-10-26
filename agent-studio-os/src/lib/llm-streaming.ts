import { getActiveApiKeys, executeChatCompletion, type LLMMessage } from "./llm-router";
import { streamChatCompletion as streamOmniroute, isOmnirouteOnline } from "./omniroute";

export interface StreamCompletionOptions {
  model: string;
  messages: LLMMessage[];
  onChunk: (chunk: string) => void | Promise<void>;
  signal?: AbortSignal;
  systemPrompt?: string;
  agentName?: string;
  prompt?: string;
  history?: LLMMessage[];
  images?: Array<{ mimeType: string; data: string; name?: string }>;
}

export interface StreamCompletionResult {
  fullContent: string;
  source:
    | "omniroute"
    | "google"
    | "openrouter"
    | "groq"
    | "openai"
    | "deepseek"
    | "anthropic"
    | "fallback";
  modelUsed: string;
  totalTokens?: number;
}

/**
 * Universal SSE reader for standard OpenAI-compatible endpoints:
 * Buffer-safe chunk parser preventing TCP boundary JSON split corruption.
 */
export async function streamOpenAICompatibleSSE(
  response: Response,
  onChunk: (chunk: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<{ fullContent: string; totalTokens?: number }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body stream is not available");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let totalTokens: number | undefined;

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            await onChunk(delta);
          }
          if (parsed.usage) {
            totalTokens =
              (parsed.usage.prompt_tokens || 0) +
              (parsed.usage.completion_tokens || 0);
          }
        } catch {
          // Incomplete or non-JSON SSE event
        }
      }
    }

    // Process leftover buffer
    if (buffer.trim().startsWith("data:")) {
      const payload = buffer.trim().slice(5).trim();
      if (payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            fullContent += delta;
            await onChunk(delta);
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullContent, totalTokens };
}

/**
 * Stream Anthropic Messages API
 */
async function streamAnthropicSSE(
  response: Response,
  onChunk: (chunk: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<{ fullContent: string; totalTokens?: number }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Anthropic response stream unavailable");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();

        try {
          const parsed = JSON.parse(payload);
          if (parsed.type === "content_block_delta" && parsed.delta?.text) {
            fullContent += parsed.delta.text;
            await onChunk(parsed.delta.text);
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullContent };
}

/**
 * Stream Google Gemini native generateContent SSE endpoint
 */
async function streamGeminiNativeSSE(
  response: Response,
  onChunk: (chunk: string) => void | Promise<void>,
  signal?: AbortSignal
): Promise<{ fullContent: string; totalTokens?: number }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Gemini response stream unavailable");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullContent = "";
  let totalTokens: number | undefined;

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") continue;

        try {
          const parsed = JSON.parse(payload);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullContent += text;
            await onChunk(text);
          }
          if (parsed.usageMetadata) {
            totalTokens = parsed.usageMetadata.totalTokenCount;
          }
        } catch {
          // Incomplete or non-JSON SSE event
        }
      }
    }

    if (buffer.trim().startsWith("data:")) {
      const payload = buffer.trim().slice(5).trim();
      if (payload !== "[DONE]") {
        try {
          const parsed = JSON.parse(payload);
          const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullContent += text;
            await onChunk(text);
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { fullContent, totalTokens };
}

/**
 * Multi-Tier Resilient Streaming Engine:
 * Tier 1: Omniroute local gateway (219 models, unified load balancing)
 * Tier 2: Direct Provider Native SSE (Gemini, OpenRouter, Groq, OpenAI, DeepSeek, Anthropic)
 * Tier 3: Cascade Router Fallback with smooth natural micro-chunking
 */
export async function streamUniversalCompletion(
  options: StreamCompletionOptions
): Promise<StreamCompletionResult> {
  const { model, messages, onChunk, signal, systemPrompt, agentName, prompt, history, images: optionImages } = options;
  const rawModel = model.trim();
  const effectiveImages =
    optionImages && optionImages.length > 0
      ? optionImages
      : messages.find((m) => m.images && m.images.length > 0)?.images;

  // -------------------------------------------------------------
  // Tier 1: Omniroute Gateway Streaming
  // -------------------------------------------------------------
  try {
    const isOnline = await isOmnirouteOnline().catch(() => false);
    if (isOnline) {
      let omniContent = "";
      let omniTokens: number | undefined;

      await streamOmniroute(
        rawModel,
        messages,
        async (chunk) => {
          omniContent += chunk;
          await onChunk(chunk);
        },
        signal
      );

      if (omniContent.trim().length > 0) {
        return {
          fullContent: omniContent,
          source: "omniroute",
          modelUsed: rawModel,
          totalTokens: omniTokens,
        };
      }
    }
  } catch (omniErr) {
    console.warn("[Stream Engine] Tier 1 Omniroute failed, cascading to direct provider:", omniErr);
  }

  if (signal?.aborted) {
    return { fullContent: "", source: "fallback", modelUsed: rawModel };
  }

  // -------------------------------------------------------------
  // Tier 2: Direct Provider Native SSE Streaming
  // -------------------------------------------------------------
  const keys = await getActiveApiKeys();

  // Helper for direct OpenAI-compatible POST
  const tryDirectOpenAI = async (
    endpoint: string,
    authHeader: string,
    targetModel: string,
    source: StreamCompletionResult["source"],
    extraHeaders: Record<string, string> = {}
  ): Promise<StreamCompletionResult | null> => {
    try {
      const formattedMessages = messages.map((m) => {
        const mImgs = m.images || (m.role === "user" ? effectiveImages : undefined);
        if (mImgs && mImgs.length > 0) {
          return {
            role: m.role,
            content: [
              { type: "text", text: m.content },
              ...mImgs.map((img) => ({
                type: "image_url",
                image_url: {
                  url: img.data.startsWith("data:")
                    ? img.data
                    : `data:${img.mimeType || "image/png"};base64,${img.data}`,
                },
              })),
            ],
          };
        }
        return { role: m.role, content: m.content };
      });

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: targetModel,
          messages: formattedMessages,
          stream: true,
        }),
        signal,
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Stream Engine] Direct ${source} error (${res.status}):`, errText);
        return null;
      }

      const { fullContent, totalTokens } = await streamOpenAICompatibleSSE(res, onChunk, signal);
      if (fullContent.trim().length > 0) {
        return {
          fullContent,
          source,
          modelUsed: targetModel,
          totalTokens,
        };
      }
    } catch (err) {
      console.warn(`[Stream Engine] Direct ${source} stream exception:`, err);
    }
    return null;
  };

  // 2A. Google Gemini Native & Direct Streaming
  const isGeminiModel =
    rawModel.startsWith("google/") ||
    rawModel.startsWith("gemini/") ||
    rawModel.includes("gemini") ||
    rawModel.startsWith("auto/");

  if (keys.GEMINI_API_KEY && (isGeminiModel || !keys.OPENROUTER_API_KEY)) {
    let cleanGemini = rawModel
      .replace(/^google\//, "")
      .replace(/^gemini\//, "")
      .replace(/:free$/, "")
      .trim();

    if (
      cleanGemini.startsWith("auto/") ||
      cleanGemini === "gemini-2.5-flash" ||
      cleanGemini === "gemini-flash" ||
      !cleanGemini
    ) {
      cleanGemini = "gemini-flash-latest";
    }

    const candidateGeminiModels = [
      cleanGemini,
      "gemini-flash-latest",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.8-flash",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    const key = keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY;

    // 2A.1 High-speed native Google Generative AI SSE streaming
    for (const targetModel of candidateGeminiModels) {
      try {
        const systemMsg = systemPrompt || messages.find((m) => m.role === "system")?.content;
        const nonSystemMsgs = messages.filter((m) => m.role !== "system");

        const contents = (nonSystemMsgs.length > 0 ? nonSystemMsgs : [{ role: "user" as const, content: prompt || "Hello" }]).map((m) => {
          const parts: any[] = [{ text: m.content || "" }];
          const mImgs = m.images || (m.role === "user" ? effectiveImages : undefined);
          if (mImgs && mImgs.length > 0) {
            for (const img of mImgs) {
              const base64Data = img.data.includes(";base64,")
                ? img.data.split(";base64,")[1]
                : img.data;
              parts.unshift({
                inlineData: {
                  mimeType: img.mimeType || "image/png",
                  data: base64Data,
                },
              });
            }
          }
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        });

        const requestBody: Record<string, unknown> = {
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        };

        if (systemMsg) {
          requestBody.systemInstruction = {
            parts: [{ text: systemMsg }],
          };
        }

        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?alt=sse&key=${key}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal,
          }
        );

        if (res.ok) {
          const { fullContent, totalTokens } = await streamGeminiNativeSSE(res, onChunk, signal);
          if (fullContent.trim().length > 0) {
            return {
              fullContent,
              source: "google",
              modelUsed: targetModel,
              totalTokens,
            };
          }
        }
      } catch (geminiNativeErr) {
        console.warn(`[Stream Engine] Gemini native stream candidate ${targetModel} error:`, geminiNativeErr);
      }
    }

    // 2A.2 OpenAI compatibility endpoint fallback
    for (const targetModel of candidateGeminiModels) {
      const geminiResult = await tryDirectOpenAI(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        `Bearer ${key}`,
        targetModel,
        "google"
      );
      if (geminiResult) return geminiResult;
    }
  }

  // 2B. OpenRouter Direct Native Streaming
  if (keys.OPENROUTER_API_KEY) {
    let cleanOR = rawModel.replace(/^openrouter\//, "");
    if (cleanOR.startsWith("auto/")) {
      cleanOR = (effectiveImages && effectiveImages.length > 0)
        ? "meta-llama/llama-3.2-11b-vision-instruct:free"
        : "liquid/lfm-2.5-2.6b:free";
    }

    const orResult = await tryDirectOpenAI(
      "https://openrouter.ai/api/v1/chat/completions",
      `Bearer ${keys.OPENROUTER_API_KEY}`,
      cleanOR,
      "openrouter",
      {
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Agent Studio OS",
      }
    );

    if (orResult) return orResult;
  }

  // 2C. Groq Turbo Direct Streaming
  if (keys.GROQ_API_KEY && (rawModel.startsWith("groq/") || rawModel.startsWith("auto/"))) {
    let cleanGroq = rawModel.replace(/^groq\//, "");
    if (cleanGroq.startsWith("auto/")) cleanGroq = "llama-3.3-70b-versatile";

    const groqResult = await tryDirectOpenAI(
      "https://api.groq.com/openai/v1/chat/completions",
      `Bearer ${keys.GROQ_API_KEY}`,
      cleanGroq,
      "groq"
    );

    if (groqResult) return groqResult;
  }

  // 2D. OpenAI Direct Streaming
  if (keys.OPENAI_API_KEY && (rawModel.startsWith("openai/") || rawModel.startsWith("gpt-") || rawModel.startsWith("auto/"))) {
    let cleanOpenAI = rawModel.replace(/^openai\//, "");
    if (cleanOpenAI.startsWith("auto/")) cleanOpenAI = "gpt-4o-mini";

    const openaiResult = await tryDirectOpenAI(
      "https://api.openai.com/v1/chat/completions",
      `Bearer ${keys.OPENAI_API_KEY}`,
      cleanOpenAI,
      "openai"
    );

    if (openaiResult) return openaiResult;
  }

  // 2E. Anthropic Claude Direct Streaming
  if (keys.ANTHROPIC_API_KEY && rawModel.startsWith("anthropic/")) {
    try {
      const cleanAnthropic = rawModel.replace(/^anthropic\//, "");
      const anthropicMsgs = messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          const mImgs = m.images || (m.role === "user" ? effectiveImages : undefined);
          if (mImgs && mImgs.length > 0) {
            return {
              role: m.role as "user" | "assistant",
              content: [
                { type: "text", text: m.content },
                ...mImgs.map((img) => {
                  const base64Data = img.data.includes(";base64,")
                    ? img.data.split(";base64,")[1]
                    : img.data;
                  return {
                    type: "image",
                    source: {
                      type: "base64",
                      media_type: img.mimeType || "image/png",
                      data: base64Data,
                    },
                  };
                }),
              ],
            };
          }
          return { role: m.role as "user" | "assistant", content: m.content };
        });

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": keys.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cleanAnthropic || "claude-3-5-haiku-20241022",
          system: systemPrompt || undefined,
          messages: anthropicMsgs,
          max_tokens: 2048,
          stream: true,
        }),
        signal,
      });

      if (res.ok) {
        const { fullContent } = await streamAnthropicSSE(res, onChunk, signal);
        if (fullContent.trim().length > 0) {
          return {
            fullContent,
            source: "anthropic",
            modelUsed: cleanAnthropic,
          };
        }
      }
    } catch (anthropicErr) {
      console.warn("[Stream Engine] Anthropic streaming failed:", anthropicErr);
    }
  }

  // -------------------------------------------------------------
  // Tier 3: Cascade Router Fallback with Micro-Word Streaming
  // -------------------------------------------------------------
  console.log("[Stream Engine] Direct streaming unavailable, engaging Tier 3 Router Cascade fallback...");
  const lastUserMsg = messages.filter((m) => m.role === "user").pop();
  const effectivePrompt = prompt || lastUserMsg?.content || "Hello";

  const fallbackRes = await executeChatCompletion({
    prompt: effectivePrompt,
    history: (history || messages.filter((m) => m.role !== "system")).slice(-8),
    model: rawModel,
    systemPrompt: systemPrompt || messages.find((m) => m.role === "system")?.content,
    agentName,
    useVaultRAG: false,
    useEpisodicMemory: false,
    images: effectiveImages,
  });

  const fullContent = fallbackRes.content || "I have received your message and processed it.";

  // Emit word chunks with micro-delays for smooth visual presentation
  const words = fullContent.split(" ");
  for (let i = 0; i < words.length; i += 2) {
    if (signal?.aborted) break;
    const piece = words.slice(i, i + 2).join(" ") + (i + 2 < words.length ? " " : "");
    await onChunk(piece);
    await new Promise((r) => setTimeout(r, 15));
  }

  return {
    fullContent,
    source: "fallback",
    modelUsed: fallbackRes.modelUsed || rawModel,
    totalTokens: fallbackRes.usage?.total_tokens,
  };
}
