import { describe, it, expect, vi, afterAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import {
  parseToolCalls,
  parseFunctionArguments,
  persistGeneratedCsvFile,
  runAgenticLoop,
} from "../agentic-tool-loop";

// Mock executeChatCompletion
vi.mock("../llm-router", () => ({
  executeChatCompletion: vi.fn(),
}));

// Mock filesystem and document generator to prevent polluting disk during test runs
vi.mock("../project-filesystem", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../project-filesystem")>();
  return {
    ...actual,
    createProjectFile: vi.fn(async (targetPath: string, content: string) => ({
      success: true,
      path: targetPath,
      fullPath: `/mocked/${targetPath}`,
      size: Buffer.byteLength(content, "utf-8"),
      message: `File "${targetPath}" created successfully.`,
    })),
  };
});

vi.mock("../document-generator", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../document-generator")>();
  return {
    ...actual,
    saveDocumentFile: vi.fn(async (fileName: string, content: string) => ({
      fileName,
      fileUrl: `/downloads/${encodeURIComponent(fileName)}`,
      size: Buffer.byteLength(content, "utf-8"),
    })),
    listDownloadedFiles: vi.fn(async () => [
      { fileName: "sample.txt", fileUrl: "/downloads/sample.txt", size: 1024, createdAt: new Date().toISOString() },
    ]),
  };
});

import { executeChatCompletion } from "../llm-router";

describe("Agentic Tool Loop Parser", () => {
  it("parses Qwen / Hermes tool call token format with single tool", () => {
    const raw = "<|tool_call:start|>[web(query='FIFA World Cup 2026 foul statistics')]<|tool_call:end|>";
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("web");
    expect(parsed[0].args.query).toBe("FIFA World Cup 2026 foul statistics");
  });

  it("parses multiple tool calls inside brackets", () => {
    const raw = "<|tool_call:start|>[web(query='FIFA World Cup 2026 foul statistics per team by match data'), web(query='FIFA World Cup 2026 statistics fouls committed per team')]<|tool_call:end|>";
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("web");
    expect(parsed[0].args.query).toBe("FIFA World Cup 2026 foul statistics per team by match data");
    expect(parsed[1].name).toBe("web");
    expect(parsed[1].args.query).toBe("FIFA World Cup 2026 statistics fouls committed per team");
  });

  it("parses XML tool call format", () => {
    const raw = `<tool_call>{"name": "web", "arguments": {"query": "weather in London"}}</tool_call>`;
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("web");
    expect(parsed[0].args.query).toBe("weather in London");
  });

  it("parses file.create with dots, path, and multiline content with parentheses", () => {
    const raw = `<|tool_call:start|>file.create(content='# Darwin Jobs\\n\\n| # | Title | Coordinates (Lat, Lon) |\\n| 1 | Nurse | -12.3, 130.8 |\\n', path='Darwin Jobs October 2026.doc')<|tool_call_end|>`;
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("file.create");
    expect(parsed[0].args.path).toBe("Darwin Jobs October 2026.doc");
    expect(parsed[0].args.content).toContain("# Darwin Jobs");
    expect(parsed[0].args.content).toContain("Coordinates (Lat, Lon)");
  });

  it("parses XML tag attributes format (e.g. <desktopaction actiontype='launch' target='https://www.youtube.com'/> and <desktop_screenshot/>)", () => {
    const raw = `<desktopaction actiontype="launch" target="https://www.youtube.com"/>\n\n<desktop_screenshot/>`;
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("desktop_action");
    expect(parsed[0].args.action_type).toBe("launch");
    expect(parsed[0].args.target).toBe("https://www.youtube.com");
    expect(parsed[1].name).toBe("desktop_screenshot");
  });

  it("parses multiple sequential tool calls in content", () => {
    const raw = `I will launch YouTube and capture the desktop screen:\ndesktop_action(action_type="launch", target="https://youtube.com")\ndesktop_screenshot()`;
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("desktop_action");
    expect(parsed[0].args.target).toBe("https://youtube.com");
    expect(parsed[1].name).toBe("desktop_screenshot");
  });

  it("parses nested XML tags", () => {
    const raw = `<desktop_action><action_type>launch</action_type><target>https://youtube.com</target></desktop_action>`;
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("desktop_action");
    expect(parsed[0].args.action_type).toBe("launch");
    expect(parsed[0].args.target).toBe("https://youtube.com");
  });

  it("safely handles text without tool calls", () => {
    const raw = "Here is the data you requested without any tool calls.";
    const parsed = parseToolCalls(raw);
    expect(parsed).toHaveLength(0);
  });
});

