import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { matchBestAgent } from "@/lib/agent-matcher";

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

    // Format tasks: extract subtasks from result envelope if present
    const formattedTasks = tasks.map((task) => {
      let subtasks: any[] = [];
      let cleanResult = task.result || "";
      if (task.result && task.result.trim().startsWith("{") && task.result.trim().endsWith("}")) {
        try {
          const parsed = JSON.parse(task.result);
          if (parsed && typeof parsed === "object") {
            if (Array.isArray(parsed.subtasks)) {
              subtasks = parsed.subtasks;
            }
            if (typeof parsed.originalResult === "string") {
              cleanResult = parsed.originalResult;
            } else if (typeof parsed.content === "string") {
              cleanResult = parsed.content;
            } else if (typeof parsed.result === "string") {
              cleanResult = parsed.result;
            } else if (typeof parsed.text === "string") {
              cleanResult = parsed.text;
            } else if (typeof parsed.deliverable === "string") {
              cleanResult = parsed.deliverable;
            } else if (Array.isArray(parsed.subtasks)) {
              cleanResult = "";
            }
          }
        } catch {}
      }
      return {
        ...task,
        subtasks,
        result: cleanResult,
      };
    });

    return NextResponse.json(formattedTasks);
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
    const { action, title, description, agentId, priority, dueDate, status } = body;

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

    const targetStatus = status || "backlog";

    // Get max position for target column
    const maxPos = await prisma.task.findFirst({
      where: { status: targetStatus },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    // Smart Auto-Assignment: resolve optimal specialist if not specified or set to auto
    let finalAgentId = agentId && agentId !== "auto" && agentId !== "unassigned" ? agentId : null;
    if (!finalAgentId && agentId !== "unassigned") {
      const allAgents = await prisma.agent.findMany();
      const matched = matchBestAgent(`${title} ${description || ""}`, allAgents as any);
      if (matched) {
        finalAgentId = matched.id;
      }
    }

    const task = await prisma.task.create({
      data: {
        title,
        description: description || "",
        status: targetStatus,
        agentId: finalAgentId,
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
        agentId: finalAgentId,
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
      subtasks,
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
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;

    if (subtasks !== undefined) {
      const existing = await prisma.task.findUnique({ where: { id } });
      let envelope: any = {};
      try {
        envelope = JSON.parse(existing?.result || "{}");
      } catch {
        envelope = { originalResult: existing?.result || "" };
      }
      envelope.subtasks = subtasks;
      updateData.result = JSON.stringify(envelope);
    } else if (result !== undefined) {
      updateData.result = result;
    }

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

    // Format response task with parsed subtasks
    let parsedSubtasks: any[] = subtasks || [];
    let cleanResult = task.result || "";
    if (task.result && task.result.trim().startsWith("{") && task.result.trim().endsWith("}")) {
      try {
        const parsed = JSON.parse(task.result);
        if (parsed && typeof parsed === "object") {
          if (Array.isArray(parsed.subtasks)) parsedSubtasks = parsed.subtasks;
          if (typeof parsed.originalResult === "string") cleanResult = parsed.originalResult;
          else if (typeof parsed.content === "string") cleanResult = parsed.content;
          else if (typeof parsed.result === "string") cleanResult = parsed.result;
          else if (Array.isArray(parsed.subtasks)) cleanResult = "";
        }
      } catch {}
    }

    return NextResponse.json({
      ...task,
      subtasks: parsedSubtasks,
      result: cleanResult,
    });
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
    const status = searchParams.get("status");

    if (id) {
      await prisma.task.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    if (status) {
      const deleted = await prisma.task.deleteMany({ where: { status } });
      return NextResponse.json({ success: true, count: deleted.count });
    }

    return NextResponse.json({ error: "Task ID or status is required" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
