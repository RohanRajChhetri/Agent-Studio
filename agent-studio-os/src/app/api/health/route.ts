import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveApiKeys } from "@/lib/router-execution";
import { fleetEventBus } from "@/lib/event-bus";
import fs from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const checks: Record<string, any> = {};
  let isHealthy = true;

  // 1. Database Connectivity & Latency Check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 as alive`;
    checks.database = {
      status: "ok",
      latencyMs: Date.now() - dbStart,
    };
  } catch (dbErr: any) {
    isHealthy = false;
    checks.database = {
      status: "error",
      error: dbErr?.message || "Database query failed",
      latencyMs: Date.now() - dbStart,
    };
  }

  // 2. Storage / Workspace Access Check
  const storageStart = Date.now();
  try {
    const workspacePath = path.join(process.cwd(), "agent-workspace");
    await fs.access(workspacePath).catch(() => fs.mkdir(workspacePath, { recursive: true }));
    checks.storage = {
      status: "ok",
      workspaceAvailable: true,
      latencyMs: Date.now() - storageStart,
    };
  } catch (storageErr: any) {
    checks.storage = {
      status: "degraded",
      workspaceAvailable: false,
      error: storageErr?.message || "Storage access issue",
      latencyMs: Date.now() - storageStart,
    };
  }

  // 3. Provider Configuration Status (Zero Leakage)
  try {
    const keys = await getActiveApiKeys();
    checks.providers = {
      gemini: Boolean(keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY),
      openai: Boolean(keys.OPENAI_API_KEY),
      groq: Boolean(keys.GROQ_API_KEY),
      anthropic: Boolean(keys.ANTHROPIC_API_KEY),
      openrouter: Boolean(keys.OPENROUTER_API_KEY || keys.OMNIROUTE_API_KEY),
      totalConfigured: [
        keys.GEMINI_API_KEY || keys.GOOGLE_API_KEY,
        keys.OPENAI_API_KEY,
        keys.GROQ_API_KEY,
        keys.ANTHROPIC_API_KEY,
        keys.OPENROUTER_API_KEY || keys.OMNIROUTE_API_KEY,
      ].filter(Boolean).length,
    };
  } catch {
    checks.providers = { status: "unknown" };
  }

  // 4. Real-time Event Bus Metrics
  checks.eventBus = {
    activeSseSubscribers: fleetEventBus.getSubscriberCount(),
    cachedRecentEvents: fleetEventBus.getRecent().length,
  };

  // 5. Memory & Process Metrics
  const mem = process.memoryUsage();
  checks.system = {
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    memoryMb: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
    },
  };

  const totalLatencyMs = Date.now() - startTime;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "unhealthy",
      timestamp: new Date().toISOString(),
      latencyMs: totalLatencyMs,
      checks,
    },
    {
      status: isHealthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
