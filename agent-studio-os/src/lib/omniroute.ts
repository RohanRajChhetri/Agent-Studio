export function getOmnirouteBase(): string {
  return process.env.OMNIROUTE_URL || "http://127.0.0.1:20128";
}

export function getOmnirouteHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const key = process.env.OMNIROUTE_API_KEY || "";
  if (key) {
    headers["Authorization"] = `Bearer ${key}`;
    headers["x-api-key"] = key;
  }
  return headers;
}

export interface OmnirouteModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface OmnirouteModelsResponse {
  data: OmnirouteModel[];
  object: string;
}

/** Check if Omniroute is online */
export async function isOmnirouteOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${getOmnirouteBase()}/v1/models`, {
      headers: getOmnirouteHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch available models from Omniroute */
export async function fetchModels(): Promise<{
  models: OmnirouteModel[];
  online: boolean;
}> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${getOmnirouteBase()}/v1/models`, {
      headers: getOmnirouteHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return { models: [], online: false };
    }

    const data: OmnirouteModelsResponse = await res.json();
    return { models: data.data || [], online: true };
  } catch {
    return { models: [], online: false };
  }
}

export interface OmnirouteCombo {
  name: string;
  strategy?: string;
  models?: Array<{ kind?: string; model?: string; providerId?: string }>;
  capabilities?: {
    multimodal?: boolean;
    reasoning?: boolean;
    caching?: boolean;
  };
}

/** Fetch user-defined and system combos from Omniroute (/v1/combos) */
export async function fetchCombos(): Promise<OmnirouteCombo[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${getOmnirouteBase()}/v1/combos`, {
      headers: getOmnirouteHeaders(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return Array.isArray(data.data) ? data.data : [];
  } catch {
    return [];
  }
}

/** Test a model by sending a minimal completion request */
export async function testModel(
  modelId: string
): Promise<{ success: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${getOmnirouteBase()}/v1/chat/completions`, {
      method: "POST",
      headers: getOmnirouteHeaders(),
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "say OK" }],
        max_tokens: 15,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latency = Date.now() - start;
    if (!res.ok) {
      const errorText = await res.text();
      return { success: false, latency, error: errorText };
    }

    return { success: true, latency };
  } catch (error) {
    return {
      success: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Connection failed",
    };
  }
}

/** Stream a chat completion from Omniroute */
export async function streamChatCompletion(
  model: string,
  messages: Array<{ role: string; content: string }>,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<{ totalTokens?: number }> {
  const res = await fetch(`${getOmnirouteBase()}/v1/chat/completions`, {
    method: "POST",
    headers: getOmnirouteHeaders(),
    body: JSON.stringify({
      model,
      messages,
      stream: true,
    }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Omniroute error: ${res.status} ${await res.text()}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let totalTokens: number | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));

    for (const line of lines) {
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) onChunk(delta);

        if (parsed.usage) {
          totalTokens =
            (parsed.usage.prompt_tokens || 0) +
            (parsed.usage.completion_tokens || 0);
        }
      } catch {
        // Skip malformed SSE chunks
      }
    }
  }

  return { totalTokens };
}

/** Non-streaming chat completion with timeout and robust response handling */
export async function chatCompletion(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{
  content: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
  latency: number;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(`${getOmnirouteBase()}/v1/chat/completions`, {
      method: "POST",
      headers: getOmnirouteHeaders(),
      body: JSON.stringify({ model, messages, stream: false }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      let parsedMsg = `Omniroute error: HTTP ${res.status}`;
      try {
        const json = JSON.parse(errBody);
        if (json.error?.message) {
          parsedMsg = json.error.message;
        }
      } catch {
        if (errBody) parsedMsg += ` - ${errBody.slice(0, 150)}`;
      }
      throw new Error(parsedMsg);
    }

    const contentType = res.headers.get("content-type") || "";
    const rawText = await res.text();

    // Check if SSE event-stream or raw data: lines
    if (contentType.includes("text/event-stream") || rawText.startsWith("data: ")) {
      const lines = rawText.split("\n").filter((l) => l.startsWith("data: "));
      let textContent = "";
      let usage: { prompt_tokens: number; completion_tokens: number } | undefined;
      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content || "";
          if (delta) textContent += delta;
          if (parsed.choices?.[0]?.message?.content) {
            textContent += parsed.choices[0].message.content;
          }
          if (parsed.usage) {
            usage = parsed.usage;
          }
        } catch {
          // Skip non-json SSE lines
        }
      }
      return {
        content: textContent,
        usage,
        latency: Date.now() - start,
      };
    }

    const data = JSON.parse(rawText);
    return {
      content:
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        "",
      usage: data.usage,
      latency: Date.now() - start,
    };
  } finally {
    clearTimeout(timeout);
  }
}
