import { NextResponse } from "next/server";
import { listAllAgentMemories } from "@/lib/episodic-memory";
import { prisma } from "@/lib/prisma";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function GET() {
  try {
    const userAgents = await prisma.agent.findMany({
      where: await getUserScopedWhere(),
      select: { name: true, displayName: true },
    });

    const userAgentNames = new Set(
      userAgents.flatMap((a) => [
        a.name.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
        a.displayName.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
      ])
    );

    const allMemories = await listAllAgentMemories();
    const filteredMemories = allMemories.filter((m) =>
      userAgentNames.has(m.agentName.toLowerCase())
    );

    return NextResponse.json({ success: true, memories: filteredMemories });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to list memories", memories: [] },
      { status: 500 }
    );
  }
}
