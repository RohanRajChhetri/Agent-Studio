import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeVaultFile, readVaultFile } from "@/lib/vault";
import { executeChatCompletion, getActiveApiKeys } from "@/lib/llm-router";
import { isOmnirouteOnline } from "@/lib/omniroute";

import { getUserScopedWhere, getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";

function getTodayKey(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

function getBriefingRelPath(userId: string | null, today: string): { primaryPath: string; fallbackPath?: string } {
  const cleanId = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, "_") : "guest";
  const userScopedPath = `briefings/Daily_Briefing_${cleanId}_${today}.md`;

  if (userId === PRIMARY_LEGACY_USER_ID) {
    return {
      primaryPath: userScopedPath,
      fallbackPath: `briefings/Daily_Briefing_${today}.md`,
    };
  }

  return { primaryPath: userScopedPath };
}

interface KanbanTelemetry {
  total: number;
  backlog: number;
  inProgress: number;
  review: number;
  done: number;
  highPriority: number;
  hasTasks: boolean;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    agentName: string | null;
    agentAvatar: string | null;
  }>;
  latestTaskUpdate: number;
}

async function fetchKanbanTelemetry(): Promise<{
  telemetry: KanbanTelemetry;
  tasks: any[];
  agents: any[];
}> {
  const scopedWhere = await getUserScopedWhere();
  const [tasks, agents] = await Promise.all([
    prisma.task.findMany({
      where: scopedWhere,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: { agent: true },
    }),
    prisma.agent.findMany({
      where: scopedWhere,
    }),
  ]);

  const backlog = tasks.filter((t) => t.status === "backlog").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const review = tasks.filter((t) => t.status === "review").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const highPriority = tasks.filter((t) => t.priority === "urgent" || t.priority === "high").length;

  const latestTaskUpdate = tasks.reduce((max, t) => {
    const time = new Date(t.updatedAt).getTime();
    return time > max ? time : max;
  }, 0);

  const telemetry: KanbanTelemetry = {
    total: tasks.length,
    backlog,
    inProgress,
    review,
    done,
    highPriority,
    hasTasks: tasks.length > 0,
    tasks: tasks.slice(0, 15).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      agentName: t.agent?.displayName || null,
      agentAvatar: t.agent?.avatar || null,
    })),
    latestTaskUpdate,
  };

  return { telemetry, tasks, agents };
}

function formatStatusBadge(status: string): string {
  switch (status) {
    case "in_progress":
      return "⚡ In Progress";
    case "review":
      return "🔍 In Review";
    case "backlog":
      return "⏳ Backlog";
    case "done":
      return "✅ Done";
    default:
      return status;
  }
}

