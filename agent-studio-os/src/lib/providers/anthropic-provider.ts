import type { LLMMessage, LLMResponse, PromptIntent } from "../router-types";
import { BaseLLMProvider } from "./base-provider";

/** Anthropic Provider */
export class AnthropicProvider extends BaseLLMProvider {
  id = "anthropic";
  name = "Anthropic Claude";

  isAvailable(keys: Record<string, string>): boolean {
    return Boolean(keys.ANTHROPIC_API_KEY);
  }

  isPreferredForIntent(intent: PromptIntent): number {
    switch (intent) {
      case "reasoning":
        return 92;
      case "creative":
        return 92;
      case "coding":
        return 85;
      case "chat":
        return 80;
      default:
        return 80;
    }
  }

  matchesModel(rawModel: string): boolean {
    return rawModel.startsWith("anthropic/") || rawModel.includes("claude");
  }

  async call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    systemPrompt?: string
  ): Promise<LLMResponse | null> {
    const key = keys.ANTHROPIC_API_KEY;
    if (!key) return null;

    const start = Date.now();
    const cleanModel = model
      .replace(/^anthropic\//, "")
      .replace(/^auto\/.*/, "claude-3-5-haiku-20241022");

    try {
      return await this.executeWithTimeout(async (signal) => {
        const anthropicMsgs = messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: cleanModel,
            system: systemPrompt || undefined,
            messages: anthropicMsgs,
            max_tokens: 2048,
          }),
          signal,
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.content?.[0]?.text || "";
          if (content) {
            return {
              content,
              latency: Date.now() - start,
              source: "anthropic",
              modelUsed: cleanModel,
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
