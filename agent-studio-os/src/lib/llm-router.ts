import fs from "fs/promises";
import path from "path";
import { getHermesHome, runOneshot } from "./hermes";
import { chatCompletion, isOmnirouteOnline } from "./omniroute";
import { queryVaultRAG, formatRAGPromptContext, type RAGChunk } from "./rag";
import { formatEpisodicMemoryPrompt } from "./episodic-memory";
import { prisma } from "./prisma";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  latency: number;
  source:
    | "omniroute"
    | "omniroute"
    | "openai"
    | "google"
    | "anthropic"
    | "groq"
    | "deepseek"
    | "mistral"
    | "hermes"
    | "fallback";
  modelUsed: string;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens?: number };
  ragCitations?: Array<{ title: string; relPath: string; excerpt: string }>;
  toolCalls?: Array<{ id: string; name: string; arguments: Record<string, unknown> }>;
}

export const VERIFIED_MODELS = [
  {
    id: "auto/fast",
    name: "Fast (Auto Route)",
    provider: "Smart Router",
    isFree: true,
  },
  {
    id: "auto/smart",
    name: "Smart Reasoning (Auto Route)",
    provider: "Smart Router",
    isFree: true,
  },
  {
    id: "auto/best-coding",
    name: "Best Coding (Auto Route)",
    provider: "Smart Router",
    isFree: true,
  },
  {
    id: "auto/best-chat",
    name: "Best Chat (Auto Route)",
    provider: "Smart Router",
    isFree: true,
  },
  {
    id: "google/gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    provider: "Google",
    isFree: true,
  },
  {
    id: "google/gemini-3.8-flash",
    name: "Gemini 3.8 Flash (High)",
    provider: "Google",
    isFree: true,
  },
  {
    id: "google/gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    provider: "Google",
    isFree: true,
  },
  {
    id: "google/gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    provider: "Google",
    isFree: true,
  },
  {
    id: "groq/llama-3.3-70b-versatile",
    name: "Llama 3.3 70B (Groq Turbo)",
    provider: "Groq",
    isFree: true,
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    isFree: false,
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    isFree: false,
  },
  {
    id: "anthropic/claude-3-7-sonnet",
    name: "Claude 3.7 Sonnet",
    provider: "Anthropic",
    isFree: false,
  },
  {
    id: "anthropic/claude-3-5-haiku-20241022",
    name: "Claude 3.5 Haiku",
    provider: "Anthropic",
    isFree: false,
  },
];

// In-memory key & gateway cache with 30s TTL to prevent repeated disk I/O
let cachedKeys: { data: Record<string, string>; expiresAt: number } | null = null;
let cachedOmnirouteStatus: { online: boolean; expiresAt: number } | null = null;

export function invalidateActiveApiKeysCache() {
  cachedKeys = null;
  cachedOmnirouteStatus = null;
}

