import { NextResponse } from "next/server";
import { listAllAgentMemories } from "@/lib/episodic-memory";

export async function GET() {
  try {
    const memories = await listAllAgentMemories();
    return NextResponse.json({ success: true, memories });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to list memories", memories: [] },
      { status: 500 }
    );
  }
}
