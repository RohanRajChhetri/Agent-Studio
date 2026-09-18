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
 * Multi-Tier Resilient Streaming Engine:
 * Tier 1: Omniroute local gateway (219 models, unified load balancing)
 * Tier 2: Direct Provider Native SSE (Gemini, OpenRouter, Groq, OpenAI, DeepSeek, Anthropic)
 * Tier 3: Cascade Router Fallback with smooth natural micro-chunking
 */
export async function streamUniversalCompletion(
  options: StreamCompletionOptions
): Promise<StreamCompletionResult> {
  const { model, messages, onChunk, signal, systemPrompt, agentName, prompt, history } = options;
  const rawModel = model.trim();

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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          ...extraHeaders,
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
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

  // 2A. Google Gemini Direct Native Streaming
  const isGeminiModel =
    rawModel.startsWith("google/") ||
    rawModel.startsWith("gemini/") ||
    rawModel.includes("gemini") ||
    rawModel.startsWith("auto/");

  if (keys.GEMINI_API_KEY && (isGeminiModel || !keys.OPENROUTER_API_KEY)) {
    let cleanGemini = rawModel
      .replace(/^google\//, "")
      .replace(/^gemini\//, "");

    // Upgrade deprecated or generic model names to active high-speed gemini-3.6-flash
    if (
      cleanGemini.startsWith("auto/") ||
      cleanGemini === "gemini-2.5-flash" ||
      cleanGemini === "gemini-flash" ||
      !cleanGemini
    ) {
      cleanGemini = "gemini-3.6-flash";
    }

    const geminiResult = await tryDirectOpenAI(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      `Bearer ${keys.GEMINI_API_KEY}`,
      cleanGemini,
      "google"
    );

    if (geminiResult) return geminiResult;
  }

  // 2B. OpenRouter Direct Native Streaming
  if (keys.OPENROUTER_API_KEY) {
    let cleanOR = rawModel.replace(/^openrouter\//, "");
    if (cleanOR.startsWith("auto/")) {
      cleanOR = "liquid/lfm-2.5-2.6b:free";
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
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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
