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
    _systemPrompt?: string,
    tools?: import("../router-types").LLMToolDefinition[]
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
        const formattedMessages = messages.map((m) => {
          if (m.images && m.images.length > 0) {
            return {
              role: m.role,
              content: [
                { type: "text", text: m.content },
                ...m.images.map((img) => ({
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

        const bodyPayload: Record<string, unknown> = {
          model: cleanModel,
          messages: formattedMessages,
        };

        if (tools && tools.length > 0) {
          bodyPayload.tools = tools.map((t) => ({
            type: "function",
            function: {
              name: t.name,
              description: t.description,
              parameters: t.parameters,
            },
          }));
          bodyPayload.tool_choice = "auto";
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyPayload),
          signal,
        });

        if (res.ok) {
          const data = await res.json();
          const choice = data.choices?.[0];
          const content = choice?.message?.content || "";
          const rawToolCalls = choice?.message?.tool_calls;
          const parsedToolCalls = Array.isArray(rawToolCalls)
            ? rawToolCalls.map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => {
                let parsedArgs = {};
                try {
                  parsedArgs = JSON.parse(tc.function?.arguments || "{}");
                } catch {
                  parsedArgs = { raw: tc.function?.arguments };
                }
                return {
                  id: tc.id || `tc-${Date.now()}`,
                  name: tc.function?.name || "",
                  arguments: parsedArgs,
                };
              })
            : undefined;

          if (content || (parsedToolCalls && parsedToolCalls.length > 0)) {
            return {
              content,
              latency: Date.now() - start,
              source: "openai",
              modelUsed: cleanModel,
              usage: data.usage,
              toolCalls: parsedToolCalls,
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
