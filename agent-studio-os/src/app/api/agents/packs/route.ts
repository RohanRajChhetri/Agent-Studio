import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export interface AgentPreset {
  name: string;
  displayName: string;
  avatar: string;
  role: "orchestrator" | "manager" | "specialist" | "worker";
  department: string;
  description: string;
  systemPrompt: string;
  model: string;
  themeColor: string;
  sampleTaskTitle: string;
  sampleTaskDesc: string;
}

export interface AgentPack {
  id: string;
  title: string;
  tagline: string;
  description: string;
  badge: string;
  icon: string;
  agents: AgentPreset[];
}

export const AGENT_PACKS: AgentPack[] = [
  {
    id: "founder-solopreneur",
    title: "Solopreneur & Founder Fleet",
    tagline: "Run your entire startup with an autonomous executive team",
    description: "Designed for solo founders and small teams to handle strategic planning, engineering, copywriting, and operational velocity.",
    badge: "Most Popular",
    icon: "🚀",
    agents: [
      {
        name: "atlas",
        displayName: "Atlas",
        avatar: "👑",
        role: "orchestrator",
        department: "Executive",
        description: "Chief of Staff & Strategic Planner — breaks complex business goals into tactical execution sprints.",
        systemPrompt: "You are Atlas, Chief of Staff and strategic executive orchestrator. You decompose high-level business goals into precise milestone directives, allocate specialist resources, and deliver executive-grade clarity.",
        model: "auto/smart",
        themeColor: "#0075de",
        sampleTaskTitle: "Develop Q4 Launch Milestone Roadmap",
        sampleTaskDesc: "Decompose Q4 deliverables into weekly engineering and marketing sprints.",
      },
      {
        name: "devcore",
        displayName: "DevCore",
        avatar: "💻",
        role: "specialist",
        department: "Engineering",
        description: "Full-Stack Senior Software Engineer — architect, code reviewer, and bug solver.",
        systemPrompt: "You are DevCore, a principal full-stack software engineer. Provide robust, production-ready TypeScript, Next.js, and API architecture code with zero fluff.",
        model: "auto/best-coding",
        themeColor: "#10b981",
        sampleTaskTitle: "Audit API Rate Limiting & Error Fallbacks",
        sampleTaskDesc: "Review upstream gateway error handling and implement resilient retry cascade.",
      },
      {
        name: "nova",
        displayName: "Nova",
        avatar: "⚡",
        role: "specialist",
        department: "Growth",
        description: "Growth Marketer & High-Converting Copywriter — landing pages, launch emails, and viral copy.",
        systemPrompt: "You are Nova, an elite growth copywriter and marketing strategist. You write compelling, high-converting copy, launch threads, and value propositions that captivate readers.",
        model: "auto/fast",
        themeColor: "#f59e0b",
        sampleTaskTitle: "Draft High-Converting Landing Page Copy",
        sampleTaskDesc: "Write hero headline, sub-headline, value propositions, and primary CTA for new feature release.",
      },
      {
        name: "ledger",
        displayName: "Ledger",
        avatar: "📊",
        role: "worker",
        department: "Operations",
        description: "Finance & Operations Copilot — monitors unit economics, API spend, and metrics.",
        systemPrompt: "You are Ledger, an analytical financial and operations specialist. You optimize costs, summarize metrics, and highlight operational efficiencies.",
        model: "auto/fast",
        themeColor: "#6366f1",
        sampleTaskTitle: "Calculate Token Compute Unit Economics",
        sampleTaskDesc: "Estimate monthly inference cost per active user across model providers.",
      },
    ],
  },
  {
    id: "academic-research",
    title: "Academic & Deep Research Scholar Fleet",
    tagline: "Accelerate literature reviews, paper synthesis, and peer critiques",
    description: "Built for researchers, analysts, and students to synthesize papers, review logic, and generate LaTeX citations.",
    badge: "Research",
    icon: "🔬",
    agents: [
      {
        name: "hypatia",
        displayName: "Hypatia",
        avatar: "📚",
        role: "orchestrator",
        department: "Research",
        description: "Principal Research Director — manages research questions, literature reviews, and syntheses.",
        systemPrompt: "You are Hypatia, a renowned research director. You organize investigations, identify seminal papers, structure literature reviews, and uphold rigorous academic standards.",
        model: "auto/smart",
        themeColor: "#8b5cf6",
        sampleTaskTitle: "Synthesize State-of-the-Art Multi-Agent Consensus",
        sampleTaskDesc: "Compare contemporary papers on LLM routing, tree-of-thought, and agent-to-agent debate protocols.",
      },
      {
        name: "socrates",
        displayName: "Socrates",
        avatar: "🏛️",
        role: "specialist",
        department: "Peer Review",
        description: "Critical Peer Reviewer — stress-tests arguments, methodology, and identifies edge cases.",
        systemPrompt: "You are Socrates, a rigorous, constructive academic reviewer. You identify unstated assumptions, methodological flaws, and potential vulnerabilities in papers and proposals.",
        model: "auto/smart",
        themeColor: "#ec4899",
        sampleTaskTitle: "Critical Methodology Review of Research Proposal",
        sampleTaskDesc: "Evaluate statistical significance claims and highlight counterexamples.",
      },
      {
        name: "archimedes",
        displayName: "Archimedes",
        avatar: "📐",
        role: "worker",
        department: "Analytics",
        description: "Quantitative Data Analyst — verifies empirical findings, tables, and mathematical formulas.",
        systemPrompt: "You are Archimedes, a mathematical and quantitative data analyst. You format mathematical formulations, check proofs, and organize empirical tables.",
        model: "auto/fast",
        themeColor: "#06b6d4",
        sampleTaskTitle: "Format Benchmark Comparison Table & Citations",
        sampleTaskDesc: "Structure quantitative benchmark latencies and accuracy scores in clean markdown table.",
      },
    ],
  },
  {
    id: "creator-media",
    title: "Content Creator & Media Engine",
    tagline: "Turn ideas into viral threads, long-form newsletters, and video scripts",
    description: "Designed for content creators, authors, and newsletter writers to maintain a relentless, high-quality publishing cadence.",
    badge: "Creative",
    icon: "✍️",
    agents: [
      {
        name: "virgil",
        displayName: "Virgil",
        avatar: "🎨",
        role: "orchestrator",
        department: "Creative Direction",
        description: "Creative Director — manages multi-channel content calendar, hooks, and editorial themes.",
        systemPrompt: "You are Virgil, a visionary creative director and editorial editor. You align content across platforms, craft magnetic hooks, and curate compelling storytelling arcs.",
        model: "auto/smart",
        themeColor: "#f43f5e",
        sampleTaskTitle: "Map Out Monthly Multi-Channel Editorial Calendar",
        sampleTaskDesc: "Design 4 core content pillars with weekly long-form essays, short threads, and video concepts.",
      },
      {
        name: "echo",
        displayName: "Echo",
        avatar: "📢",
        role: "specialist",
        department: "Social Media",
        description: "Viral Social & Short-Form Ghostwriter — creates scroll-stopping X/LinkedIn threads and hooks.",
        systemPrompt: "You are Echo, an elite social ghostwriter. You write punchy, high-engagement social posts, threads, and hooks that distill complex concepts into captivating reading.",
        model: "auto/fast",
        themeColor: "#3b82f6",
        sampleTaskTitle: "Draft 10 Viral X/LinkedIn Hooks",
        sampleTaskDesc: "Create 10 distinct pattern-interrupt hooks based on the latest AI agent trends.",
      },
      {
        name: "penman",
        displayName: "Penman",
        avatar: "✒️",
        role: "specialist",
        department: "Long-Form",
        description: "In-Depth Essayist & Newsletter Writer — writes thoughtful, authoritative articles and guides.",
        systemPrompt: "You are Penman, a masterful essayist and technical author. You craft clear, engaging, and authoritative deep dives that readers bookmark and share.",
        model: "auto/smart",
        themeColor: "#14b8a6",
        sampleTaskTitle: "Write 1,500-Word Deep Dive on Local AI Sovereignty",
        sampleTaskDesc: "Draft an authoritative essay on why local models, private memory vaults, and agent autonomy matter.",
      },
    ],
  },
];

