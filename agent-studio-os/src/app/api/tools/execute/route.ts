import { NextResponse } from "next/server";
import { executeCodeSandbox, performWebSearch } from "@/lib/tools-engine";
import { getAuthUserId } from "@/lib/user-auth";
import { validateToolActionSafety } from "@/lib/safety-guardrails";

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tool } = body;

    if (!tool) {
      return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
    }

    // Safety guardrail check
    const safety = validateToolActionSafety(tool, body);
    if (!safety.allowed) {
      return NextResponse.json(
        {
          error: "Action blocked by safety guardrails",
          reason: safety.reason,
          riskLevel: safety.riskLevel,
        },
        { status: 403 }
      );
    }

    if (tool === "code") {
      const { code, language = "javascript" } = body;
      if (!code) {
        return NextResponse.json({ error: "Code snippet is required" }, { status: 400 });
      }

      const result = await executeCodeSandbox(code, language);
      return NextResponse.json({
        success: result.success,
        tool: "code",
        result,
      });
    }

    if (tool === "search") {
      const { query, maxResults = 5 } = body;
      if (!query || !query.trim()) {
        return NextResponse.json({ error: "Search query is required" }, { status: 400 });
      }

      const result = await performWebSearch(query, maxResults);
      return NextResponse.json({
        success: true,
        tool: "search",
        result,
      });
    }

    if (tool === "export") {
      const { filename, content } = body;
      if (!filename || content === undefined) {
        return NextResponse.json({ error: "Filename and content required" }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        tool: "export",
        filename,
        size: Buffer.byteLength(content, "utf-8"),
      });
    }

    if (
      tool.startsWith("fs_") ||
      tool.startsWith("github_") ||
      tool.startsWith("postgres_") ||
      tool === "mcp"
    ) {
      const { mcpManager } = await import("@/lib/mcp/client-manager");
      const targetTool = tool === "mcp" ? body.toolName : tool;
      const toolArgs = body.args || body;
      const result = await mcpManager.executeTool(targetTool, toolArgs);
      return NextResponse.json({
        success: !result.isError,
        tool: targetTool,
        result,
      });
    }

    return NextResponse.json({ error: `Unsupported tool: ${tool}` }, { status: 400 });
  } catch (error) {
    console.error("[Tools Execute API] Error:", error);
    return NextResponse.json(
      {
        error: "Tool execution failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