/** Read API keys across process env, .env.local, and Hermes .env with in-memory caching */
export async function getActiveApiKeys(forceFresh = false): Promise<Record<string, string>> {
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

  // 2. Read .env.local
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
          process.env[k] = v;
        }
      }
    }
  } catch {}

  // 3. Hermes .env
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
          process.env[k] = v;
        }
      }
    }
  } catch {}

  // Defaults for Omniroute if configured
  if (process.env.OMNIROUTE_URL) {
    keys.OMNIROUTE_URL = process.env.OMNIROUTE_URL;
  }
  if (process.env.OMNIROUTE_API_KEY) {
    keys.OMNIROUTE_API_KEY = process.env.OMNIROUTE_API_KEY;
  }
  if (process.env.OPENROUTER_API_KEY) {
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

/** Check Omniroute online status with 10s caching */
export async function checkOmnirouteStatusCached(): Promise<boolean> {
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

/** Detect intent of user query for task-aware routing */
export type PromptIntent = "coding" | "reasoning" | "creative" | "chat";

export function detectPromptIntent(prompt: string): PromptIntent {
  const lower = prompt.toLowerCase();

  // Define keyword patterns for each intent
  const intentPatterns: Record<Exclude<PromptIntent, "chat">, RegExp[]> = {
    coding: [
      /def\s+|function\s+|class\s+|import\s+|const\s+|let\s+|```/i,
      /bug|error|exception|stacktrace/i,
      /refactor|compile|typescript|javascript|python|sql|html|css/i,
      /api|endpoint|git|docker/i
    ],
    reasoning: [
      /why|prove|calculate/i,
      /algorithm|math|analyze/i,
      /tradeoff|evaluate/i
    ],
    creative: [
      /write a story|copy|marketing/i,
      /headline|email|pitch/i
    ]
  };

  // Check each intent in order of priority
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(pattern => pattern.test(lower))) {
      return intent as PromptIntent;
    }
  }

  return "chat";
}

/** Sliding window context manager to prevent 400 context_length_exceeded errors */
export function trimMessagesToContext(
  messages: LLMMessage[],
  maxEstimatedTokens = 12000
): LLMMessage[] {
  if (messages.length <= 6) return messages;

  const hasSystem = messages[0]?.role === "system";
  const systemMsg = hasSystem ? messages[0] : null;
  const conversation = hasSystem ? messages.slice(1) : [...messages];

  // More accurate token estimation:
  // - English text: ~4 chars/token
  // - Code/markup: ~3 chars/token (more verbose)
  // - Whitespace/punctuation: ~2 chars/token
  const estimateTokens = (text: string): number => {
    if (!text) return 0;

    // Count different character types for better estimation
    const codeChars = (text.match(/[{}[\](),;:=<>+\-*/&|^%$#@!~`\\]/g) || []).length;
    const whitespaceChars = (text.match(/\s/g) || []).length;
    const otherChars = text.length - codeChars - whitespaceChars;

    // Weighted estimate: code chars count more, whitespace less
    return Math.ceil(
      (codeChars * 0.3 +    // More tokens per char for code symbols
       whitespaceChars * 0.1 + // Fewer tokens per char for whitespace
       otherChars * 0.25)    // Standard estimate for regular text
    );
  };

  let tokenCount = systemMsg ? estimateTokens(systemMsg.content) : 0;
  const trimmed: LLMMessage[] = [];

  // Iterate backwards from the newest message to preserve recent context
  for (let i = conversation.length - 1; i >= 0; i--) {
    const msg = conversation[i];
    const est = estimateTokens(msg.content);
    if (tokenCount + est > maxEstimatedTokens && trimmed.length >= 4) {
      break;
    }
    tokenCount += est;
    trimmed.unshift(msg);
  }

  return systemMsg ? [systemMsg, ...trimmed] : trimmed;
}

/** Build an elite, role-tailored system prompt */
export function buildDefaultSystemPrompt(params: {
  agentName?: string;
  role?: string;
  systemPrompt?: string;
  description?: string;
}): string {
  const custom = params.systemPrompt?.trim();
  const name = params.agentName || "Specialist";
  const role = params.role || "autonomous specialist";

  const excellenceCore = `You are ${name}, an elite ${role} in the Agent Studio OS autonomous AI swarm.
Deliver exceptional, top-tier responses characterized by:
- Deep domain expertise and rigorous, analytical thinking.
- Direct, high-signal communication: answer directly without generic conversational filler ("As an AI...", "Sure! I'd be delighted..."), robotic greetings, or unsolicited tags like [[tasks]].
- Beautiful, clean Markdown formatting with clear headings, organized lists, and syntax-highlighted code blocks where applicable.
- Practical, production-ready solutions and actionable takeaways.
- Tone: Confident, articulate, professional, and genuinely helpful.`;

  if (custom && custom.length > 50) {
    return `${excellenceCore}\n\n[SPECIALIST DIRECTIVES & PERSONA]\n${custom}`;
  }

  const lowerName = name.toLowerCase();
  let roleDirective = "";

  if (lowerName.includes("noman") || role === "worker" || lowerName.includes("dev")) {
    roleDirective = `Primary Expertise: Senior Full-Stack Software Engineering & Architecture.
- You excel at TypeScript, React/Next.js, Node.js, Python, distributed systems, and API design.
- You write elegant, production-grade code that is bug-free, type-safe, and includes thoughtful error handling.
- When writing code, provide complete, runnable implementations rather than incomplete snippets.`;
  } else if (lowerName.includes("athena") || lowerName.includes("research")) {
    roleDirective = `Primary Expertise: Deep Research, Intelligence Analysis & Synthesis.
- You conduct exhaustive analysis, synthesize complex data, and uncover non-obvious insights.
- Provide structured executive summaries, market trends, architectural tradeoffs, and data comparisons.`;
  } else if (lowerName.includes("mercury") || lowerName.includes("copy") || lowerName.includes("market")) {
    roleDirective = `Primary Expertise: Strategic Marketing, Brand Positioning & Persuasive Copywriting.
- You write compelling, sharp, conversion-driven copy and strategic narrative frameworks.
- Your writing is punchy, memorable, and resonant with users.`;
  } else if (lowerName.includes("vulcan") || lowerName.includes("devops") || lowerName.includes("infra")) {
    roleDirective = `Primary Expertise: Cloud Infrastructure, DevOps, SRE & System Reliability.
- You specialize in Linux, Docker, Kubernetes, CI/CD pipelines, observability, network security, and infrastructure as code.
- You prioritize resilience, high availability, zero-downtime deployments, and security compliance.`;
  } else if (lowerName.includes("muskaan") || lowerName.includes("manager") || lowerName.includes("product")) {
    roleDirective = `Primary Expertise: Technical Product Management & Agile Swarm Coordination.
- You specialize in product strategy, roadmap execution, user-centric feature specifications, sprint deliverables, and team orchestration.
- You communicate with clarity, alignment, and momentum.`;
  } else {
    roleDirective = `Primary Expertise: Autonomous Problem Solving & Executive Systems Orchestration.
- You orchestrate multi-step workflows, resolve complex challenges, and ensure flawless execution across all deliverables.`;
  }

  return `${excellenceCore}\n\n[SPECIALIST DIRECTIVES]\n${roleDirective}${custom ? `\n\nAdditional Guidance: ${custom}` : ""}`;
}

