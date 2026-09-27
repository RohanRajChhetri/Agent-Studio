import { NextResponse } from "next/server";
import { executeTaskById } from "@/lib/task-executor";
import { notifyWhatsAppUser } from "@/lib/whatsapp-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const overrideAgentId = body.agentId;

    const result = await executeTaskById(id, overrideAgentId);

    if (!result.success || !result.task) {
      return NextResponse.json(
        { error: result.error || "Failed to execute task" },
        { status: result.error?.includes("not found") ? 404 : 500 }
      );
    }

    // Relay notification via WhatsApp if enabled
    if (result.deliverable) {
      notifyWhatsAppUser(
        `Task Completed: ${result.task.title}`,
        result.deliverable.slice(0, 300) + "...",
        {
          agentName: result.task.agent?.displayName || "Autonomous Agent",
          status: "Review Required",
        }
      ).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      task: result.task,
      deliverable: result.deliverable,
      vaultPath: result.vaultPath,
      latency: result.latency,
      modelUsed: result.modelUsed,
    });
  } catch (error) {
    console.error("Task run error:", error);
    return NextResponse.json(
      {
        error: "Failed to execute task",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
