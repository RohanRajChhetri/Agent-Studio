import { describe, it, expect, vi, beforeEach } from "vitest";
import { routeMobileCommand } from "../omnichannel-router";

// Mock dependencies
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agent: {
      count: vi.fn().mockResolvedValue(4),
      findMany: vi.fn().mockResolvedValue([
        { id: "agent-1", name: "cyber-sentinel", displayName: "Cyber Sentinel", model: "auto/fast" },
        { id: "agent-2", name: "researcher", displayName: "Deep Research", model: "auto/smart" },
      ]),
      findFirst: vi.fn().mockResolvedValue({
        id: "agent-1",
        name: "cyber-sentinel",
        displayName: "Cyber Sentinel",
        model: "auto/fast",
      }),
    },
    task: {
      groupBy: vi.fn().mockResolvedValue([
        { status: "in_progress", _count: { id: 2 } },
        { status: "review", _count: { id: 1 } },
        { status: "backlog", _count: { id: 3 } },
      ]),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "task-abc1234",
          title: "Audit Authentication Security",
          status: "review",
          priority: "high",
          agent: { displayName: "Cyber Sentinel" },
        },
        {
          id: "task-def5678",
          title: "Analyze Market Trends",
          status: "backlog",
          priority: "medium",
          agent: null,
        },
      ]),
      findFirst: vi.fn().mockImplementation(({ where }) => {
        const idVal = typeof where?.id === "object" ? where?.id?.startsWith : where?.id;
        if (idVal && String(idVal).startsWith("task-abc")) {
          return Promise.resolve({
            id: "task-abc1234",
            title: "Audit Authentication Security",
            status: "review",
            priority: "high",
            agent: { displayName: "Cyber Sentinel", name: "cyber-sentinel" },
          });
        }
        return Promise.resolve(null);
      }),
      update: vi.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({
          id: where.id,
          title: "Audit Authentication Security",
          status: data.status,
          result: data.result || "Deliverable output",
        });
      }),
    },
    activityLog: {
      create: vi.fn().mockResolvedValue(true),
    },
  },
}));

vi.mock("@/lib/omniroute", () => ({
  isOmnirouteOnline: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/vault", () => ({
  ensureVaultExists: vi.fn().mockResolvedValue(true),
  writeVaultFile: vi.fn().mockResolvedValue(true),
  readVaultFile: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/llm-router", () => ({
  executeChatCompletion: vi.fn().mockResolvedValue({
    content: "## Mobile Executed Deliverable\nTask executed successfully via mobile command.",
    modelUsed: "auto/fast",
    latency: 180,
  }),
}));

describe("Omnichannel Mobile Command Router", () => {
  const context = {
    sender: "Rohan",
    channel: "telegram" as const,
    defaultAgent: {
      id: "agent-1",
      name: "cyber-sentinel",
      displayName: "Cyber Sentinel",
    },
  };

  it("should return handled: false for non-slash messages", async () => {
    const res = await routeMobileCommand("Hello agent, how are you?", context);
    expect(res.handled).toBe(false);
  });

  it("should handle /help and /start command with directory of tools", async () => {
    const res = await routeMobileCommand("/help", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("Mobile Command Center");
    expect(res.replyText).toContain("/tasks");
    expect(res.replyText).toContain("/run");
    expect(res.replyText).toContain("/approve");
  });

  it("should handle /status command with fleet diagnostics", async () => {
    const res = await routeMobileCommand("/status", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("System Status");
    expect(res.replyText).toContain("Omniroute");
    expect(res.replyText).toContain("4 agents");
  });

  it("should handle /tasks command listing active tasks", async () => {
    const res = await routeMobileCommand("/tasks", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("Active Tasks");
    expect(res.replyText).toContain("Audit Authentication Security");
  });

  it("should handle /run <id> command executing task", async () => {
    const res = await routeMobileCommand("/run task-abc", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("Task Completed & Ready for Review");
    expect(res.replyText).toContain("Deliverable Preview");
  });

  it("should handle /approve <id> command marking task done", async () => {
    const res = await routeMobileCommand("/approve task-abc", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("Task Approved");
  });

  it("should handle /briefing command", async () => {
    const res = await routeMobileCommand("/briefing", context);
    expect(res.handled).toBe(true);
    expect(res.replyText).toContain("Daily Executive Briefing");
  });
});
