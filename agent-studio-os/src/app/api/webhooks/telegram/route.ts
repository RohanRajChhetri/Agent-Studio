import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhooks/telegram/[token]",
    description: "Telegram Bot Webhook Receiver",
    timestamp: new Date().toISOString(),
  });
}

export async function POST() {
  return NextResponse.json(
    { error: "Use /api/webhooks/telegram/[token] instead." },
    { status: 400 }
  );
}
