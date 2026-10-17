import { describe, it, expect, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ alive: 1 }]),
  },
  default: {
    $queryRaw: vi.fn().mockResolvedValue([{ alive: 1 }]),
  },
}));

vi.mock("@/lib/router-execution", () => ({
  getActiveApiKeys: vi.fn().mockResolvedValue({
    GEMINI_API_KEY: "test-gemini-key",
  }),
}));

describe("GET /api/health", () => {
  it("should return 200 with healthy status and detailed diagnostics", async () => {
    const response = await GET();
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.status).toBe("healthy");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.storage.status).toBe("ok");
    expect(body.checks.providers.gemini).toBe(true);
    expect(body.checks.system.nodeVersion).toBeDefined();
    expect(body.checks.eventBus).toBeDefined();
  });
});
