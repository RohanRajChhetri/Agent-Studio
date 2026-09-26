import type { AgentProfile } from "@/types";

/**
 * Intelligent domain-aware specialist agent matcher.
 * Analyzes the user's prompt or task title/description and selects
 * the most qualified specialist agent rather than blindly defaulting
 * to the most recently created agent.
 */
export function matchBestAgent(
  queryOrTask: string,
  agents: AgentProfile[],
  options?: { defaultToOrchestrator?: boolean }
): AgentProfile | null {
  if (!agents || agents.length === 0) return null;

  const defaultToOrchestrator = options?.defaultToOrchestrator ?? true;
  const orchestrator = agents.find(
    (a) => a.role === "orchestrator" || a.name === "rohan" || (a.department && a.department.toLowerCase().includes("exec"))
  );

  const text = (queryOrTask || "").trim().toLowerCase();

  // If empty query, return orchestrator or first established agent
  if (!text) {
    return orchestrator || agents[0];
  }

  // Domain keyword mappings
  const devKeywords = [
    "code", "build", "develop", "bug", "fix", "frontend", "backend", "api", "database",
    "sql", "prisma", "react", "component", "refactor", "endpoint", "function", "javascript",
    "typescript", "css", "html", "tailwind", "ui", "ux", "app", "server", "git", "terminal",
    "next.js", "nextjs", "node", "crud", "route", "query", "schema", "auth", "jwt", "oauth",
    "rest", "graphql", "websocket", "service", "migration"
  ];

  const researchKeywords = [
    "research", "analyze", "analysis", "market", "competitor", "document", "docs", "brief",
    "summary", "synthesize", "search", "web", "information", "report", "read", "pricing",
    "strategy", "intelligence", "vault", "obsidian", "note", "paper", "investigate", "benchmark"
  ];

  const opsKeywords = [
    "monitor", "health", "sentry", "uptime", "alert", "incident", "telemetry", "infrastructure",
    "healing", "status", "server load", "performance", "metric", "logs", "crash", "deploy",
    "docker", "container", "devops", "cloud", "aws", "cron", "routine", "pipeline"
  ];

  const commsKeywords = [
    "whatsapp", "telegram", "discord", "message", "channel", "notify", "broadcast",
    "dispatch", "webhook", "listen", "chat", "inbound", "outbound", "sms", "echo", "integration"
  ];

  const orchKeywords = [
    "plan", "coordinate", "orchestrate", "lead", "manage", "roadmap", "project", "team",
    "delegate", "oversee", "review", "hierarchy", "master", "vision", "strategy", "align"
  ];

  let bestAgent: AgentProfile = orchestrator || agents[0];
  let highestScore = -1;

  for (const agent of agents) {
    let score = 0;
    const name = (agent.name || "").toLowerCase();
    const displayName = (agent.displayName || "").toLowerCase();
    const role = (agent.role || "").toLowerCase();
    const dept = (agent.department || "").toLowerCase();
    const desc = (agent.description || "").toLowerCase();
    const agentKeywords = `${name} ${displayName} ${role} ${dept} ${desc}`;

    // Direct name match in query
    if (name && text.includes(name)) score += 30;
    if (displayName && text.includes(displayName)) score += 30;

    // Engineering & Dev matching
    if (dept.includes("eng") || name === "devcore" || role.includes("dev") || agentKeywords.includes("code")) {
      for (const kw of devKeywords) {
        if (text.includes(kw)) score += 4;
      }
    }

    // Research & Analysis matching
    if (dept.includes("research") || name === "scout" || agentKeywords.includes("research") || agentKeywords.includes("synthesiz")) {
      for (const kw of researchKeywords) {
        if (text.includes(kw)) score += 4;
      }
    }

    // Telemetry, Monitoring & Ops matching
    if (name === "sentry" || dept.includes("ops") || agentKeywords.includes("telemetry") || agentKeywords.includes("health")) {
      for (const kw of opsKeywords) {
        if (text.includes(kw)) score += 4;
      }
    }

    // Messaging & Gateway matching
    if (name === "echo" || agentKeywords.includes("whatsapp") || agentKeywords.includes("telegram")) {
      for (const kw of commsKeywords) {
        if (text.includes(kw)) score += 4;
      }
    }

    // Orchestrator matching
    if (role === "orchestrator" || name === "rohan") {
      for (const kw of orchKeywords) {
        if (text.includes(kw)) score += 4;
      }
    }

    // Slight penalty for workload if tasks count exists
    const taskCount = (agent as any).taskCount ?? (agent as any)._count?.tasks ?? 0;
    score -= taskCount * 0.1;

    if (score > highestScore) {
      highestScore = score;
      bestAgent = agent;
    }
  }

  // If no specific domain keywords matched, fallback to orchestrator (not the newest created agent)
  if (highestScore <= 0 && defaultToOrchestrator && orchestrator) {
    return orchestrator;
  }

  return bestAgent;
}