/** Helper to extract plain text system & user messages with history support */
function prepareMessages(prompt: string, systemPrompt?: string, history?: LLMMessage[]): LLMMessage[] {
  const messages: LLMMessage[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  if (history && history.length > 0) {
    for (const h of history) {
      if (h.content && h.content.trim()) {
        messages.push({ role: h.role, content: h.content });
      }
    }
  }
  messages.push({ role: "user", content: prompt });
  return messages;
}

/** Direct Provider Callers with Built-In Timeouts */

async function callGoogleGemini(
  model: string,
  messages: LLMMessage[],
  key: string
): Promise<LLMResponse | null> {
  const start = Date.now();
  let cleanModel = model
    .replace(/^google\//, "")
    .replace(/^gemini\//, "")
    .replace(/:free$/, "");

  // Resolve to active working Gemini models
  const supportedGemini = [
    "gemini-3.8-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-pro-latest",
  ];

  if (!supportedGemini.includes(cleanModel)) {
    if (cleanModel.includes("3.8") || cleanModel === "auto/smart") {
      cleanModel = "gemini-3.8-flash";
    } else if (cleanModel.includes("3.5")) {
      cleanModel = "gemini-3.5-flash";
    } else if (cleanModel.includes("lite")) {
      cleanModel = "gemini-3.1-flash-lite";
    } else {
      cleanModel = "gemini-3.6-flash";
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18000);

  try {
    // 1. Try OpenAI-compatible endpoint
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: cleanModel,
          messages,
        }),
        signal: controller.signal,
      }
    );

    if (res.ok) {
      clearTimeout(timeout);
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      if (content) {
        return {
          content,
          latency: Date.now() - start,
          source: "google",
          modelUsed: cleanModel,
          usage: data.usage,
        };
      }
    }

    // 2. High-reliability fallback to Google's native generateContent endpoint
    const nativeRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (nativeRes.ok) {
      const nData = await nativeRes.json();
      const content = nData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (content) {
        return {
          content,
          latency: Date.now() - start,
          source: "google",
          modelUsed: cleanModel,
        };
      }
    }
  } catch (err) {
    console.warn("[Router Provider] Gemini call failed:", err);
  }
  return null;
}

async function callOpenAI(
  model: string,
  messages: LLMMessage[],
  key: string
): Promise<LLMResponse | null> {
  const start = Date.now();
  const cleanModel = model
    .replace(/^openai\//, "")
    .replace(/^auto\/.*/, "gpt-4o-mini");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

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
  } catch (err) {
    console.warn("[Router Provider] OpenAI call failed:", err);
  }
  return null;
}

