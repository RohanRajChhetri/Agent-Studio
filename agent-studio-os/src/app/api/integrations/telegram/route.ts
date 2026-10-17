import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  pollTelegramOnce,
  startTelegramPoller,
  stopTelegramPoller,
  getTelegramPollerStatus,
  sendTelegramMessage,
  autoDetectTelegramChatId,
  saveTelegramConfig,
} from "@/lib/telegram-service";

import { getUserScopedWhere, getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");
  const userId = await getAuthUserId();

  if (agentId) {
    const agent = await prisma.agent.findFirst({
      where: await getUserScopedWhere({ id: agentId }),
    });

    if (!agent) {
      return NextResponse.json({
        configured: false,
        hasToken: false,
        hasChatId: false,
        enabled: false,
        poller: getTelegramPollerStatus(),
      });
    }

    const integration = await prisma.agentIntegration.findUnique({
      where: { agentId_platform: { agentId, platform: "telegram" } },
      include: { agent: true },
    });

    let parsedConfig: any = {};
    if (integration?.config) {
      try {
        parsedConfig = JSON.parse(integration.config);
      } catch {}
    }

    const pollerState = getTelegramPollerStatus();
    return NextResponse.json({
      configured: Boolean(parsedConfig.botToken),
      hasToken: Boolean(parsedConfig.botToken),
      hasChatId: Boolean(parsedConfig.chatId),
      enabled: integration?.enabled ?? false,
      config: parsedConfig,
      agent: integration?.agent,
      poller: pollerState,
    });
  }

  // If user is primary legacy user, return their existing system/agent telegram configs
  if (userId === PRIMARY_LEGACY_USER_ID) {
    const config = await getTelegramConfig();
    const pollerState = getTelegramPollerStatus();

    return NextResponse.json({
      configured: Boolean(config.token && config.chatId),
      hasToken: Boolean(config.token),
      hasChatId: Boolean(config.chatId),
      enabled: config.enabled,
      config: {
        botToken: config.token,
        chatId: config.chatId,
        botUsername: config.botUsername,
      },
      assignedAgents:
        config.assignedAgents?.map((a: any) => ({
          id: a.id,
          displayName: a.displayName,
          avatar: a.avatar,
        })) || [],
      poller: pollerState,
    });
  }

  // For any new user, only search for integrations attached to their own agents
  const userAgents = await prisma.agent.findMany({
    where: await getUserScopedWhere(),
    select: { id: true, displayName: true, avatar: true },
  });
  const userAgentIds = userAgents.map((a) => a.id);

  if (userAgentIds.length > 0) {
    const integration = await prisma.agentIntegration.findFirst({
      where: {
        agentId: { in: userAgentIds },
        platform: "telegram",
      },
      include: { agent: true },
    });

    if (integration?.config) {
      try {
        const parsed = JSON.parse(integration.config);
        const pollerState = getTelegramPollerStatus();
        return NextResponse.json({
          configured: Boolean(parsed.botToken && parsed.chatId),
          hasToken: Boolean(parsed.botToken),
          hasChatId: Boolean(parsed.chatId),
          enabled: integration.enabled,
          config: {
            botToken: parsed.botToken,
            chatId: parsed.chatId,
            botUsername: parsed.botUsername,
          },
          assignedAgents: [
            {
              id: integration.agent.id,
              displayName: integration.agent.displayName,
              avatar: integration.agent.avatar,
            },
          ],
          poller: pollerState,
        });
      } catch {}
    }
  }

  // Clean unconfigured slate for new users
  return NextResponse.json({
    configured: false,
    hasToken: false,
    hasChatId: false,
    enabled: false,
    config: {
      botToken: null,
      chatId: null,
      botUsername: null,
    },
    assignedAgents: [],
    poller: getTelegramPollerStatus(),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, webhookUrl } = body;

    // 0. Verify Bot Token against Telegram API
    if (action === "test_token") {
      const token = body.token || (await getTelegramConfig()).token;
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Bot token is required" },
          { status: 400 }
        );
      }

      try {
        const tgRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const tgData = await tgRes.json();
        if (tgData.ok) {
          return NextResponse.json({
            success: true,
            bot: tgData.result,
            username: tgData.result.username,
            firstName: tgData.result.first_name,
          });
        } else {
          return NextResponse.json({
            success: false,
            error: tgData.description || "Invalid Telegram bot token",
          });
        }
      } catch (err: any) {
        return NextResponse.json({
          success: false,
          error: err.message || "Failed to reach Telegram API",
        });
      }
    }

    // 1. Auto-detect user Chat ID from incoming bot messages
    if (action === "auto_detect_chat_id") {
      const token = body.token || (await getTelegramConfig()).token;
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Bot token is required for auto-detect" },
          { status: 400 }
        );
      }
      const detectResult = await autoDetectTelegramChatId(token);
      return NextResponse.json(detectResult);
    }

    // 2. Save Telegram Configuration
    if (action === "save_config") {
      const token = body.token || body.botToken;
      if (!token) {
        return NextResponse.json(
          { success: false, error: "Bot token is required to save configuration" },
          { status: 400 }
        );
      }
      const saveResult = await saveTelegramConfig({
        token,
        chatId: body.chatId,
        agentId: body.agentId,
      });
      return NextResponse.json(saveResult);
    }

    // 3. Dispatch Briefing or Arbitrary Message to Telegram
    if (
      action === "send_briefing" ||
      action === "send_message" ||
      (body.message && !action)
    ) {
      const config = await getTelegramConfig();
      const token = body.token || config.token;

      if (!token) {
        return NextResponse.json(
          {
            success: false,
            notConfigured: true,
            reason: "missing_token",
            error: "Telegram bot token is not configured yet. Please configure your bot token in Settings or setup modal.",
          },
          { status: 400 }
        );
      }

      let chatId = body.chatId || config.chatId;

      // If no chatId is stored, attempt one-shot auto-detect in case user already sent /start
      if (!chatId) {
        const auto = await autoDetectTelegramChatId(token);
        if (auto.success && auto.chatId) {
          chatId = auto.chatId;
        }
      }

      if (!chatId) {
        return NextResponse.json(
          {
            success: false,
            notConfigured: true,
            reason: "missing_chat_id",
            botUsername: config.botUsername,
            error: "Telegram Chat ID is not configured. Send /start to your Telegram bot or specify your Chat ID.",
          },
          { status: 400 }
        );
      }

      const messageText = body.message;
      if (!messageText || typeof messageText !== "string") {
        return NextResponse.json(
          { success: false, error: "Message content is required" },
          { status: 400 }
        );
      }

      const result = await sendTelegramMessage(token, chatId, messageText, "Markdown");
      if (result.ok) {
        await prisma.activityLog.create({
          data: {
            type: "telegram_dispatch",
            message: `Dispatched Daily Executive Briefing to Telegram (Chat ID: ${chatId})`,
            metadata: JSON.stringify({ chatId, length: messageText.length }),
          },
        });
        return NextResponse.json({
          success: true,
          message: "Daily Executive Briefing successfully delivered to Telegram!",
          chatId,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.description || "Failed to deliver message to Telegram",
          },
          { status: 500 }
        );
      }
    }

    // 4. Trigger an immediate poll and process pending messages
    if (action === "poll_now") {
      const result = await pollTelegramOnce();
      return NextResponse.json({
        success: true,
        processed: result.processed,
        error: result.error,
        status: getTelegramPollerStatus(),
      });
    }

    // 5. Start background polling loop
    if (action === "start_poller") {
      startTelegramPoller();
      const firstPoll = await pollTelegramOnce();
      return NextResponse.json({
        success: true,
        message: "Telegram poller started",
        processed: firstPoll.processed,
        status: getTelegramPollerStatus(),
      });
    }

    // 6. Stop background polling loop
    if (action === "stop_poller") {
      stopTelegramPoller();
      return NextResponse.json({
        success: true,
        message: "Telegram poller stopped",
        status: getTelegramPollerStatus(),
      });
    }

    // 7. Set Webhook URL if user has a public tunnel / ngrok
    if (action === "set_webhook") {
      const config = await getTelegramConfig();
      if (!config.token) {
        return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 400 });
      }

      if (!webhookUrl) {
        const delRes = await fetch(`https://api.telegram.org/bot${config.token}/deleteWebhook`);
        const delData = await delRes.json();
        return NextResponse.json({ success: delData.ok, message: "Webhook deleted. Polling mode active." });
      }

      const res = await fetch(`https://api.telegram.org/bot${config.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return NextResponse.json({ success: data.ok, details: data });
    }

    // 8. Send test message
    if (action === "send_test") {
      const config = await getTelegramConfig();
      const token = body.token || config.token;
      if (!token) {
        return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 400 });
      }
      const chatId = body.chatId || config.chatId;
      if (!chatId) {
        return NextResponse.json({ error: "Chat ID required for test message" }, { status: 400 });
      }
      const result = await sendTelegramMessage(
        token,
        chatId,
        "👋 Hello from Agent Studio OS! Your Telegram integration is fully operational."
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("[Telegram API Error]:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
