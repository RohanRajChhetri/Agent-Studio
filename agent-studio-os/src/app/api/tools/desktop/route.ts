import { NextRequest, NextResponse } from "next/server";
import { executeCUAAction, isCUADriverAvailable } from "@/lib/cua-driver";
import type { CUAAction } from "@/lib/cua-driver";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/tools/desktop
 * Execute a CUA desktop automation action.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action_type,
      target,
      text,
      coordinates,
      fromCoordinates,
      key,
      combo,
      direction,
      amount,
      duration,
      smooth,
      stepTitle,
      source,
    } = body;

    if (!action_type || typeof action_type !== "string") {
      return NextResponse.json(
        { error: "Missing required field: action_type." },
        { status: 400 }
      );
    }

    const validActions = [
      "click",
      "double_click",
      "right_click",
      "mouse_move",
      "move",
      "drag",
      "type",
      "screenshot",
      "scroll",
      "key",
      "hotkey",
      "inspect",
      "launch",
      "active_window",
      "wait",
      "sleep",
    ];
    if (!validActions.includes(action_type)) {
      return NextResponse.json(
        { error: `Invalid action_type: "${action_type}". Supported: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const action: CUAAction = {
      type: action_type as CUAAction["type"],
      target,
      text,
      coordinates,
      fromCoordinates,
      key,
      combo,
      direction,
      amount,
      duration,
      smooth,
      stepTitle,
      source: source || "human",
    };

    const result = await executeCUAAction(action);

    // Log activity
    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `Desktop action: ${action_type}${target ? ` → ${target}` : ""}${text ? ` "${text.slice(0, 40)}"` : ""} (${result.success ? "success" : "failed"}, ${result.latency}ms)`,
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[Desktop API] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Desktop action failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/tools/desktop
 * Check CUA Driver availability and capabilities.
 */
export async function GET() {
  try {
    const available = await isCUADriverAvailable();
    return NextResponse.json({
      available,
      driver: "CUA Driver",
      supportedActions: [
        "click",
        "double_click",
        "right_click",
        "mouse_move",
        "move",
        "drag",
        "type",
        "screenshot",
        "scroll",
        "key",
        "hotkey",
        "inspect",
        "launch",
        "active_window",
      ],
    });
  } catch (err) {
    return NextResponse.json(
      {
        available: false,
        error: err instanceof Error ? err.message : "CUA status check failed",
      },
      { status: 500 }
    );
  }
}
