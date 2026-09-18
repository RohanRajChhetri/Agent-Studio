import { NextResponse } from "next/server";
import { executeRoutine } from "@/lib/scheduler";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await executeRoutine(id);
    return NextResponse.json({
      success: true,
      message: `Routine executed successfully. Task created and assigned to ${result.task.agent?.displayName || "Agent"}.`,
      ...result,
    });
  } catch (error) {
    console.error("Failed to trigger routine:", error);
    return NextResponse.json(
      { error: "Failed to execute routine", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
