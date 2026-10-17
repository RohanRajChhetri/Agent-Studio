import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { a2aBroker } from "./protocol";
import { createProjectFile, createProjectFolder } from "@/lib/project-filesystem";
import { saveDocumentFile } from "@/lib/document-generator";
import type {
  A2AHierarchyExecutionResult,
  A2AHierarchyNodeExecution,
  ConferenceFileDeliverable,
} from "@/types/a2a";

interface SubordinateAgent {
  id: string;
  name: string;
  displayName: string;
  role: string;
  department: string;
  avatar: string;
  systemPrompt: string;
  model: string | null;
  subordinates?: SubordinateAgent[];
}

/**
 * Pillar 1: Hierarchical Chain-of-Command Engine
 * Orchestrators decompose goals -> Delegate to subordinate Managers ->
 * Managers delegate to Specialists -> Results bubble up to Orchestrator.
 */
export async function executeHierarchicalMission({
  orchestratorId,
  missionTopic,
  missionDetails = "",
}: {
  orchestratorId: string;
  missionTopic: string;
  missionDetails?: string;
}): Promise<A2AHierarchyExecutionResult> {
  const startTime = Date.now();
  const missionId = "h-mission-" + Math.random().toString(36).slice(2, 9);

  // 1. Fetch Orchestrator and its full hierarchy tree
  const orchestrator = await prisma.agent.findUnique({
    where: { id: orchestratorId },
    include: {
      subordinates: {
        include: {
          subordinates: true,
        },
      },
    },
  });

  if (!orchestrator) {
    throw new Error(`Orchestrator agent with ID "${orchestratorId}" not found`);
  }

  // Fallback: If agent has no subordinates assigned in DB, look for subordinates in the same department or general specialists
  let directSubordinates: SubordinateAgent[] = orchestrator.subordinates as SubordinateAgent[];
  if (!directSubordinates || directSubordinates.length === 0) {
    const fallbackAgents = await prisma.agent.findMany({
      where: {
        id: { not: orchestrator.id },
      },
      take: 3,
    });
    directSubordinates = fallbackAgents as unknown as SubordinateAgent[];
  }

  // 2. Orchestrator decomposes mission into work packages for subordinates
  const subListText = directSubordinates
    .map(
      (sub, i) =>
        `${i + 1}. ${sub.displayName} (${sub.role} | Department: ${sub.department || "General"})`
    )
    .join("\n");

  const decompositionPrompt = `You are ${orchestrator.displayName} (${orchestrator.role}), the supreme orchestrator for this mission.
MISSION GOAL:
"${missionTopic}"
${missionDetails ? `ADDITIONAL CONTEXT:\n${missionDetails}\n` : ""}

YOUR DIRECT SUBORDINATES:
${subListText}

INSTRUCTIONS:
Decompose this overarching mission into discrete, highly specialized work packages tailored to each of your subordinates.
For each subordinate, provide:
1. Title of the work package
2. Concrete objective and actionable instructions
3. Expected deliverable schema

Respond ONLY with a valid JSON array of objects with the structure:
[
  {
    "agentName": "Name of subordinate",
    "taskTitle": "Concise task title",
    "directive": "Specific instructions and technical requirements for this agent"
  }
]`;

  let subtaskDirectives: Array<{
    agentName: string;
    taskTitle: string;
    directive: string;
  }> = [];

  try {
    const decompRes = await executeChatCompletion({
      prompt: decompositionPrompt,
      model: orchestrator.model || "auto/fast",
      systemPrompt:
        orchestrator.systemPrompt ||
        "You are an elite AI Orchestrator that breaks down large missions into high-impact subtasks for specialists.",
      agentName: orchestrator.name,
    });

    const cleaned = decompRes.content.replace(/```json/g, "").replace(/```/g, "").trim();
    subtaskDirectives = JSON.parse(cleaned);
  } catch {
    // Fallback decomposition if JSON parsing failed
    subtaskDirectives = directSubordinates.map((sub) => ({
      agentName: sub.displayName,
      taskTitle: `Execute core analysis: ${missionTopic.slice(0, 30)}`,
      directive: `Analyze the technical, operational, and architecture aspects of ${missionTopic} from your perspective as ${sub.role}.`,
    }));
  }

  // 3. Execute subtasks across direct subordinates
  const subordinateExecutions: A2AHierarchyNodeExecution[] = [];
  const subordinateResultsContext: string[] = [];
  let totalTasksExecuted = 0;

  for (const subordinate of directSubordinates) {
    const subStart = Date.now();
    const directiveObj =
      subtaskDirectives.find(
        (d) =>
          d.agentName.toLowerCase().includes(subordinate.displayName.toLowerCase()) ||
          subordinate.displayName.toLowerCase().includes(d.agentName.toLowerCase())
      ) || {
        taskTitle: `Operational Domain Execution: ${subordinate.role}`,
        directive: `Execute specialized operations on ${missionTopic} relevant to ${subordinate.department}.`,
      };

    // Issue A2A Delegation Contract
    const contract = await a2aBroker.delegateTask(
      {
        taskId: `a2a-task-${subordinate.id}-${Date.now()}`,
        title: directiveObj.taskTitle,
        delegator: orchestrator.displayName,
        delegatee: subordinate.displayName,
        objective: directiveObj.directive,
        inputData: { missionTopic, missionDetails },
        priority: "high",
      },
      { id: orchestrator.id, name: orchestrator.displayName },
      { id: subordinate.id, name: subordinate.displayName }
    );

    totalTasksExecuted++;

    // Check if this subordinate is a Manager with their own workers/specialists
    const secondarySubordinates = subordinate.subordinates || [];
    const secondaryExecutions: A2AHierarchyNodeExecution[] = [];
    let managerSubordinateNotes = "";

    if (secondarySubordinates.length > 0) {
      // Sub-tier delegation (Tier 3 Specialist execution)
      for (const worker of secondarySubordinates) {
        const workerStart = Date.now();
        const workerContract = await a2aBroker.delegateTask(
          {
            taskId: `a2a-worker-${worker.id}-${Date.now()}`,
            title: `Tactical Implementation: ${directiveObj.taskTitle}`,
            delegator: subordinate.displayName,
            delegatee: worker.displayName,
            objective: `Provide detailed technical code, configurations, or empirical data for: ${directiveObj.directive}`,
            inputData: { topic: directiveObj.taskTitle },
            priority: "medium",
          },
          { id: subordinate.id, name: subordinate.displayName },
          { id: worker.id, name: worker.displayName }
        );

        totalTasksExecuted++;

        const workerPrompt = `You are ${worker.displayName} (${worker.role} in ${worker.department || "General"}).
YOUR MANAGER: ${subordinate.displayName}
DIRECTIVE:
${directiveObj.directive}

Produce an exact, high-quality, practical deliverable with code, steps, or concrete data.`;

        const workerRes = await executeChatCompletion({
          prompt: workerPrompt,
          model: worker.model || "auto/fast",
          systemPrompt: worker.systemPrompt || "You are a tactical AI Worker delivering concrete outputs.",
          agentName: worker.name,
        });

        const workerLatency = Date.now() - workerStart;
        a2aBroker.completeTask(workerContract.id, workerRes.content, "completed", workerLatency);

        secondaryExecutions.push({
          agentId: worker.id,
          agentName: worker.displayName,
          agentRole: worker.role,
          avatar: worker.avatar || "🤖",
          taskTitle: `Tactical Sub-Task: ${worker.displayName}`,
          directive: directiveObj.directive,
          status: "completed",
          output: workerRes.content,
          latencyMs: workerLatency,
        });

        managerSubordinateNotes += `\n[Report from ${worker.displayName}]:\n${workerRes.content.slice(0, 400)}...\n`;
      }
    }

    // Manager / Specialist executes and summarizes
    const subPrompt = `You are ${subordinate.displayName} (${subordinate.role} | Department: ${subordinate.department || "General"}).
YOUR ASSIGNED A2A MISSION:
- Title: ${directiveObj.taskTitle}
- Objective: ${directiveObj.directive}
${managerSubordinateNotes ? `\nSUBORDINATE WORKER INPUTS:\n${managerSubordinateNotes}\n` : ""}

Provide a rigorous, actionable technical report. Outline your analysis, concrete solutions, architecture or data structures, and any caveats.`;

    const subRes = await executeChatCompletion({
      prompt: subPrompt,
      model: subordinate.model || "auto/fast",
      systemPrompt:
        subordinate.systemPrompt ||
        "You are an elite domain specialist delivering structured technical deliverables.",
      agentName: subordinate.name,
    });

    const subLatency = Date.now() - subStart;
    a2aBroker.completeTask(contract.id, subRes.content, "completed", subLatency);

    subordinateExecutions.push({
      agentId: subordinate.id,
      agentName: subordinate.displayName,
      agentRole: subordinate.role,
      avatar: subordinate.avatar || "🤖",
      taskTitle: directiveObj.taskTitle,
      directive: directiveObj.directive,
      status: "completed",
      output: subRes.content,
      latencyMs: subLatency,
      subordinates: secondaryExecutions.length > 0 ? secondaryExecutions : undefined,
    });

    subordinateResultsContext.push(
      `### Work Package from ${subordinate.displayName} (${subordinate.role}):\n${subRes.content}\n`
    );
  }

  // 4. Orchestrator synthesizes the final Master Executive Deliverable
  const synthesisPrompt = `You are ${orchestrator.displayName} (${orchestrator.role}), reviewing all deliverables from your subordinate chain of command.

OVERARCHING MISSION:
"${missionTopic}"

SUBORDINATE REPORTS RECEIVED:
${subordinateResultsContext.join("\n\n")}

SYNTHESIS INSTRUCTIONS:
Synthesize all subordinate work into a unified, publication-grade Master Executive Deliverable.
1. Executive Summary & Architecture Overview
2. Consolidated Technical Plan & Combined Implementation
3. Risk Mitigation & Verification Checklist
4. Next Steps & Milestone Roadmap`;

  const synthesisRes = await executeChatCompletion({
    prompt: synthesisPrompt,
    model: orchestrator.model || "auto/fast",
    systemPrompt:
      orchestrator.systemPrompt ||
      "You are the master orchestrator synthesizing reports into a definitive, unified deliverable.",
    agentName: orchestrator.name,
  });

  const totalDuration = Date.now() - startTime;

  // Root node representation
  const rootNode: A2AHierarchyNodeExecution = {
    agentId: orchestrator.id,
    agentName: orchestrator.displayName,
    agentRole: orchestrator.role,
    avatar: orchestrator.avatar || "👑",
    taskTitle: missionTopic,
    directive: missionDetails || "Supreme mission orchestration and synthesis",
    status: "completed",
    output: synthesisRes.content,
    latencyMs: totalDuration,
    subordinates: subordinateExecutions,
  };

  // 5. Dedicate a folder for conference deliverables and write the conference discussion minutes file
  const conferenceFolder = "agent-workspace/conference";
  await createProjectFolder(conferenceFolder);

  const cleanSlug =
    missionTopic
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .slice(0, 32)
      .replace(/^_|_$/g, "") || "mission";
  const timestampStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const minutesFileName = `conference_minutes_${cleanSlug}_${timestampStr}.md`;
  const minutesRelPath = `${conferenceFolder}/${minutesFileName}`;

  // Build structured discussion markdown
  const participantsSummary = directSubordinates
    .map((s) => `- **${s.displayName}** (${s.role} | Department: ${s.department || "General"})`)
    .join("\n");

  const subordinateSections = subordinateExecutions
    .map(
      (sub) => `### Work Package: ${sub.taskTitle}
- **Assigned Specialist**: ${sub.agentName} (${sub.agentRole})
- **Directive**: ${sub.directive}
- **Status**: ${sub.status} (Execution Time: ${Math.round((sub.latencyMs || 0) / 1000)}s)

#### Specialist Report:
${sub.output || "(No output recorded)"}
`
    )
    .join("\n\n");

  const conferenceMinutesContent = `# A2A Executive Conference Minutes & Master Deliverable

**Mission Topic**: ${missionTopic}
**Mission ID**: \`${missionId}\`
**Date / Timestamp**: ${new Date().toLocaleString()}
**Presiding Orchestrator**: ${orchestrator.displayName} (${orchestrator.role})
**Dedicated Artifacts Folder**: \`${conferenceFolder}/\`
**Subtasks Executed**: ${totalTasksExecuted} subtasks across ${directSubordinates.length} specialists
**Total Duration**: ${Math.round(totalDuration / 1000)} seconds

---

## 1. Conference Participants & Hierarchy
- **Executive Orchestrator**: ${orchestrator.displayName} (${orchestrator.role})
${participantsSummary}

---

## 2. Master Executive Deliverable & Architectural Decisions
${synthesisRes.content}

---

## 3. Detailed Specialist Reports & Tactical Artifacts
${subordinateSections}

---
*Recorded autonomously by Agent Studio OS A2A Protocol Engine*
`;

  const conferenceFileMeta: ConferenceFileDeliverable = {
    fileName: minutesFileName,
    filePath: minutesRelPath,
    fileUrl: `/downloads/${encodeURIComponent(minutesFileName)}`,
    size: 0,
  };

  try {
    const written = await createProjectFile(minutesRelPath, conferenceMinutesContent, { overwrite: true });
    conferenceFileMeta.size = written.size;
    // Also save to downloads for instant browser download
    const dlDoc = await saveDocumentFile(minutesFileName, conferenceMinutesContent);
    conferenceFileMeta.fileUrl = dlDoc.fileUrl;
  } catch (fileErr) {
    console.warn("[Hierarchy Executor] Failed to persist conference minutes file:", fileErr);
  }

  return {
    missionId,
    missionTopic,
    orchestratorId: orchestrator.id,
    orchestratorName: orchestrator.displayName,
    rootSummary: `Successfully orchestrated mission "${missionTopic}" across ${directSubordinates.length} direct reports and ${totalTasksExecuted} total subtasks.`,
    finalDeliverable: synthesisRes.content,
    executionTree: rootNode,
    totalSubtasks: totalTasksExecuted,
    totalLatencyMs: totalDuration,
    createdAt: new Date().toISOString(),
    dedicatedFolder: conferenceFolder,
    conferenceFile: conferenceFileMeta,
  };
}
