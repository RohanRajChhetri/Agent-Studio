import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executeChatCompletion, getActiveApiKeys } from "@/lib/llm-router";
import { getUserScopedWhere } from "@/lib/user-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, title, description, agents = [] } = body;

    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    // Ensure we have active agents list
    let agentList = Array.isArray(agents) && agents.length > 0 ? agents : [];
    if (agentList.length === 0) {
      try {
        agentList = await prisma.agent.findMany({
          where: await getUserScopedWhere(),
        });
      } catch (err) {
        console.error("Failed to query agents for decomposition:", err);
      }
    }

    // Helper: Find best matching agent for a role or directive
    const matchAgent = (kw: string) => {
      if (!agentList.length) return null;
      const lowerKw = kw.toLowerCase();
      
      const found = agentList.find((a: any) => {
        const text = `${a.name} ${a.displayName} ${a.role || ""} ${a.department || ""} ${a.description || ""}`.toLowerCase();
        return text.includes(lowerKw);
      });
      return found || agentList[0];
    };

    const athena = matchAgent("research") || matchAgent("athena") || agentList[0];
    const vulcan = matchAgent("devops") || matchAgent("vulcan") || matchAgent("developer") || matchAgent("code") || agentList[1] || agentList[0];
    const mercury = matchAgent("copywriter") || matchAgent("mercury") || matchAgent("writer") || matchAgent("content") || agentList[2] || agentList[0];
    const leadOrchestrator = matchAgent("orchestrator") || matchAgent("lead") || matchAgent("manager") || agentList[0];

    let generatedSubtasks: any[] = [];

    // Attempt dynamic LLM decomposition if an active API key or provider is available
    try {
      const activeKeys = await getActiveApiKeys();
      const hasAnyKey = Object.values(activeKeys).some((k) => k && k.trim().length > 0);

      if (hasAnyKey) {
        const agentRosterSummary = agentList
          .map((a: any) => `- ${a.displayName || a.name} (Role: ${a.role || "specialist"}, Dept: ${a.department || "general"})`)
          .join("\n");

        const prompt = `Deconstruct the following task into 3 to 5 clear, sequential milestones/subtasks for autonomous execution by specialized AI agents:

Task Title: "${title}"
Task Details: "${description || "None specified"}"

Available Agents:
${agentRosterSummary || "General AI Specialists"}

Return ONLY a valid JSON array of objects with no markdown code fence or wrapping text:
[
  {
    "title": "Clear action milestone title",
    "description": "Specific execution directive",
    "priority": "high" | "medium" | "low",
    "targetRole": "developer" | "researcher" | "writer" | "orchestrator"
  }
]`;

        const llmRes = await executeChatCompletion({
          prompt,
          systemPrompt: "You are an autonomous AI project manager. Break down tasks into concrete, actionable specialist milestones. Return strictly valid JSON array.",
          model: "auto/fast",
          useVaultRAG: false,
          useEpisodicMemory: false,
        });

        if (llmRes.content) {
          let cleanContent = llmRes.content.trim();
          if (cleanContent.startsWith("```")) {
            cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
          }
          const parsed = JSON.parse(cleanContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedSubtasks = parsed.map((item: any, idx: number) => {
              const assigned = matchAgent(item.targetRole || item.title) || leadOrchestrator;
              return {
                id: `sub-${Date.now()}-${idx + 1}`,
                title: String(item.title || `Milestone ${idx + 1}`),
                description: String(item.description || ""),
                agentId: assigned?.id || null,
                agentName: assigned?.displayName || assigned?.name || "Specialist Agent",
                agentAvatar: assigned?.avatar || "bot",
                priority: ["urgent", "high", "medium", "low"].includes(item.priority) ? item.priority : "medium",
                completed: false,
              };
            });
          }
        }
      }
    } catch (llmErr) {
      console.warn("[Decompose] LLM decomposition fallback to heuristic:", llmErr);
    }

    // Fallback: Domain-aware heuristic breakdown if LLM did not produce valid subtasks
    if (generatedSubtasks.length === 0) {
      const tLower = `${title} ${description || ""}`.toLowerCase();

      if (tLower.includes("code") || tLower.includes("api") || tLower.includes("auth") || tLower.includes("bug") || tLower.includes("implement") || tLower.includes("build") || tLower.includes("fix")) {
        generatedSubtasks = [
          {
            id: `sub-${Date.now()}-1`,
            title: "Architecture & Interface Specification",
            description: "Define schemas, API contracts, error boundaries, and state requirements.",
            agentId: leadOrchestrator?.id || null,
            agentName: leadOrchestrator?.displayName || "Lead Orchestrator",
            agentAvatar: leadOrchestrator?.avatar || "crown",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-2`,
            title: "Core Logic Implementation & Integration",
            description: "Develop the primary logic, state flow, and database models.",
            agentId: vulcan?.id || null,
            agentName: vulcan?.displayName || "Vulcan (DevOps)",
            agentAvatar: vulcan?.avatar || "settings",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-3`,
            title: "Automated Verification & Unit Tests",
            description: "Execute regression tests, verify type safety, and lint contracts.",
            agentId: vulcan?.id || null,
            agentName: vulcan?.displayName || "Vulcan (DevOps)",
            agentAvatar: vulcan?.avatar || "settings",
            priority: "medium",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-4`,
            title: "Documentation & Release Notes",
            description: "Document endpoint usage, update schemas, and log changes to vault.",
            agentId: mercury?.id || null,
            agentName: mercury?.displayName || "Mercury (Copywriter)",
            agentAvatar: mercury?.avatar || "pen",
            priority: "low",
            completed: false,
          },
        ];
      } else if (tLower.includes("research") || tLower.includes("market") || tLower.includes("competitor") || tLower.includes("audit") || tLower.includes("analyze") || tLower.includes("investigate")) {
        generatedSubtasks = [
          {
            id: `sub-${Date.now()}-1`,
            title: "Source Gathering & Market Landscape Exploration",
            description: "Gather competitor specs, documentation, benchmarks, and external data sources.",
            agentId: athena?.id || null,
            agentName: athena?.displayName || "Athena (Research)",
            agentAvatar: athena?.avatar || "microscope",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-2`,
            title: "Comparative Feature Matrix Synthesis",
            description: "Construct structural breakdown of pricing, latency, capabilities, and gaps.",
            agentId: athena?.id || null,
            agentName: athena?.displayName || "Athena (Research)",
            agentAvatar: athena?.avatar || "microscope",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-3`,
            title: "Executive Synthesis & Strategic Recommendations",
            description: "Distill findings into concrete action items and executive briefing.",
            agentId: mercury?.id || null,
            agentName: mercury?.displayName || "Mercury (Copywriter)",
            agentAvatar: mercury?.avatar || "pen",
            priority: "medium",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-4`,
            title: "Memory Vault Note Archival",
            description: "Save structured synthesis to Obsidian Vault with backlinks.",
            agentId: leadOrchestrator?.id || null,
            agentName: leadOrchestrator?.displayName || "Lead Orchestrator",
            agentAvatar: leadOrchestrator?.avatar || "crown",
            priority: "low",
            completed: false,
          },
        ];
      } else {
        generatedSubtasks = [
          {
            id: `sub-${Date.now()}-1`,
            title: `Define Scope & Requirements for "${title.slice(0, 32)}"`,
            description: "Clarify inputs, constraints, deliverables, and acceptance criteria.",
            agentId: leadOrchestrator?.id || null,
            agentName: leadOrchestrator?.displayName || "Lead Orchestrator",
            agentAvatar: leadOrchestrator?.avatar || "crown",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-2`,
            title: "Specialist Execution & Drafting",
            description: "Execute primary deliverables and produce working draft.",
            agentId: vulcan?.id || athena?.id || null,
            agentName: (vulcan || athena)?.displayName || "Specialist Agent",
            agentAvatar: (vulcan || athena)?.avatar || "zap",
            priority: "high",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-3`,
            title: "Peer Quality Review & Polishing",
            description: "Review outputs for errors, adherence to directives, and tone.",
            agentId: mercury?.id || null,
            agentName: mercury?.displayName || "Mercury (Copywriter)",
            agentAvatar: mercury?.avatar || "pen",
            priority: "medium",
            completed: false,
          },
          {
            id: `sub-${Date.now()}-4`,
            title: "Final Verification & Sign-off",
            description: "Validate acceptance criteria and persist artifact to Vault.",
            agentId: leadOrchestrator?.id || null,
            agentName: leadOrchestrator?.displayName || "Lead Orchestrator",
            agentAvatar: leadOrchestrator?.avatar || "crown",
            priority: "low",
            completed: false,
          },
        ];
      }
    }

    // Persist into database envelope if taskId is provided
    if (taskId) {
      try {
        const existingTask = await prisma.task.findFirst({
          where: await getUserScopedWhere({ id: taskId }),
        });
        if (existingTask) {
          let existingData: any = {};
          try {
            existingData = JSON.parse(existingTask.result || "{}");
          } catch {
            existingData = { originalResult: existingTask.result || "" };
          }
          existingData.subtasks = generatedSubtasks;

          await prisma.task.update({
            where: { id: taskId },
            data: { result: JSON.stringify(existingData) },
          });
        }
      } catch (e) {
        console.error("Could not persist subtasks to database:", e);
      }
    }

    return NextResponse.json({
      success: true,
      subtasks: generatedSubtasks,
    });
  } catch (error) {
    console.error("Task decomposition error:", error);
    return NextResponse.json(
      { error: "Failed to decompose task with AI" },
      { status: 500 }
    );
  }
}
