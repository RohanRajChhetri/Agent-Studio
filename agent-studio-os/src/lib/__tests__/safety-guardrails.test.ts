import { describe, it, expect } from "vitest";
import { validateToolActionSafety } from "../safety-guardrails";

describe("Safety Guardrails Engine", () => {
  it("allows safe read-only tools unconditionally", () => {
    const result = validateToolActionSafety("search", { query: "latest AI news" });
    expect(result.allowed).toBe(true);
    expect(result.requiresApproval).toBe(false);
    expect(result.riskLevel).toBe("low");
  });

  it("allows document generation and reading in workspace", () => {
    const result = validateToolActionSafety("read_file", { path: "src/index.ts" });
    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe("low");

    const writeResult = validateToolActionSafety("write_file", {
      path: "notes/summary.md",
      content: "Hello",
    });
    expect(writeResult.allowed).toBe(true);
    expect(writeResult.riskLevel).toBe("medium");
  });

  it("blocks attempts to read or overwrite sensitive environment files", () => {
    const dotEnvCheck = validateToolActionSafety("read_file", { path: ".env" });
    expect(dotEnvCheck.allowed).toBe(false);
    expect(dotEnvCheck.riskLevel).toBe("critical");
    expect(dotEnvCheck.reason).toContain("blocked by security guardrails");

    const localEnvCheck = validateToolActionSafety("write_file", { path: ".env.local" });
    expect(localEnvCheck.allowed).toBe(false);
    expect(localEnvCheck.riskLevel).toBe("critical");
  });

  it("blocks path traversal and root system directory access", () => {
    const traversal = validateToolActionSafety("read_file", {
      path: "../../Windows/System32/config",
    });
    expect(traversal.allowed).toBe(false);
    expect(traversal.riskLevel).toBe("critical");
    expect(traversal.reason).toContain("Path traversal or system directory escape");
  });

  it("blocks destructive shell commands", () => {
    const rmRf = validateToolActionSafety("shell", { command: "rm -rf /" });
    expect(rmRf.allowed).toBe(false);
    expect(rmRf.riskLevel).toBe("critical");

    const dropTable = validateToolActionSafety("code", {
      code: "DROP TABLE users;",
    });
    expect(dropTable.allowed).toBe(false);
    expect(dropTable.riskLevel).toBe("critical");
  });

  it("flags elevated tools when approval is required", () => {
    const webhookCheck = validateToolActionSafety(
      "webhook",
      { url: "https://api.external.com/send" },
      { allowHighRiskWithApproval: true }
    );
    expect(webhookCheck.requiresApproval).toBe(true);
    expect(webhookCheck.riskLevel).toBe("high");
  });

  it("respects explicit user approval override", () => {
    const approved = validateToolActionSafety(
      "webhook",
      { url: "https://api.external.com/send" },
      { isUserExplicitlyApproved: true }
    );
    expect(approved.allowed).toBe(true);
    expect(approved.requiresApproval).toBe(false);
  });
});
