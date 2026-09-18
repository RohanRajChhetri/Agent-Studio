import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateNextRun } from "@/lib/scheduler";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routine = await prisma.routine.findUnique({
      where: { id },
      include: { agent: true },
    });

    if (!routine) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    return NextResponse.json({ routine });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch routine", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.routine.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    }

    const type = body.type !== undefined ? body.type : existing.type;
    const time = body.time !== undefined ? body.time : existing.time;
    const scheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : existing.scheduledAt;

    let nextRunAt = existing.nextRunAt;
    if (body.enabled !== undefined && !body.enabled) {
      nextRunAt = null;
    } else if (body.type !== undefined || body.time !== undefined || body.scheduledAt !== undefined || body.enabled === true) {
      nextRunAt = calculateNextRun(type, time, scheduledAt);
    }

    const updated = await prisma.routine.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title.trim() }),
        ...(body.description !== undefined && { description: body.description.trim() }),
        ...(body.prompt !== undefined && { prompt: body.prompt.trim() }),
        ...(body.type !== undefined && { type: body.type }),
        ...(body.time !== undefined && { time: body.time }),
        ...(body.scheduledAt !== undefined && { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null }),
        ...(body.enabled !== undefined && { enabled: Boolean(body.enabled) }),
        ...(body.autoExecute !== undefined && { autoExecute: Boolean(body.autoExecute) }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.agentId !== undefined && { agentId: body.agentId || null }),
        nextRunAt,
      },
      include: { agent: true },
    });

    return NextResponse.json({ routine: updated });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update routine", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.routine.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete routine", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
