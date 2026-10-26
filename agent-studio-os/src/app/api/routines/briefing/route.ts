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

export interface KanbanTelemetry {
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

export interface FleetTelemetry {
  total: number;
  online: number;
  busy: number;
  idle: number;
  offline: number;
  agents: Array<{
    id: string;
    displayName: string;
    role: string;
    department: string;
    status: string;
    avatar: string;
  }>;
}

export interface RoutineTelemetry {
  total: number;
  enabled: number;
  daily: number;
  items: Array<{
    id: string;
    title: string;
    type: string;
    time: string | null;
    enabled: boolean;
    agentName: string | null;
  }>;
}

export interface ComprehensiveTelemetry {
  kanban: KanbanTelemetry;
  fleet: FleetTelemetry;
  routines: RoutineTelemetry;
  activity: {
    recentCount: number;
    items: Array<{
      id: string;
      type: string;
      message: string;
      createdAt: string;
    }>;
  };
}

async function fetchComprehensiveTelemetry(): Promise<{
  telemetry: ComprehensiveTelemetry;
  tasks: any[];
  agents: any[];
  routines: any[];
  recentLogs: any[];
}> {
  const scopedWhere = await getUserScopedWhere();
  const [tasks, agents, routines, recentLogs] = await Promise.all([
    prisma.task.findMany({
      where: scopedWhere,
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      include: { agent: true },
    }),
    prisma.agent.findMany({
      where: scopedWhere,
    }),
    prisma.routine.findMany({
      where: scopedWhere,
      include: { agent: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: scopedWhere,
      take: 12,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const backlog = tasks.filter((t) => t.status === "backlog" || t.status === "todo").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const review = tasks.filter((t) => t.status === "review").length;
  const done = tasks.filter((t) => t.status === "done").length;
  const highPriority = tasks.filter((t) => t.priority === "urgent" || t.priority === "high").length;

  const latestTaskUpdate = tasks.reduce((max, t) => {
    const time = new Date(t.updatedAt).getTime();
    return time > max ? time : max;
  }, 0);

  const onlineAgents = agents.filter((a) => a.status === "online").length;
  const busyAgents = agents.filter((a) => a.status === "busy").length;
  const idleAgents = agents.filter((a) => a.status === "idle").length;
  const offlineAgents = agents.filter((a) => a.status === "offline" || !a.status).length;

  // Prioritize tasks for the client: Review first, then In Progress, then Urgent/High Backlog, then others
  const prioritizedTasks = [
    ...tasks.filter((t) => t.status === "review"),
    ...tasks.filter((t) => t.status === "in_progress"),
    ...tasks.filter((t) => (t.status === "backlog" || t.status === "todo") && (t.priority === "urgent" || t.priority === "high")),
    ...tasks.filter((t) => (t.status === "backlog" || t.status === "todo") && t.priority !== "urgent" && t.priority !== "high"),
    ...tasks.filter((t) => t.status === "done"),
  ];

  const telemetry: ComprehensiveTelemetry = {
    kanban: {
      total: tasks.length,
      backlog,
      inProgress,
      review,
      done,
      highPriority,
      hasTasks: tasks.length > 0,
      // Pass all active tasks (up to 100) so frontend has 100% complete review and queue data
      tasks: prioritizedTasks.slice(0, 100).map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        agentName: t.agent?.displayName || null,
        agentAvatar: t.agent?.avatar || null,
      })),
      latestTaskUpdate,
    },
    fleet: {
      total: agents.length,
      online: onlineAgents,
      busy: busyAgents,
      idle: idleAgents,
      offline: offlineAgents,
      agents: agents.slice(0, 16).map((a) => ({
        id: a.id,
        displayName: a.displayName,
        role: a.role,
        department: a.department,
        status: a.status,
        avatar: a.avatar,
      })),
    },
    routines: {
      total: routines.length,
      enabled: routines.filter((r) => r.enabled).length,
      daily: routines.filter((r) => r.type === "daily").length,
      items: routines.slice(0, 8).map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        time: r.time,
        enabled: r.enabled,
        agentName: r.agent?.displayName || null,
      })),
    },
    activity: {
      recentCount: recentLogs.length,
      items: recentLogs.map((l) => ({
        id: l.id,
        type: l.type,
        message: l.message,
        createdAt: l.createdAt.toISOString(),
      })),
    },
  };

