import { NextResponse } from "next/server";
import path from "path";
import { exec } from "child_process";
import fs from "fs/promises";
import { getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";
import { resolveSafeProjectPath, WORKSPACE_ROOT } from "@/lib/project-filesystem";

export async function POST(request: Request) {
  try {
    let userId = await getAuthUserId();
    if (!userId && process.env.NODE_ENV !== "production") {
      userId = PRIMARY_LEGACY_USER_ID;
    }
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectName, editor = "vscode" } = body;

    const cleanProjectName = (projectName || "workspace").trim();
    const relPath = `agent-workspace/${cleanProjectName}`;
    const { safePath } = resolveSafeProjectPath(relPath);

    // Ensure directory exists
    try {
      await fs.access(safePath);
    } catch {
      await fs.mkdir(safePath, { recursive: true });
    }

    // Windows / POSIX absolute path
    const normalizedPath = safePath.replace(/\\/g, "/");
    const windowsPath = safePath.replace(/\//g, "\\");

    let protocolUrl = `vscode://file/${normalizedPath}`;
    let executedCommand = "";

    if (editor === "cursor") {
      protocolUrl = `cursor://file/${normalizedPath}`;
      executedCommand = `cursor "${windowsPath}"`;
    } else if (editor === "explorer") {
      protocolUrl = "";
      executedCommand = `explorer "${windowsPath}"`;
    } else {
      // Default: VS Code
      protocolUrl = `vscode://file/${normalizedPath}`;
      executedCommand = `code "${windowsPath}"`;
    }

    let commandSuccess = false;
    let commandMessage = "";

    if (executedCommand) {
      try {
        await new Promise<void>((resolve, reject) => {
          exec(executedCommand, { timeout: 5000 }, (err) => {
            if (err) {
              console.warn(`[OpenIDE] CLI launch attempt ("${executedCommand}") notice:`, err.message);
              // Not fatal since protocol URL serves as reliable fallback in browser
              commandMessage = err.message;
              resolve();
            } else {
              commandSuccess = true;
              resolve();
            }
          });
        });
      } catch (err: any) {
        commandMessage = err.message || "CLI execution failed";
      }
    }

    return NextResponse.json({
      success: true,
      editor,
      projectName: cleanProjectName,
      path: safePath,
      protocolUrl,
      commandSuccess,
      commandMessage,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to open project in IDE" },
      { status: 500 }
    );
  }
}
