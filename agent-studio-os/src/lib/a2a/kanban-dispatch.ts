import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { a2aBroker } from "./protocol";
import type {
  A2AKanbanDispatchResult,
  A2ADispatchedTaskItem,
  A2AMessage,
} from "@/types/a2a";

interface DispatchConsensusOptions {
  topic: string;
  verdict: {
    summary: string;
    consensusPoints?: string[];
    winningStance?: string;
    recommendedAction?: string;
  };
  participatingAgentIds?: string[];
  targetStatus?: "backlog" | "todo" | "in_progress";
  executeNow?: boolean;
}

/**
 * Pillar 3: Roundtable Consensus to Autonomous Kanban Dispatch
 * Decomposes arbitrated debate consensus into actionable Kanban tasks
 * and auto-assigns tickets to the optimal specialists with A2A delegation contracts.
 */
export async function dispatchConsensusToKanban(
  options: DispatchConsensusOptions
): Promise<A2AKanbanDispatchResult> {
  const {
    topic,
    verdict,
    participatingAgentIds = [],
    targetStatus = "todo",
    executeNow = false,
  } = options;

  // 1. Fetch eligible agents
  let eligibleAgents = await prisma.agent.findMany({
    where: participatingAgentIds.length > 0 ? { id: { in: participatingAgentIds } } : undefined,
  });

  if (eligibleAgents.length === 0) {
    eligibleAgents = await prisma.agent.findMany({ take: 5 });
  }

  // 2. Synthesize actionable Kanban tasks via LLM decomposition
  const agentProfilesSummary = eligibleAgents
    .map((a) => `- ${a.displayName} (${a.role} | Dept: ${a.department}): ${a.description || a.role}`)
    .join("\n");

  const consensusText = (verdict.consensusPoints || []).join("\n- ");

  const prompt = `You are an Autonomous Operations Lead converting an executive debate consensus into production Kanban tasks.

DEBATE TOPIC: "${topic}"
EXECUTIVE SUMMARY: ${verdict.summary}
WINNING STANCE: ${verdict.winningStance || "Pragmatic Hybrid"}
RECOMMENDED ACTION: ${verdict.recommendedAction || "Execute phased rollout"}
KEY CONSENSUS POINTS:
- ${consensusText}

AVAILABLE SPECIALIST AGENTS:
${agentProfilesSummary}

INSTRUCTIONS:
Generate 3 to 4 concrete, actionable Kanban tasks required to implement this consensus.
For each task:
1. "title": Concise, imperative title (e.g. "Implement JWT Token Revocation Service")
2. "description": Clear requirements, architecture constraints, and expected deliverables
3. "priority": "urgent" | "high" | "medium"
4. "assignedAgentName": The EXACT displayName of the best suited agent from the list above

Respond ONLY with a valid JSON array of objects with structure:
[
  {
    "title": "Task title",
    "description": "Task specifications...",
    "priority": "high",
    "assignedAgentName": "Agent Name"
  }
]`;

  let parsedTasks: Array<{
    title: string;
    description: string;
    priority: "urgent" | "high" | "medium";
    assignedAgentName: string;
  }> = [];

  try {
    const aiResponse = await executeChatCompletion({
      prompt,
      model: "auto/fast",
      systemPrompt: "You are an elite Agile Technical Program Manager decomposing decisions into crisp tasks. Output only valid JSON.",
    });

    const cleaned = aiResponse.content.replace(/```json/g, "").replace(/```/g, "").trim();
    parsedTasks = JSON.parse(cleaned);
  } catch (err) {
    console.warn("[A2A Kanban Dispatch] AI decomposition failed, using fallback templates:", err);
    parsedTasks = [
      {
        title: `Architecture Setup: ${topic.slice(0, 40)}`,
        description: `Implement the foundational architecture agreed in consensus: ${verdict.recommendedAction || verdict.summary}`,
        priority: "high",
        assignedAgentName: eligibleAgents[0]?.displayName || "Lead Architect",
      },
      {
        title: `Security & Edge Case Verification`,
        description: `Verify resilience, test edge cases, and ensure fail-safes based on debate findings.`,
        priority: "medium",
        assignedAgentName: eligibleAgents[1]?.displayName || eligibleAgents[0]?.displayName || "Security Specialist",
      },
    ];
  }

  // 3. Persist tasks to Prisma SQLite database & register A2A contracts
  const createdTasks: A2ADispatchedTaskItem[] = [];
  const contracts: A2AMessage[] = [];

  for (let idx = 0; idx < parsedTasks.length; idx++) {
    const t = parsedTasks[idx];

    // Find closest matching agent
    const matchedAgent =
      eligibleAgents.find(
        (a) =>
          a.displayName.toLowerCase() === t.assignedAgentName.toLowerCase() ||
          a.name.toLowerCase() === t.assignedAgentName.toLowerCase() ||
          t.assignedAgentName.toLowerCase().includes(a.displayName.toLowerCase())
      ) || eligibleAgents[idx % eligibleAgents.length];

    // Create Task record
    const newTask = await prisma.task.create({
      data: {
        title: t.title,
        description: t.description,
        priority: t.priority || "medium",
        status: targetStatus,
        agentId: matchedAgent?.id || null,
        position: idx,
      },
    });

    // Register A2A Delegation Contract
    const contract = await a2aBroker.delegateTask(
      {
        taskId: newTask.id,
        title: t.title,
        delegator: "Roundtable Consensus Arbiter",
        delegatee: matchedAgent?.displayName || "Autonomous Agent",
        objective: t.description,
        inputData: { topic, verdictSummary: verdict.summary },
        priority: t.priority || "medium",
      },
      { id: "consensus-arbiter", name: "Consensus Arbiter" },
      { id: matchedAgent?.id || "unassigned", name: matchedAgent?.displayName || "Agent" }
    );

    contracts.push(contract);

    createdTasks.push({
      id: newTask.id,
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      status: newTask.status,
      assignedAgentId: matchedAgent?.id || "",
      assignedAgentName: matchedAgent?.displayName || "Unassigned",
      contractId: contract.id,
    });
  }

  // Log dispatch in OS activity log
  await prisma.activityLog.create({
    data: {
      type: "a2a_dispatch",
      message: `[A2A Dispatch] Deployed ${createdTasks.length} tasks to Kanban board from debate: "${topic.slice(0, 45)}..."`,
      agentId: eligibleAgents[0]?.id || null,
    },
  });

  return {
    success: true,
    topic,
    winningStance: verdict.winningStance,
    createdTasks,
    contracts,
  };
}
