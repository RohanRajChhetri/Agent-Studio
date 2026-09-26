import type { LLMMessage, LLMResponse, PromptIntent } from "../router-types";
import { BaseLLMProvider } from "./base-provider";

/** Groq Provider */
export class GroqProvider extends BaseLLMProvider {
  id = "groq";
  name = "Groq Turbo";

  isAvailable(keys: Record<string, string>): boolean {
    return Boolean(keys.GROQ_API_KEY);
  }

  isPreferredForIntent(intent: PromptIntent): number {
    switch (intent) {
      case "chat":
        return 88;
      case "coding":
        return 75;
      case "reasoning":
        return 70;
      case "creative":
        return 75;
      default:
        return 75;
    }
  }

  matchesModel(rawModel: string): boolean {
    return rawModel.startsWith("groq/") || rawModel.includes("llama");
  }

  async call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    _systemPrompt?: string
  ): Promise<LLMResponse | null> {
    const key = keys.GROQ_API_KEY;
    if (!key) return null;
    void _systemPrompt;

    const start = Date.now();
    const cleanModel = model
      .replace(/^groq\//, "")
      .replace(/^auto\/.*/, "llama-3.3-70b-versatile");

    try {
      return await this.executeWithTimeout(async (signal) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cleanModel,
            messages,
          }),
          signal,
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || "";
          if (content) {
            return {
              content,
              latency: Date.now() - start,
              source: "groq",
              modelUsed: cleanModel,
              usage: data.usage,
            };
          }
        }
        return null;
      }, 16000);
    } catch (err) {
      return this.handleError(err, this.name);
    }
  }
}
