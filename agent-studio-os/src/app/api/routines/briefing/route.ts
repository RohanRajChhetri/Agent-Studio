import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeVaultFile, readVaultFile } from "@/lib/vault";
import { executeChatCompletion, getActiveApiKeys } from "@/lib/llm-router";
import { isOmnirouteOnline } from "@/lib/omniroute";

function getTodayKey(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

export async function GET() {
  try {
    const today = getTodayKey();
    const briefingRelPath = `briefings/Daily_Briefing_${today}.md`;

    try {
      const file = await readVaultFile(briefingRelPath);
      return NextResponse.json({
        exists: true,
        date: today,
        path: briefingRelPath,
        content: file.content,
        modifiedAt: file.modifiedAt,
      });
    } catch {
      return NextResponse.json({
        exists: false,
        date: today,
        path: briefingRelPath,
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
    const today = getTodayKey();
    const briefingRelPath = `briefings/Daily_Briefing_${today}.md`;
    const todayFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Gather contextual workspace telemetry
    const [tasks, agents, recentLogs, omnirouteOnline] = await Promise.all([
      prisma.task.findMany({
        orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
        include: { agent: true },
      }),
      prisma.agent.findMany(),
      prisma.activityLog.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
      isOmnirouteOnline(),
    ]);

    const activeTasks = tasks.filter((t) => t.status !== "done");
    const completedTasks = tasks.filter((t) => t.status === "done");
    const highPriorityTasks = activeTasks.filter((t) => t.priority === "urgent" || t.priority === "high");

    const prompt = `You are the Executive Chief of Staff for an elite business leader and knowledge worker.
Write a powerful, inspiring, and actionable **Daily Executive Morning Briefing** for ${todayFormatted}.

CURRENT WORKSPACE CONTEXT:
- Date: ${todayFormatted}
- Active Kanban Tasks (${activeTasks.length}):
${activeTasks.slice(0, 8).map((t) => `  * [${t.priority.toUpperCase()}] "${t.title}" — Assigned to: ${t.agent?.displayName || "Unassigned"}`).join("\n")}
- Recently Completed Wins (${completedTasks.length}):
${completedTasks.slice(0, 5).map((t) => `  * "${t.title}" (${t.agent?.displayName || "Agent"})`).join("\n") || "  * All systems freshly initialized."}
- Agent Workforce Readiness (${agents.length} specialists):
${agents.map((a) => `  * ${a.avatar} ${a.displayName} (${a.role} | ${a.department})`).join("\n")}
- Enterprise Model Routing: ${omnirouteOnline ? "Omniroute Local Router Active (Port 20128)" : "Universal Multi-Provider Cascade Ready"}

FORMAT REQUIREMENTS:
Generate a crisp, beautifully formatted Markdown document following this structure:
# 🌅 Daily Executive Briefing — ${todayFormatted}
> *Inspiring focus quote for the day.*

## 🎯 Strategic Priorities For Today
(Top 3 high-leverage milestones to accomplish today)

## 📋 Task Battlefield & Execution Roster
(Concise table or bulleted list of high-priority tickets, assigned specialists, and status)

## 🏆 Recent Wins & Velocity
(Brief recap of yesterday's completed milestones)

## 🤖 Autonomous Workforce Directive
(Specific tactical assignments for agents like dev, research, or content creation to run in background)

## 💡 Chief of Staff Proactive Recommendation
(One actionable high-impact suggestion to maximize productivity today)

Keep the tone confident, decisive, polished, and energizing.`;

    let briefingContent = "";
    try {
      const activeKeys = await getActiveApiKeys();
      const hasKey = Object.values(activeKeys).some((k) => k && k.trim().length > 0);

      if (hasKey) {
        const completion = await executeChatCompletion({
          prompt,
          model: "auto/smart",
          systemPrompt: "You are an elite autonomous Chief of Staff producing high-impact executive morning briefings.",
          agentName: "Chief of Staff",
        });
        briefingContent = completion.content;
      }
    } catch (llmErr) {
      console.warn("LLM briefing generation skipped to fallback template:", llmErr);
    }

    if (!briefingContent) {
      // Deterministic high-quality fallback briefing
      briefingContent = `# 🌅 Daily Executive Briefing — ${todayFormatted}

> *"Focus is a muscle: say no to the non-essential so your highest goals can compound."*

---

## 🎯 Strategic Priorities For Today
1. **Drive High-Priority Kanban Deliverables**: Clear the ${highPriorityTasks.length > 0 ? highPriorityTasks.length : "key"} urgent tickets in the backlog.
2. **Review Autonomous Specialist Swarms**: Ensure agent delegations in research and engineering are progressing.
3. **Obsidian Knowledge Sync**: Capture today's decisions and code syntheses directly into the Organizational Knowledge Vault.

---

## 📋 Task Battlefield & Execution Roster
${activeTasks.length > 0
  ? activeTasks
      .slice(0, 6)
      .map((t, idx) => `${idx + 1}. **${t.title}** (${t.priority.toUpperCase()}) — ${t.agent ? `${t.agent.avatar} ${t.agent.displayName}` : "⚡ Auto-Assign Ready"}`)
      .join("\n")
  : "No pending tasks in backlog. Ready for new mission capture!"}

---

## 🏆 Recent Wins & Velocity
${completedTasks.length > 0
  ? completedTasks
      .slice(0, 4)
      .map((t) => `- ✅ **${t.title}** (Completed)`)
      .join("\n")
  : "- All tasks queued and ready for execution."}

---

## 🤖 Autonomous Workforce Directive
- **Research & Strategy**: Activate Athena / Scout for background market and competitive audits.
- **Engineering & Implementation**: Deploy DevCore / Vulcan on verified codebase tickets.
- **Communications**: Mercury standing by for executive summaries and documentation.

---

## 💡 Chief of Staff Proactive Recommendation
Run the **Autonomous Feature Pipeline** or capture quick stream-of-consciousness thoughts via **Voice Brain Dump** to automatically delegate subtasks across your specialist fleet.`;
    }

    // Persist to Obsidian Markdown Vault
    await writeVaultFile(briefingRelPath, briefingContent);

    // Record activity log
    await prisma.activityLog.create({
      data: {
        type: "briefing_generated",
        message: `Executive Morning Briefing generated for ${today}`,
        metadata: JSON.stringify({ date: today, path: briefingRelPath }),
      },
    });

    return NextResponse.json({
      success: true,
      date: today,
      path: briefingRelPath,
      content: briefingContent,
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
