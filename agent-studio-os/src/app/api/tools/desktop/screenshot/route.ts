import { NextResponse } from "next/server";
import { executeCUAAction, isCUADriverAvailable } from "@/lib/cua-driver";
import { getCUATelemetry } from "@/lib/cua-telemetry";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/tools/desktop/screenshot
 * Capture and return current desktop screenshot with live agent telemetry.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const since = parseInt(url.searchParams.get("since") || "0", 10);
    const result = await executeCUAAction({ type: "screenshot" });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to capture screenshot" },
        { status: 500 }
      );
    }

    // Use latest-desktop.jpg which is updated in-place by the CUA native engine
    const fileUrl = `/downloads/latest-desktop.jpg?t=${Date.now()}`;
    const imageUrl = fileUrl;
    const telemetry = getCUATelemetry(since);

    return NextResponse.json({
      success: true,
      screenshot: result.screenshot,
      imageUrl,
      fileUrl,
      latency: result.latency,
      timestamp: new Date().toISOString(),
      telemetry: {
        events: telemetry.events,
        cursor: telemetry.cursor,
        latestStep: telemetry.latestStep,
      },
    });
  } catch (err) {
    console.error("[Desktop Screenshot API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Screenshot capture failed" },
      { status: 500 }
    );
  }
}
