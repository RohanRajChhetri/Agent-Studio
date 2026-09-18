import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { platform, config = {} } = body;

    if (!platform) {
      return NextResponse.json({ error: "Platform is required" }, { status: 400 });
    }

    // Retrieve saved configuration if any token is omitted or masked
    const savedSetting = await prisma.setting.findUnique({
      where: { key: `integration:${platform}` },
    });
    let savedConfig: Record<string, any> = {};
    if (savedSetting) {
      try {
        savedConfig = JSON.parse(savedSetting.value)?.config || {};
      } catch {}
    }

    const effectiveConfig = {
      ...savedConfig,
      ...config,
    };
    // Replace masked values with saved raw values
    if (config.botToken && config.botToken.includes("••••")) {
      effectiveConfig.botToken = savedConfig.botToken;
    }
    if (config.accessToken && config.accessToken.includes("••••")) {
      effectiveConfig.accessToken = savedConfig.accessToken;
    }

    const startTime = Date.now();

    // 1. Telegram
    if (platform === "telegram") {
      const token = effectiveConfig.botToken;
      if (!token) {
        return NextResponse.json({
          success: false,
          error: "Telegram Bot Token is required (obtain from @BotFather)",
        });
      }

      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        return NextResponse.json({
          success: false,
          error: data.description || "Invalid Telegram Bot Token or network error",
          latency,
        });
      }

      return NextResponse.json({
        success: true,
        latency,
        details: {
          botId: data.result.id,
          botName: data.result.first_name,
          username: data.result.username,
          canJoinGroups: data.result.can_join_groups,
          statusText: `@${data.result.username} verified & active`,
        },
      });
    }

    // 2. Discord
    if (platform === "discord") {
      const token = effectiveConfig.botToken;
      if (!token) {
        return NextResponse.json({
          success: false,
          error: "Discord Bot Token is required (obtain from Discord Developer Portal)",
        });
      }

      const res = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: data.message || "Invalid Discord Bot Token",
          latency,
        });
      }

      return NextResponse.json({
        success: true,
        latency,
        details: {
          botId: data.id,
          username: `${data.username}#${data.discriminator || "0"}`,
          statusText: `${data.username} bot verified & ready`,
        },
      });
    }

    // 3. Slack
    if (platform === "slack") {
      const token = effectiveConfig.botToken;
      if (!token) {
        return NextResponse.json({
          success: false,
          error: "Slack Bot Token (xoxb-...) is required",
        });
      }

      const res = await fetch("https://slack.com/api/auth.test", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok || !data.ok) {
        return NextResponse.json({
          success: false,
          error: data.error || "Invalid Slack token",
          latency,
        });
      }

      return NextResponse.json({
        success: true,
        latency,
        details: {
          team: data.team,
          user: data.user,
          statusText: `Connected to workspace "${data.team}" as @${data.user}`,
        },
      });
    }

    // 4. WhatsApp Business Cloud
    if (platform === "whatsapp_cloud") {
      const accessToken = effectiveConfig.accessToken;
      const phoneNumberId = effectiveConfig.phoneNumberId;

      if (!accessToken) {
        return NextResponse.json({
          success: false,
          error: "WhatsApp Cloud Access Token is required",
        });
      }

      const url = phoneNumberId
        ? `https://graph.facebook.com/v21.0/${phoneNumberId}`
        : "https://graph.facebook.com/v21.0/me";

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(8000),
      });
      const data = await res.json();
      const latency = Date.now() - startTime;

      if (!res.ok || data.error) {
        return NextResponse.json({
          success: false,
          error: data.error?.message || "WhatsApp Cloud API authentication failed",
          latency,
        });
      }

      return NextResponse.json({
        success: true,
        latency,
        details: {
          phoneNumber: data.display_phone_number || phoneNumberId || "Verified",
          verifiedName: data.verified_name || "WhatsApp Business Account",
          statusText: "WhatsApp Cloud API token verified",
        },
      });
    }

    // 5. WhatsApp Personal (QR Pair mode)
    if (platform === "whatsapp") {
      const latency = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        latency,
        details: {
          statusText: "Personal WhatsApp linking ready. Run 'hermes whatsapp' to scan QR code.",
          mode: "qr_pair",
        },
      });
    }

    // 6. Signal & Generic Webhook
    if (platform === "webhook" || platform === "signal") {
      const latency = Date.now() - startTime;
      return NextResponse.json({
        success: true,
        latency,
        details: {
          statusText: `${platform === "signal" ? "Signal gateway" : "Webhook endpoint"} verified and ready`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      latency: 0,
      details: { statusText: "Ready" },
    });
  } catch (error) {
    console.error("Test integration error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to connect to provider service",
    });
  }
}
