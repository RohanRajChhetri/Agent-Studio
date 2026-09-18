import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isOmnirouteOnline } from "@/lib/omniroute";
import { countVaultNotes } from "@/lib/vault";
import { getActiveApiKeys, testProviderKey } from "@/lib/llm-router";

// In-memory cache for live ping latencies (15s TTL to avoid flooding upstream APIs)
let cachedProviderLatencies: { data: any[]; expiresAt: number } | null = null;

export function invalidateProviderLatencyCache() {
  cachedProviderLatencies = null;
}

export async function GET() {
  try {
    const [agentCount, taskStats, recentActivity, omnirouteOnline, vaultNotes, allAgents, activeKeys] =
      await Promise.all([
        prisma.agent.count(),
        prisma.task.groupBy({
          by: ["status"],
          _count: true,
        }),
        prisma.activityLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
        isOmnirouteOnline(),
        countVaultNotes(),
        prisma.agent.findMany({
          select: {
            id: true,
            name: true,
            displayName: true,
            avatar: true,
            role: true,
            model: true,
            status: true,
            department: true,
            themeColor: true,
          },
        }),
        getActiveApiKeys(),
      ]);

    const activeTasks = taskStats
      .filter((t) => t.status !== "done")
      .reduce((sum, t) => sum + t._count, 0);

    const completedTasks = taskStats.find((t) => t.status === "done")?._count || 0;

    // Count online/active agents
    const onlineAgentsCount = allAgents.filter(
      (a) => a.status === "online" || a.status === "busy"
    ).length;

    // Calculate approximate fleet token metrics
    const totalTokensUsed = allAgents.length * 2800 + recentActivity.length * 420;
    const estimatedCostUsd = ((totalTokensUsed / 1_000_000) * 1.5).toFixed(4);

    // Build real dynamic provider statuses based on ONLY ACTUAL user configuration
    const now = Date.now();
    let providerLatencies: any[] = [];

    if (cachedProviderLatencies && cachedProviderLatencies.expiresAt > now) {
      providerLatencies = cachedProviderLatencies.data;
    } else {
      const checkTasks: Promise<void>[] = [];

      // 1. Omniroute Router (Only if server running or configured)
      if (omnirouteOnline || activeKeys.OMNIROUTE_URL) {
        checkTasks.push(
          (async () => {
            let omniLatency = 0;
            if (omnirouteOnline) {
              try {
                const t0 = Date.now();
                const r = await fetch("http://127.0.0.1:20128/v1/models", {
                  signal: AbortSignal.timeout(1000),
                  headers: activeKeys.OMNIROUTE_API_KEY
                    ? { Authorization: `Bearer ${activeKeys.OMNIROUTE_API_KEY}` }
                    : {},
                });
                if (r.ok) omniLatency = Date.now() - t0;
              } catch {}
            }

            providerLatencies.push({
              name: "Omniroute Router",
              status: omnirouteOnline ? "healthy" : "offline",
              latencyMs: omniLatency || (omnirouteOnline ? 5 : 0),
              model: omnirouteOnline ? "Cascade Auto-Route (Port 20128)" : "Router Offline",
              isConfigured: true,
            });
          })()
        );
      }

      // 2. Google Gemini (Only if key is configured)
      if (activeKeys.GEMINI_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("gemini", activeKeys.GEMINI_API_KEY);
            providerLatencies.push({
              name: "Google Gemini",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "gemini-2.5-flash / 2.0",
              isConfigured: true,
            });
          })()
        );
      }

      // 3. OmniRoute Gateway / OpenRouter (Only if key is configured)
      if (activeKeys.OPENROUTER_API_KEY || activeKeys.OMNIROUTE_API_KEY) {
        checkTasks.push(
          (async () => {
            const key = activeKeys.OPENROUTER_API_KEY || activeKeys.OMNIROUTE_API_KEY;
            const test = await testProviderKey("openrouter", key);
            providerLatencies.push({
              name: "OpenRouter Gateway",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "OpenRouter Multi-Model",
              isConfigured: true,
            });
          })()
        );
      }

      // 4. Groq High-Speed (Only if key is configured)
      if (activeKeys.GROQ_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("groq", activeKeys.GROQ_API_KEY);
            providerLatencies.push({
              name: "Groq High-Speed",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "llama-3.3-70b-versatile",
              isConfigured: true,
            });
          })()
        );
      }

      // 5. Anthropic Claude (Only if key is configured)
      if (activeKeys.ANTHROPIC_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("anthropic", activeKeys.ANTHROPIC_API_KEY);
            providerLatencies.push({
              name: "Anthropic Claude",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "claude-3-7-sonnet",
              isConfigured: true,
            });
          })()
        );
      }

      // 6. OpenAI (Only if key is configured)
      if (activeKeys.OPENAI_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("openai", activeKeys.OPENAI_API_KEY);
            providerLatencies.push({
              name: "OpenAI",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "gpt-4o / o3-mini",
              isConfigured: true,
            });
          })()
        );
      }

      // 7. DeepSeek (Only if key is configured)
      if (activeKeys.DEEPSEEK_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("deepseek", activeKeys.DEEPSEEK_API_KEY);
            providerLatencies.push({
              name: "DeepSeek",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "deepseek-chat / r1",
              isConfigured: true,
            });
          })()
        );
      }

      // 8. xAI Grok (Only if key is configured)
      if (activeKeys.XAI_API_KEY) {
        checkTasks.push(
          (async () => {
            const test = await testProviderKey("xai", activeKeys.XAI_API_KEY);
            providerLatencies.push({
              name: "xAI (Grok)",
              status: test.success ? "healthy" : "offline",
              latencyMs: test.latency || 0,
              model: "grok-2",
              isConfigured: true,
            });
          })()
        );
      }

      await Promise.all(checkTasks);
      cachedProviderLatencies = { data: providerLatencies, expiresAt: now + 30000 };
    }

    return NextResponse.json({
      stats: {
        totalAgents: agentCount,
        onlineAgents: onlineAgentsCount,
        activeTasks,
        completedTasks,
        vaultNotes,
        omnirouteOnline,
        totalTokensUsed,
        estimatedCostUsd,
      },
      activity: recentActivity,
      taskBreakdown: taskStats,
      providerLatencies,
      fleetSummary: allAgents,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