async function callGroq(
  model: string,
  messages: LLMMessage[],
  key: string
): Promise<LLMResponse | null> {
  const start = Date.now();
  const cleanModel = model
    .replace(/^groq\//, "")
    .replace(/^auto\/.*/, "llama-3.3-70b-versatile");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);

  try {
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

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
  } catch (err) {
    console.warn("[Router Provider] Groq call failed:", err);
  }
  return null;
}

async function callAnthropic(
  model: string,
  messages: LLMMessage[],
  key: string,
  systemPrompt?: string
): Promise<LLMResponse | null> {
  const start = Date.now();
  const cleanModel = model
    .replace(/^anthropic\//, "")
    .replace(/^auto\/.*/, "claude-3-5-haiku-20241022");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
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
      signal: controller.signal,
    });
    clearTimeout(timeout);

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
  } catch (err) {
    console.warn("[Router Provider] Anthropic call failed:", err);
  }
  return null;
}

async function callOmniRoute(
  model: string,
  messages: LLMMessage[],
  key: string
): Promise<LLMResponse | null> {
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
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Agent Studio OS",
      },
      body: JSON.stringify({
        model: cleanModel,
        messages,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content =
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        "";
      if (content) {
        return {
          content,
          latency: Date.now() - start,
          source: "omniroute",
          modelUsed: cleanModel,
          usage: data.usage,
        };
      }
    }
  } catch (err) {
    console.warn("[Router Provider] OmniRoute call failed:", err);
  }
  return null;
}

async function callOmniroute(
  model: string,
  messages: LLMMessage[]
): Promise<LLMResponse | null> {
  const start = Date.now();
  try {
    const result = await chatCompletion(model, messages);
    if (result.content && result.content.trim().length > 0) {
      return {
        content: result.content,
        latency: result.latency || Date.now() - start,
        source: "omniroute",
        modelUsed: model,
        usage: result.usage,
      };
    }
  } catch (err) {
    console.warn("[Router Provider] Omniroute execution failed:", err);
  }
  return null;
}

