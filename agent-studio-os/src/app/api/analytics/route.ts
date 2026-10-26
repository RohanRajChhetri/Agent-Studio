import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const [messages, tasks, activityLogs] = await Promise.all([
      prisma.chatMessage.findMany({
        select: {
          id: true,
          model: true,
          latency: true,
          tokens: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      prisma.task.findMany({
        select: {
          id: true,
          status: true,
          priority: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.activityLog.findMany({
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    // Aggregate tokens and latency
    let totalTokens = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const modelDistribution: Record<string, { count: number; totalLatency: number; tokens: number }> = {};

    messages.forEach((m) => {
      const tokens = m.tokens || Math.max(1, Math.round(50));
      totalTokens += tokens;

      if (m.latency && m.latency > 0) {
        totalLatency += m.latency;
        latencyCount++;
      }

      const modelKey = m.model || "auto/fast";
      if (!modelDistribution[modelKey]) {
        modelDistribution[modelKey] = { count: 0, totalLatency: 0, tokens: 0 };
      }
      modelDistribution[modelKey].count++;
      modelDistribution[modelKey].tokens += tokens;
      if (m.latency) modelDistribution[modelKey].totalLatency += m.latency;
    });

    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 420;

    // Estimate cost across model tiers
    let estimatedCostUsd = 0;
    Object.entries(modelDistribution).forEach(([model, stat]) => {
      const lower = model.toLowerCase();
      let ratePerMillion = 0.5; // default fallback $0.50 per M tokens
      if (lower.includes("gemini")) ratePerMillion = 0.15;
      else if (lower.includes("claude-3-7") || lower.includes("claude-3.5-sonnet") || lower.includes("claude-3-5")) ratePerMillion = 3.0;
      else if (lower.includes("gpt-4o")) ratePerMillion = 2.5;
      else if (lower.includes("o1") || lower.includes("o3")) ratePerMillion = 10.0;
      else if (lower.includes("groq") || lower.includes("llama")) ratePerMillion = 0.08;
      else if (lower.includes("deepseek")) ratePerMillion = 0.25;
      else if (lower.includes("ollama") || lower.includes("local") || lower.includes("omniroute")) ratePerMillion = 0.0;

      estimatedCostUsd += (stat.tokens / 1_000_000) * ratePerMillion;
    });

    // Task status counts
    const taskStatusCounts = {
      backlog: tasks.filter((t) => t.status === "backlog").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      review: tasks.filter((t) => t.status === "review").length,
      done: tasks.filter((t) => t.status === "done").length,
      total: tasks.length,
    };

    // Format top models
    const topModels = Object.entries(modelDistribution)
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        tokens: stat.tokens,
        avgLatency: stat.count > 0 && stat.totalLatency > 0 ? Math.round(stat.totalLatency / stat.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      metrics: {
        totalMessages: messages.length,
        totalTokens,
        avgLatencyMs: avgLatency,
        estimatedCostUsd: Number(estimatedCostUsd.toFixed(4)),
        tasks: taskStatusCounts,
        topModels,
        activityLogsCount: activityLogs.length,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to compute analytics" },
      { status: 500 }
    );
  }
}
