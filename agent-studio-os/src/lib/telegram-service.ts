import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { formatResponseTime } from "@/lib/utils";

interface TelegramPollerState {
  running: boolean;
  activeToken: string | null;
  offset: number;
  lastPollAt: number | null;
  lastMessageAt: number | null;
  processedCount: number;
  lastError: string | null;
  assignedAgentNames: string | null;
}

export interface TelegramAgentTarget {
  id?: string;
  name?: string;
  displayName?: string | null;
  model?: string | null;
  systemPrompt?: string | null;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: {
    message_id?: number;
    chat: { id: number | string };
    text?: string;
    from?: { first_name?: string; username?: string };
  };
  edited_message?: {
    message_id?: number;
    chat: { id: number | string };
    text?: string;
    from?: { first_name?: string; username?: string };
  };
}

declare global {
  var __telegramPollers: Map<string, TelegramPollerState> | undefined;
  var __telegramMasterRunning: boolean | undefined;
}

// Global state persisted across Next.js API calls in development
const globalPollers: Map<string, TelegramPollerState> = globalThis.__telegramPollers || new Map();
globalThis.__telegramPollers = globalPollers;

let masterRunning: boolean = globalThis.__telegramMasterRunning || false;
globalThis.__telegramMasterRunning = masterRunning;

export async function getTelegramConfigs(): Promise<{
  token: string;
  enabled: boolean;
  agent: TelegramAgentTarget;
}[]> {
  try {
    const integrations = await prisma.agentIntegration.findMany({
      where: { platform: "telegram", enabled: true },
      include: { agent: true }
    });

    return integrations.map(i => {
      let config: { botToken?: string } = {};
      try { config = JSON.parse(i.config || "{}"); } catch {}
      return {
        agent: i.agent,
        token: (config.botToken || "") as string,
        enabled: i.enabled
      };
    }).filter(i => i.token);
  } catch (err) {
    console.error("[Telegram Service] Failed to read configs:", err);
    return [];
  }
}

export async function getTelegramConfig(): Promise<{
  token: string | null;
  enabled: boolean;
  assignedAgents: TelegramAgentTarget[];
}> {
  // Legacy stub to prevent breaking old API routes that were not yet migrated
  const configs = await getTelegramConfigs();
  if (configs.length > 0) {
    return { token: configs[0].token, enabled: configs[0].enabled, assignedAgents: [configs[0].agent] };
  }
  return { token: null, enabled: false, assignedAgents: [] };
}

export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  parseMode: "Markdown" | "HTML" | undefined = undefined
): Promise<{ ok: boolean; description?: string }> {
  try {
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 4000) {
      const splitIdx = remaining.lastIndexOf("\n", 4000) || 4000;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx);
    }
    chunks.push(remaining);

    for (const chunk of chunks) {
      const payload: { chat_id: number | string; text: string; parse_mode?: string } = {
        chat_id: chatId,
        text: chunk,
      };
      if (parseMode) payload.parse_mode = parseMode;

      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) {
        if (parseMode) {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chatId, text: chunk }),
          });
        }
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[Telegram Service] Error sending message:", err);
    return { ok: false, description: err instanceof Error ? err.message : "Network error" };
  }
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  token: string,
  agent: TelegramAgentTarget
): Promise<boolean> {
  const message = update?.message || update?.edited_message;
  if (!message || !message.text) return false;

  const chatId = message.chat.id;
  const userText = message.text.trim();
  const sender = message.from?.first_name || message.from?.username || "Telegram User";

  const aName = agent?.displayName || "Agent Studio OS";

  if (userText === "/start" || userText.startsWith("/start ")) {
    const welcome = `🤖 *Connected to ${aName}*\n\nWelcome ${sender}! I am ready to assist you.`;
    await sendTelegramMessage(token, chatId, welcome, "Markdown");
    return true;
  }

  if (userText === "/status") {
    const statusMsg = `⚡ *Agent Status*\n• Identity: **${aName}**\n• Connection: Active`;
    await sendTelegramMessage(token, chatId, statusMsg, "Markdown");
    return true;
  }

  try {
    fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, action: "typing" }),
    }).catch(() => {});
  } catch {}

  try {
    const completion = await executeChatCompletion({
      prompt: userText,
      model: agent?.model || "auto/fast",
      systemPrompt: agent?.systemPrompt || `You are ${aName}, an intelligent autonomous AI agent responding to the user via Telegram.`,
      agentName: agent?.name,
      useVaultRAG: true,
      useEpisodicMemory: true,
    });

    const replyText = completion.content || "I have received and processed your message.";
    const timeFormatted = formatResponseTime(completion.latency);

    await prisma.activityLog.create({
      data: {
        type: "device_message",
        message: `Telegram (@${message.from?.username || sender}): "${userText.slice(0, 35)}${userText.length > 35 ? "..." : ""}" → Replied by ${aName} (${timeFormatted})`,
        agentId: agent?.id || null,
      },
    });

    await sendTelegramMessage(token, chatId, replyText.trim());

    const state = globalPollers.get(token);
    if (state) {
      state.lastMessageAt = Date.now();
      state.processedCount++;
    }
    return true;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Error executing request";
    console.error("[Telegram Execution Error]:", err);
    await sendTelegramMessage(token, chatId, `⚠️ Sorry, an error occurred:\n${errorMsg}`);
    return false;
  }
}

