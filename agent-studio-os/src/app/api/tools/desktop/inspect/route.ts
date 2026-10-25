import { NextRequest, NextResponse } from "next/server";
import { executeCUAAction } from "@/lib/cua-driver";

/**
 * GET /api/tools/desktop/inspect
 * Inspect the UI element tree of the desktop or a specific application.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const app = searchParams.get("app") || undefined;

    const result = await executeCUAAction({
      type: "inspect",
      target: app,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to inspect desktop UI" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Desktop Inspect API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "UI inspection failed" },
      { status: 500 }
    );
  }
}
