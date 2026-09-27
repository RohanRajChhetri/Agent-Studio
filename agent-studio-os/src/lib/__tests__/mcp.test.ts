import { describe, it, expect, beforeEach } from "vitest";
import { mcpManager } from "../mcp/client-manager";
import path from "path";
import fs from "fs/promises";

describe("MCP Client Manager - Live Tool Execution", () => {
  const testDir = path.resolve(process.cwd(), "scratch", "mcp-test");
  const testFile = path.resolve(testDir, "sample.txt");

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(testFile, "Hello Agent Studio OS MCP", "utf-8");
  });

  it("should list available MCP servers and tools", () => {
    const servers = mcpManager.listServers();
    expect(servers.length).toBeGreaterThanOrEqual(3);

    const tools = mcpManager.listTools();
    expect(tools.length).toBeGreaterThanOrEqual(6);
    expect(tools.some((t) => t.name === "fs_read_file")).toBe(true);
    expect(tools.some((t) => t.name === "github_list_repos")).toBe(true);
    expect(tools.some((t) => t.name === "postgres_query")).toBe(true);
  });

  it("should successfully execute fs_read_file on existing file", async () => {
    const res = await mcpManager.executeTool("fs_read_file", { path: testFile });
    expect(res.isError).toBe(false);
    expect(res.content[0]?.text).toContain("Hello Agent Studio OS MCP");
  });

  it("should successfully execute fs_write_file and create new file", async () => {
    const newFile = path.resolve(testDir, "output.md");
    const res = await mcpManager.executeTool("fs_write_file", {
      path: newFile,
      content: "# Agent Generated Deliverable\nTask complete.",
    });

    expect(res.isError).toBe(false);
    expect(res.content[0]?.text).toContain("Successfully wrote");

    const content = await fs.readFile(newFile, "utf-8");
    expect(content).toContain("# Agent Generated Deliverable");
  });

  it("should prevent directory traversal outside allowed workspace root", async () => {
    const res = await mcpManager.executeTool("fs_read_file", {
      path: "../../../../../../../../../Windows/System32/drivers/etc/hosts",
    });

    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("Access denied");
  });

  it("should list directory contents with fs_list_directory", async () => {
    const res = await mcpManager.executeTool("fs_list_directory", { path: testDir });
    expect(res.isError).toBe(false);
    const text = res.content[0]?.text || "";
    expect(text).toContain("sample.txt");
  });

  it("should handle postgres_query read safety checks", async () => {
    const dropRes = await mcpManager.executeTool("postgres_query", {
      query: "DROP TABLE users;",
    });
    expect(dropRes.isError).toBe(true);
    expect(dropRes.content[0]?.text).toContain("Safety Guard");

    const selectRes = await mcpManager.executeTool("postgres_query", {
      query: "SELECT id, name FROM Agent;",
    });
    expect(selectRes.isError).toBe(false);
    expect(selectRes.content[0]?.text).toContain("Query validated");
  });

  it("should return error for unknown tool", async () => {
    const res = await mcpManager.executeTool("unknown_nonexistent_tool", {});
    expect(res.isError).toBe(true);
    expect(res.content[0]?.text).toContain("not found");
  });
});
