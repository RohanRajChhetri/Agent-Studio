import { NextResponse } from "next/server";
import { executeCodeSandbox, performWebSearch } from "@/lib/tools-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { tool } = body;

    if (!tool) {
      return NextResponse.json({ error: "Tool name is required" }, { status: 400 });
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
