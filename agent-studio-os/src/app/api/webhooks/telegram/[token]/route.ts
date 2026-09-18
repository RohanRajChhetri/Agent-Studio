import { NextResponse } from "next/server";
import { getTelegramConfigs, processTelegramUpdate } from "@/lib/telegram-service";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const update = await request.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { token } = await params;
    const configs = await getTelegramConfigs();
    const config = configs.find((c) => c.token === token);
    
    if (!config) {
      return NextResponse.json({ error: "Telegram bot token not recognized" }, { status: 404 });
    }

    const processed = await processTelegramUpdate(update, token, config.agent);
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[Telegram Webhook POST Error]:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
