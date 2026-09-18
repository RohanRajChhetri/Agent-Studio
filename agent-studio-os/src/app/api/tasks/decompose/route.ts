import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { taskId, title, description, agents = [] } = body;

    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    // Heuristic & Agent role matcher
    const matchAgent = (kw: string) => {
      if (!agents.length) return null;
      const lowerKw = kw.toLowerCase();
      
      const found = agents.find((a: any) => {
        const text = `${a.name} ${a.displayName} ${a.role || ""} ${a.department || ""} ${a.description || ""}`.toLowerCase();
        return text.includes(lowerKw);
      });
      return found || agents[0];
    };

    const athena = matchAgent("research") || matchAgent("athena") || agents[0];
    const vulcan = matchAgent("devops") || matchAgent("vulcan") || matchAgent("developer") || agents[1] || agents[0];
    const mercury = matchAgent("copywriter") || matchAgent("mercury") || matchAgent("writer") || agents[2] || agents[0];
    const rohanOrLead = matchAgent("orchestrator") || matchAgent("manager") || agents[0];

    // Generate intelligent subtasks tailored to the goal
    const tLower = `${title} ${description || ""}`.toLowerCase();
    
    let generatedSubtasks = [];

    if (tLower.includes("code") || tLower.includes("api") || tLower.includes("auth") || tLower.includes("bug") || tLower.includes("implement") || tLower.includes("build")) {
      generatedSubtasks = [
        {
          id: `sub-${Date.now()}-1`,
          title: "Architecture & Interface Specification",
          description: "Define schemas, API contract, and edge-case handling rules.",
          agentId: rohanOrLead?.id || null,
          agentName: rohanOrLead?.displayName || "Lead Orchestrator",
          agentAvatar: rohanOrLead?.avatar || "👑",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-2`,
          title: "Core Implementation & Integration",
          description: "Develop the primary logic, state flow, and database models.",
          agentId: vulcan?.id || null,
          agentName: vulcan?.displayName || "Vulcan (DevOps)",
          agentAvatar: vulcan?.avatar || "⚙️",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-3`,
          title: "Automated Verification & Unit Tests",
          description: "Execute regression tests, verify type safety, and lint contracts.",
          agentId: vulcan?.id || null,
          agentName: vulcan?.displayName || "Vulcan (DevOps)",
          agentAvatar: vulcan?.avatar || "⚙️",
          priority: "medium" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-4`,
          title: "Documentation & Release Notes",
          description: "Document endpoint usage and update knowledge base.",
          agentId: mercury?.id || null,
          agentName: mercury?.displayName || "Mercury (Copywriter)",
          agentAvatar: mercury?.avatar || "✍️",
          priority: "low" as const,
          completed: false,
        },
      ];
    } else if (tLower.includes("research") || tLower.includes("market") || tLower.includes("competitor") || tLower.includes("audit") || tLower.includes("analyze")) {
      generatedSubtasks = [
        {
          id: `sub-${Date.now()}-1`,
          title: "Source Gathering & Market Landscape Exploration",
          description: "Gather competitor specs, documentation, and external data sources.",
          agentId: athena?.id || null,
          agentName: athena?.displayName || "Athena (Research)",
          agentAvatar: athena?.avatar || "🔬",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-2`,
          title: "Comparative Feature Matrix Synthesis",
          description: "Construct structural breakdown of pricing, latency, and capabilities.",
          agentId: athena?.id || null,
          agentName: athena?.displayName || "Athena (Research)",
          agentAvatar: athena?.avatar || "🔬",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-3`,
          title: "Executive Synthesis & Strategic Recommendations",
          description: "Distill findings into concrete action items and executive briefing.",
          agentId: mercury?.id || null,
          agentName: mercury?.displayName || "Mercury (Copywriter)",
          agentAvatar: mercury?.avatar || "✍️",
          priority: "medium" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-4`,
          title: "Memory Vault Note Archival",
          description: "Save structured synthesis to Obsidian Vault with backlinks.",
          agentId: rohanOrLead?.id || null,
          agentName: rohanOrLead?.displayName || "Lead Orchestrator",
          agentAvatar: rohanOrLead?.avatar || "👑",
          priority: "low" as const,
          completed: false,
        },
      ];
    } else {
      // General goal breakdown
      generatedSubtasks = [
        {
          id: `sub-${Date.now()}-1`,
          title: `Define Scope & Requirements for "${title.slice(0, 32)}"`,
          description: "Clarify inputs, constraints, deliverables, and acceptance criteria.",
          agentId: rohanOrLead?.id || null,
          agentName: rohanOrLead?.displayName || "Lead Orchestrator",
          agentAvatar: rohanOrLead?.avatar || "👑",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-2`,
          title: "Specialist Execution & Drafting",
          description: "Execute primary deliverables and produce working draft.",
          agentId: vulcan?.id || athena?.id || null,
          agentName: (vulcan || athena)?.displayName || "Specialist Agent",
          agentAvatar: (vulcan || athena)?.avatar || "⚡",
          priority: "high" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-3`,
          title: "Peer Quality Review & Polishing",
          description: "Review outputs for errors, adherence to directives, and tone.",
          agentId: mercury?.id || null,
          agentName: mercury?.displayName || "Mercury (Copywriter)",
          agentAvatar: mercury?.avatar || "✍️",
          priority: "medium" as const,
          completed: false,
        },
        {
          id: `sub-${Date.now()}-4`,
          title: "Final Verification & Sign-off",
          description: "Validate acceptance criteria and persist artifact to Vault.",
          agentId: rohanOrLead?.id || null,
          agentName: rohanOrLead?.displayName || "Lead Orchestrator",
          agentAvatar: rohanOrLead?.avatar || "👑",
          priority: "low" as const,
          completed: false,
        },
      ];
    }

    // If a taskId was provided, persist into task result payload
    if (taskId) {
      try {
        const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
        if (existingTask) {
          let existingData: any = {};
          try {
            existingData = JSON.parse(existingTask.result || "{}");
          } catch {
            existingData = { originalResult: existingTask.result };
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