  return { telemetry, tasks, agents, routines, recentLogs };
}

function buildTruthfulBriefing(params: {
  todayFormatted: string;
  tasks: any[];
  agents: any[];
  routines: any[];
  recentLogs: any[];
  telemetry: ComprehensiveTelemetry;
}): string {
  const { todayFormatted, tasks, agents, routines, telemetry } = params;

  const backlogTasks = tasks.filter((t) => t.status === "backlog" || t.status === "todo");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
  const reviewTasks = tasks.filter((t) => t.status === "review");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const total = tasks.length || 1;

  const reviewPct = Math.round((reviewTasks.length / total) * 100);
  const backlogPct = Math.round((backlogTasks.length / total) * 100);
  const inProgressPct = Math.round((inProgressTasks.length / total) * 100);
  const donePct = Math.round((doneTasks.length / total) * 100);

  const reviewRows = reviewTasks.map((t) => {
    const specialist = t.agent?.displayName || "Autonomous Swarm";
    const priority = (t.priority || "medium").toUpperCase();
    return `| **${priority}** | ${specialist} | **${t.title}** | Awaiting Executive Sign-Off |`;
  });

  return `# DAILY EXECUTIVE INTELLIGENCE MEMORANDUM
**Date:** ${todayFormatted} | **Classification:** Operations Executive Digest

---

### 1. Executive Summary & Critical Bottleneck
${
  reviewTasks.length > 0
    ? `Review Gate clearance is currently the primary operational priority. **${reviewTasks.length} completed deliverables await executive sign-off**, holding back active sprint cycle times. The autonomous workforce of **${telemetry.fleet.online} specialist agents** is fully online and ready for deployment.`
    : inProgressTasks.length > 0
    ? `Workforce is actively executing **${inProgressTasks.length} in-flight initiatives**. Autonomous specialists are unblocked and driving milestones toward the Review Gate.`
    : `Operational board is clear with **${backlogTasks.length} staged backlog initiatives**. Specialist fleet is primed for new mission intake.`
}

---

### 2. Immediate Decision Gate: Deliverables Requiring Sign-Off
${
  reviewTasks.length > 0
    ? `*The following deliverables have been produced by autonomous specialists and require executive review:*

| Priority | Specialist | Deliverable Title | Status |
| :--- | :--- | :--- | :--- |
${reviewRows.join("\n")}`
    : "*Review Gate is clean. No deliverables are currently awaiting sign-off.*"
}

---

### 3. Pipeline Flow & Workload Distribution
| Operational Stage | Count | Distribution | Status Indicator |
| :--- | :---: | :---: | :--- |
| **Backlog & Staged** | ${backlogTasks.length} | ${backlogPct}% | Staged for intake |
| **In Progress** | ${inProgressTasks.length} | ${inProgressPct}% | ${inProgressTasks.length > 0 ? "Active Swarm Runs" : "Idle (Swarm Ready)"} |
| **Awaiting Review** | ${reviewTasks.length} | ${reviewPct}% | ${reviewTasks.length > 0 ? "**Action Required**" : "Cleared"} |
| **Completed Wins** | ${doneTasks.length} | ${donePct}% | Verified & Archived |
| **Total Tracked** | **${tasks.length}** | **100%** | Full Operational Pipeline |

---

### 4. Strategic Priorities For Today
1. **Clear Review Gate Deliverables**: Review and approve the ${reviewTasks.length} completed specialist deliverables in Kanban to finalize results and free agent queues.
2. **Backlog Allocation & Sprint Seeding**: Mobilize available specialists to intake high-priority backlog tickets (${backlogTasks.length} tickets staged).
3. **Background Automation Maintenance**: Verify automated routines (${telemetry.routines.enabled} active) and agent triggers are monitoring workflows.

---

### 5. Autonomous Fleet Deployment
- **Fleet Capacity**: **${agents.length} specialists registered** (${telemetry.fleet.online} Online, ${telemetry.fleet.busy} Busy)
${
  agents.length > 0
    ? agents
        .slice(0, 6)
        .map((a) => {
          const count = tasks.filter((t) => t.agentId === a.id && t.status !== "done").length;
          return `- **${a.displayName}** (${a.role} | ${a.department}): ${
            count > 0 ? `${count} active assigned ticket${count > 1 ? "s" : ""}.` : "Ready for mission allocation."
          }`;
        })
        .join("\n")
    : "- No specialist agents deployed."
}

---

### 6. Chief of Staff Action Directive
Begin the day with a focused clearance sweep on the Review Gate deliverables in the Kanban board. Approving these completed tasks unlocks immediate capacity for your specialist workforce.`;
}

