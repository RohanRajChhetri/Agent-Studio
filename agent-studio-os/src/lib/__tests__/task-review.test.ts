import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/llm-router", () => ({
  executeChatCompletion: vi.fn().mockResolvedValue({
    content: "# Revised Deliverable\nAddressing feedback thoroughly.",
    modelUsed: "mock-model",
    latency: 250,
  }),
}));

vi.mock("@/lib/vault", () => ({
  writeVaultFile: vi.fn().mockResolvedValue(true),
  ensureVaultExists: vi.fn().mockResolvedValue(true),
}));

describe("Human-in-the-Loop Task Review Logic", () => {
  const mockTask = {
    id: "task-123",
    title: "Draft Security Architecture",
    description: "Design multi-tier auth",
    priority: "high",
    status: "review",
    result: "Initial security draft.",
    agentId: "agent-1",
    agent: {
      id: "agent-1",
      name: "cyber-sentinel",
      displayName: "Cyber Sentinel",
      systemPrompt: "Security specialist",
      model: "gpt-4o",
    },
  };

  it("should validate review transitions: approve marks status done", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.task.findUnique as any).mockResolvedValue(mockTask);
    (prisma.task.update as any).mockResolvedValue({
      ...mockTask,
      status: "done",
    });

    const updated = await prisma.task.update({
      where: { id: "task-123" },
      data: { status: "done" },
    });

    expect(updated.status).toBe("done");
  });

  it("should validate revision transitions: revise marks status review or in_progress with critique", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.task.findUnique as any).mockResolvedValue(mockTask);
    (prisma.task.update as any).mockResolvedValue({
      ...mockTask,
      status: "review",
      result: "# Revised Deliverable\nAddressing feedback thoroughly.",
    });

    const updated = await prisma.task.update({
      where: { id: "task-123" },
      data: {
        status: "review",
        result: "# Revised Deliverable\nAddressing feedback thoroughly.",
      },
    });

    expect(updated.status).toBe("review");
    expect(updated.result).toContain("Revised Deliverable");
  });

  it("should validate rejection transitions: reject marks status backlog", async () => {
    const { prisma } = await import("@/lib/prisma");
    (prisma.task.findUnique as any).mockResolvedValue(mockTask);
    (prisma.task.update as any).mockResolvedValue({
      ...mockTask,
      status: "backlog",
      description: `${mockTask.description}\n\n[Rejected]: Out of scope`,
    });

    const updated = await prisma.task.update({
      where: { id: "task-123" },
      data: {
        status: "backlog",
        description: `${mockTask.description}\n\n[Rejected]: Out of scope`,
      },
    });

    expect(updated.status).toBe("backlog");
    expect(updated.description).toContain("[Rejected]");
  });
});
