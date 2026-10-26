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
  userId?: string | null;
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

export interface UnifiedTelegramConfig {
  token: string | null;
  chatId: string | null;
  botUsername: string | null;
  enabled: boolean;
  assignedAgents: TelegramAgentTarget[];
}

export async function getTelegramConfig(): Promise<UnifiedTelegramConfig> {
  const configs = await getTelegramConfigs();
  let token: string | null = null;
  let chatId: string | null = null;
  let enabled = false;
  let assignedAgents: TelegramAgentTarget[] = [];

  if (configs.length > 0) {
    token = configs[0].token;
    enabled = configs[0].enabled;
    assignedAgents = configs.map((c) => c.agent);
  }

  // Also check database settings table and environment variables
  try {
    const [tokenSetting, chatIdSetting, botUserSetting] = await Promise.all([
      prisma.setting.findUnique({ where: { key: "telegram_bot_token" } }),
      prisma.setting.findUnique({ where: { key: "telegram_chat_id" } }),
      prisma.setting.findUnique({ where: { key: "telegram_bot_username" } }),
    ]);

    if (!token && tokenSetting?.value) {
      token = tokenSetting.value;
      enabled = true;
    }
    if (!token && process.env.TELEGRAM_BOT_TOKEN) {
      token = process.env.TELEGRAM_BOT_TOKEN;
      enabled = true;
    }

    if (chatIdSetting?.value) {
      chatId = chatIdSetting.value;
    } else if (process.env.TELEGRAM_CHAT_ID) {
      chatId = process.env.TELEGRAM_CHAT_ID;
    }

    // Also check agent integrations for any chatId in JSON config
    if (!chatId) {
      const integrations = await prisma.agentIntegration.findMany({
        where: { platform: "telegram" },
      });
      for (const integ of integrations) {
        try {
          const cfg = JSON.parse(integ.config || "{}");
          if (cfg.chatId) {
            chatId = String(cfg.chatId);
            break;
          }
        } catch {}
      }
    }

    return {
      token,
      chatId,
      botUsername: botUserSetting?.value || null,
      enabled: enabled || Boolean(token),
      assignedAgents,
    };
  } catch (err) {
    console.error("[Telegram Service] Error reading unified config:", err);
    return { token, chatId, botUsername: null, enabled, assignedAgents };
  }
}

