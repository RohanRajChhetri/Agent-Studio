import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getTelegramConfig,
  pollTelegramOnce,
  startTelegramPoller,
  stopTelegramPoller,
  getTelegramPollerStatus,
  sendTelegramMessage,
} from "@/lib/telegram-service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentId = url.searchParams.get("agentId");

  if (agentId) {
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
      enabled: integration?.enabled ?? false,
      config: parsedConfig,
      agent: integration?.agent,
      poller: pollerState,
    });
  }

  const config = await getTelegramConfig();
  const pollerState = getTelegramPollerStatus();

  return NextResponse.json({
    configured: Boolean(config.token),
    enabled: config.enabled,
    config: { botToken: config.token },
    assignedAgents:
      config.assignedAgents?.map((a: any) => ({
        id: a.id,
        displayName: a.displayName,
        avatar: a.avatar,
      })) || [],
    poller: pollerState,
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

    // 1. Trigger an immediate poll and process pending messages
    if (action === "poll_now") {
      const result = await pollTelegramOnce();
      return NextResponse.json({
        success: true,
        processed: result.processed,
        error: result.error,
        status: getTelegramPollerStatus(),
      });
    }

    // 2. Start background polling loop
    if (action === "start_poller") {
      startTelegramPoller();
      // Also run one cycle immediately
      const firstPoll = await pollTelegramOnce();
      return NextResponse.json({
        success: true,
        message: "Telegram poller started",
        processed: firstPoll.processed,
        status: getTelegramPollerStatus(),
      });
    }

    // 3. Stop background polling loop
    if (action === "stop_poller") {
      stopTelegramPoller();
      return NextResponse.json({
        success: true,
        message: "Telegram poller stopped",
        status: getTelegramPollerStatus(),
      });
    }

    // 4. Set Webhook URL if user has a public tunnel / ngrok
    if (action === "set_webhook") {
      const config = await getTelegramConfig();
      if (!config.token) {
        return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 400 });
      }

      if (!webhookUrl) {
        // Delete webhook to re-enable getUpdates polling
        const delRes = await fetch(`https://api.telegram.org/bot${config.token}/deleteWebhook`);
        const delData = await delRes.json();
        return NextResponse.json({ success: delData.ok, message: "Webhook deleted. Polling mode active." });
      }

      const res = await fetch(`https://api.telegram.org/bot${config.token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
      const data = await res.json();
      return NextResponse.json({ success: data.ok, details: data });
    }

    // 5. Send test message
    if (action === "send_test") {
      const config = await getTelegramConfig();
      if (!config.token) {
        return NextResponse.json({ error: "Telegram bot token not configured" }, { status: 400 });
      }
      const chatId = body.chatId;
      if (!chatId) {
        return NextResponse.json({ error: "Chat ID required for test message" }, { status: 400 });
      }
      const result = await sendTelegramMessage(
        config.token,
        chatId,
        "👋 Hello from Agent Studio OS! Your integration is working perfectly."
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
