import { NextResponse } from "next/server";
import { executeCUAAction, isCUADriverAvailable } from "@/lib/cua-driver";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tools/desktop/screenshot
 * Capture and return current desktop screenshot.
 */
export async function GET() {
  try {
    const result = await executeCUAAction({ type: "screenshot" });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to capture screenshot" },
        { status: 500 }
      );
    }

    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `Captured desktop screenshot (${result.latency}ms)`,
      },
    });

    return NextResponse.json({
      success: true,
      screenshot: result.screenshot,
      latency: result.latency,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Desktop Screenshot API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Screenshot capture failed" },
      { status: 500 }
    );
  }
}