/** Formats rich markdown text for Telegram presentation */
export function formatTextForTelegram(text: string): string {
  return text
    // Format markdown headers into clean bold headers
    .replace(/^###\s+(.*$)/gim, "\n*$1*")
    .replace(/^##\s+(.*$)/gim, "\n━━━━━━━━━━━━━━━━━━━━\n*$1*\n━━━━━━━━━━━━━━━━━━━━")
    .replace(/^#\s+(.*$)/gim, "*$1*\n")
    // Convert table lines into bullet points
    .replace(/\|\s*:?---+:?\s*/g, "")
    .replace(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g, "• *$1* | $2 — $3 ($4)")
    .replace(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g, "• *$1* — $2 ($3)")
    .replace(/\|\s*([^|\n]+)\s*\|\s*([^|\n]+)\s*\|/g, "• *$1*: $2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendTelegramMessage(
  token: string,
  chatId: number | string,
  text: string,
  parseMode: "Markdown" | "HTML" | undefined = undefined
): Promise<{ ok: boolean; description?: string }> {
  try {
    const formatted = parseMode === "Markdown" ? formatTextForTelegram(text) : text;
    const chunks: string[] = [];
    let remaining = formatted;
    while (remaining.length > 3900) {
      let splitIdx = remaining.lastIndexOf("\n\n", 3900);
      if (splitIdx <= 0) splitIdx = remaining.lastIndexOf("\n", 3900);
      if (splitIdx <= 0) splitIdx = 3900;
      chunks.push(remaining.slice(0, splitIdx));
      remaining = remaining.slice(splitIdx).trimStart();
    }
    if (remaining.length > 0) chunks.push(remaining);

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
        // Fallback to plain text if markdown formatting failed
        const fallbackRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: chunk.replace(/[*_`]/g, "") }),
        });
        const fallbackData = await fallbackRes.json();
        if (!fallbackData.ok) {
          return { ok: false, description: fallbackData.description || data.description };
        }
      }
    }
    return { ok: true };
  } catch (err) {
    console.error("[Telegram Service] Error sending message:", err);
    return { ok: false, description: err instanceof Error ? err.message : "Network error" };
  }
}

/** Auto-detects the latest chat ID that messaged the Telegram bot via getUpdates */
export async function autoDetectTelegramChatId(token: string): Promise<{
  success: boolean;
  chatId?: string;
  username?: string;
  firstName?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=20&timeout=0`);
    const data = await res.json();
    if (!data.ok) {
      return { success: false, error: data.description || "Failed to fetch updates from Telegram" };
    }

    const updates = data.result || [];
    // Traverse backwards from newest update to find any chat
    for (let i = updates.length - 1; i >= 0; i--) {
      const update = updates[i];
      const msg = update?.message || update?.edited_message || update?.channel_post;
      if (msg && msg.chat?.id) {
        const foundChatId = String(msg.chat.id);
        const username = msg.from?.username || msg.chat?.username || "";
        const firstName = msg.from?.first_name || msg.chat?.title || "";

        // Persist to setting
        await prisma.setting.upsert({
          where: { key: "telegram_chat_id" },
          update: { value: foundChatId },
          create: { key: "telegram_chat_id", value: foundChatId },
        });

        if (username) {
          await prisma.setting.upsert({
            where: { key: "telegram_chat_user" },
            update: { value: `@${username}` },
            create: { key: "telegram_chat_user", value: `@${username}` },
          });
        }

        return {
          success: true,
          chatId: foundChatId,
          username,
          firstName,
        };
      }
    }

    return {
      success: false,
      error: "No incoming messages found yet. Open Telegram, send /start to your bot, and try Auto-Detect again.",
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to query Telegram API" };
  }
}

/** Saves Telegram Bot Token and Chat ID to persistent settings and agent integration */
export async function saveTelegramConfig(params: {
  token: string;
  chatId?: string;
  agentId?: string;
}): Promise<{ success: boolean; botUsername?: string; error?: string }> {
  try {
    const { token, chatId, agentId } = params;
    const cleanToken = token.trim();
    const cleanChatId = chatId ? String(chatId).trim() : undefined;

    // Verify token with Telegram API
    const testRes = await fetch(`https://api.telegram.org/bot${cleanToken}/getMe`);
    const testData = await testRes.json();
    if (!testData.ok) {
      return { success: false, error: testData.description || "Invalid Telegram bot token" };
    }

    const botUsername = testData.result?.username || "";

    // Save globally to settings table
    await Promise.all([
      prisma.setting.upsert({
        where: { key: "telegram_bot_token" },
        update: { value: cleanToken },
        create: { key: "telegram_bot_token", value: cleanToken },
      }),
      prisma.setting.upsert({
        where: { key: "telegram_bot_username" },
        update: { value: botUsername },
        create: { key: "telegram_bot_username", value: botUsername },
      }),
      ...(cleanChatId
        ? [
            prisma.setting.upsert({
              where: { key: "telegram_chat_id" },
              update: { value: cleanChatId },
              create: { key: "telegram_chat_id", value: cleanChatId },
            }),
          ]
        : []),
    ]);

    // Update agent integration
    const targetAgent = agentId
      ? await prisma.agent.findUnique({ where: { id: agentId } })
      : await prisma.agent.findFirst();

    if (targetAgent) {
      const configObj: Record<string, any> = { botToken: cleanToken };
      if (cleanChatId) configObj.chatId = cleanChatId;

      await prisma.agentIntegration.upsert({
        where: {
          agentId_platform: {
            agentId: targetAgent.id,
            platform: "telegram",
          },
        },
        update: {
          enabled: true,
          config: JSON.stringify(configObj),
        },
        create: {
          agentId: targetAgent.id,
          platform: "telegram",
          enabled: true,
          config: JSON.stringify(configObj),
        },
      });
    }

    return { success: true, botUsername };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to save configuration" };
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

  // Automatically remember active chat ID for future dispatches
  try {
    await prisma.setting.upsert({
      where: { key: "telegram_chat_id" },
      update: { value: String(chatId) },
      create: { key: "telegram_chat_id", value: String(chatId) },
    });
    if (message.from?.username) {
      await prisma.setting.upsert({
        where: { key: "telegram_chat_user" },
        update: { value: `@${message.from.username}` },
        create: { key: "telegram_chat_user", value: `@${message.from.username}` },
      });
    }
  } catch {}

  const aName = agent?.displayName || "Agent Studio OS";

  // Check and dispatch mobile commands (/tasks, /run, /approve, /ask, /briefing, /status, /help)
  const { routeMobileCommand } = await import("@/lib/omnichannel-router");
  const commandResult = await routeMobileCommand(userText, {
    sender,
    channel: "telegram",
    defaultAgent: agent,
  });

  if (commandResult.handled) {
    await sendTelegramMessage(token, chatId, commandResult.replyText, commandResult.parseMode || "Markdown");
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
        userId: agent?.userId || null,
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
    await sendTelegramMessage(token, chatId, `Sorry, an error occurred:\n${errorMsg}`);
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
