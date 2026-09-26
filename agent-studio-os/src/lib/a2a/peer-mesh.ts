import { prisma } from "@/lib/prisma";
import { executeChatCompletion } from "@/lib/llm-router";
import { a2aBroker } from "./protocol";
import type { A2AMessage, A2AMessageType } from "@/types/a2a";

export interface InvokePeerOptions {
  fromAgentId: string;
  toAgentId: string;
  taskType?: A2AMessageType;
  title: string;
  prompt: string;
  contextData?: Record<string, any>;
}

export interface PeerReviewOptions {
  authorAgentId: string;
  reviewerAgentId: string;
  artifactTitle: string;
  artifactContent: string;
  rubricFocus?: string;
}

/**
 * Pillar 2: Event-Driven Message Bus & Peer-to-Peer Mesh
 * Enables dynamic agent-to-agent tool calling, peer reviews, and collaborative queries.
 */
export async function invokePeerAgent(options: InvokePeerOptions): Promise<{
  success: boolean;
  message: A2AMessage;
  content: string;
  latencyMs: number;
}> {
  const start = Date.now();
  const [caller, target] = await Promise.all([
    options.fromAgentId === "system"
      ? null
      : prisma.agent.findFirst({
          where: { OR: [{ id: options.fromAgentId }, { name: options.fromAgentId }] },
        }),
    prisma.agent.findFirst({
      where: { OR: [{ id: options.toAgentId }, { name: options.toAgentId }] },
    }),
  ]);

  if (!target) {
    throw new Error(`Target peer agent "${options.toAgentId}" not found`);
  }

  const callerName = caller ? caller.displayName : "Peer Agent";
  const targetName = target.displayName;

  // Issue A2A Delegation Contract
  const message = await a2aBroker.delegateTask(
    {
      taskId: `peer-call-${Date.now()}`,
      title: options.title || `A2A Peer Call: ${targetName}`,
      delegator: callerName,
      delegatee: targetName,
      objective: options.prompt,
      inputData: options.contextData || {},
      priority: "high",
    },
    { id: caller?.id || "system", name: callerName },
    { id: target.id, name: targetName }
  );

  const fullPrompt = `You have been invoked via the Agent-to-Agent (A2A) protocol by your peer: **${callerName}**.
TASK REQUEST:
${options.prompt}

${options.contextData ? `CONTEXT DATA:\n${JSON.stringify(options.contextData, null, 2)}\n` : ""}

GUIDELINES:
1. Act directly as ${target.displayName} (${target.role} | Department: ${target.department}).
2. Provide a direct, actionable, and precise response tailored for your peer agent to use.
3. Be concise and eliminate introductory filler.`;

  const completion = await executeChatCompletion({
    prompt: fullPrompt,
    model: target.model || "auto/fast",
    systemPrompt:
      target.systemPrompt ||
      `You are ${target.displayName}, an elite autonomous specialist answering a peer agent's query.`,
    agentName: target.name,
  });

  const latencyMs = Date.now() - start;
  a2aBroker.completeTask(message.id, completion.content, "completed", latencyMs);

  return {
    success: true,
    message: {
      ...message,
      status: "completed",
      result: completion.content,
      latencyMs,
    },
    content: completion.content,
    latencyMs,
  };
}

/**
 * Request a formal A2A Peer Review on code, documentation, or architecture deliverable
 */
export async function requestPeerReview(options: PeerReviewOptions) {
  const start = Date.now();
  const [author, reviewer] = await Promise.all([
    options.authorAgentId === "system"
      ? null
      : prisma.agent.findFirst({
          where: { OR: [{ id: options.authorAgentId }, { name: options.authorAgentId }] },
        }),
    prisma.agent.findFirst({
      where: { OR: [{ id: options.reviewerAgentId }, { name: options.reviewerAgentId }] },
    }),
  ]);

  if (!reviewer) {
    throw new Error(`Reviewer agent "${options.reviewerAgentId}" not found`);
  }

  const authorName = author ? author.displayName : "Author Agent";
  const reviewerName = reviewer.displayName;

  const reviewPrompt = `You are ${reviewerName} (${reviewer.role}), performing a formal A2A Peer Review.
AUTHOR: ${authorName}
ARTIFACT TITLE: "${options.artifactTitle}"
${options.rubricFocus ? `SPECIFIC FOCUS: ${options.rubricFocus}\n` : ""}

ARTIFACT TO REVIEW:
\`\`\`
${options.artifactContent}
\`\`\`

PROVIDE YOUR REVIEW IN THIS FORMAT:
1. Strengths & Positives
2. Critical Flaws, Vulnerabilities, or Edge Cases
3. Concrete Improvements (Code/Architecture changes)
4. Overall Recommendation: [APPROVED / NEEDS_REVISION / REJECTED]`;

  const reviewRes = await executeChatCompletion({
    prompt: reviewPrompt,
    model: reviewer.model || "auto/fast",
    systemPrompt:
      reviewer.systemPrompt ||
      "You are a critical, precise peer reviewer focusing on technical excellence and safety.",
    agentName: reviewer.name,
  });

  const latencyMs = Date.now() - start;

  const peerMsg = await a2aBroker.logPeerReview(
    { id: author?.id || "unknown", name: authorName },
    { id: reviewer.id, name: reviewerName },
    `Peer Review: ${options.artifactTitle}`,
    reviewRes.content
  );

  return {
    success: true,
    peerMessageId: peerMsg.id,
    reviewer: reviewerName,
    critique: reviewRes.content,
    latencyMs,
  };
}
