export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  latency: number;
  source:
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

export type PromptIntent = "coding" | "reasoning" | "creative" | "chat";

export interface LLMProvider {
  id: string;
  name: string;
  isAvailable(keys: Record<string, string>): boolean;
  isPreferredForIntent(intent: PromptIntent): number;
  matchesModel(rawModel: string): boolean;
  call(
    model: string,
    messages: LLMMessage[],
    keys: Record<string, string>,
    systemPrompt?: string
  ): Promise<LLMResponse | null>;
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
