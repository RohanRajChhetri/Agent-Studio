import type { LLMMessage, LLMResponse, PromptIntent } from "../router-types";
import { BaseLLMProvider } from "./base-provider";
import { chatCompletion } from "../omniroute";

/** OmniRoute / OpenRouter Remote Gateway Provider */
export class OmniRouteGatewayProvider extends BaseLLMProvider {
  id = "omniroute_gateway";
  name = "OmniRoute Gateway";

  isAvailable(keys: Record<string, string>): boolean {
    return Boolean(keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY);
  }

  isPreferredForIntent(intent: PromptIntent): number {
    switch (intent) {
      case "coding":
        return 78;
      case "reasoning":
        return 75;
      case "creative":
        return 75;
      case "chat":
        return 75;
      default:
        return 70;
    }
  }

  matchesModel(rawModel: string): boolean {
    return (
      rawModel.startsWith("omniroute/") ||
      rawModel.startsWith("openrouter/") ||
      rawModel.startsWith("liquid/") ||
      rawModel.startsWith("nex-agi/") ||
      rawModel.startsWith("inclusionai/") ||
      rawModel.includes(":free")
    );
  }

  async call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    _systemPrompt?: string
  ): Promise<LLMResponse | null> {
    const key = keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY;
    if (!key) return null;
    void _systemPrompt;

    const start = Date.now();
    let cleanModel = model.replace(/^omniroute\//, "");
    if (cleanModel.startsWith("auto/")) {
      if (cleanModel === "auto/smart" || cleanModel === "auto/best-reasoning") {
        cleanModel = "deepseek/deepseek-r1";
      } else if (cleanModel === "auto/best-coding") {
        cleanModel = "qwen/qwen-2.5-coder-32b-instruct";
      } else {
        cleanModel = "meta-llama/llama-3.3-70b-instruct";
      }
    } else if (cleanModel.startsWith("groq/")) {
      // Map Groq model aliases to valid OpenRouter identifiers
      if (cleanModel.includes("3.3-70b")) {
        cleanModel = "meta-llama/llama-3.3-70b-instruct";
      } else if (cleanModel.includes("3.1-8b")) {
        cleanModel = "meta-llama/llama-3.1-8b-instruct";
      } else if (cleanModel.includes("deepseek-r1")) {
        cleanModel = "deepseek/deepseek-r1-distill-llama-70b";
      } else {
        cleanModel = cleanModel.replace(/^groq\//, "");
      }
    }

    // Models to attempt in order (requested model, then high-availability free tier candidates)
    const modelCandidates = [
      cleanModel,
      "liquid/lfm-2.5-2.6b:free",
      "qwen/qwen3.8-27b:free",
      "nvidia/nemotron-3.5-lightning:free",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const candidate of modelCandidates) {
      try {
        const response = await this.executeWithTimeout(async (signal) => {
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "http://localhost:3000",
              "X-Title": "Agent Studio OS",
            },
            body: JSON.stringify({
              model: candidate,
              messages,
            }),
            signal,
          });

          if (res.ok) {
            const data = await res.json();
            const content =
              data.choices?.[0]?.message?.content ||
              data.choices?.[0]?.text ||
              "";
            if (content && content.trim().length > 0) {
              return {
                content,
                latency: Date.now() - start,
                source: "omniroute",
                modelUsed: candidate,
                usage: data.usage,
              };
            }
          }
          return null;
        }, 22000);

        if (response) return response;
      } catch {
        // Cascade to next candidate
      }
    }

    return null;
  }
}

/** Local Omniroute Daemon Provider */
export class OmnirouteLocalProvider extends BaseLLMProvider {
  id = "omniroute_local";
  name = "Omniroute Local Daemon";

  isAvailable(): boolean {
    return true; // Dynamic availability checked via checkOmnirouteStatusCached
  }

  isPreferredForIntent(): number {
    return 60; // Lower baseline for local daemon waterfall
  }

  matchesModel(rawModel: string): boolean {
    return (
      rawModel.startsWith("omniroute/") ||
      rawModel.startsWith("auto/") ||
      rawModel.startsWith("oc/") ||
      rawModel.startsWith("opencode/") ||
      rawModel.startsWith("no-think/")
    );
  }

  async call(
    model: string,
    messages: LLMMessage[],
    _keys: Record<string, string> = {},
    _systemPrompt?: string
  ): Promise<LLMResponse | null> {
    void _keys;
    void _systemPrompt;
    const start = Date.now();
    const targetModel = model.startsWith("groq/") ? "auto/fast" : model;

    try {
      const result = await chatCompletion(targetModel, messages);
      if (result.content && result.content.trim().length > 0) {
        return {
          content: result.content,
          latency: result.latency || Date.now() - start,
          source: "omniroute",
          modelUsed: targetModel,
          usage: result.usage,
        };
      }
    } catch (err) {
      // If a specific model failed on Omniroute, retry once with auto/fast
      if (targetModel !== "auto/fast") {
        try {
          const fallbackResult = await chatCompletion("auto/fast", messages);
          if (fallbackResult.content && fallbackResult.content.trim().length > 0) {
            return {
              content: fallbackResult.content,
              latency: fallbackResult.latency || Date.now() - start,
              source: "omniroute",
              modelUsed: "auto/fast",
              usage: fallbackResult.usage,
            };
          }
        } catch {}
      }
      return this.handleError(err, this.name);
    }
    return null;
  }
}