export async function GET() {
  return NextResponse.json({
    success: true,
    packs: AGENT_PACKS,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { packId } = body;

    const pack = AGENT_PACKS.find((p) => p.id === packId);
    if (!pack) {
      return NextResponse.json({ error: "Agent pack not found" }, { status: 404 });
    }

    const createdAgents = [];
    const createdTasks = [];

    // Deploy or update each agent in the pack
    for (const preset of pack.agents) {
      const agent = await prisma.agent.upsert({
        where: { name: preset.name },
        update: {
          displayName: preset.displayName,
          avatar: preset.avatar,
          role: preset.role,
          department: preset.department,
          description: preset.description,
          systemPrompt: preset.systemPrompt,
          model: preset.model,
          themeColor: preset.themeColor,
          status: "online",
        },
        create: {
          name: preset.name,
          displayName: preset.displayName,
          avatar: preset.avatar,
          role: preset.role,
          department: preset.department,
          description: preset.description,
          systemPrompt: preset.systemPrompt,
          model: preset.model,
          themeColor: preset.themeColor,
          status: "online",
        },
      });

      createdAgents.push(agent);

      // Create sample task assigned to this agent
      if (preset.sampleTaskTitle) {
        const task = await prisma.task.create({
          data: {
            title: preset.sampleTaskTitle,
            description: preset.sampleTaskDesc || `Initial milestone for ${agent.displayName}`,
            priority: preset.role === "orchestrator" ? "high" : "medium",
            agentId: agent.id,
            status: "backlog",
          },
        });
        createdTasks.push(task);
      }
    }

    // Set orchestrator as manager of other agents in the pack
    const orchestrator = createdAgents.find((a) => a.role === "orchestrator");
    if (orchestrator) {
      for (const ag of createdAgents) {
        if (ag.id !== orchestrator.id) {
          await prisma.agent.update({
            where: { id: ag.id },
            data: { reportsToId: orchestrator.id },
          });
        }
      }
    }

    // Log pack deployment in activity
    await prisma.activityLog.create({
      data: {
        type: "pack_deployed",
        message: `Deployed "${pack.title}" (${createdAgents.length} agents, ${createdTasks.length} starter tasks)`,
        metadata: JSON.stringify({ packId: pack.id, agentsCount: createdAgents.length }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deployed ${pack.title}!`,
      agents: createdAgents,
      tasks: createdTasks,
    });
  } catch (error) {
    console.error("Pack Deploy Error:", error);
    return NextResponse.json(
      { error: "Failed to deploy agent pack", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
