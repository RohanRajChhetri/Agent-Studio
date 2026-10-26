import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere, getAuthUserId } from "@/lib/user-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface DesktopActionLogEntry {
  id: string;
  actionType: "launch" | "screenshot" | "click" | "type" | "compound" | "inspect" | "key" | "wait";
  title: string;
  target?: string;
  status: "success" | "failed";
  latency: number;
  screenshotUrl?: string;
  agentName: string;
  details?: string;
  timestamp: string;
}

/**
 * GET /api/tools/desktop/logs
 * Retrieves structured desktop action execution history.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const scopedWhere = await getUserScopedWhere({
      OR: [
        { type: "desktop_action" },
        { message: { contains: "Desktop action:" } },
        { message: { contains: "Autonomous Task:" } },
        { message: { contains: "Desktop Screenshot" } },
      ],
    });

    const logs = await prisma.activityLog.findMany({
      where: scopedWhere,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const entries: DesktopActionLogEntry[] = logs.map((log) => {
      let meta: any = {};
      if (log.metadata) {
        try {
          meta = JSON.parse(log.metadata);
        } catch {
          meta = {};
        }
      }

      // Infer actionType from metadata or message
      let actionType: DesktopActionLogEntry["actionType"] = meta.actionType || "screenshot";
      if (!meta.actionType) {
        const msgLower = log.message.toLowerCase();
        if (msgLower.includes("screenshot")) actionType = "screenshot";
        else if (msgLower.includes("launch") || msgLower.includes("open")) actionType = "launch";
        else if (msgLower.includes("click")) actionType = "click";
        else if (msgLower.includes("type")) actionType = "type";
        else if (msgLower.includes("compound")) actionType = "compound";
      }

      const status: "success" | "failed" =
        meta.success === false || log.message.includes("failed") ? "failed" : "success";

      return {
        id: log.id,
        actionType,
        title: meta.title || log.message.split("(")[0].trim() || "Desktop Action",
        target: meta.target || undefined,
        status,
        latency: typeof meta.latency === "number" ? meta.latency : 0,
        screenshotUrl: meta.screenshotUrl || undefined,
        agentName: meta.agentName || "Desktop Operator",
        details: meta.details || log.message,
        timestamp: log.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      success: true,
      count: entries.length,
      logs: entries,
    });
  } catch (error) {
    console.error("[Desktop Logs API] Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch desktop action logs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools/desktop/logs
 * Record a desktop action into the audit trail.
 */
export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const body = await request.json();
    const {
      actionType = "screenshot",
      title,
      target,
      status = "success",
      latency = 0,
      screenshotUrl,
      agentName = "Desktop Operator",
      details,
    } = body;

    const message = `Desktop action: ${actionType}${target ? ` → ${target}` : ""} (${status}, ${latency}ms)`;

    const newLog = await prisma.activityLog.create({
      data: {
        userId,
        type: "desktop_action",
        message,
        agentId: agentName === "Desktop Operator" ? "desktop-operator" : undefined,
        metadata: JSON.stringify({
          actionType,
          title: title || message,
          target,
          status,
          success: status === "success",
          latency,
          screenshotUrl,
          agentName,
          details,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      logId: newLog.id,
    });
  } catch (error) {
    console.error("[Desktop Logs API] Error creating log:", error);
    return NextResponse.json(
      { error: "Failed to create desktop action log" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tools/desktop/logs
 * Clear desktop action logs.
 */
export async function DELETE() {
  try {
    const scopedWhere = await getUserScopedWhere({
      OR: [
        { type: "desktop_action" },
        { message: { contains: "Desktop action:" } },
        { message: { contains: "Autonomous Task:" } },
      ],
    });

    const result = await prisma.activityLog.deleteMany({
      where: scopedWhere,
    });

    return NextResponse.json({
      success: true,
      deletedCount: result.count,
    });
  } catch (error) {
    console.error("[Desktop Logs API] Error clearing logs:", error);
    return NextResponse.json(
      { error: "Failed to clear desktop action logs" },
      { status: 500 }
    );
  }
}
