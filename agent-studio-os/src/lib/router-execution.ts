import fs from "fs/promises";
import path from "path";
import type { LLMMessage, LLMResponse } from "./router-types";
import {
  detectPromptIntent,
  trimMessagesToContext,
  buildDefaultSystemPrompt,
  prepareMessages,
} from "./context-management";
import {
  ALL_PROVIDERS,
  GeminiProvider,
  OpenAIProvider,
  GroqProvider,
  AnthropicProvider,
  OmniRouteGatewayProvider,
  OmnirouteLocalProvider,
} from "./provider-selection";
import { getHermesHome, runOneshot } from "./hermes";
import { isOmnirouteOnline } from "./omniroute";
import { queryVaultRAG, formatRAGPromptContext, type RAGChunk } from "./rag";
import { formatEpisodicMemoryPrompt } from "./episodic-memory";
import { prisma } from "./prisma";

// In-memory key & gateway cache with 30s TTL to prevent repeated disk I/O
let cachedKeys: { data: Record<string, string>; expiresAt: number } | null = null;
let cachedOmnirouteStatus: { online: boolean; expiresAt: number } | null = null;

/**
 * Cache cleanup to prevent memory leaks and prune expired entries
 */
export function cleanupExpiredCache(): void {
  const now = Date.now();
  if (cachedKeys && cachedKeys.expiresAt <= now) {
    cachedKeys = null;
  }
  if (cachedOmnirouteStatus && cachedOmnirouteStatus.expiresAt <= now) {
    cachedOmnirouteStatus = null;
  }
}

export function invalidateActiveApiKeysCache(): void {
  cachedKeys = null;
  cachedOmnirouteStatus = null;
}

/**
 * Read API keys across process env, .env.local, and Hermes .env with in-memory caching.
 * Architectural Fix: NO mutation of process.env is performed.
 */