export async function GET() {
  try {
    const userId = await getAuthUserId();
    const today = getTodayKey();
    const { primaryPath, fallbackPath } = getBriefingRelPath(userId, today);

    const { telemetry } = await fetchComprehensiveTelemetry();

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
          telemetry,
          kanbanStats: telemetry.kanban,
          isOutOfSync: false,
        });
      }

      const fileModifiedTime = new Date(file.modifiedAt).getTime();
      const isOutOfSync = telemetry.kanban.latestTaskUpdate > fileModifiedTime;

      return NextResponse.json({
        exists: true,
        date: today,
        path: activePath,
        content: file.content,
        modifiedAt: file.modifiedAt,
        telemetry,
        kanbanStats: telemetry.kanban,
        isOutOfSync,
      });
    } catch {
      return NextResponse.json({
        exists: false,
        date: today,
        path: primaryPath,
        telemetry,
        kanbanStats: telemetry.kanban,
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

    const { telemetry, tasks, agents, routines, recentLogs } = await fetchComprehensiveTelemetry();

    const reviewTasks = tasks.filter((t) => t.status === "review");

    const deterministicBriefing = buildTruthfulBriefing({
      todayFormatted,
      tasks,
      agents,
      routines,
      recentLogs,
      telemetry,
    });

    let briefingContent = "";

    try {
      const activeKeys = await getActiveApiKeys();
      const hasKey = Object.values(activeKeys).some((k) => k && k.trim().length > 0);

      if (hasKey) {
        const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
        const backlogTasks = tasks.filter((t) => t.status === "backlog" || t.status === "todo");

        const prompt = `You are the elite Executive Chief of Staff for an AI-native high-performance organization.
Write a powerful, dense, factual, and strictly accurate **Daily Executive Intelligence Memorandum** for ${todayFormatted}.

CRITICAL CONSTRAINTS:
1. NO greetings of any kind (do NOT say 'Good morning', 'Hello', etc.).
2. NO quotes or motivational sayings.
3. NO git or code commit references.
4. Strictly ground on actual tasks, agents, and routines provided below.
5. NEVER invent placeholder names like 'Review Queue Item', 'Pending Triage', 'Task 1', etc. Use the EXACT deliverable titles provided below.
6. Format as an elite executive memorandum with clean markdown headers and tables.
7. NEVER use emojis anywhere in the output. Rely strictly on formal executive typography, clean headers, and concise bullet points.

ACTUAL WORKSPACE TELEMETRY:
- Tasks Total: ${tasks.length} (Backlog/Todo: ${telemetry.kanban.backlog}, In Progress: ${telemetry.kanban.inProgress}, Review: ${telemetry.kanban.review}, Done: ${telemetry.kanban.done})

- DELIVERABLES REQUIRING SIGN-OFF (REVIEW GATE):
${
  reviewTasks.length > 0
    ? reviewTasks
        .map(
          (t) =>
            `  * [${(t.priority || "high").toUpperCase()}] "${t.title}" | Produced by: ${
              t.agent?.displayName || "Autonomous Swarm"
            }`
        )
        .join("\n")
    : "  * (No deliverables currently awaiting review)"
}

- IN-FLIGHT SWARM INITIATIVES (IN PROGRESS):
${
  inProgressTasks.length > 0
    ? inProgressTasks
        .map(
          (t) =>
            `  * [${(t.priority || "medium").toUpperCase()}] "${t.title}" | Specialist: ${
              t.agent?.displayName || "Autonomous Swarm"
            }`
        )
        .join("\n")
    : "  * (No tasks currently in progress — swarm is ready for assignment)"
}

- HIGH PRIORITY BACKLOG INITIATIVES:
${
  backlogTasks.slice(0, 10)
    .map(
      (t) =>
        `  * [${(t.priority || "medium").toUpperCase()}] "${t.title}" | Specialist: ${
          t.agent?.displayName || "Unassigned"
        }`
    )
    .join("\n")
}

- Specialist Fleet: ${agents.length} specialists (${telemetry.fleet.online} Online, ${telemetry.fleet.busy} Busy)
${agents.slice(0, 10).map((a) => `  * ${a.displayName} (${a.role} | ${a.department}) — Status: ${a.status}`).join("\n")}
- Scheduled Routines: ${routines.length} configured (${telemetry.routines.enabled} active)

FORMAT STRUCTURE:
# DAILY EXECUTIVE INTELLIGENCE MEMORANDUM
**Date:** ${todayFormatted} | **Classification:** Operations Executive Digest

---

### 1. Executive Summary & Critical Bottleneck
[2-3 dense sentences focusing on the immediate operational bottleneck, e.g. the ${reviewTasks.length} review deliverables]

---

### 2. Immediate Decision Gate: Deliverables Requiring Sign-Off
[Markdown table: Priority | Specialist | Deliverable Title | Status. MUST USE REAL DELIVERABLE TITLES. If none, write: "*Review Gate is clean. No deliverables are currently awaiting sign-off.*"]

---

### 3. Pipeline Flow & Workload Distribution
[Markdown table showing Backlog, In Progress, Review, Completed distribution]

---

### 4. Strategic Priorities For Today
[Top 3 numbered action priorities strictly based on current tasks]

---

### 5. Autonomous Fleet Deployment
[Summary of specialist fleet capacity and allocations]

---

### 6. Chief of Staff Action Directive
[Direct, high-impact concluding recommendation]`;

        const completionPromise = executeChatCompletion({
          prompt,
          model: "auto/smart",
          systemPrompt:
            "You are an elite Executive Chief of Staff. You produce strictly truthful, crisp, dense executive memorandums. You never use greetings, quotes, or conversational filler.",
          agentName: "Chief of Staff",
          useVaultRAG: false,
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
      console.warn("LLM briefing generation timed out or failed, using structured deterministic briefing:", llmErr);
    }

    if (!briefingContent) {
      briefingContent = deterministicBriefing;
    }

    await writeVaultFile(briefingRelPath, briefingContent);

    await prisma.activityLog.create({
      data: {
        userId,
        type: "briefing_generated",
        message: `Executive Daily Briefing generated for ${today} (${telemetry.kanban.total} tasks tracked, ${telemetry.fleet.online} agents online)`,
        metadata: JSON.stringify({
          date: today,
          path: briefingRelPath,
          kanbanTasks: telemetry.kanban.total,
          reviewCount: telemetry.kanban.review,
          fleetOnline: telemetry.fleet.online,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      date: today,
      path: briefingRelPath,
      content: briefingContent,
      telemetry,
      kanbanStats: telemetry.kanban,
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
