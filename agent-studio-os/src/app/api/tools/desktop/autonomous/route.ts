import { NextRequest, NextResponse } from "next/server";
import { executeAutonomousDesktopTask } from "@/lib/autonomous-desktop-loop";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tools/desktop/autonomous
 * Execute an autonomous desktop goal with multi-step vision & mouse/keyboard automation.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goal } = body;

    if (!goal || typeof goal !== "string" || !goal.trim()) {
      return NextResponse.json(
        { error: "Missing required parameter: 'goal'" },
        { status: 400 }
      );
    }

    const result = await executeAutonomousDesktopTask(goal.trim());

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `Autonomous Desktop Operator: "${goal.slice(0, 50)}" (${result.stepsExecuted} steps, ${result.totalLatency}ms)`,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Autonomous Desktop API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Autonomous desktop task execution failed" },
      { status: 500 }
    );
  }
}