export async function getActiveApiKeys(forceFresh = false): Promise<Record<string, string>> {
  cleanupExpiredCache();

  const now = Date.now();
  if (!forceFresh && cachedKeys && cachedKeys.expiresAt > now) {
    return cachedKeys.data;
  }

  const keys: Record<string, string> = {};

  const envVarNames = [
    "OMNIROUTE_API_KEY",
    "OPENROUTER_API_KEY",
    "OMNIROUTE_URL",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "GROQ_API_KEY",
    "MISTRAL_API_KEY",
    "DEEPSEEK_API_KEY",
    "MOONSHOT_API_KEY",
    "XAI_API_KEY",
  ];

  for (const name of envVarNames) {
    if (process.env[name]) {
      keys[name] = process.env[name]!;
    }
  }

  // Cross-map Google and Gemini keys
  if (keys.GOOGLE_API_KEY && !keys.GEMINI_API_KEY) {
    keys.GEMINI_API_KEY = keys.GOOGLE_API_KEY;
  }
  if (keys.GOOGLE_GENERATIVE_AI_API_KEY && !keys.GEMINI_API_KEY) {
    keys.GEMINI_API_KEY = keys.GOOGLE_GENERATIVE_AI_API_KEY;
  }
  if (keys.GEMINI_API_KEY && !keys.GOOGLE_API_KEY) {
    keys.GOOGLE_API_KEY = keys.GEMINI_API_KEY;
  }

  // Read .env.local without modifying process.env
  try {
    const localEnvPath = path.join(process.cwd(), ".env.local");
    const localContent = await fs.readFile(localEnvPath, "utf-8");
    for (const line of localContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...rest] = trimmed.split("=");
        const v = rest.join("=").replace(/^['"]|['"]$/g, "").trim();
        if (k && v && !keys[k]) {
          keys[k] = v;
        }
      }
    }
  } catch {}

  // Read Hermes .env without modifying process.env
  try {
    const hermesEnvPath = path.join(getHermesHome(), ".env");
    const hermesContent = await fs.readFile(hermesEnvPath, "utf-8");
    for (const line of hermesContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const [k, ...rest] = trimmed.split("=");
        const v = rest.join("=").replace(/^['"]|['"]$/g, "").trim();
        if (k && v && !keys[k]) {
          keys[k] = v;
        }
      }
    }
  } catch {}

  // Defaults for Omniroute if configured
  if (process.env.OMNIROUTE_URL && !keys.OMNIROUTE_URL) {
    keys.OMNIROUTE_URL = process.env.OMNIROUTE_URL;
  }
  if (process.env.OMNIROUTE_API_KEY && !keys.OMNIROUTE_API_KEY) {
    keys.OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY && !keys.OPENROUTER_API_KEY) {
    keys.OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  }

  // Cross-map OpenRouter and OmniRoute keys
  if (keys.OPENROUTER_API_KEY && !keys.OMNIROUTE_API_KEY) {
    keys.OMNIROUTE_API_KEY = keys.OPENROUTER_API_KEY;
  }
  if (keys.OMNIROUTE_API_KEY && !keys.OPENROUTER_API_KEY) {
    keys.OPENROUTER_API_KEY = keys.OMNIROUTE_API_KEY;
  }

  cachedKeys = { data: keys, expiresAt: now + 30000 };
  return keys;
}

/** Check Omniroute online status with 10s caching and expired cache pruning */
export async function checkOmnirouteStatusCached(): Promise<boolean> {
  cleanupExpiredCache();

  const now = Date.now();
  if (cachedOmnirouteStatus && cachedOmnirouteStatus.expiresAt > now) {
    return cachedOmnirouteStatus.online;
  }
  const online = await isOmnirouteOnline();
  cachedOmnirouteStatus = { online, expiresAt: now + 10000 };
  return online;
}

/** Normalize model name to avoid non-existent or 404 models */
export function normalizeModelName(rawModel?: string | null): string {
  if (
    !rawModel ||
    rawModel.trim() === "" ||
    rawModel === "omniroute/owl-alpha" ||
    rawModel === "liquid/lfm-2.5-2.6b:free"
  ) {
    return "auto/fast";
  }
  return rawModel.trim();
}

/**
 * Universal Chat Completion Engine
 * Provider-Agnostic: Executes whichever provider/model is selected or configured.
 * Omniroute is NOT forced as the primary brain.
 * Strategy pattern: Uses modular provider classes ordered by preference and model match.
 */
export async function executeChatCompletion(params: {
  prompt: string;
  history?: LLMMessage[];
  model?: string | null;
  systemPrompt?: string;
  agentName?: string;
  useVaultRAG?: boolean;
  useEpisodicMemory?: boolean;
}): Promise<LLMResponse> {
  const start = Date.now();
  const rawModel = normalizeModelName(params.model);
  const keys = await getActiveApiKeys();

  let augmentedSystem = buildDefaultSystemPrompt({
    agentName: params.agentName,
    systemPrompt: params.systemPrompt,
  });
  let citations: RAGChunk[] = [];

  // 1. Vault RAG Context Grounding
  if (params.useVaultRAG !== false) {
    try {
      citations = await queryVaultRAG(params.prompt, { limit: 3 });
      if (citations.length > 0) {
        augmentedSystem += formatRAGPromptContext(citations);
      }
    } catch (ragErr) {
      console.warn("[LLM Router] RAG query error:", ragErr);
    }
  }

  // 2. Episodic Memory Injection
  if (params.useEpisodicMemory !== false && params.agentName) {
    try {
      const memorySnippet = await formatEpisodicMemoryPrompt(params.agentName);
      if (memorySnippet) {
        augmentedSystem += memorySnippet;
      }
    } catch (memErr) {
      console.warn("[LLM Router] Episodic memory error:", memErr);
    }
  }

  // 3. Prepare and trim context to prevent overflows
  const rawMessages = prepareMessages(params.prompt, augmentedSystem || undefined, params.history);
  const messages = trimMessagesToContext(rawMessages);

  const formatCitations = () => {
    const relevantCitations = citations.filter((c) => c.score >= 5.0);
    return relevantCitations.length > 0
      ? relevantCitations.map((c) => ({
          title: c.title,
          relPath: c.relPath,
          excerpt: c.excerpt,
        }))
      : undefined;
  };

  const intent = detectPromptIntent(params.prompt);
  const isAuto = rawModel.startsWith("auto/");

  // 4. Build provider execution cascade using Strategy Pattern
  const callers: Array<() => Promise<LLMResponse | null>> = [];

  // If not explicitly auto, check if rawModel targets a specific provider
  if (!isAuto) {
    const explicitProvider = ALL_PROVIDERS.find(
      (p) => p.matchesModel(rawModel) && p.isAvailable(keys)
    );
    if (explicitProvider) {
      callers.push(() => explicitProvider.call(rawModel, messages, keys, augmentedSystem));
    }
  }

  // Waterfall priority fallback if auto or explicit candidate wasn't resolved / might fail
  if (isAuto || callers.length === 0) {
    const isLocalOmnirouteOnline = await checkOmnirouteStatusCached();
    if (isLocalOmnirouteOnline) {
      callers.push(() => new OmnirouteLocalProvider().call(rawModel, messages, keys, augmentedSystem));
    }

    if (intent === "coding") {
      if (keys.OPENAI_API_KEY) {
        callers.push(() => new OpenAIProvider().call("gpt-4o", messages, keys, augmentedSystem));
      }
      if (keys.GEMINI_API_KEY) {
        callers.push(() => new GeminiProvider().call("gemini-3.6-flash", messages, keys, augmentedSystem));
      }
      if (keys.GROQ_API_KEY) {
        callers.push(() => new GroqProvider().call("llama-3.3-70b-versatile", messages, keys, augmentedSystem));
      }
      if (keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY) {
        callers.push(() => new OmniRouteGatewayProvider().call(rawModel, messages, keys, augmentedSystem));
      }
    } else if (intent === "reasoning") {
      if (keys.GEMINI_API_KEY) {
        callers.push(() => new GeminiProvider().call("gemini-3.6-flash", messages, keys, augmentedSystem));
      }
      if (keys.OPENAI_API_KEY) {
        callers.push(() => new OpenAIProvider().call("gpt-4o-mini", messages, keys, augmentedSystem));
      }
      if (keys.ANTHROPIC_API_KEY) {
        callers.push(() => new AnthropicProvider().call("claude-3-5-haiku-20241022", messages, keys, augmentedSystem));
      }
    } else {
      // General Fast Chat
      if (keys.GEMINI_API_KEY) {
        callers.push(() => new GeminiProvider().call("gemini-3.6-flash", messages, keys, augmentedSystem));
      }
      if (keys.GROQ_API_KEY) {
        callers.push(() => new GroqProvider().call("llama-3.3-70b-versatile", messages, keys, augmentedSystem));
      }
      if (keys.OPENAI_API_KEY) {
        callers.push(() => new OpenAIProvider().call("gpt-4o-mini", messages, keys, augmentedSystem));
      }
      if (keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY) {
        callers.push(() => new OmniRouteGatewayProvider().call(rawModel, messages, keys, augmentedSystem));
      }
    }

    // Secondary fallback: Omniroute local daemon if not already tried
    if (!isLocalOmnirouteOnline) {
      callers.push(async () => {
        const online = await checkOmnirouteStatusCached();
        if (online) return new OmnirouteLocalProvider().call(rawModel, messages, keys, augmentedSystem);
        return null;
      });
    }

    // Add remaining available providers as safety fallbacks
    if (keys.GEMINI_API_KEY && !callers.some((c) => c.name.includes("Gemini"))) {
      callers.push(() => new GeminiProvider().call("gemini-2.5-flash", messages, keys, augmentedSystem));
    }
    if (keys.OMNIROUTE_API_KEY && !callers.some((c) => c.name.includes("OmniRoute"))) {
      callers.push(() => new OmniRouteGatewayProvider().call(rawModel, messages, keys, augmentedSystem));
    }
  } else {
    // Explicit model chosen: provide automatic fallback resilience if the chosen provider fails
    if (keys.GEMINI_API_KEY && !rawModel.toLowerCase().includes("gemini")) {
      callers.push(() => new GeminiProvider().call("gemini-2.5-flash", messages, keys, augmentedSystem));
    }
    if (keys.GROQ_API_KEY && !rawModel.toLowerCase().includes("llama")) {
      callers.push(() => new GroqProvider().call("llama-3.3-70b-versatile", messages, keys, augmentedSystem));
    }
    if (keys.OPENAI_API_KEY && !rawModel.toLowerCase().includes("gpt")) {
      callers.push(() => new OpenAIProvider().call("gpt-4o-mini", messages, keys, augmentedSystem));
    }
    if ((keys.OMNIROUTE_API_KEY || keys.OPENROUTER_API_KEY) && !rawModel.toLowerCase().includes("openrouter")) {
      callers.push(() => new OmniRouteGatewayProvider().call("auto/fast", messages, keys, augmentedSystem));
    }
  }

  // 5. Execute with Zero-Drop Cascade (Try candidates until one succeeds)
  for (const caller of callers) {
    try {
      const response = await caller();
      if (response && response.content && response.content.trim().length > 0) {
        response.ragCitations = formatCitations();

        // Telemetry logging (non-blocking)
        try {
          prisma.activityLog
            .create({
              data: {
                type: "llm_completion",
                message: `${response.modelUsed} (${response.source}) in ${response.latency}ms`,
                agentId: null,
              },
            })
            .catch(() => {});
        } catch {}

        return response;
      }
    } catch (callerErr) {
      console.warn("[LLM Router] Provider execution failed, cascading to next:", callerErr);
    }
  }

  // 6. Last resort: Hermes CLI oneshot
  if (params.agentName) {
    try {
      const isHermesError = (text: string): boolean => {
        const trimmed = text.trim();
        if (!trimmed) return true;
        if (trimmed.startsWith("API call failed")) return true;
        if (trimmed.includes("command not found")) return true;
        if (/^HTTP\s+(?:4\d\d|5\d\d):/i.test(trimmed)) return true;
        if (/is not a valid model ID/i.test(trimmed)) return true;
        if (/quota exceeded|budget exceeded|rate limit/i.test(trimmed)) return true;
        return false;
      };

      const hermesModel = rawModel.startsWith("groq/") ? "auto/fast" : rawModel;
      let hermesOutput = await runOneshot(params.prompt, {
        model: hermesModel,
        profile: params.agentName,
      });

      if (isHermesError(hermesOutput) && hermesModel !== "auto/fast") {
        try {
          const retryOutput = await runOneshot(params.prompt, {
            model: "auto/fast",
            profile: params.agentName,
          });
          if (!isHermesError(retryOutput)) {
            hermesOutput = retryOutput;
          }
        } catch {}
      }

      if (hermesOutput && !isHermesError(hermesOutput)) {
        return {
          content: hermesOutput,
          latency: Date.now() - start,
          source: "hermes",
          modelUsed: hermesModel,
          ragCitations: formatCitations(),
        };
      }
    } catch {}
  }

  // 7. Clear, Actionable Fallback (Never fail silently)
  const latency = Date.now() - start;
  return {
    content:
      `⚠️ **Agent Connection & Model Setup Notice**\n\n` +
      `Your agent fleet is ready, but needs an active AI provider to generate live completions:\n\n` +
      `1. **Get Free Google Gemini Key (Zero Cost)**: Generate a free key in 30 seconds at [Google AI Studio](https://aistudio.google.com/app/apikey) and paste it into [Settings → Providers](/settings).\n` +
      `2. **Universal Gateways**: Or configure **OpenRouter** (300+ models with free-tier access), **Groq** (ultra-low latency), or **OpenAI** in [Settings](/settings).\n` +
      `3. **Local Self-Hosted**: If using local models, start your **Omniroute** (` + "`http://127.0.0.1:20128`" + `) or **Ollama** server.\n\n` +
      `*Once configured, all autonomous agents, Kanban runners, routines, and roundtables activate instantly.*`,
    latency,
    source: "fallback",
    modelUsed: rawModel,
  };
}

/** Test an API key with its provider directly */
export async function testProviderKey(
  provider: string,
  key: string
): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now();
  const normalizedProvider = provider.toLowerCase();

  try {
    if (normalizedProvider === "omniroute") {
      const url = process.env.OMNIROUTE_URL || "http://127.0.0.1:20128";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${url}/v1/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
          "x-api-key": key,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Omniroute HTTP ${res.status}` };
    }

    if (normalizedProvider === "openrouter") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Invalid key (HTTP ${res.status})` };
    }

    if (normalizedProvider === "openai") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Invalid key (HTTP ${res.status})` };
    }

    if (normalizedProvider === "groq") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Invalid key (HTTP ${res.status})` };
    }

    if (normalizedProvider === "google" || normalizedProvider === "gemini") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Gemini API key rejected (HTTP ${res.status})` };
    }

    if (normalizedProvider === "anthropic") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.status === 200 || res.status === 400) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Anthropic key rejected (HTTP ${res.status})` };
    }

    if (normalizedProvider === "deepseek") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.deepseek.com/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `DeepSeek key rejected (HTTP ${res.status})` };
    }

    if (normalizedProvider === "mistral") {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch("https://api.mistral.ai/v1/models", {
        headers: { Authorization: `Bearer ${key}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const latency = Date.now() - start;
      if (res.ok) {
        return { success: true, latency };
      }
      return { success: false, latency, error: `Mistral key rejected (HTTP ${res.status})` };
    }

    return { success: true, latency: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}
