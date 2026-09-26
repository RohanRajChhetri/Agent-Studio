import type { LLMMessage, LLMResponse, PromptIntent } from "../router-types";
import { BaseLLMProvider } from "./base-provider";

/** Google Gemini Provider */
export class GeminiProvider extends BaseLLMProvider {
  id = "google";
  name = "Google Gemini";

  isAvailable(keys: Record<string, string>): boolean {
    return Boolean(keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY);
  }

  isPreferredForIntent(intent: PromptIntent): number {
    switch (intent) {
      case "reasoning":
        return 95;
      case "chat":
        return 90;
      case "coding":
        return 80;
      case "creative":
        return 85;
      default:
        return 80;
    }
  }

  matchesModel(rawModel: string): boolean {
    return (
      rawModel.includes("gemini") ||
      rawModel.startsWith("google/") ||
      rawModel === "auto/smart" ||
      rawModel === "auto/fast"
    );
  }

  /** Normalize model name to valid Google Generative AI production identifiers */
  normalizeGeminiModel(rawModel: string): string {
    const clean = rawModel
      .replace(/^google\//, "")
      .replace(/^gemini\//, "")
      .replace(/:free$/, "")
      .trim()
      .toLowerCase();

    if (clean.includes("pro-latest") || clean.includes("3.1-pro")) {
      return "gemini-pro-latest";
    }
    if (clean.includes("3.8")) {
      return "gemini-3.8-flash";
    }
    if (clean.includes("3.7")) {
      return "gemini-3.7-flash";
    }
    if (clean.includes("flash-latest") || clean === "gemini-flash") {
      return "gemini-flash-latest";
    }
    if (clean.includes("3.6")) {
      return "gemini-3.6-flash";
    }
    if (clean.includes("3.5")) {
      return "gemini-3.5-flash";
    }
    // High-reliability default with full current generation capacity
    return "gemini-3.5-flash";
  }

  async call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    systemPrompt?: string
  ): Promise<LLMResponse | null> {
    const key = keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY;
    if (!key) return null;

    const start = Date.now();
    const primaryModel = this.normalizeGeminiModel(model);
    const candidateModels = [
      primaryModel,
      "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-flash-latest",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    // Extract system instructions and conversation contents
    const systemMessages = messages.filter((m) => m.role === "system");
    const nonSystemMessages = messages.filter((m) => m.role !== "system");

    const effectiveSystemPrompt =
      systemPrompt ||
      systemMessages.map((m) => m.content).join("\n\n") ||
      undefined;

    // Ensure we have at least one user message
    const formattedMessages =
      nonSystemMessages.length > 0
        ? nonSystemMessages
        : [{ role: "user" as const, content: "Hello" }];

    for (const targetModel of candidateModels) {
      try {
        const result = await this.executeWithTimeout(async (signal) => {
          // 1. High-speed Google native generateContent endpoint (preferred)
          try {
            const contents = formattedMessages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            }));

            const requestBody: Record<string, unknown> = {
              contents,
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              },
            };

            if (effectiveSystemPrompt) {
              requestBody.systemInstruction = {
                parts: [{ text: effectiveSystemPrompt }],
              };
            }

            const nativeRes = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${key}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody),
                signal,
              }
            );

            if (nativeRes.ok) {
              const nData = await nativeRes.json();
              const content = nData.candidates?.[0]?.content?.parts?.[0]?.text || "";
              if (content) {
                return {
                  content,
                  latency: Date.now() - start,
                  source: "google" as const,
                  modelUsed: targetModel,
                };
              }
            } else if (nativeRes.status === 429) {
              // Quota/Rate limit exceeded for project — fail fast so cascade can switch to available providers immediately
              return null;
            }
          } catch {
            // Fall through to OpenAI-compatible endpoint
          }

          // 2. OpenAI-compatible endpoint fallback
          try {
            const openAiMessages = [
              ...(effectiveSystemPrompt
                ? [{ role: "system", content: effectiveSystemPrompt }]
                : []),
              ...formattedMessages,
            ];

            const res = await fetch(
              "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: targetModel,
                  messages: openAiMessages,
                  temperature: 0.7,
                }),
                signal,
              }
            );

            if (res.ok) {
              const data = await res.json();
              const content = data.choices?.[0]?.message?.content || "";
              if (content) {
                return {
                  content,
                  latency: Date.now() - start,
                  source: "google" as const,
                  modelUsed: targetModel,
                  usage: data.usage,
                };
              }
            } else if (res.status === 429) {
              return null;
            }
          } catch {
            // Ignore and try next candidate
          }

          return null;
        }, 18000);

        if (result) return result;
      } catch {
        // Try next candidate model
      }
    }

    return null;
  }
}