/**
 * Universal Chat Completion Engine
 * Provider-Agnostic: Executes whichever provider/model is selected or configured.
 * Omniroute is NOT forced as the primary brain.
 * Features: Smart auto-routing, sliding context window, automatic failovers (no silent hangs), and telemetry.
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

  // 1. Vault RAG Context Grounding (Safeguarded against small-talk)
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

  // 4. Determine execution order based on model specification and available keys
  // Provider is chosen based on what the user/agent specified, NOT hardcoded to Omniroute.
  const callers: Array<() => Promise<LLMResponse | null>> = [];

  const isGemini = rawModel.includes("gemini") || rawModel.startsWith("google/");
  const isOpenAI = rawModel.startsWith("openai/") || rawModel.startsWith("gpt-");
  const isGroq = rawModel.startsWith("groq/") || rawModel.includes("llama");
  const isAnthropic = rawModel.startsWith("anthropic/") || rawModel.includes("claude");
  const isOmniRoute =
    rawModel.startsWith("omniroute/") ||
    rawModel.startsWith("openrouter/") ||
    rawModel.startsWith("liquid/") ||
    rawModel.startsWith("nex-agi/") ||
    rawModel.startsWith("inclusionai/") ||
    rawModel.includes(":free");
  const isOmniroute =
    rawModel.startsWith("omniroute/") ||
    rawModel.startsWith("auto/") ||
    rawModel.startsWith("oc/") ||
    rawModel.startsWith("opencode/") ||
    rawModel.startsWith("no-think/") ||
    (!isGemini && !isOpenAI && !isGroq && !isAnthropic);
  const isAuto = rawModel.startsWith("auto/");

  // Explicit Provider Selection
  if (isGemini && keys.GEMINI_API_KEY) {
    callers.push(() => callGoogleGemini(rawModel, messages, keys.GEMINI_API_KEY));
  } else if (isOpenAI && keys.OPENAI_API_KEY) {
    callers.push(() => callOpenAI(rawModel, messages, keys.OPENAI_API_KEY));
  } else if (isGroq && keys.GROQ_API_KEY) {
    callers.push(() => callGroq(rawModel, messages, keys.GROQ_API_KEY));
  } else if (isAnthropic && keys.ANTHROPIC_API_KEY) {
    callers.push(() => callAnthropic(rawModel, messages, keys.ANTHROPIC_API_KEY, augmentedSystem));
  } else if (isOmniRoute && keys.OMNIROUTE_API_KEY) {
    callers.push(() => callOmniRoute(rawModel, messages, keys.OMNIROUTE_API_KEY));
  } else if (isOmniroute) {
    callers.push(() => callOmniroute(rawModel, messages));
  }

  // If auto or explicit caller wasn't resolved, build smart task-aware priority waterfall:
  if (isAuto || callers.length === 0) {
    if (intent === "coding") {
      if (keys.OPENAI_API_KEY) callers.push(() => callOpenAI("gpt-4o", messages, keys.OPENAI_API_KEY));
      if (keys.GEMINI_API_KEY) callers.push(() => callGoogleGemini("gemini-3.6-flash", messages, keys.GEMINI_API_KEY));
      if (keys.GROQ_API_KEY) callers.push(() => callGroq("llama-3.3-70b-versatile", messages, keys.GROQ_API_KEY));
      if (keys.OMNIROUTE_API_KEY) callers.push(() => callOmniRoute(rawModel, messages, keys.OMNIROUTE_API_KEY));
    } else if (intent === "reasoning") {
      if (keys.GEMINI_API_KEY) callers.push(() => callGoogleGemini("gemini-3.6-flash", messages, keys.GEMINI_API_KEY));
      if (keys.OPENAI_API_KEY) callers.push(() => callOpenAI("gpt-4o-mini", messages, keys.OPENAI_API_KEY));
      if (keys.ANTHROPIC_API_KEY) callers.push(() => callAnthropic("claude-3-5-haiku-20241022", messages, keys.ANTHROPIC_API_KEY, augmentedSystem));
    } else {
      // General Fast Chat
      if (keys.GEMINI_API_KEY) callers.push(() => callGoogleGemini("gemini-3.6-flash", messages, keys.GEMINI_API_KEY));
      if (keys.GROQ_API_KEY) callers.push(() => callGroq("llama-3.3-70b-versatile", messages, keys.GROQ_API_KEY));
      if (keys.OPENAI_API_KEY) callers.push(() => callOpenAI("gpt-4o-mini", messages, keys.OPENAI_API_KEY));
      if (keys.OMNIROUTE_API_KEY) callers.push(() => callOmniRoute(rawModel, messages, keys.OMNIROUTE_API_KEY));
    }

    // Add Omniroute as optional candidate if available
    callers.push(async () => {
      const online = await checkOmnirouteStatusCached();
      if (online) return callOmniroute(rawModel, messages);
      return null;
    });

    // Add any remaining configured direct keys as fallbacks
    if (keys.GEMINI_API_KEY && !callers.some(c => c.name.includes("Gemini"))) {
      callers.push(() => callGoogleGemini("gemini-3.6-flash", messages, keys.GEMINI_API_KEY));
    }
    if (keys.OMNIROUTE_API_KEY && !callers.some(c => c.name.includes("OmniRoute"))) {
      callers.push(() => callOmniRoute(rawModel, messages, keys.OMNIROUTE_API_KEY));
    }
  }

  // 5. Execute with Zero-Drop Cascade (Try candidate until one succeeds)
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
      const hermesOutput = await runOneshot(params.prompt, {
        model: rawModel,
        profile: params.agentName,
      });
      if (
        hermesOutput &&
        !hermesOutput.startsWith("API call failed") &&
        !hermesOutput.includes("command not found")
      ) {
        return {
          content: hermesOutput,
          latency: Date.now() - start,
          source: "hermes",
          modelUsed: rawModel,
          ragCitations: formatCitations(),
        };
      }
    } catch {}
  }

  // 7. Clear, Actionable Fallback (Never fail silently)
  const latency = Date.now() - start;
  return {
    content:
      `⚠️ **Agent Connection & Model Notice**\n\n` +
      `The agent could not generate a reply through \`${rawModel}\`. To ensure instant replies:\n\n` +
      `1. **Add an API Key**: Go to [Settings → Provider Hub](/settings) and add a **Google Gemini** (Free), **OmniRoute**, or **OpenAI** API key.\n` +
      `2. **Check Model Selection**: If using a custom model name, verify it matches your active provider in Settings.\n` +
      `3. **Local Gateways**: If using Omniroute, check that the local terminal process is active.`,
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

    if (normalizedProvider === "omniroute" || normalizedProvider === "openrouter") {
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