describe("Function Arguments Parser", () => {
  it("extracts single quote arguments", () => {
    const res = parseFunctionArguments("query='test query', limit=10");
    expect(res.query).toBe("test query");
    expect(res.limit).toBe("10");
  });

  it("extracts double quote arguments", () => {
    const res = parseFunctionArguments('code="console.log(42)", language="javascript"');
    expect(res.code).toBe("console.log(42)");
    expect(res.language).toBe("javascript");
  });

  it("fallbacks to whole string as query when no equals sign", () => {
    const res = parseFunctionArguments("'hello world'");
    expect(res.query).toBe("hello world");
  });
});

describe("CSV Generation & Persistence", () => {
  it("extracts CSV block and returns download URL", async () => {
    const sampleCsv = "```csv\nMatch,Team,Fouls\n1,USA,12\n2,Canada,14\n```";
    const res = await persistGeneratedCsvFile(sampleCsv, "test_fouls.csv");
    expect(res).not.toBeNull();
    expect(res?.fileUrl).toBe("/downloads/test_fouls.csv");
    expect(res?.rowCount).toBe(3);
  });
});

describe("runAgenticLoop multi-step execution", () => {
  it("iterates on tool call and produces multiple outputs", async () => {
    // Turn 1 returns tool call
    // Turn 2 returns final response with data
    const mockedExecute = vi.mocked(executeChatCompletion);
    mockedExecute
      .mockResolvedValueOnce({
        content: "<|tool_call:start|>[web(query='world cup 2026 fouls')]<|tool_call:end|>",
        latency: 120,
        modelUsed: "auto/fast",
        source: "omniroute",
      })
      .mockResolvedValueOnce({
        content: "### Analysis Complete\n\nHere are the 208 match records and statistics.",
        latency: 150,
        modelUsed: "auto/fast",
        source: "omniroute",
      });

    const result = await runAgenticLoop({
      prompt: "give me data about world cup fouls and make a csv file",
      model: "auto/fast",
    });

    expect(result.toolsExecuted).toContain("web");
    expect(result.outputs.length).toBeGreaterThan(1);
    expect(result.outputs.some((o) => o.type === "tool_execution")).toBe(true);
    expect(result.outputs.some((o) => o.type === "final_response")).toBe(true);
  });

  it("handles terminal tool by inspecting download vault safely", async () => {
    const mockedExecute = vi.mocked(executeChatCompletion);
    mockedExecute
      .mockResolvedValueOnce({
        content: "<|tool_call:start|>[terminal()]<|tool_call:end|>",
        latency: 100,
        modelUsed: "auto/fast",
        source: "omniroute",
      })
      .mockResolvedValueOnce({
        content: "I checked the workspace download vault. Your file is available.",
        latency: 120,
        modelUsed: "auto/fast",
        source: "omniroute",
      });

    const result = await runAgenticLoop({
      prompt: "i cant find that file",
      model: "auto/fast",
    });

    expect(result.toolsExecuted).toContain("terminal");
    expect(result.outputs.some((o) => o.type === "tool_execution")).toBe(true);
    expect(result.outputs.some((o) => o.content.includes("download"))).toBe(true);
  });

  it("handles file creation tools and attaches deliverable download card", async () => {
    const mockedExecute = vi.mocked(executeChatCompletion);
    mockedExecute
      .mockResolvedValueOnce({
        content: "<|tool_call:start|>[file(filename='test_essays.pdf', content='# Dog, Bhutan, and Cat Essays\\n\\nHere are the essays.')]<|tool_call:end|>",
        latency: 100,
        modelUsed: "auto/fast",
        source: "omniroute",
      })
      .mockResolvedValueOnce({
        content: "I have created the PDF file with the essays.",
        latency: 120,
        modelUsed: "auto/fast",
        source: "omniroute",
      });

    const result = await runAgenticLoop({
      prompt: "can you give me those essay in pdf file",
      model: "auto/fast",
    });

    expect(result.toolsExecuted).toContain("file");
    expect(result.outputs.some((o) => o.type === "data_deliverable")).toBe(true);
    expect(result.outputs.some((o) => o.content.includes("test_essays.pdf"))).toBe(true);
  });

  afterAll(async () => {
    const root = process.cwd();
    const filesToDelete = [
      path.join(root, "test_essays.pdf"),
      path.join(root, "agent-workspace", "test_essays.pdf"),
      path.join(root, "public", "downloads", "test_essays.pdf"),
      path.join(root, "public", "downloads", "test_fouls.csv"),
      path.join(root, "public", "downloads", "give_me_those_essay_in.pdf"),
      path.join(root, "public", "downloads", "give_me_data_about_world.csv"),
    ];
    for (const f of filesToDelete) {
      try {
        await fs.unlink(f);
      } catch {}
    }
  });
});