function buildTruthfulBriefing(params: {
  todayFormatted: string;
  tasks: any[];
  agents: any[];
  telemetry: KanbanTelemetry;
}): string {
  const { todayFormatted, tasks, agents, telemetry } = params;

  const backlogTasks = tasks.filter((t) => t.status === "backlog");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const reviewTasks = tasks.filter((t) => t.status === "review");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const activeTasks = tasks.filter((t) => t.status !== "done");

  const quotes = [
    `"Focus is a muscle: say no to the non-essential so your highest goals can compound." — Marcus Aurelius`,
    `"Simplicity boils down to two steps: Identify the essential. Eliminate the rest." — Leo Babauta`,
    `"Action is the foundational key to all success." — Pablo Picasso`,
    `"Decide what to do, and more importantly, decide what NOT to do." — Steve Jobs`,
  ];
  const quote = quotes[new Date().getDay() % quotes.length];

  if (!telemetry.hasTasks) {
    // 0 tasks scenario — 100% accurate, no hallucinations
    return `# 🌅 Daily Executive Briefing — ${todayFormatted}

> *${quote}*

## 📊 Live Kanban Telemetry Matrix
| 📥 Backlog | ⚡ In Progress | 🔍 Under Review | ✅ Completed | 🎯 Total Active |
| :---: | :---: | :---: | :---: | :---: |
| **0** | **0** | **0** | **0** | **0** |

## 🎯 Strategic Priorities For Today
1. **Define Core Operational Focus**: Your Kanban board is currently at a clean slate. Capture today's top 1-3 critical milestones.
2. **Mobilize Specialist Fleet**: Delegate key research, coding, or analysis initiatives to your ${agents.length} available agents.
3. **Capture Strategic Insights**: Utilize **Voice Brain Dump** or **+ New Task** on the Kanban board to seed priority objectives.

## 📋 Task Battlefield & Execution Roster
✨ **Kanban Board is completely clear!** No active, in-progress, or queued tickets found.

*Ready for new mission intake. Click **Open Kanban** or create a task from the dashboard to initialize autonomous agent workflows.*

## 🏆 Recent Wins & Velocity
- 🌟 All systems primed and freshly initialized.
- ⚡ Autonomous agent workforce (${agents.length} specialists) standing by for immediate task intake.

## 🤖 Autonomous Workforce Directive
${
  agents.length > 0
    ? agents.slice(0, 4).map((a) => `- **${a.avatar} ${a.displayName}** (${a.role} | ${a.department}): Ready for task assignments.`).join("\n")
    : "- No specialist agents deployed yet. Head to **Agents** or deploy an agent pack to build your autonomous fleet."
}

## 💡 Chief of Staff Proactive Recommendation
Your task queue is clear. Take 5 minutes to define your highest-leverage goal for this week and initialize tickets in Kanban to empower background agent swarms.`;
  }

  // Active tasks scenario — strictly grounded in real DB data
  const strategicPriorities: string[] = [];
  if (reviewTasks.length > 0) {
    strategicPriorities.push(
      `**Clear Review Gate (${reviewTasks.length} Deliverables)**: Review and sign off on completed items such as *"${reviewTasks[0].title}"*.`
    );
  }
  if (inProgressTasks.length > 0) {
    strategicPriorities.push(
      `**Monitor Active Specialists**: Drive momentum on active tickets (*"${inProgressTasks[0].title}"*).`
    );
  }
  if (backlogTasks.length > 0) {
    strategicPriorities.push(
      `**Triage Backlog Priorities**: Assign specialists to queued items in the backlog (${backlogTasks.length} pending).`
    );
  }
  if (strategicPriorities.length < 3) {
    strategicPriorities.push(
      `**Knowledge Vault Synthesis**: Synchronize notes and task outcomes into your local Obsidian Knowledge Vault.`
    );
  }

  const battlefieldRows = tasks.map((t) => {
    const agentLabel = t.agent ? `${t.agent.avatar} ${t.agent.displayName}` : "⚡ Unassigned";
    const statusLabel = formatStatusBadge(t.status);
    const priorityLabel = t.priority ? t.priority.toUpperCase() : "MEDIUM";
    return `| **${priorityLabel}** | ${statusLabel} | **${t.title}** | ${agentLabel} |`;
  });

  return `# 🌅 Daily Executive Briefing — ${todayFormatted}

> *${quote}*

## 📊 Live Kanban Telemetry Matrix
| 📥 Backlog | ⚡ In Progress | 🔍 Under Review | ✅ Completed | 🎯 Total Tracked |
| :---: | :---: | :---: | :---: | :---: |
| **${backlogTasks.length}** | **${inProgressTasks.length}** | **${reviewTasks.length}** | **${doneTasks.length}** | **${tasks.length}** |

## 🎯 Strategic Priorities For Today
${strategicPriorities.slice(0, 3).map((p, idx) => `${idx + 1}. ${p}`).join("\n")}

## 📋 Task Battlefield & Execution Roster
| Priority | Status | Task Description | Assigned Specialist |
| :--- | :--- | :--- | :--- |
${battlefieldRows.join("\n")}

${
  reviewTasks.length > 0
    ? `## 🔍 Immediate Executive Review Gate (${reviewTasks.length} Tickets Awaiting Sign-Off)
The following deliverables have been completed by specialists and require executive sign-off:
${reviewTasks.map((t) => `- **${t.title}** (${t.priority.toUpperCase()}) — Specialist: *${t.agent?.displayName || "Agent Swarm"}*`).join("\n")}\n\n`
    : ""
}## 🏆 Recent Wins & Velocity
${
  doneTasks.length > 0
    ? doneTasks.map((t) => `- ✅ **${t.title}** — Completed by *${t.agent?.displayName || "Autonomous Swarm"}*`).join("\n")
    : "- Active sprint underway. Focus on advancing tickets from In Progress and Review."
}

## 🤖 Autonomous Workforce Directive
${
  agents.length > 0
    ? agents
        .slice(0, 5)
        .map((a) => {
          const assignedCount = tasks.filter((t) => t.agentId === a.id && t.status !== "done").length;
          return `- **${a.avatar} ${a.displayName}** (${a.role} | ${a.department}): ${
            assignedCount > 0
              ? `Actively driving ${assignedCount} assigned Kanban ticket${assignedCount > 1 ? "s" : ""}.`
              : "Standing by for autonomous delegation."
          }`;
        })
        .join("\n")
    : "- No specialist agents deployed yet. Head to **Agents** or deploy an agent pack to build your autonomous fleet."
}

## 💡 Chief of Staff Proactive Recommendation
${
  reviewTasks.length > 0
    ? `You have **${reviewTasks.length} deliverable${reviewTasks.length > 1 ? "s" : ""} in Review**. Conduct a rapid sign-off pass in the Kanban board to approve and close out finished work.`
    : inProgressTasks.length > 0
    ? `Your specialist agents are actively executing in the background. Keep focus on high-impact strategic tasks while the swarm progresses on deliverables.`
    : "Your pipeline is clear for today. Use the Kanban board to outline next week's key growth drivers."
}`;
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const today = getTodayKey();
    const { primaryPath, fallbackPath } = getBriefingRelPath(userId, today);

    // Fetch real-time Kanban telemetry scoped to current user
    const { telemetry } = await fetchKanbanTelemetry();

    try {
      let file: { content: string; modifiedAt: string } | null = null;
      let activePath = primaryPath;
      try {
        file = await readVaultFile(primaryPath);
      } catch {
        if (fallbackPath) {
          try {
            file = await readVaultFile(fallbackPath);
            activePath = fallbackPath;
          } catch {}
        }
      }

      if (!file) {
        return NextResponse.json({
          exists: false,
          date: today,
          path: primaryPath,
          kanbanStats: telemetry,
          isOutOfSync: false,
        });
      }

      const fileModifiedTime = new Date(file.modifiedAt).getTime();
      const isOutOfSync = telemetry.latestTaskUpdate > fileModifiedTime;

      return NextResponse.json({
        exists: true,
        date: today,
        path: activePath,
        content: file.content,
        modifiedAt: file.modifiedAt,
        kanbanStats: telemetry,
        isOutOfSync,
      });
    } catch {
      return NextResponse.json({
        exists: false,
        date: today,
        path: primaryPath,
        kanbanStats: telemetry,
        isOutOfSync: false,
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check daily briefing", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    const today = getTodayKey();
    const { primaryPath } = getBriefingRelPath(userId, today);
    const briefingRelPath = primaryPath;
    const todayFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const scopedWhere = await getUserScopedWhere();

    // Gather live contextual workspace telemetry scoped to current user
    const [{ telemetry, tasks, agents }, recentLogs, omnirouteOnline] = await Promise.all([
      fetchKanbanTelemetry(),
      prisma.activityLog.findMany({
        where: scopedWhere,
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      isOmnirouteOnline().catch(() => false),
    ]);

    const activeTasks = tasks.filter((t) => t.status !== "done");
    const reviewTasks = tasks.filter((t) => t.status === "review");
    const doneTasks = tasks.filter((t) => t.status === "done");

    // Generate accurate fallback briefing first
    const deterministicBriefing = buildTruthfulBriefing({
      todayFormatted,
      tasks,
      agents,
      telemetry,
    });

    let briefingContent = "";

    // Attempt fast LLM synthesis with strict grounding and timeout
    try {
      const activeKeys = await getActiveApiKeys();
      const hasKey = Object.values(activeKeys).some((k) => k && k.trim().length > 0);

      if (hasKey) {
        const prompt = `You are the Executive Chief of Staff for an elite business leader.
Write a powerful, inspiring, and strictly accurate **Daily Executive Morning Briefing** for ${todayFormatted}.

CRITICAL TRUTH & GROUNDING CONSTRAINTS:
1. You MUST ONLY reference the actual tasks from the KANBAN TELEMETRY below.
2. DO NOT invent, hallucinate, or fabricate any tasks, titles, or numbers that are not listed.
3. If the Kanban board has 0 tasks, state clearly that the board is clean/empty with 0 tasks.
4. Accurately reflect statuses: tasks in 'review' are awaiting executive approval; tasks in 'done' are completed wins.

LIVE KANBAN TELEMETRY:
- Total Tasks: ${tasks.length} (Backlog: ${telemetry.backlog}, In Progress: ${telemetry.inProgress}, Review: ${telemetry.review}, Done: ${telemetry.done})
- Tasks in Board:
${
  tasks.length > 0
    ? tasks.map((t) => `  * [${t.priority.toUpperCase()}] "${t.title}" — Status: ${t.status} | Agent: ${t.agent?.displayName || "Unassigned"}`).join("\n")
    : "  * (Kanban Board is completely empty)"
}

AGENT SPECIALIST READINESS:
${agents.map((a) => `  * ${a.avatar} ${a.displayName} (${a.role} | ${a.department})`).join("\n")}

FORMAT:
Output crisp Markdown starting with "# 🌅 Daily Executive Briefing — ${todayFormatted}".
Include:
- Inspiring focus quote
- Live Kanban Telemetry Matrix table
- Strategic Priorities For Today
- Task Battlefield & Execution Roster (listing real tasks only)
${reviewTasks.length > 0 ? "- Executive Review Gate (highlighting tickets needing sign-off)" : ""}
- Recent Wins & Velocity
- Autonomous Workforce Directive
- Chief of Staff Proactive Recommendation`;

        // Run with a 10s promise timeout to guarantee rapid response
        const completionPromise = executeChatCompletion({
          prompt,
          model: "auto/smart",
          systemPrompt: "You are an elite Chief of Staff. You produce strictly truthful, crisp executive briefings.",
          agentName: "Chief of Staff",
          useVaultRAG: false, // Avoid slow RAG retrieval on daily briefing
        });

        const timeoutPromise = new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("LLM briefing timeout")), 12000)
        );

        const completion = await Promise.race([completionPromise, timeoutPromise]);
        if (completion && completion.content && completion.content.trim().length > 100) {
          briefingContent = completion.content;
        }
      }
    } catch (llmErr) {
      console.warn("LLM briefing generation timed out or failed, using pristine deterministic briefing:", llmErr);
    }

    if (!briefingContent) {
      briefingContent = deterministicBriefing;
    }

    // Persist to Obsidian Markdown Vault
    await writeVaultFile(briefingRelPath, briefingContent);

    // Record activity log scoped to user
    await prisma.activityLog.create({
      data: {
        userId,
        type: "briefing_generated",
        message: `Executive Morning Briefing generated for ${today} (${telemetry.total} Kanban tasks tracked)`,
        metadata: JSON.stringify({
          date: today,
          path: briefingRelPath,
          kanbanTasks: telemetry.total,
          reviewCount: telemetry.review,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      date: today,
      path: briefingRelPath,
      content: briefingContent,
      kanbanStats: telemetry,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Briefing POST Error:", error);
    return NextResponse.json(
      { error: "Failed to generate briefing", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
