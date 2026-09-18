import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const integrations = await prisma.agentIntegration.findMany({
      where: { agentId: id },
    });
    return NextResponse.json(integrations);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const { platform, enabled, config } = body;

    if (!platform) {
      return NextResponse.json(
        { error: "Platform is required" },
        { status: 400 }
      );
    }

    const integration = await prisma.agentIntegration.upsert({
      where: {
        agentId_platform: { agentId: id, platform },
      },
      update: {
        enabled: enabled ?? true,
        config: config ?? null,
      },
      create: {
        agentId: id,
        platform,
        enabled: enabled ?? true,
        config: config ?? null,
      },
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    );
  }
}
