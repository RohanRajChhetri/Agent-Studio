import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const status = searchParams.get("status");

    const where: Record<string, unknown> = {};
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const tasks = await prisma.task.findMany({
      where,
      include: { agent: true },
      orderBy: [{ status: "asc" }, { position: "asc" }],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, title, description, agentId, priority, dueDate } = body;

    // Support seeding starter tasks
    if (action === "seed") {
      const agents = await prisma.agent.findMany();
      const firstAgentId = agents[0]?.id || null;
      const secondAgentId = agents[1]?.id || firstAgentId;

      const starterTasks = [
        {
          title: "Research competitor pricing models",
          description: "Analyze market pricing strategies for AI agent platforms and create comparison notes in the memory vault.",
          priority: "high",
          status: "backlog",
          agentId: firstAgentId,
          position: 1,
        },
        {
          title: "Implement authentication webhook handler",
          description: "Build a robust Node.js webhook handler with cryptographic signature verification and logging.",
          priority: "urgent",
          status: "in_progress",
          agentId: secondAgentId,
          position: 1,
        },
        {
          title: "Draft weekly customer intelligence summary",
          description: "Aggregate key insights and takeaways from recent conversations into a weekly intelligence briefing.",
          priority: "medium",
          status: "review",
          agentId: firstAgentId,
          position: 1,
          result: "# Customer Intelligence Briefing\n\n- **Usage**: 240 active agent conversations\n- **Top Requests**: Kanban task automation and direct memory vault export\n- **Action Items**: Upgrade LLM fallback routes and add task run buttons.",
        },
      ];

      for (const t of starterTasks) {
        await prisma.task.create({ data: t });
      }

      const allTasks = await prisma.task.findMany({
        include: { agent: true },
        orderBy: [{ status: "asc" }, { position: "asc" }],
      });

      return NextResponse.json(allTasks, { status: 201 });
    }

    if (!title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Get max position for backlog
    const maxPos = await prisma.task.findFirst({
      where: { status: "backlog" },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title,
        description: description || "",
        agentId: agentId || null,
        priority: priority || "medium",
        dueDate: dueDate ? new Date(dueDate) : null,
        position: (maxPos?.position || 0) + 1,
      },
      include: { agent: true },
    });

    await prisma.activityLog.create({
      data: {
        type: "task_created",
        message: `Task "${title}" created`,
        agentId: agentId || null,
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const {
      id,
      status,
      position,
      title,
      description,
      agentId,
      priority,
      dueDate,
      result,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status !== undefined) updateData.status = status;
    if (position !== undefined) updateData.position = position;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (agentId !== undefined) updateData.agentId = agentId || null;
    if (priority !== undefined) updateData.priority = priority;
    if (result !== undefined) updateData.result = result;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    const task = await prisma.task.update({
      where: { id },
      data: updateData,
      include: { agent: true },
    });

    if (status) {
      await prisma.activityLog.create({
        data: {
          type: "task_moved",
          message: `Task "${task.title}" moved to ${status.replace("_", " ")}`,
          agentId: task.agentId,
        },
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    await prisma.task.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
