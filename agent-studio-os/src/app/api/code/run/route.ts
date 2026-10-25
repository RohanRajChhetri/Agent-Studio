import { NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { getAuthUserId, PRIMARY_LEGACY_USER_ID } from "@/lib/user-auth";

const execAsync = promisify(exec);

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
    const { projectName = "default-project", filePath, command: customCommand } = body;

    if (!filePath || typeof filePath !== "string") {
      return NextResponse.json({ error: "filePath is required" }, { status: 400 });
    }

    // Path sanitization
    const cleanRel = filePath.replace(/^[/\\]+/, "").replace(/\\/g, "/");
    if (cleanRel.includes("..")) {
      return NextResponse.json({ error: "Invalid file path traversal" }, { status: 400 });
    }

    const projectCwd = path.join(process.cwd(), "agent-workspace", projectName);
    await fs.mkdir(projectCwd, { recursive: true });
    const targetFullPath = path.join(projectCwd, cleanRel);

    // Verify file exists
    try {
      await fs.access(targetFullPath);
    } catch {
      return NextResponse.json({ error: `File not found: ${cleanRel}` }, { status: 404 });
    }

    const ext = path.extname(cleanRel).toLowerCase();
    let runCommand = customCommand;

    if (!runCommand) {
      if (ext === ".py") {
        const venvPy = path.join(process.cwd(), "..", ".venv", "Scripts", "python.exe");
        const pyExec = fsSync.existsSync(venvPy) ? `"${venvPy}"` : "python";
        runCommand = `${pyExec} "${cleanRel}"`;
      } else if (ext === ".js" || ext === ".mjs" || ext === ".cjs") {
        runCommand = `node "${cleanRel}"`;
      } else if (ext === ".ts" || ext === ".tsx") {
        runCommand = `npx tsx "${cleanRel}"`;
      } else if (ext === ".sh") {
        runCommand = `bash "${cleanRel}"`;
      } else {
        return NextResponse.json(
          { error: `Direct execution not supported for file type "${ext}". Use an interactive browser preview or terminal.` },
          { status: 400 }
        );
      }
    }

    const startTime = Date.now();
    try {
      const { stdout, stderr } = await execAsync(runCommand, {
        cwd: projectCwd,
        timeout: 25000,
        maxBuffer: 1024 * 1024 * 5, // 5MB buffer
        windowsHide: true,
      });

      return NextResponse.json({
        success: true,
        stdout: stdout || "",
        stderr: stderr || "",
        exitCode: 0,
        latency: Date.now() - startTime,
        command: runCommand,
      });
    } catch (execErr: any) {
      return NextResponse.json({
        success: false,
        stdout: execErr.stdout || "",
        stderr: execErr.stderr || execErr.message || "Execution error",
        exitCode: execErr.code ?? 1,
        latency: Date.now() - startTime,
        command: runCommand,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to execute script" }, { status: 500 });
  }
}
