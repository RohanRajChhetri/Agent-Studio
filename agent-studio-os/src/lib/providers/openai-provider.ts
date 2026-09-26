import type { LLMMessage, LLMResponse, PromptIntent } from "../router-types";
import { BaseLLMProvider } from "./base-provider";

/** OpenAI Provider */
export class OpenAIProvider extends BaseLLMProvider {
  id = "openai";
  name = "OpenAI";

  isAvailable(keys: Record<string, string>): boolean {
    return Boolean(keys.OPENAI_API_KEY);
  }

  isPreferredForIntent(intent: PromptIntent): number {
    switch (intent) {
      case "coding":
        return 95;
      case "reasoning":
        return 88;
      case "creative":
        return 90;
      case "chat":
        return 85;
      default:
        return 85;
    }
  }

  matchesModel(rawModel: string): boolean {
    return rawModel.startsWith("openai/") || rawModel.startsWith("gpt-");
  }

  async call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    _systemPrompt?: string
  ): Promise<LLMResponse | null> {
    const key = keys.OPENAI_API_KEY;
    if (!key) return null;
    void _systemPrompt;

    const start = Date.now();
    const cleanModel = model
      .replace(/^openai\//, "")
      .replace(/^auto\/.*/, "gpt-4o-mini");

    try {
      return await this.executeWithTimeout(async (signal) => {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
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
              source: "openai",
              modelUsed: cleanModel,
              usage: data.usage,
            };
          }
        }
        return null;
      }, 20000);
    } catch (err) {
      return this.handleError(err, this.name);
    }
  }
}
