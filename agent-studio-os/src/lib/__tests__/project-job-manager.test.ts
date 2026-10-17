import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startProjectBuildJob,
  getProjectBuildJob,
  getLatestProjectBuildJob,
} from "../project-job-manager";

// Mock buildProjectWithAgent
vi.mock("../project-generator", () => ({
  buildProjectWithAgent: vi.fn().mockImplementation(async (params: any) => {
    return {
      success: true,
      response: "Built mock project successfully",
      createdFiles: [
        { path: "index.html", content: "<h1>Hello</h1>", language: "html", size: 20 },
      ],
      primaryFile: { path: "index.html", content: "<h1>Hello</h1>", language: "html" },
      projectTree: [],
      model: "test-model",
      latency: 50,
    };
  }),
}));

describe("ProjectJobManager", () => {
  it("starts a background build job and tracks its status", async () => {
    const { job, promise } = startProjectBuildJob({
      userId: "user-123",
      projectName: "test-weather-app",
      prompt: "Build a weather app",
    });

    expect(job.id).toBeDefined();
    expect(job.status).toBe("running");
    expect(job.projectName).toBe("test-weather-app");

    // Can retrieve by ID
    const retrieved = getProjectBuildJob(job.id);
    expect(retrieved?.id).toBe(job.id);

    // Wait for background completion
    const completed = await promise;
    expect(completed.status).toBe("completed");
    expect(completed.result?.success).toBe(true);
    expect(completed.result?.createdFiles.length).toBe(1);

    // Latest job query finds it
    const latest = getLatestProjectBuildJob("user-123", "test-weather-app");
    expect(latest?.id).toBe(job.id);
    expect(latest?.status).toBe("completed");
  });
});
