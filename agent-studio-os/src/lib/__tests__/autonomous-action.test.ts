import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    agent: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    activityLog: {
      create: vi.fn(),
    },
  },
}));

// Mock llm-router
vi.mock("@/lib/llm-router", () => ({
  executeChatCompletion: vi.fn().mockResolvedValue({
    content: "### Executive Deliverable\n\n```python\nprint('Autonomous Execution Success')\n```",
    modelUsed: "auto/smart",
    latency: 85,
  }),
}));

// Mock vault
vi.mock("@/lib/vault", () => ({
  writeVaultFile: vi.fn().mockResolvedValue({ success: true }),
  ensureVaultExists: vi.fn().mockResolvedValue(true),
}));

// Mock omniroute
vi.mock("@/lib/omniroute", () => ({
  isOmnirouteOnline: vi.fn().mockResolvedValue(true),
}));

import { prisma } from "@/lib/prisma";
import { dispatchAutonomousAction } from "@/lib/autonomous-action-dispatcher";

describe("Autonomous Dashboard Action Orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle 'execute task in kanban' by finding and running the pending task", async () => {
    const mockTask = {
      id: "task-123",
      title: "Implement OAuth2 JWT Middleware",
      description: "Build robust authentication handler",
      status: "backlog",
      priority: "high",
      agent: {
        id: "agent-coder",
        displayName: "Coder Agent",
        name: "coder",
        role: "specialist",
        avatar: "laptop",
      },
    };

    (prisma.task.findFirst as any).mockResolvedValue(mockTask);
    (prisma.task.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTask, ...data })
    );

    const result = await dispatchAutonomousAction("execute task in kanban");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("execute_kanban");
    expect(result.content).toContain("Autonomous Execution Completed");
    expect(result.content).toContain("Implement OAuth2 JWT Middleware");
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-123" },
        data: expect.objectContaining({ status: "in_progress" }),
      })
    );
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "task-123" },
        data: expect.objectContaining({ status: "review" }),
      })
    );
  });

  it("should handle 'assign task to Coder and complete it' by creating and running it", async () => {
    const mockAgent = {
      id: "agent-coder",
      displayName: "Coder Agent",
      name: "coder",
      role: "specialist",
      avatar: "laptop",
    };

    (prisma.agent.findMany as any).mockResolvedValue([mockAgent]);
    (prisma.task.count as any).mockResolvedValue(2);
    (prisma.task.create as any).mockResolvedValue({
      id: "task-new",
      title: "Build SQLite index optimizer",
      description: "Dispatched via Mission Control Command Center",
      status: "backlog",
      priority: "medium",
      agent: mockAgent,
    });
    (prisma.task.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "task-new",
        title: "Build SQLite index optimizer",
        ...data,
        agent: mockAgent,
      })
    );

    const result = await dispatchAutonomousAction(
      "assign task to Coder Agent: Build SQLite index optimizer and complete it"
    );

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("assign_task");
    expect(result.content).toContain("Task Assigned & Fully Executed!");
    expect(result.content).toContain("Build SQLite index optimizer");
  });

  it("should handle 'show me the tasks' by querying active Kanban tickets", async () => {
    (prisma.task.findMany as any).mockResolvedValue([
      {
        id: "task-1",
        title: "Database Indexing",
        status: "in_progress",
        priority: "urgent",
        agent: { displayName: "DevOps Agent" },
      },
    ]);

    const result = await dispatchAutonomousAction("show me the tasks on kanban");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("query_tasks");
    expect(result.content).toContain("Current Kanban Tasks");
    expect(result.content).toContain("Database Indexing");
  });

  it("should handle 'fleet status' by providing telemetry report", async () => {
    (prisma.agent.findMany as any).mockResolvedValue([
      { displayName: "Executive", role: "orchestrator", avatar: "crown" },
    ]);
    (prisma.task.groupBy as any).mockResolvedValue([
      { status: "in_progress", _count: { id: 2 } },
    ]);

    const result = await dispatchAutonomousAction("system status");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("fleet_status");
    expect(result.content).toContain("Live Fleet Telemetry");
  });

  it("should handle direct actionable programming task without conversational fluff", async () => {
    (prisma.agent.findMany as any).mockResolvedValue([
      { id: "coder-1", displayName: "Coder Agent", role: "specialist" },
    ]);

    const result = await dispatchAutonomousAction(
      "write a python script to validate JWT tokens with ed25519"
    );

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("direct_task");
    expect(result.content).toContain("Executive Deliverable");
  });

  it("should handle typo tolerance for 'execute task in kanvban'", async () => {
    const mockTask = {
      id: "task-typo",
      title: "Security Hardening",
      description: "Harden endpoints",
      status: "backlog",
      priority: "high",
      agent: { id: "a1", displayName: "SecOps", role: "specialist", avatar: "shield" },
    };

    (prisma.task.findFirst as any).mockResolvedValue(mockTask);
    (prisma.task.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({ ...mockTask, ...data })
    );

    const result = await dispatchAutonomousAction("execute task in kanvban");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("execute_kanban");
    expect(result.content).toContain("Security Hardening");
  });

  it("should handle sandbox code execution intent 'run code: 10 + 20'", async () => {
    const result = await dispatchAutonomousAction("run code: console.log(10 + 20)");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("execute_code");
    expect(result.content).toContain("Sandbox Code Execution");
    expect(result.content).toContain("30");
  });

  it("should handle dynamic delegation when user says 'assign task to other agents and complete it'", async () => {
    const mockAgent = {
      id: "agent-specialist",
      displayName: "Backend Specialist",
      name: "backend",
      role: "specialist",
      avatar: "settings",
    };

    const pendingTask = {
      id: "task-pending-1",
      title: "Build Distributed Lock Manager",
      description: "Prevent race conditions in SQLite transactions",
      status: "backlog",
      priority: "high",
      agent: null,
    };

    (prisma.agent.findMany as any).mockResolvedValue([mockAgent]);
    (prisma.task.findFirst as any).mockResolvedValue(pendingTask);
    (prisma.task.count as any).mockResolvedValue(1);
    (prisma.task.create as any).mockResolvedValue({
      id: "task-new-delegated",
      title: "Build Distributed Lock Manager",
      description: "Prevent race conditions in SQLite transactions",
      status: "backlog",
      priority: "medium",
      agent: mockAgent,
    });
    (prisma.task.update as any).mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: "task-new-delegated",
        title: "Build Distributed Lock Manager",
        ...data,
        agent: mockAgent,
      })
    );

    const result = await dispatchAutonomousAction("assign the task to other agents and complete it");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("assign_task");
    expect(result.content).toContain("Task Assigned & Fully Executed!");
    expect(result.content).toContain("Build Distributed Lock Manager");
  });

  it("should handle proforme task intent without conversational filler", async () => {
    (prisma.agent.findMany as any).mockResolvedValue([
      { id: "coder-1", displayName: "Dev Agent", role: "specialist" },
    ]);

    const result = await dispatchAutonomousAction("proforme this task: calculate SHA-256 hash in typescript");

    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("direct_task");
    expect(result.content).toContain("Executive Deliverable");
  });

  it("should handle compound intent 'open youtube search for cat video and then take a screen shot of it'", async () => {
    const { resolveLaunchTarget } = await import("@/lib/cua-driver");
    const resolved = resolveLaunchTarget("youtube search for cat video");
    expect(resolved.isUrl).toBe(true);
    expect(resolved.target).toBe("https://www.youtube.com/results?search_query=cat%20video");

    const result = await dispatchAutonomousAction("open youtube search for cat video and then take a screen shot of it");
    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("desktop_action");
    expect(result.metadata?.target).toBe("youtube search for cat video");
    expect(result.content).toContain("Autonomous Task Executed");
  });

  it("should resolve various search queries and desktop apps correctly", async () => {
    const { resolveLaunchTarget } = await import("@/lib/cua-driver");

    const yt1 = resolveLaunchTarget("search for funny dogs on youtube");
    expect(yt1.isUrl).toBe(true);
    expect(yt1.target).toContain("https://www.youtube.com/results?search_query=funny%20dogs");

    const g1 = resolveLaunchTarget("google search for latest news");
    expect(g1.isUrl).toBe(true);
    expect(g1.target).toContain("https://www.google.com/search?q=latest%20news");

    const calc = resolveLaunchTarget("calculator");
    expect(calc.isUrl).toBe(false);
    expect(calc.target).toBe("calc");

    const notepad = resolveLaunchTarget("notepad");
    expect(notepad.isUrl).toBe(false);
    expect(notepad.target).toBe("notepad");

    const navYt = resolveLaunchTarget("navigate to youtube");
    expect(navYt.isUrl).toBe(true);
    expect(navYt.target).toBe("https://www.youtube.com");

    const goToGh = resolveLaunchTarget("go to github");
    expect(goToGh.isUrl).toBe(true);
    expect(goToGh.target).toBe("https://github.com");
  });

  it("should handle 'open youtube wait 2 seconds and take a screen shot' by waiting 2 seconds instead of searching for wait", async () => {
    const { resolveLaunchTarget } = await import("@/lib/cua-driver");
    const { parseDesktopCompoundInstruction } = await import("@/lib/autonomous-action-dispatcher");

    const parsed = parseDesktopCompoundInstruction("open youtube wait 2 seconds and take a screen shot");
    expect(parsed.isCompound).toBe(true);
    expect(parsed.target).toBe("youtube");
    expect(parsed.hasExplicitWait).toBe(true);
    expect(parsed.waitMs).toBe(2000);
    expect(parsed.hasScreenshot).toBe(true);

    const resolved = resolveLaunchTarget(parsed.target!);
    expect(resolved.isUrl).toBe(true);
    expect(resolved.target).toBe("https://www.youtube.com");
    expect(resolved.target).not.toContain("search_query");

    const result = await dispatchAutonomousAction("open youtube wait 2 seconds and take a screen shot");
    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("desktop_action");
    expect(result.metadata?.target).toBe("youtube");
    expect(result.metadata?.hasExplicitWait).toBe(true);
    expect(result.metadata?.waitTime).toBe(2000);
    expect(result.metadata?.hasScreenshot).toBe(true);
    expect(result.content).toContain("YouTube");
    expect(result.content).toContain("Waited 2000ms");
    expect(result.content).not.toContain("YouTube search for");
  });

  it("should resolve 'youtube wait 2 seconds' to YouTube homepage URL, not search results", async () => {
    const { resolveLaunchTarget } = await import("@/lib/cua-driver");
    const resolved = resolveLaunchTarget("youtube wait 2 seconds");
    expect(resolved.isUrl).toBe(true);
    expect(resolved.target).toBe("https://www.youtube.com");
    expect(resolved.target).not.toContain("search_query");
    expect(resolved.displayTitle).toBe("YouTube");
    expect(resolved.extractedWaitMs).toBe(2000);
  });

  it("should handle 'navigate to youtube' intent autonomously without Windows shell errors", async () => {
    const result = await dispatchAutonomousAction("navigate to youtube");
    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("desktop_action");
    expect(result.content).toContain("Autonomous Task Executed");
  });

  it("should handle 'take a screenshot form the destop operator page' as a desktop screenshot action", async () => {
    const result = await dispatchAutonomousAction("take a screenshot form the destop operator page");
    expect(result.handled).toBe(true);
    expect(result.actionType).toBe("desktop_action");
    expect(result.content).toContain("Desktop Screenshot Captured");

    const { executeAutonomousDesktopTask } = await import("@/lib/autonomous-desktop-loop");
    const loopResult = await executeAutonomousDesktopTask("take a screenshot form the destop operator page");
    expect(loopResult.success).toBe(true);
    expect(loopResult.finalScreenshotUrl).toBeDefined();
    expect(loopResult.stepsExecuted).toBeGreaterThanOrEqual(1);
  });

  it("should return handled: false for pure conversation, letting standard router take over", async () => {
    const result = await dispatchAutonomousAction("hello how are you doing today?");
    expect(result.handled).toBe(false);
  });

  it("should NOT intercept conversational questions containing file attachments as kanban tasks", async () => {
    const mockTask = {
      id: "task-bhutan",
      title: "Research Bhutan's Gross National Happiness Framework",
      status: "backlog",
      priority: "medium",
    };
    (prisma.task.findFirst as any).mockResolvedValue(mockTask);

    const promptWithAttachment =
      "can you tell me about this tesst\n\n--- File Attachment: completed test.htm (text/html) ---\n```\n<li class='task-item'>completed task on board</li>\n```";

    const result = await dispatchAutonomousAction(promptWithAttachment);

    expect(result.handled).toBe(false);
    expect(result.content).toBe("");
  });

  it("should return a clear notice and not execute random tasks when a specific task is not found", async () => {
    (prisma.task.findFirst as any).mockResolvedValue(null);

    const result = await dispatchAutonomousAction("execute task: NonExistentFeatureXYZ");

    expect(result.handled).toBe(true);
    expect(result.content).toContain("Kanban Execution Notice");
    expect(result.content).not.toContain("Research Bhutan");
  });
});