export async function pollTelegramOnce(): Promise<{
  processed: number;
  error?: string;
}> {
  const configs = await getTelegramConfigs();
  if (configs.length === 0) {
    return { processed: 0, error: "No Telegram bot tokens configured" };
  }

  let totalProcessed = 0;
  
  for (const config of configs) {
    const token = config.token;
    if (!globalPollers.has(token)) {
      globalPollers.set(token, {
        running: masterRunning,
        activeToken: token,
        offset: 0,
        lastPollAt: null,
        lastMessageAt: null,
        processedCount: 0,
        lastError: null,
        assignedAgentNames: config.agent.displayName ?? null,
      });
    }

    const state = globalPollers.get(token)!;
    state.lastPollAt = Date.now();

    try {
      const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${state.offset}&timeout=5`;
      const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
      const data = await res.json();

      if (!data.ok) {
        state.lastError = data.description || "Telegram API error";
        continue;
      }

      const updates = data.result || [];
      let count = 0;

      for (const update of updates) {
        if (update.update_id >= state.offset) {
          state.offset = update.update_id + 1;
        }
        const success = await processTelegramUpdate(update, token, config.agent);
        if (success) count++;
      }

      state.lastError = null;
      totalProcessed += count;
    } catch (err) {
      state.lastError = err instanceof Error ? err.message : "Network error";
    }
  }

  return { processed: totalProcessed };
}

export function startTelegramPoller(): void {
  if (masterRunning) return;
  masterRunning = true;
  globalThis.__telegramMasterRunning = masterRunning;
  for (const state of globalPollers.values()) state.running = true;

  const runLoop = async () => {
    while (globalThis.__telegramMasterRunning) {
      try {
        await pollTelegramOnce();
      } catch (err) {
        console.error("[Telegram Poller Loop Error]:", err);
      }
      if (globalThis.__telegramMasterRunning) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  };

  runLoop();
}

export function stopTelegramPoller(): void {
  masterRunning = false;
  globalThis.__telegramMasterRunning = masterRunning;
  for (const state of globalPollers.values()) state.running = false;
}

export function getTelegramPollerStatus(): TelegramPollerState {
  let processedCount = 0;
  for (const state of globalPollers.values()) {
    processedCount += state.processedCount;
  }
  return {
    running: masterRunning,
    activeToken: null,
    offset: 0,
    lastPollAt: null,
    lastMessageAt: null,
    processedCount,
    lastError: null,
    assignedAgentNames: null,
  };
}
