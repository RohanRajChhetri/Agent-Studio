import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { calculateNextRun, checkAndRunDueRoutines } from "@/lib/scheduler";

export async function GET() {
  try {
    // Automatically evaluate and execute any due routines on fetch
    try {
      await checkAndRunDueRoutines();
    } catch (checkErr) {
      console.warn("Error running due routines check:", checkErr);
    }

    const routines = await prisma.routine.findMany({
      include: {
        agent: true,
      },
      orderBy: [
        { enabled: "desc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json({ routines });
  } catch (error) {
    console.error("Failed to fetch routines:", error);
    return NextResponse.json(
      { error: "Failed to fetch routines", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      prompt,
      description,
      type = "daily",
      time = "09:00",
      scheduledAt,
      agentId,
      autoExecute = true,
      priority = "medium",
    } = body;

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Task instructions/prompt is required" }, { status: 400 });
    }

    const nextRunAt = calculateNextRun(type, time, scheduledAt);

    const routine = await prisma.routine.create({
      data: {
        title: title.trim(),
        description: (description || "").trim(),
        prompt: prompt.trim(),
        type,
        time: type === "daily" ? time : null,
        scheduledAt: type === "one_time" && scheduledAt ? new Date(scheduledAt) : null,
        agentId: agentId || null,
        autoExecute: Boolean(autoExecute),
        priority: priority || "medium",
        enabled: true,
        nextRunAt,
      },
      include: {
        agent: true,
      },
    });

    await prisma.activityLog.create({
      data: {
        type: "routine_created",
        message: `Created ${type === "daily" ? "daily routine" : "scheduled task"} "${title}"`,
        agentId: agentId || null,
      },
    });

    return NextResponse.json({ routine }, { status: 201 });
  } catch (error) {
    console.error("Failed to create routine:", error);
    return NextResponse.json(
      { error: "Failed to create routine", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
