import { prisma } from "@/lib/prisma";
import {
  findAndExecuteMatchingTask,
  createAndAssignTask,
  approveTaskByQuery,
  type TaskExecutionResult,
} from "@/lib/task-executor";
import { executeChatCompletion } from "@/lib/llm-router";
import { matchBestAgent } from "@/lib/agent-matcher";
import { isOmnirouteOnline } from "@/lib/omniroute";
import { performWebSearch, executeCodeSandbox } from "@/lib/tools-engine";
import type { AgentProfile } from "@/types";

export interface AutonomousActionOutput {
  handled: boolean;
  actionType?:
    | "execute_kanban"
    | "assign_task"
    | "approve_task"
    | "query_tasks"
    | "fleet_status"
    | "direct_task"
    | "search_web"
    | "execute_code";
  content: string;
  task?: any;
  agentName?: string;
  agentAvatar?: string;
  metadata?: Record<string, any>;
}

/**
 * Autonomous Action Dispatcher for Dashboard Command Center & Chat
 * Converts conversational intent into direct execution against Kanban, Agent Fleet, Tools, and Memory.
 */
export async function dispatchAutonomousAction(
  prompt: string,
  context?: {
    agentId?: string;
    targetAgent?: any;
  }
): Promise<AutonomousActionOutput> {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  // -------------------------------------------------------------
  // 1. INTENT: EXECUTE KANBAN TASK
  // Examples:
  // - "execute task in kanban" / "execute task in kanvban"
  // - "can you execute the task on kanban"
  // - "run task in kanban"
  // - "execute task"
  // - "run the first task"
  // - "complete the pending task"
  // - "execute kanban" / "execute ticket"
  // -------------------------------------------------------------
  const hasExecutionVerb =
    /\b(execute|run|start|complete|work\s+on|do|solve|finish)\b/i.test(lower);
  const hasKanbanOrTask =
    /\b(task|ticket|item|kanv?ban|board)\b/i.test(lower);
  const isQueryPrefix =
    lower.startsWith("show ") ||
    lower.startsWith("list ") ||
    lower.startsWith("what ") ||
    lower.startsWith("how many ");
  const isAssignPrefix =
    /\b(assign|delegate|give\s+(this\s+)?task|hand\s+over\s+to|have\s+(an\s+|the\s+|other\s+)?agent|ask\s+(an\s+|the\s+|other\s+)?agent)\b/i.test(
      lower
    ) ||
    lower.startsWith("create a task") ||
    lower.startsWith("create task") ||
    lower.startsWith("queue task");

  const isExecuteKanban =
    hasExecutionVerb &&
    hasKanbanOrTask &&
    !isQueryPrefix &&
    !isAssignPrefix;

  if (isExecuteKanban) {
    let taskQuery = "";
    // Clean out command prefixes and location phrases
    const cleanLower = lower
      .replace(/^(if\s+i\s+say\s+to\s+|can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+you\s+to\s+)?/i, "")
      .replace(/(?:it\s+should\s+be\s+able\s+to\s+do\s+it|and\s+complete\s+it|please)?$/i, "")
      .trim();

    const match = cleanLower.match(
      /(?:execute|run|start|complete|work\s+on|do)\s+(?:the\s+)?(?:task|ticket)?\s*(?:in\s+kanv?ban|on\s+kanv?ban)?\s*(?:on|named|called|for|:|about)?\s*(.*)/i
    );
    if (match && match[1]) {
      taskQuery = match[1]
        .replace(/in\s+kanv?ban|on\s+kanv?ban|the\s+task|the\s+ticket|kanv?ban|board/gi, "")
        .trim();
    }

    const execResult = await findAndExecuteMatchingTask(
      taskQuery || undefined,
      context?.agentId
    );

    if (!execResult.success || !execResult.task) {
      return {
        handled: true,
        actionType: "execute_kanban",
        content: `⚠️ **No Pending Kanban Tasks Found**\n\n${
          execResult.message || "There are no pending tasks waiting in Backlog or In Progress on the Kanban board."
        }\n\n👉 *Tip: You can create a new task by typing:*\n\`assign task to Coder: build a user authentication endpoint and execute it\``,
      };
    }

    const task = execResult.task;
    const agent = task.agent;
    const deliverable = execResult.deliverable || task.result || "Deliverable completed successfully.";

    const responseContent = `⚡ **Autonomous Execution Completed: "${task.title}"**

**Assigned Specialist:** ${agent ? `${agent.avatar || "🤖"} **${agent.displayName}** (${agent.role})` : "Autonomous Specialist"}  
**Status Pipeline:** \`in_progress\` ➔ **\`review\`** (Ready for validation)  
**Memory Vault File:** \`${execResult.vaultPath || `tasks/${task.title}.md`}\`  
**Execution Latency:** ${execResult.latency ? `${execResult.latency}ms` : "Instant"}

### Deliverable Output
${deliverable}

👉 **Next Steps:** [View card on Kanban Board](/kanban) • [Inspect in Memory Vault](/memory) • Reply *"approve task"* to mark Done.`;

    return {
      handled: true,
      actionType: "execute_kanban",
      content: responseContent,
      task: task,
      agentName: agent?.displayName || "Specialist Agent",
      agentAvatar: agent?.avatar || "⚡",
      metadata: {
        taskId: task.id,
        status: "review",
        vaultPath: execResult.vaultPath,
      },
    };
  }

  // -------------------------------------------------------------
  // 2. INTENT: ASSIGN TASK TO OTHER AGENTS (WITH OPTIONAL EXECUTION)
  // Examples:
  // - "assign task to other agents and complete it"
  // - "assign task to Coder: build an auth webhook and complete it"
  // - "give this task to Researcher: compare SQLite vs Postgres and execute it"
  // - "create a task for Engineering to fix memory leaks"
  // - "assign task to review agent: audit security"
  // -------------------------------------------------------------
  const isAssignTask =
    /\b(assign|delegate|give\s+(this\s+)?task|hand\s+over\s+to|have\s+(an\s+|the\s+|other\s+)?agent|ask\s+(an\s+|the\s+|other\s+)?agent)\b/i.test(
      lower
    ) ||
    lower.startsWith("create a task") ||
    lower.startsWith("create task") ||
    lower.startsWith("queue task");

  if (isAssignTask) {
    const agents = await prisma.agent.findMany();
    const shouldExecuteNow =
      lower.includes("and complete it") ||
      lower.includes("and execute it") ||
      lower.includes("and run it") ||
      lower.includes("execute it") ||
      lower.includes("complete it") ||
      lower.includes("do it now") ||
      lower.includes("proforme it") ||
      lower.includes("perform it");

    // Clean prompt to extract target agent and task details
    let targetAgent = null;
    for (const a of agents) {
      if (
        lower.includes(a.displayName.toLowerCase()) ||
        lower.includes(a.name.toLowerCase()) ||
        lower.includes(a.role.toLowerCase())
      ) {
        targetAgent = a;
        break;
      }
    }

    // Extract task title
    let taskBody = text
      .replace(/^(can\s+you\s+|please\s+)?(assign|give|delegate)\s+(?:the|this)?\s*(?:task)?\s*(?:to\s+[^:]+[:\s]+)?/i, "")
      .replace(/^create\s+(?:a\s+)?task\s+(?:to|for)?\s*([^:]+[:\s]+)?/i, "")
      .replace(/and\s+(complete|execute|run|perform|proforme)\s+it/gi, "")
      .trim();

    // If taskBody refers generically to "the task" or "this task" or "other agents", check if there is an existing pending task on Kanban!
    const isGenericRef =
      !taskBody ||
      /^(the\s+)?(task|ticket|item)(\s+to\s+other\s+agents)?$/i.test(taskBody.trim()) ||
      taskBody.trim().length <= 5;

    if (isGenericRef) {
      const pendingTask = await prisma.task.findFirst({
        where: { status: { in: ["backlog", "in_progress"] } },
        include: { agent: true },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
      if (pendingTask) {
        taskBody = pendingTask.title + (pendingTask.description ? `: ${pendingTask.description}` : "");
      } else {
        taskBody = text;
      }
    }

    // If no explicit agent found, match best agent semantically
    if (!targetAgent && agents.length > 0) {
      const matched = matchBestAgent(taskBody, agents as any);
      targetAgent = matched ? agents.find((a) => a.id === matched.id) || agents[0] : agents[0];
    }

    // Extract title (first sentence or up to 80 chars)
    const titleParts = taskBody.split(/[.\n:]/);
    const title = (titleParts[0] || taskBody).slice(0, 90).trim() || "Autonomous Task";
    const description = taskBody.length > title.length ? taskBody : "Dispatched via Mission Control Command Center";

    const result = await createAndAssignTask({
      title,
      description,
      agentId: targetAgent?.id || null,
      priority: lower.includes("urgent") ? "urgent" : lower.includes("high") ? "high" : "medium",
      executeImmediately: shouldExecuteNow,
    });

    if (shouldExecuteNow && result.success && result.task) {
      const task = result.task;
      const agent = task.agent || targetAgent;
      return {
        handled: true,
        actionType: "assign_task",
        content: `🚀 **Task Assigned & Fully Executed!**

**Task Title:** "${task.title}"  
**Assigned Specialist:** ${agent?.avatar || "🤖"} **${agent?.displayName}** (${agent?.role || "Specialist"})  
**Status:** \`backlog\` ➔ \`in_progress\` ➔ **\`review\`**  
**Obsidian Vault:** \`${result.vaultPath || `tasks/${task.title}.md`}\`

### Deliverable
${result.deliverable || "Execution complete."}

👉 [Inspect on Kanban Board](/kanban) • [Open in Memory](/memory)`,
        task: task,
        agentName: agent?.displayName,
        agentAvatar: agent?.avatar || "🤖",
      };
    } else {
      const task = result.task;
      return {
        handled: true,
        actionType: "assign_task",
        content: `📋 **Task Queued to Kanban Board**

**Task:** "${title}"  
**Assigned Agent:** ${targetAgent?.avatar || "🤖"} **${targetAgent?.displayName}** (${targetAgent?.role || "Specialist"})  
**Priority:** \`${result.task?.priority || "medium"}\`  
**Status:** \`backlog\` (Ready for autonomous pickup)

The specialist agent has been assigned and the ticket is now live on the Kanban pipeline.  
👉 [Open Kanban Board](/kanban) or reply *"execute task"* to run it immediately.`,
        task: task,
        agentName: targetAgent?.displayName,
        agentAvatar: targetAgent?.avatar || "🤖",
      };
    }
  }

  // -------------------------------------------------------------
  // 3. INTENT: APPROVE KANBAN TASK
  // Examples:
  // - "approve task"
  // - "approve the review task"
  // - "approve task on auth"
  // - "mark task done"
  // -------------------------------------------------------------
  const isApproveTask =
    lower.startsWith("approve task") ||
    lower.startsWith("approve deliverable") ||
    lower.startsWith("mark task done") ||
    lower === "approve" ||
    lower === "approve it";

  if (isApproveTask) {
    const taskQuery = text.replace(/approve\s+(?:the\s+)?(?:task|deliverable)?/i, "").trim();
    const res = await approveTaskByQuery(taskQuery || undefined);

    return {
      handled: true,
      actionType: "approve_task",
      content: res.success && res.task
        ? `✅ **Deliverable Approved & Completed!**\n\nTask **"${res.task.title}"** has passed human-in-the-loop validation and moved to **Done**.\n\n👉 [View on Kanban Board](/kanban)`
        : `⚠️ ${res.message}`,
      task: res.task,
    };
  }

  // -------------------------------------------------------------
  // 4. INTENT: QUERY KANBAN TASKS
  // Examples:
  // - "show me the tasks"
  // - "list tasks"
  // - "what tasks are in kanban"
  // - "what's in backlog"
  // -------------------------------------------------------------
  const isQueryTasks =
    lower.includes("show me the tasks") ||
    lower.includes("show tasks") ||
    lower.includes("list tasks") ||
    lower.includes("what tasks") ||
    lower.includes("tasks in kanban") ||
    lower.includes("what's on kanban") ||
    lower.includes("what's in backlog") ||
    lower.includes("what is in backlog");

  if (isQueryTasks) {
    const tasks = await prisma.task.findMany({
      where: { status: { in: ["in_progress", "review", "backlog"] } },
      include: { agent: true },
      orderBy: [{ status: "asc" }, { priority: "asc" }, { updatedAt: "desc" }],
      take: 10,
    });

    if (tasks.length === 0) {
      return {
        handled: true,
        actionType: "query_tasks",
        content: `📋 **Kanban Pipeline Status**\n\nAll clear! No active tasks are currently pending in Backlog, In Progress, or Review.\n\n👉 *To create a task, type:*\n\`assign task to Coder: build a user authentication endpoint\``,
      };
    }

    const reviewTasks = tasks.filter((t) => t.status === "review");
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
    const backlogTasks = tasks.filter((t) => t.status === "backlog");

    let table = `📋 **Current Kanban Tasks (${tasks.length} Active)**\n\n`;

    if (reviewTasks.length > 0) {
      table += `### 🔍 Needs Review (${reviewTasks.length})\n`;
      reviewTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — ${t.agent?.displayName || "Unassigned"}  \n  ↳ *Reply \`approve task\` to mark Done or inspect on [Kanban](/kanban)*\n`;
      });
      table += `\n`;
    }

    if (inProgressTasks.length > 0) {
      table += `### ⚡ In Progress (${inProgressTasks.length})\n`;
      inProgressTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — ${t.agent?.displayName || "Agent executing..."}\n`;
      });
      table += `\n`;
    }

    if (backlogTasks.length > 0) {
      table += `### ⏳ Backlog (${backlogTasks.length})\n`;
      backlogTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — Assigned to: **${t.agent?.displayName || "Unassigned"}**\n`;
      });
      table += `\n`;
    }

    table += `👉 *To execute any task immediately, type:*\n\`execute task\``;

    return {
      handled: true,
      actionType: "query_tasks",
      content: table,
    };
  }

  // -------------------------------------------------------------
  // 5. INTENT: FLEET & SYSTEM STATUS
  // Examples:
  // - "system status", "fleet status", "list agents", "what agents do we have"
  // -------------------------------------------------------------
  const isFleetStatus =
    lower === "system status" ||
    lower === "fleet status" ||
    lower === "status" ||
    lower === "list agents" ||
    lower === "what agents do we have" ||
    lower.includes("how is the fleet");

  if (isFleetStatus) {
    const [agents, taskCounts, omniOnline] = await Promise.all([
      prisma.agent.findMany(),
      prisma.task.groupBy({ by: ["status"], _count: { id: true } }),
      isOmnirouteOnline().catch(() => false),
    ]);

    const counts: Record<string, number> = {};
    for (const t of taskCounts) {
      counts[t.status] = t._count.id;
    }

    let report = `⚡ **Agent Studio OS — Live Fleet Telemetry**\n\n`;
    report += `• **Gateway Engine:** ${omniOnline ? "🟢 OmniRoute Online (`http://localhost:3000`)" : "🟡 Direct Provider Fallbacks Active"}\n`;
    report += `• **Workforce Fleet:** **${agents.length} Autonomous Agents**\n`;
    report += `• **Kanban Pipeline:** **${counts["in_progress"] || 0} in progress**, **${counts["review"] || 0} needs review**, **${counts["backlog"] || 0} backlog**, **${counts["done"] || 0} completed**\n\n`;
    report += `### Active Agents Directory\n`;
    agents.forEach((a) => {
      report += `- ${a.avatar || "🤖"} **${a.displayName}** (\`${a.role}\` | Dept: ${a.department || "General"}) — ${a.model ? a.model.split("/").pop() : "Auto Cascade"}\n`;
    });

    return {
      handled: true,
      actionType: "fleet_status",
      content: report,
    };
  }

  // -------------------------------------------------------------
  // 6. INTENT: LIVE WEB SEARCH
  // Examples:
  // - "search web for Next.js 15 features"
  // - "web search latest LLM benchmarks"
  // - "search for postgres 17 release"
  // -------------------------------------------------------------
  const isSearchWeb =
    lower.startsWith("search web for ") ||
    lower.startsWith("search the web for ") ||
    lower.startsWith("web search ") ||
    lower.startsWith("search for ") ||
    lower.startsWith("look up ") ||
    lower.startsWith("google ");

  if (isSearchWeb) {
    const query = text
      .replace(/^(search\s+(the\s+)?web\s+for|web\s+search|search\s+for|look\s+up|google)\s+/i, "")
      .trim();

    if (query) {
      try {
        const searchResult = await performWebSearch(query, 5);
        let content = `🌐 **Live Web Search Results: "${query}"**\n*(Executed in ${searchResult.latency}ms)*\n\n`;

        if (searchResult.results.length === 0) {
          content += `No direct results found for "${query}".`;
        } else {
          searchResult.results.forEach((item, idx) => {
            content += `**${idx + 1}. [${item.title}](${item.url})**  \n${item.snippet}  \n🔗 \`${item.url}\`\n\n`;
          });
        }

        await prisma.activityLog.create({
          data: {
            type: "agent_action",
            message: `Executed live web search for: "${query.slice(0, 50)}"`,
          },
        });

        return {
          handled: true,
          actionType: "search_web",
          content,
          agentName: "Search Specialist",
          agentAvatar: "🌐",
        };
      } catch (err) {
        return {
          handled: true,
          actionType: "search_web",
          content: `⚠️ Web search failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 7. INTENT: SANDBOX CODE EXECUTION
  // Examples:
  // - "run code: console.log(42 * 2)"
  // - "execute code: print('Hello from Python')"
  // - "run javascript: [1,2,3].map(x => x*2)"
  // -------------------------------------------------------------
  const isRunCode =
    lower.startsWith("run code:") ||
    lower.startsWith("execute code:") ||
    lower.startsWith("run javascript:") ||
    lower.startsWith("run js:") ||
    lower.startsWith("run python:") ||
    lower.startsWith("run script:");

  if (isRunCode) {
    const isPython = lower.startsWith("run python:");
    const lang = isPython ? "python" : "javascript";
    const code = text.replace(/^(run|execute)\s+(code|javascript|js|python|script):\s*/i, "").trim();

    if (code) {
      try {
        const execResult = await executeCodeSandbox(code, lang);
        let content = `💻 **Sandbox Code Execution (${lang.toUpperCase()})**\n\n`;
        content += `**Status:** ${execResult.success ? "✅ Success" : "❌ Error"} • **Latency:** ${execResult.executionTime}ms\n\n`;
        content += "```" + lang + "\n" + code + "\n```\n\n";
        content += "### Output Console\n```\n";
        content += execResult.stdout ? execResult.stdout : "(No stdout)";
        if (execResult.stderr) {
          content += "\n[STDERR]\n" + execResult.stderr;
        }
        content += "\n```";

        await prisma.activityLog.create({
          data: {
            type: "agent_action",
            message: `Executed ${lang} code sandbox snippet`,
          },
        });

        return {
          handled: true,
          actionType: "execute_code",
          content,
          agentName: "Code Runner",
          agentAvatar: "💻",
        };
      } catch (err) {
        return {
          handled: true,
          actionType: "execute_code",
          content: `⚠️ Code execution failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 8. INTENT: DIRECT ACTIONABLE TASK (Not just a chatbot)
  // If the user gives a concrete task (e.g. "write code for...", "build a script...",
  // "generate a table comparing...", "analyze this bug..."), ensure the agent
  // behaves as a production-grade executor and delivers real, actionable outputs.
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // 8. INTENT: DIRECT ACTIONABLE TASK (Not just a chatbot)
  // If the user gives a concrete task (e.g. "write code for...", "build a script...",
  // "generate a table comparing...", "analyze this bug...", "perform a task..."), ensure the agent
  // behaves as a production-grade executor and delivers real, actionable outputs.
  // -------------------------------------------------------------
  const isDirectActionableWork =
    /^(can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+you\s+to\s+)?(write|create|build|implement|code|generate|analyze|summarize|calculate|debug|fix|draft|design|refactor|perform|proforme|make|setup|set\s+up|configure|audit|test|benchmark|optimize|find\s+bugs\s+in|check)\s+/i.test(
      lower
    ) ||
    /^(here\s+is\s+a\s+task|i\s+have\s+a\s+task|task:)/i.test(lower) ||
    /\b(proforme|perform)\s+(this|the|a)\s+task\b/i.test(lower) ||
    (lower.includes("task") &&
      (lower.includes("small task") ||
        lower.includes("perform") ||
        lower.includes("proforme") ||
        lower.includes("solve") ||
        lower.includes("build")));

  if (isDirectActionableWork) {
    // Determine the optimal specialist agent
    const agents = await prisma.agent.findMany();
    const specialist = matchBestAgent(text, agents as any);
    const effectiveAgent = specialist ? agents.find((a) => a.id === specialist.id) || agents[0] : agents[0];

    // Check if web search context would enrich this technical task
    let webContext = "";
    if (
      lower.includes("latest") ||
      lower.includes("current") ||
      lower.includes("documentation") ||
      lower.includes("benchmark")
    ) {
      try {
        const searchRes = await performWebSearch(text.slice(0, 80), 3);
        if (searchRes && searchRes.results.length > 0) {
          webContext =
            "\n\n[LIVE WEB SEARCH CONTEXT]\n" +
            searchRes.results.map((r) => `- ${r.title}: ${r.snippet} (${r.url})`).join("\n");
        }
      } catch {
        // Continue if search unreachable
      }
    }

    // Build execution prompt emphasizing complete, non-conversational deliverable
    const executionPrompt = `You are ${effectiveAgent ? effectiveAgent.displayName : "an elite Autonomous AI Specialist"} in Agent Studio OS.
The user has issued an active mission command:
"${text}"${webContext}

CRITICAL INSTRUCTIONS:
- You are an autonomous software agent and technical executor, NOT a chat bot.
- Do NOT provide conversational fluff like "Sure! Here is that script for you..." or "I hope this helps!".
- Start directly with the professional executive summary and complete, production-grade deliverable.
- If code is requested: Provide complete, runnable, production code in fenced code blocks with language identifiers.
- If analysis or research is requested: Provide concrete tables, benchmarks, or structured specifications.
- If testing is needed: Provide verification commands.`;

    const result = await executeChatCompletion({
      prompt: executionPrompt,
      model: effectiveAgent?.model || null,
      systemPrompt: effectiveAgent?.systemPrompt || undefined,
      agentName: effectiveAgent?.name,
      useVaultRAG: true,
    });

    // Automatically log this autonomous execution to activity log
    await prisma.activityLog.create({
      data: {
        type: "agent_action",
        message: `${effectiveAgent?.displayName || "Specialist"} executed direct task: "${text.slice(0, 60)}..."`,
        agentId: effectiveAgent?.id || null,
      },
    });

    return {
      handled: true,
      actionType: "direct_task",
      content: result.content,
      agentName: effectiveAgent?.displayName,
      agentAvatar: effectiveAgent?.avatar || "🤖",
    };
  }

  // Not handled by direct action — proceed to standard conversational router
  return { handled: false, content: "" };
}
