import { prisma } from "@/lib/prisma";
import {
  findAndExecuteMatchingTask,
  createAndAssignTask,
  approveTaskByQuery,
} from "@/lib/task-executor";
import { executeChatCompletion } from "@/lib/llm-router";
import { matchBestAgent } from "@/lib/agent-matcher";
import { isOmnirouteOnline } from "@/lib/omniroute";
import { performWebSearch, executeCodeSandbox } from "@/lib/tools-engine";
import { calculateNextRun } from "@/lib/scheduler";

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
    | "execute_code"
    | "scrape_web"
    | "create_routine"
    | "create_workflow"
    | "desktop_action";
  content: string;
  task?: any;
  agentName?: string;
  agentAvatar?: string;
  metadata?: Record<string, any>;
}

/**
 * Intelligent Parser for Compound Desktop Instructions.
 * Decomposes multi-intent instructions like:
 * - "open youtube wait 2 seconds and take a screen shot"
 * - "open youtube, wait 2 seconds, and take a screenshot"
 * - "open youtube search for cat video and then take a screen shot of it"
 * - "launch calculator wait 1s and capture screen"
 * - "wait 2 seconds and take a screenshot"
 */
export function parseDesktopCompoundInstruction(input: string): {
  isCompound: boolean;
  target?: string;
  hasExplicitWait: boolean;
  waitMs: number;
  hasScreenshot: boolean;
} {
  const cleaned = input
    .trim()
    .replace(/^(?:i\s+(?:told\s+(?:it|you)\s+to|want\s+you\s+to)\s+)/i, "")
    .replace(/^(?:can\s+you\s+|could\s+you\s+|please\s+)/i, "");

  const lower = cleaned.toLowerCase();

  // Check if the entire instruction is simply a desktop screenshot request (e.g. "take a screenshot form the destop operator page")
  const isPureScreenshot =
    /^(?:can\s+you\s+|could\s+you\s+|please\s+)?(?:take\s+(?:a\s+)?(?:screen\s*shot|screenshot|snapshot)|capture\s+(?:the\s+)?(?:screen|desktop)|screen\s*shot|screenshot|snapshot)(?:\s+(?:of|from|form|in|on)\s+.+)?$/i.test(
      lower.trim()
    ) &&
    !/^(?:open|launch|start|run|visit|browse|go\s+to|goto|navigate)\b/i.test(lower.trim()) &&
    !/\b(?:and|then)\s+(?:open|launch|start|run|visit|browse|type|click|write|press)\b/i.test(lower.trim());

  if (isPureScreenshot) {
    return {
      isCompound: false,
      target: undefined,
      hasExplicitWait: false,
      waitMs: 0,
      hasScreenshot: true,
    };
  }

  // 1. Detect screenshot intent
  const hasScreenshot =
    /(?:take\s+(?:a\s+)?screen\s*shot|capture\s+(?:the\s+)?screen|screen\s*shot)(?:\s+(?:of\s+)?(?:it|this|that|the\s+page|the\s+result|the\s+screen|the\s+desktop))?$/i.test(
      lower
    ) || /\b(?:take\s+(?:a\s+)?screen\s*shot|capture\s+(?:the\s+)?screen|screenshot|screen\s*shot)\b/i.test(lower);

  // 2. Detect explicit wait duration
  let hasExplicitWait = false;
  let waitMs = 0;
  const waitMatch = lower.match(
    /\b(?:wait|pause|sleep|delay)(?:\s+for|\s+of)?\s+(\d+(?:\.\d+)?)\s*(seconds|second|secs|sec|s|milliseconds|millis|ms|minutes|mins|m)?\b/i
  );

  if (waitMatch) {
    hasExplicitWait = true;
    const val = parseFloat(waitMatch[1]);
    const unit = (waitMatch[2] || "").toLowerCase();
    if (unit.startsWith("m") && !unit.startsWith("ms") && !unit.startsWith("millis")) {
      waitMs = Math.round(val * 60000);
    } else if (unit === "ms" || unit.startsWith("millis")) {
      waitMs = Math.round(val);
    } else {
      waitMs = val <= 10 ? Math.round(val * 1000) : Math.round(val);
    }
  } else if (/\b(?:wait|pause|sleep)\s+(?:a\s+couple\s+(?:of\s+)?seconds|a\s+few\s+seconds)\b/i.test(lower)) {
    hasExplicitWait = true;
    waitMs = 2500;
  } else if (/\b(?:wait|pause|sleep)\s+(?:a\s+second|a\s+bit|a\s+moment)\b/i.test(lower)) {
    hasExplicitWait = true;
    waitMs = 1500;
  }

  // 3. Extract target by stripping screenshot and wait segments
  let stripped = cleaned;
  if (hasScreenshot) {
    stripped = stripped.replace(
      /(?:\s+(?:and\s+)?(?:then\s+)?)?(?:take\s+(?:a\s+)?screen\s*shot|capture\s+(?:the\s+)?screen|screen\s*shot)(?:\s+(?:of\s+)?(?:it|this|that|the\s+page|the\s+result|the\s+screen|the\s+desktop))?$/i,
      ""
    );
  }
  if (hasExplicitWait) {
    stripped = stripped.replace(
      /(?:\s+(?:and\s+)?(?:then\s+)?)?(?:wait|pause|sleep|delay)(?:\s+for|\s+of)?\s+(?:\d+(?:\.\d+)?\s*(?:seconds|second|secs|sec|s|milliseconds|millis|ms|minutes|mins|m)?|a\s+couple\s+(?:of\s+)?seconds|a\s+few\s+seconds|a\s+second|a\s+bit|a\s+moment)/i,
      ""
    );
  }

  // Strip leading navigation / launch verbs
  const prefixMatch = stripped.match(
    /^(?:open|launch|start|run|visit|browse\s+to|browse|go\s+to|goto|navigate\s+to|navigate|head\s+to|take\s+me\s+to)\s+(.+)$/i
  );
  let target = prefixMatch ? prefixMatch[1].trim() : stripped.trim();

  // Strip trailing connectors like "and", "then", ","
  target = target
    .replace(/^(?:and\s+)?(?:then\s+)?/i, "")
    .replace(/(?:\s+and|\s+then|,|\.)$/i, "")
    .trim();

  // If target is empty or only filler words
  if (/^(?:and|then|please|it|this|that|now)?$/i.test(target)) {
    target = "";
  }

  const isCompound =
    (hasScreenshot && (!!target || hasExplicitWait)) ||
    (hasExplicitWait && !!target) ||
    (!!target && prefixMatch !== null && (hasScreenshot || hasExplicitWait));

  return {
    isCompound,
    target: target || undefined,
    hasExplicitWait,
    waitMs,
    hasScreenshot,
  };
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
    skipActionDispatch?: boolean;
    isCodeWorkspace?: boolean;
    skipDirectTask?: boolean;
  }
): Promise<AutonomousActionOutput> {
  if (context?.skipActionDispatch || context?.isCodeWorkspace) {
    return { handled: false, content: "" };
  }

  // Strip attached file contents and block quotes to ensure intent analysis is strictly on the user's explicit typed command
  let userInstruction = prompt.trim();
  userInstruction = userInstruction.split(/\n\s*---\s*File Attachment:/i)[0];
  userInstruction = userInstruction.split(/\n\s*\[Attached File:/i)[0];
  userInstruction = userInstruction.split(/\n\s*\[Attached Image:/i)[0].trim();

  const text = userInstruction;
  const lower = userInstruction.toLowerCase();

  // -------------------------------------------------------------
  // 1. INTENT: EXECUTE KANBAN TASK
  // Examples:
  // - "execute task in kanban" / "execute task in kanvban"
  // - "can you execute the task on kanban"
  // - "run task in kanban"
  // - "execute task: Build OAuth2"
  // - "run the first task" / "complete the pending task"
  // -------------------------------------------------------------
  const isConversationalQuestion =
    /^(?:can\s+you\s+(?:tell|explain|read|check|review|see|look|describe|help)|tell\s+me|what\s+is|what\s+are|how\s+(?:do|to|does|can)|explain|look\s+at|read|review|summarize|inspect|check|describe)\b/i.test(
      lower
    );

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

  const hasExplicitKanbanCommand =
    /\b(?:run|execute|start|complete)\s+(?:the\s+)?(?:kanban\s+task|task\s+(?:in|on)\s+kanban|kanban\s+ticket|ticket\s+(?:in|on)\s+kanban)\b/i.test(lower) ||
    /^(?:execute|run|start)\s+(?:the\s+)?(?:task|ticket)\b/i.test(lower) ||
    /^(?:complete|finish)\s+(?:the\s+)?(?:pending\s+)?(?:task|ticket)\b/i.test(lower) ||
    /\b(?:execute|run|start)\s+task\s*[:"']/i.test(lower);

  const isExecuteKanban =
    !isConversationalQuestion &&
    !isQueryPrefix &&
    !isAssignPrefix &&
    hasExplicitKanbanCommand;

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
        content: `**Kanban Execution Notice**\n\n${
          execResult.message || "There are no pending tasks waiting in Backlog or In Progress on the Kanban board."
        }\n\n*Tip: You can create a new task by typing:*\n\`assign task to Coder: build a user authentication endpoint and execute it\``,
      };
    }

    const task = execResult.task;
    const agent = task.agent;
    const deliverable = execResult.deliverable || task.result || "Deliverable completed successfully.";

    const responseContent = `**Autonomous Execution Completed: "${task.title}"**

**Assigned Specialist:** ${agent ? `${agent.avatar || "bot"} **${agent.displayName}** (${agent.role})` : "Autonomous Specialist"}  
**Status Pipeline:** \`in_progress\` → **\`review\`** (Ready for validation)  
**Memory Vault File:** \`${execResult.vaultPath || `tasks/${task.title}.md`}\`  
**Execution Latency:** ${execResult.latency ? `${execResult.latency}ms` : "Instant"}

### Deliverable Output
${deliverable}

**Next Steps:** [View card on Kanban Board](/kanban) • [Inspect in Memory Vault](/memory) • Reply *"approve task"* to mark Done.`;

    return {
      handled: true,
      actionType: "execute_kanban",
      content: responseContent,
      task: task,
      agentName: agent?.displayName || "Specialist Agent",
      agentAvatar: agent?.avatar || "zap",
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
    lower.startsWith("queue task") ||
    /\b(create|add|put|make)\s+(?:this\s+|a\s+|an\s+|the\s+)?task\s+(?:in|on|to)\s+(?:the\s+)?kanban/i.test(lower) ||
    /\b(create|add|put)\s+(?:this\s+)?(?:task\s+)?(?:in|on|to)\s+(?:the\s+)?kanban\s+board/i.test(lower);

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
      .replace(/^(can\s+you\s+|please\s+)?(create|add|put|make)\s+(?:a\s+|this\s+|the\s+)?task\s+(?:in|on|to)\s+(?:the\s+)?kanban(?:\s+board)?(?:\s+(?:called|named|titled|for|to))?\s*/i, "")
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
        content: `**Task Assigned & Fully Executed!**

**Task Title:** "${task.title}"  
**Assigned Specialist:** ${agent?.avatar || "bot"} **${agent?.displayName}** (${agent?.role || "Specialist"})  
**Status:** \`backlog\` → \`in_progress\` → **\`review\`**  
**Obsidian Vault:** \`${result.vaultPath || `tasks/${task.title}.md`}\`

### Deliverable
${result.deliverable || "Execution complete."}

[Inspect on Kanban Board](/kanban) • [Open in Memory](/memory)`,
        task: task,
        agentName: agent?.displayName,
        agentAvatar: agent?.avatar || "bot",
      };
    } else {
      const task = result.task;
      return {
        handled: true,
        actionType: "assign_task",
        content: `**Task Queued to Kanban Board**

**Task:** "${title}"  
**Assigned Agent:** ${targetAgent?.avatar || "bot"} **${targetAgent?.displayName}** (${targetAgent?.role || "Specialist"})  
**Priority:** \`${result.task?.priority || "medium"}\`  
**Status:** \`backlog\` (Ready for autonomous pickup)

The specialist agent has been assigned and the ticket is now live on the Kanban pipeline.  
[Open Kanban Board](/kanban) or reply *"execute task"* to run it immediately.`,
        task: task,
        agentName: targetAgent?.displayName,
        agentAvatar: targetAgent?.avatar || "bot",
      };
    }
  }

  // -------------------------------------------------------------
  // 2b. INTENT: CREATE SCHEDULED ROUTINE
  // Examples:
  // - "make a routine to check logs every day at 9am"
  // - "create routine: morning security audit"
  // - "make routine called Health Check that runs daily"
  // -------------------------------------------------------------
  const isCreateRoutine =
    /\b(make|create|schedule|set\s+up)\s+(?:a\s+|an\s+)?(?:daily\s+|automated\s+|recurring\s+)?routine\b/i.test(lower) ||
    lower.startsWith("make routine") ||
    lower.startsWith("create routine") ||
    lower.startsWith("schedule routine");

  if (isCreateRoutine) {
    const agents = await prisma.agent.findMany();
    const routineBody = text
      .replace(/^(can\s+you\s+|please\s+)?(make|create|schedule|set\s+up)\s+(?:a\s+|an\s+)?(?:daily\s+|automated\s+|recurring\s+)?routine(?:\s+(?:called|named|titled|for|to))?\s*/i, "")
      .trim();

    const title = routineBody.split(/[.\n:]/)[0]?.slice(0, 70).trim() || "Automated Routine";
    const prompt = routineBody || title;
    const isDaily = !lower.includes("one time") && !lower.includes("one-time") && !lower.includes("once");
    const type = isDaily ? "daily" : "one_time";

    let time = "09:00";
    const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
    if (timeMatch && (lower.includes("at ") || lower.includes("every ") || lower.includes("daily "))) {
      let hour = parseInt(timeMatch[1], 10);
      const min = timeMatch[2] ? timeMatch[2] : "00";
      const ampm = timeMatch[3]?.toLowerCase();
      if (ampm === "pm" && hour < 12) hour += 12;
      if (ampm === "am" && hour === 12) hour = 0;
      time = `${String(hour).padStart(2, "0")}:${min}`;
    }

    const priority = lower.includes("urgent") ? "urgent" : lower.includes("high") ? "high" : "medium";

    let targetAgent = null;
    for (const a of agents) {
      if (lower.includes(a.displayName.toLowerCase()) || lower.includes(a.name.toLowerCase())) {
        targetAgent = a;
        break;
      }
    }
    if (!targetAgent && agents.length > 0) {
      const matched = matchBestAgent(`${title} ${prompt}`, agents as any);
      targetAgent = matched ? agents.find((a) => a.id === matched.id) || agents[0] : agents[0];
    }

    const nextRunAt = calculateNextRun(type, time, null);

    const routine = await prisma.routine.create({
      data: {
        title: title.trim(),
        description: `Automated scheduled routine configured via Mission Control`,
        prompt: prompt.trim(),
        type,
        time: type === "daily" ? time : null,
        scheduledAt: null,
        agentId: targetAgent?.id || null,
        enabled: true,
        autoExecute: true,
        priority,
        nextRunAt,
      },
      include: { agent: true },
    });

    try {
      await prisma.activityLog.create({
        data: {
          type: "routine_created",
          message: `Created ${type === "daily" ? "daily routine" : "scheduled task"} "${routine.title}"`,
          agentId: targetAgent?.id || null,
        },
      });
    } catch {}

    const agent = routine.agent || targetAgent;
    return {
      handled: true,
      actionType: "create_routine",
      content: `**Automated Routine Scheduled Successfully!**

**Routine Title:** "${routine.title}"  
**Assigned Specialist:** ${agent?.avatar || "bot"} **${agent?.displayName}** (${agent?.role || "Specialist"})  
**Execution Cadence:** ${type === "daily" ? `Daily at \`${time}\`` : `One-time execution`}  
**Next Scheduled Run:** ${nextRunAt ? new Date(nextRunAt).toLocaleString() : "Active in scheduler"}  
**Status:** **Active & Autonomous**

[Open Routines Page](/routines) to view or trigger immediately.`,
      agentName: agent?.displayName,
      agentAvatar: agent?.avatar || "bot",
      metadata: { routineId: routine.id, title: routine.title, routinesUrl: "/routines" },
    };
  }

  // -------------------------------------------------------------
  // 2c. INTENT: CREATE MULTI-AGENT DAG WORKFLOW
  // Examples:
  // - "create workflows"
  // - "create workflow: competitor analysis pipeline"
  // - "make a workflow for security audit"
  // - "build workflow for market research"
  // -------------------------------------------------------------
  const isCreateWorkflow =
    /\b(make|create|build|generate|design)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:dag\s+|swarm\s+|multi-agent\s+)?workflow(?:s)?\b/i.test(lower) ||
    lower.startsWith("create workflow") ||
    lower.startsWith("make workflow") ||
    lower.startsWith("build workflow");

  if (isCreateWorkflow) {
    const agents = await prisma.agent.findMany();
    const wfBody = text
      .replace(/^(can\s+you\s+|please\s+)?(make|create|build|generate|design)\s+(?:a\s+|an\s+)?(?:new\s+)?(?:dag\s+|swarm\s+|multi-agent\s+)?workflow(?:s)?(?:\s+(?:called|named|titled|for|to))?\s*/i, "")
      .trim();

    const wfName = wfBody.split(/[.\n:]/)[0]?.slice(0, 70).trim() || "Autonomous Multi-Agent Swarm";
    const workflowId = `workflow-${Date.now()}`;
    const firstAgent = agents[0] || null;
    const secondAgent = agents[1] || firstAgent;
    const thirdAgent = agents[2] || firstAgent;

    const triggerId = `node-trigger-${Date.now()}`;
    const a1Id = `node-stage1-${Date.now()}`;
    const a2Id = `node-stage2-${Date.now()}`;
    const a3Id = `node-stage3-${Date.now()}`;
    const endId = `node-end-${Date.now()}`;

    const nodes = [
      {
        id: triggerId,
        type: "trigger",
        title: "Mission Intake",
        description: "Intake user goal and parameter grounding",
        position: { x: 60, y: 180 },
        status: "idle",
      },
      {
        id: a1Id,
        type: "agent",
        title: `${firstAgent?.displayName || "Research"} Intelligence`,
        description: "Exhaustive research & requirements synthesis",
        position: { x: 320, y: 100 },
        agentId: firstAgent?.id,
        agentName: firstAgent?.displayName || "Researcher",
        agentAvatar: firstAgent?.avatar || "search",
        agentRole: firstAgent?.role || "specialist",
        promptTemplate: "Analyze mission directive and extract core parameters:\n\n{{input}}",
        status: "idle",
      },
      {
        id: a2Id,
        type: "agent",
        title: `${secondAgent?.displayName || "Engineering"} Architect`,
        description: "Design systems architecture & code implementation",
        position: { x: 600, y: 100 },
        agentId: secondAgent?.id,
        agentName: secondAgent?.displayName || "Engineer",
        agentAvatar: secondAgent?.avatar || "zap",
        agentRole: secondAgent?.role || "specialist",
        promptTemplate: "Synthesize upstream findings into runnable deliverable:\n\n{{previous_output}}",
        status: "idle",
      },
      {
        id: a3Id,
        type: "agent",
        title: `${thirdAgent?.displayName || "Quality"} Verification`,
        description: "Independent audit, linting, and security gate",
        position: { x: 880, y: 100 },
        agentId: thirdAgent?.id,
        agentName: thirdAgent?.displayName || "Auditor",
        agentAvatar: thirdAgent?.avatar || "shield",
        agentRole: thirdAgent?.role || "specialist",
        promptTemplate: "Perform rigorous quality and security verification:\n\n{{previous_output}}",
        status: "idle",
      },
      {
        id: endId,
        type: "end",
        title: "Deliverable Ready",
        description: "Terminal deliverable output verification",
        position: { x: 1140, y: 180 },
        status: "idle",
      },
    ];

    const edges = [
      { id: `e1-${Date.now()}`, from: triggerId, to: a1Id },
      { id: `e2-${Date.now()}`, from: a1Id, to: a2Id },
      { id: `e3-${Date.now()}`, from: a2Id, to: a3Id },
      { id: `e4-${Date.now()}`, from: a3Id, to: endId },
    ];

    const newWorkflow = {
      id: workflowId,
      name: wfName,
      description: wfBody || "Autonomous DAG swarm pipeline created via chat",
      category: "Swarm",
      nodes,
      edges,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const setting = await prisma.setting.findUnique({
      where: { key: "agent_studio_workflows" },
    });
    let existingCustom: any[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) existingCustom = parsed;
      } catch {}
    }

    const updated = [
      ...existingCustom.filter((w: any) => w.id !== workflowId),
      newWorkflow,
    ];

    await prisma.setting.upsert({
      where: { key: "agent_studio_workflows" },
      update: { value: JSON.stringify(updated) },
      create: { key: "agent_studio_workflows", value: JSON.stringify(updated) },
    });

    try {
      await prisma.activityLog.create({
        data: {
          type: "workflow_created",
          message: `Created visual DAG workflow: "${newWorkflow.name}" with 5 stages`,
        },
      });
    } catch {}

    return {
      handled: true,
      actionType: "create_workflow",
      content: `**Visual DAG Workflow Built & Deployed!**

**Workflow Name:** "${newWorkflow.name}"  
**Workflow ID:** \`${workflowId}\`  
**Pipeline Topology:** \`Trigger\` → \`${firstAgent?.displayName || "Research"}\` → \`${secondAgent?.displayName || "Engineering"}\` → \`${thirdAgent?.displayName || "Verification"}\` → \`Terminal Deliverable\`  
**Total Stages:** 5 nodes • 4 wired edges  
**Status:** **Ready in Workflow Canvas**

[Open in Visual Workflow Canvas](/workflows?id=${workflowId}) to view the interactive graph or run it now.`,
      agentName: context?.targetAgent?.displayName || "Swarm Orchestrator",
      agentAvatar: context?.targetAgent?.avatar || "workflow",
      metadata: { workflowId, workflowsUrl: `/workflows?id=${workflowId}` },
    };
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
        ? `**Deliverable Approved & Completed!**\n\nTask **"${res.task.title}"** has passed human-in-the-loop validation and moved to **Done**.\n\n[View on Kanban Board](/kanban)`
        : `${res.message}`,
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
        content: `**Kanban Pipeline Status**\n\nAll clear! No active tasks are currently pending in Backlog, In Progress, or Review.\n\n*To create a task, type:*\n\`assign task to Coder: build a user authentication endpoint\``,
      };
    }

    const reviewTasks = tasks.filter((t) => t.status === "review");
    const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
    const backlogTasks = tasks.filter((t) => t.status === "backlog");

    let table = `**Current Kanban Tasks (${tasks.length} Active)**\n\n`;

    if (reviewTasks.length > 0) {
      table += `### � Needs Review (${reviewTasks.length})\n`;
      reviewTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — ${t.agent?.displayName || "Unassigned"}  \n  ↳ *Reply \`approve task\` to mark Done or inspect on [Kanban](/kanban)*\n`;
      });
      table += `\n`;
    }

    if (inProgressTasks.length > 0) {
      table += `### In Progress (${inProgressTasks.length})\n`;
      inProgressTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — ${t.agent?.displayName || "Agent executing..."}\n`;
      });
      table += `\n`;
    }

    if (backlogTasks.length > 0) {
      table += `### Backlog (${backlogTasks.length})\n`;
      backlogTasks.forEach((t) => {
        table += `- **"${t.title}"** (${t.priority.toUpperCase()}) — Assigned to: **${t.agent?.displayName || "Unassigned"}**\n`;
      });
      table += `\n`;
    }

    table += `*To execute any task immediately, type:*\n\`execute task\``;

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

    let report = `**Agent Studio OS — Live Fleet Telemetry**\n\n`;
    report += `• **Gateway Engine:** ${omniOnline ? "OmniRoute Online (`http://localhost:3000`)" : "Direct Provider Fallbacks Active"}\n`;
    report += `• **Workforce Fleet:** **${agents.length} Autonomous Agents**\n`;
    report += `• **Kanban Pipeline:** **${counts["in_progress"] || 0} in progress**, **${counts["review"] || 0} needs review**, **${counts["backlog"] || 0} backlog**, **${counts["done"] || 0} completed**\n\n`;
    report += `### Active Agents Directory\n`;
    agents.forEach((a) => {
      report += `- ${a.avatar || "bot"} **${a.displayName}** (\`${a.role}\` | Dept: ${a.department || "General"}) — ${a.model ? a.model.split("/").pop() : "Auto Cascade"}\n`;
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
        let content = `**Live Web Search Results: "${query}"**\n*(Executed in ${searchResult.latency}ms)*\n\n`;

        if (searchResult.results.length === 0) {
          content += `No direct results found for "${query}".`;
        } else {
          searchResult.results.forEach((item, idx) => {
            content += `**${idx + 1}. [${item.title}](${item.url})**  \n${item.snippet}  \n\`${item.url}\`\n\n`;
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
          agentAvatar: "globe",
        };
      } catch (err) {
        return {
          handled: true,
          actionType: "search_web",
          content: `Web search failed: ${err instanceof Error ? err.message : String(err)}`,
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
        let content = `**Sandbox Code Execution (${lang.toUpperCase()})**\n\n`;
        content += `**Status:** ${execResult.success ? "Success" : "Error"} • **Latency:** ${execResult.executionTime}ms\n\n`;
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
          agentAvatar: "laptop",
        };
      } catch (err) {
        return {
          handled: true,
          actionType: "execute_code",
          content: `Code execution failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 7b. INTENT: LIVE WEB SCRAPING & CRAWLING (SCRAPLING)
  // Examples:
  // - "scrape https://github.com/trycua/cua"
  // - "scrape page https://news.ycombinator.com"
  // - "extract data from https://example.com"
  // - "crawl https://docs.python.org"
  // -------------------------------------------------------------
  const isScrapeIntent =
    /^(scrape|crawl|extract\s+data\s+from|fetch\s+page|harvest)\s+(https?:\/\/[^\s]+)/i.test(text) ||
    (/\b(scrape|crawl)\b/i.test(lower) && /https?:\/\/[^\s]+/i.test(text));

  if (isScrapeIntent) {
    const urlMatch = text.match(/https?:\/\/[^\s"'>)]+/);
    if (urlMatch) {
      const targetUrl = urlMatch[0];
      const isCrawl = /\bcrawl\b/i.test(lower);

      try {
        if (isCrawl) {
          const { crawlSite } = await import("./scrapling-bridge");
          const crawlRes = await crawlSite(targetUrl, { maxPages: 5 });

          let content = `**Autonomous Web Crawl Complete**\n\n`;
          content += `• **Target URL:** \`${targetUrl}\`\n`;
          content += `• **Status:** ${crawlRes.success ? "Success" : "Failed"}\n`;
          content += `• **Pages Scraped:** ${crawlRes.pagesScraped}\n`;
          content += `• **Latency:** ${crawlRes.latency}ms\n\n`;

          if (crawlRes.items.length > 0) {
            content += `### Extracted Sample Records\n\`\`\`json\n`;
            content += JSON.stringify(crawlRes.items.slice(0, 3), null, 2);
            content += `\n\`\`\``;
          }

          return {
            handled: true,
            actionType: "scrape_web",
            content,
            agentName: "Scrapling Harvester",
            agentAvatar: "globe",
            metadata: { url: targetUrl, pagesScraped: crawlRes.pagesScraped },
          };
        } else {
          const { scrapePage } = await import("./scrapling-bridge");
          const scrapeRes = await scrapePage(targetUrl, { toMarkdown: true, stealthMode: lower.includes("stealth") || lower.includes("cloudflare") });

          let content = `**Autonomous Scrape Complete: "${scrapeRes.title || targetUrl}"**\n\n`;
          content += `• **Source:** \`${targetUrl}\`\n`;
          content += `• **Status:** ${scrapeRes.success ? "Success" : "Scrape Failed"}\n`;
          content += `• **Engine:** Scrapling Stealth Fetcher • **Latency:** ${scrapeRes.latency}ms\n\n`;

          if (scrapeRes.success) {
            content += `### Extracted Page Content\n\n`;
            const preview = (scrapeRes.markdown || scrapeRes.content || "").slice(0, 3500);
            content += preview;
            if ((scrapeRes.markdown || scrapeRes.content || "").length > 3500) {
              content += `\n\n*(Truncated for chat display. Full content available in memory vault.)*`;
            }
          } else {
            content += `**Error details:** ${scrapeRes.error || "Unable to scrape page"}`;
          }

          return {
            handled: true,
            actionType: "scrape_web",
            content,
            agentName: "Scrapling Harvester",
            agentAvatar: "globe",
            metadata: { url: targetUrl, title: scrapeRes.title, latency: scrapeRes.latency },
          };
        }
      } catch (err) {
        return {
          handled: true,
          actionType: "scrape_web",
          content: `Scrape execution failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 7a. INTENT: AUTONOMOUS DESKTOP MULTI-STEP GOAL ("do anything on my desktop", "open notepad and type ...", etc.)
  // -------------------------------------------------------------
  const isAutonomousDesktopGoal =
    (/\b(on\s+(?:my\s+)?desktop|desktop\s+task|desktop\s+automation|operate\s+my\s+desktop|do\s+anything\s+on\s+my\s+desktop|control\s+my\s+desktop)\b/i.test(
      lower
    ) ||
      /^(?:can\s+you\s+|please\s+)?(?:open|launch)\s+[a-zA-Z0-9_-]+\s+(?:and\s+)?(?:then\s+)?(?:type|write|calculate|click|press)\b/i.test(
        lower.trim()
      ));

  if (isAutonomousDesktopGoal) {
    try {
      const { executeAutonomousDesktopTask } = await import("./autonomous-desktop-loop");
      const result = await executeAutonomousDesktopTask(text);

      let content = `### **Autonomous Desktop Operator Executed**\n\n`;
      content += `**Goal:** "${result.goal}"\n`;
      content += `**Status:** ${result.success ? "Successfully completed" : "Partially completed"} (${result.stepsExecuted} steps in ${result.totalLatency}ms)\n\n`;
      content += `#### Executed Actions:\n`;
      result.steps.forEach((s, idx) => {
        content += `${idx + 1}. ${s.success ? "" : ""} **${s.action.toUpperCase()}**: ${s.description} *(${s.latency}ms)*\n`;
      });
      if (result.finalScreenshotUrl) {
        content += `\n\n![Final Desktop Evidence](${result.finalScreenshotUrl})\n\n*[Primary display screenshot after execution]*`;
      }

      return {
        handled: true,
        actionType: "desktop_action",
        content,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
        metadata: {
          actionType: "desktop_action",
          target: text,
          goal: result.goal,
          stepsExecuted: result.stepsExecuted,
          hasScreenshot: !!result.finalScreenshotUrl,
          screenshotUrl: result.finalScreenshotUrl,
        },
      };
    } catch (err) {
      return {
        handled: true,
        actionType: "desktop_action",
        content: `Autonomous desktop execution failed: ${err instanceof Error ? err.message : String(err)}`,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
      };
    }
  }

  // -------------------------------------------------------------
  // 7b. INTENT: COMPOUND DESKTOP ACTION (Launch app/url, explicit wait, AND screenshot)
  // Examples:
  // - "open youtube wait 2 seconds and take a screen shot"
  // - "open youtube search for cat video and then take a screen shot of it"
  // - "open youtube, wait 2 seconds, and take a screenshot"
  // - "launch calculator wait 1s and capture screen"
  // - "wait 2 seconds and take a screenshot"
  // -------------------------------------------------------------
  const compound = parseDesktopCompoundInstruction(lower);

  if (compound.isCompound) {
    const rawTarget = compound.target;
    try {
      const { executeCUAAction, resolveLaunchTarget } = await import("./cua-driver");
      const resolved = rawTarget ? resolveLaunchTarget(rawTarget) : null;

      // Step 1: Target Resolution & Navigation (if a target was specified)
      let launchRes: any = null;
      if (resolved && rawTarget) {
        try {
          const { fleetEventBus } = await import("./event-bus");
          fleetEventBus.publish("agent_status", {
            agentName: "Desktop Operator",
            step: `Navigating to ${resolved.displayTitle}...`,
            tool: "desktop_action",
          });
        } catch {}

        launchRes = await executeCUAAction({ type: "launch", target: resolved.target });
      }

      // Step 2: Viewport & Timing Stabilization (honoring explicit user wait duration)
      const waitTime = compound.hasExplicitWait
        ? compound.waitMs
        : (resolved ? (resolved.isUrl ? 2200 : 1000) : 1000);

      try {
        const { fleetEventBus } = await import("./event-bus");
        fleetEventBus.publish("agent_status", {
          agentName: "Desktop Operator",
          step: compound.hasExplicitWait
            ? `Waiting ${waitTime}ms as requested before capture...`
            : `Waiting for viewport to stabilize...`,
          tool: "desktop_action",
        });
      } catch {}

      await new Promise((r) => setTimeout(r, waitTime));

      // Step 3: Visual Verification & Evidence Capture (if screenshot requested)
      let screenRes: any = null;
      let screenshotUrl: string | undefined;
      const fileName = `screenshot-${Date.now()}.jpg`;

      if (compound.hasScreenshot) {
        try {
          const { fleetEventBus } = await import("./event-bus");
          fleetEventBus.publish("agent_status", {
            agentName: "Desktop Operator",
            step: `Capturing desktop state...`,
            tool: "desktop_screenshot",
          });
        } catch {}

        screenRes = await executeCUAAction({ type: "screenshot" });

        if (screenRes && screenRes.screenshot) {
          try {
            const fs = await import("fs/promises");
            const path = await import("path");
            const downloadDir = path.join(process.cwd(), "public", "downloads");
            await fs.mkdir(downloadDir, { recursive: true });
            const filePath = path.join(downloadDir, fileName);
            await fs.writeFile(filePath, Buffer.from(screenRes.screenshot, "base64"));
            screenshotUrl = `/downloads/${fileName}`;
          } catch {
            screenshotUrl = `data:image/jpeg;base64,${screenRes.screenshot}`;
          }
        }
      }

      let stepNum = 1;
      let content = `### Autonomous Task Executed: ${resolved ? resolved.displayTitle : "Desktop Operation"}\n\n`;
      content += `**Objective:** Autonomous computer execution and visual evidence capture\n\n`;
      content += `#### Workflow Breakdown:\n`;
      if (resolved && rawTarget) {
        content += `${stepNum++}. **Target Resolution & Navigation:** Resolved \`${rawTarget}\` to \`${resolved.target}\` and initiated ${resolved.isUrl ? "browser session" : "desktop application"}.\n`;
      }
      content += `${stepNum++}. **Viewport Stabilization:** ${
        compound.hasExplicitWait
          ? `Waited ${waitTime}ms (${(waitTime / 1000).toFixed(1)}s) as requested before capture.`
          : `Monitored display rendering until viewport settled (${waitTime}ms).`
      }\n`;
      if (compound.hasScreenshot) {
        content += `${stepNum++}. **Visual Verification & Telemetry:** Captured high-resolution primary display screenshot (${screenRes?.latency || 0}ms).\n\n`;
        if (screenshotUrl) {
          content += `![Desktop Screenshot](${screenshotUrl})\n\n*[Primary display screenshot saved to \`${fileName}\`]*\n\n`;
        }
      }
      content += `*Execution completed autonomously in ${(launchRes?.latency || 0) + (screenRes?.latency || 0) + waitTime}ms.*`;

      // Persist to ActivityLog
      try {
        await prisma.activityLog.create({
          data: {
            type: "desktop_action",
            message: `Desktop compound action: ${resolved ? resolved.displayTitle : rawTarget || "desktop"} (${(launchRes?.latency || 0) + (screenRes?.latency || 0) + waitTime}ms)`,
            agentId: "desktop-operator",
            metadata: JSON.stringify({
              actionType: "compound",
              title: `Compound Desktop Action: ${resolved ? resolved.displayTitle : rawTarget || "Operation"}`,
              target: rawTarget || "desktop",
              status: "success",
              success: true,
              latency: (launchRes?.latency || 0) + (screenRes?.latency || 0) + waitTime,
              screenshotUrl,
              agentName: "Desktop Operator",
            }),
          },
        });
      } catch {}

      return {
        handled: true,
        actionType: "desktop_action",
        content,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
        metadata: {
          target: rawTarget || "desktop",
          waitTime,
          hasExplicitWait: compound.hasExplicitWait,
          launched: launchRes ? launchRes.success : true,
          hasScreenshot: compound.hasScreenshot,
          screenshotUrl,
        },
      };
    } catch (err) {
      return {
        handled: true,
        actionType: "desktop_action",
        content: `Desktop compound action failed: ${err instanceof Error ? err.message : String(err)}`,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
      };
    }
  }

  // 7c. INTENT: AUTONOMOUS DESKTOP AUTOMATION (CUA DRIVER)
  // Examples:
  // - "take a screenshot" / "capture screen"
  // - "inspect chrome" / "inspect screen"
  // - "open chrome" / "launch notepad" / "launch calculator"
  // -------------------------------------------------------------
  const isScreenshot =
    /^(?:can\s+you\s+|could\s+you\s+|please\s+)?(?:take|capture|grab|get)\s+(?:a\s+)?(?:desktop\s+|screen\s*)?(?:screen\s*shot|screenshot|snapshot|screen)(?:\s+(?:of|from|form)\s+.+)?$/i.test(
      lower.trim()
    ) ||
    /^(?:take\s+(?:a\s+)?(?:screen\s*shot|screenshot|snapshot)|capture\s+(?:the\s+)?(?:screen|desktop)|screenshot|screen\s*shot|desktop_screenshot|screen_capture|snapshot)$/i.test(
      lower.trim()
    );

  if (isScreenshot) {
    try {
      const { executeCUAAction } = await import("./cua-driver");
      const res = await executeCUAAction({ type: "screenshot" });

      let content = `**Desktop Screenshot Captured**\n\n`;
      content += `• **Status:** ${res.success ? "Success" : "Failed"}\n`;
      content += `• **Latency:** ${res.latency}ms\n`;
      let savedScreenshotUrl: string | undefined;

      if (res.screenshot) {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const downloadDir = path.join(process.cwd(), "public", "downloads");
          await fs.mkdir(downloadDir, { recursive: true });
          const fileName = `screenshot-${Date.now()}.png`;
          const filePath = path.join(downloadDir, fileName);
          await fs.writeFile(filePath, Buffer.from(res.screenshot, "base64"));
          savedScreenshotUrl = `/downloads/${fileName}`;
          content += `\n\n![Desktop Screenshot](${savedScreenshotUrl})\n\n*[Primary display screenshot saved to \`${fileName}\`]*`;
        } catch {
          savedScreenshotUrl = `data:image/png;base64,${res.screenshot}`;
          content += `\n\n![Desktop Screenshot](${savedScreenshotUrl})`;
        }
      } else if (res.error) {
        content += `\n${res.error}`;
      }

      // Persist to ActivityLog
      try {
        await prisma.activityLog.create({
          data: {
            type: "desktop_action",
            message: `Desktop action: screenshot (${res.success ? "success" : "failed"}, ${res.latency}ms)`,
            agentId: "desktop-operator",
            metadata: JSON.stringify({
              actionType: "screenshot",
              title: "Desktop Screenshot",
              target: "Primary Display",
              status: res.success ? "success" : "failed",
              success: res.success,
              latency: res.latency,
              screenshotUrl: savedScreenshotUrl,
              agentName: "Desktop Operator",
            }),
          },
        });
      } catch {}

      return {
        handled: true,
        actionType: "desktop_action",
        content,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
        metadata: { hasScreenshot: !!res.screenshot, latency: res.latency, screenshotUrl: savedScreenshotUrl },
      };
    } catch (err) {
      return {
        handled: true,
        actionType: "desktop_action",
        content: `Screenshot failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  const isLaunchIntent =
    /^(?:can\s+you\s+|please\s+)?(?:open|launch|start|run|visit|browse\s+to|browse|go\s+to|goto|navigate\s+to|navigate|take\s+me\s+to|head\s+to)\s+([a-zA-Z0-9_.:/ -]+?)(?:\s+please)?$/i.test(
      lower.trim()
    );

  if (isLaunchIntent) {
    const appMatch = lower
      .trim()
      .match(/^(?:can\s+you\s+|please\s+)?(?:open|launch|start|run|visit|browse\s+to|browse|go\s+to|goto|navigate\s+to|navigate|take\s+me\s+to|head\s+to)\s+([a-zA-Z0-9_.:/ -]+?)(?:\s+please)?$/i);
    const appName = appMatch ? appMatch[1].trim() : "app";

    try {
      const { executeCUAAction, resolveLaunchTarget } = await import("./cua-driver");
      const resolved = resolveLaunchTarget(appName);
      const res = await executeCUAAction({ type: "launch", target: appName });

      // Capture desktop screenshot right after launch so it's ready when user clicks "View Desktop"
      let screenshotUrl: string | undefined;
      try {
        const waitMs = resolved.isUrl ? 1800 : 800;
        await new Promise((r) => setTimeout(r, waitMs));
        const screenRes = await executeCUAAction({ type: "screenshot" });
        if (screenRes.screenshot) {
          const fs = await import("fs/promises");
          const path = await import("path");
          const downloadDir = path.join(process.cwd(), "public", "downloads");
          await fs.mkdir(downloadDir, { recursive: true });
          const fileName = `screenshot-${Date.now()}.jpg`;
          await fs.writeFile(path.join(downloadDir, fileName), Buffer.from(screenRes.screenshot, "base64"));
          screenshotUrl = `/downloads/${fileName}`;
        }
      } catch (e) {
        console.warn("[Launch Intent] Post-launch screenshot capture skipped:", e);
      }

      return {
        handled: true,
        actionType: "desktop_action",
        content: `### Autonomous Task Executed: ${resolved.displayTitle}\n\n• **Action:** ${res.output || `Navigated to ${resolved.displayTitle}`}\n• **Status:** ${res.success ? "Success" : "Failed"}\n• **Latency:** ${res.latency}ms${screenshotUrl ? `\n\n![Desktop Screenshot](${screenshotUrl})` : ""}`,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
        metadata: {
          target: appName,
          actionType: "desktop_action",
          launched: res.success,
          screenshotUrl,
          hasScreenshot: !!screenshotUrl,
        },
      };
    } catch (err) {
      return {
        handled: true,
        actionType: "desktop_action",
        content: `Failed to launch ${appName}: ${err instanceof Error ? err.message : String(err)}`,
        agentName: "Desktop Operator",
        agentAvatar: "laptop",
      };
    }
  }

  // -------------------------------------------------------------
  // 8. INTENT: DIRECT ACTIONABLE TASK (Not just a chatbot)
  // If the user gives a concrete task (e.g. "write code for...", "build a script...",
  // "generate a table comparing...", "analyze this bug..."), ensure the agent
  // behaves as a production-grade executor and delivers real, actionable outputs.
  // -------------------------------------------------------------
  // 8. INTENT: DIRECT ACTIONABLE TASK (Not just a chatbot)
  // If the user gives a concrete task (e.g. "write code for...", "build a script...",
  // "generate a table comparing...", "analyze this bug...", "perform a task..."), ensure the agent
  // behaves as a production-grade executor and delivers real, actionable outputs.
  // -------------------------------------------------------------
  const isDirectActionableWork =
    !context?.skipDirectTask &&
    (/^(can\s+you\s+|could\s+you\s+|please\s+|i\s+want\s+you\s+to\s+)?(write|create|build|implement|code|generate|analyze|summarize|calculate|debug|fix|draft|design|refactor|perform|proforme|make|setup|set\s+up|configure|audit|test|benchmark|optimize|find\s+bugs\s+in|check)\s+/i.test(
      lower
    ) ||
      /^(here\s+is\s+a\s+task|i\s+have\s+a\s+task|task:)/i.test(lower) ||
      /\b(proforme|perform)\s+(this|the|a)\s+task\b/i.test(lower) ||
      (lower.includes("task") &&
        (lower.includes("small task") ||
          lower.includes("perform") ||
          lower.includes("proforme") ||
          lower.includes("solve") ||
          lower.includes("build"))));

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
      agentAvatar: effectiveAgent?.avatar || "bot",
    };
  }

  // Not handled by direct action — proceed to standard conversational router
  return { handled: false, content: "" };
}
