import { spawn } from "child_process";
import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import {
  createProjectFile,
  listProjectDirectory,
  type FileTreeNode,
} from "./project-filesystem";
import { extractProjectFiles, detectLanguageFromPath, type ExtractedProjectFile } from "./project-generator";

export interface ClaudeCodeBuildOptions {
  prompt: string;
  projectName: string;
  projectPath: string;
  targetFolder?: string;
  currentFilePath?: string;
  currentCode?: string;
  model?: string;
  timeoutMs?: number;
}

export interface ClaudeCodeBuildResult {
  success: boolean;
  response: string;
  createdFiles: ExtractedProjectFile[];
  primaryFile?: { path: string; content: string; language: string };
  projectTree: FileTreeNode[];
  model: string;
  latency: number;
  engine: "claude-code-cli";
  error?: string;
}

import os from "os";

/** Check if the native Claude Code binary exists on the host machine */
export function getClaudeBinaryPath(): string | null {
  const homeDir = os.homedir() || process.env.USERPROFILE || process.env.HOME || "";
  const isWin = process.platform === "win32";

  // Check custom override from env
  if (process.env.CLAUDE_BINARY_PATH && fsSync.existsSync(process.env.CLAUDE_BINARY_PATH)) {
    return process.env.CLAUDE_BINARY_PATH;
  }

  // 1. Check ~/.local/bin/claude (.exe on Windows)
  const localBin = path.join(
    homeDir,
    ".local",
    "bin",
    isWin ? "claude.exe" : "claude"
  );
  if (homeDir && fsSync.existsSync(localBin)) {
    return localBin;
  }

  // 2. Check Windows APPDATA npm global
  if (isWin && process.env.APPDATA) {
    const npmCmd = path.join(process.env.APPDATA, "npm", "claude.cmd");
    if (fsSync.existsSync(npmCmd)) {
      return npmCmd;
    }
  }

  // 3. Check Unix global npm path
  if (!isWin && homeDir) {
    const unixNpmBin = path.join(homeDir, ".npm-global", "bin", "claude");
    if (fsSync.existsSync(unixNpmBin)) {
      return unixNpmBin;
    }
  }

  return "claude";
}

export function isClaudeCodeAvailable(): boolean {
  try {
    const bin = getClaudeBinaryPath();
    return Boolean(bin && fsSync.existsSync(bin));
  } catch {
    return false;
  }
}

/**
 * Executes the native Anthropic Claude Code CLI autonomously inside the project's workspace folder.
 * Powered by local OmniRoute routing for ultra-smart code synthesis and tool execution.
 */
export async function runClaudeCodeProjectBuild(
  options: ClaudeCodeBuildOptions
): Promise<ClaudeCodeBuildResult> {
  const startTime = Date.now();
  const binary = getClaudeBinaryPath();
  if (!binary) {
    throw new Error("Claude Code CLI is not installed or available on this system.");
  }

  const projectDir = path.resolve(process.cwd(), options.projectPath);
  await fs.mkdir(projectDir, { recursive: true });

  // Snapshot existing files before execution
  const initialFiles = new Set<string>();
  try {
    const entries = await fs.readdir(projectDir, { recursive: true });
    for (const entry of entries) {
      if (typeof entry === "string") initialFiles.add(entry.replace(/\\/g, "/"));
    }
  } catch {}

  // Build high-context prompt for Claude Code
  const targetSubfolderInfo = options.targetFolder
    ? `\nTarget subfolder: "${options.targetFolder}"`
    : "";
  const currentFileInfo = options.currentFilePath
    ? `\nCurrent active file: "${options.currentFilePath}"`
    : "";

  const systemInstructions = `You are Claude Code, an autonomous Lead Full-Stack Software Architect operating inside this workspace directory.
Project Name: "${options.projectName}"${targetSubfolderInfo}${currentFileInfo}

Task: ${options.prompt}

MANDATORY INSTRUCTIONS:
1. Autonomously create, write, and refine all necessary project files (e.g. index.html, styles.css, app.js, components, README.md).
2. Use modern, beautiful design aesthetics: glassmorphism, responsive layout, polished typography (Inter/Outfit), fluid animations, and rich interactive features.
3. Every file must be 100% complete and fully implemented with NO placeholders, ellipses (...), or TODO comments.
4. In addition to creating the files directly, format each file in your final summary using tagged code blocks so they are crystal clear:
\`\`\`file:filename.ext
[complete code here]
\`\`\`
5. Provide an articulate architectural overview, list of features, and how to test.`;

  // Model selection: default to gemini/gemini-3.6-flash which provides rapid reasoning/thought tokens
  const selectedModel = options.model && !options.model.startsWith("auto/")
    ? options.model
    : "gemini/gemini-3.6-flash";

  const claudeArgs = [
    "--model",
    selectedModel,
    "-p",
    systemInstructions,
    "--dangerously-skip-permissions",
    "--output-format",
    "text",
  ];

  return new Promise<ClaudeCodeBuildResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const child = spawn(binary, claudeArgs, {
      cwd: projectDir,
      env: {
        ...process.env,
        ANTHROPIC_BASE_URL: process.env.OMNIROUTE_URL || "http://127.0.0.1:20128",
        ANTHROPIC_API_KEY: "dummy",
        CI: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeout = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        try {
          child.kill("SIGTERM");
        } catch {}
        reject(new Error(`Claude Code execution timed out after ${options.timeoutMs || 90000}ms`));
      }
    }, options.timeoutMs || 90000);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      if (!isSettled) {
        isSettled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on("close", async (code) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);

      try {
        // 1. Extract files from Claude's markdown output blocks
        const extractedFiles = extractProjectFiles(stdout, options.currentFilePath);

        // 2. Scan disk for any new or modified files created directly by Claude Code tools
        const diskFiles = new Map<string, string>();
        try {
          const allEntries = await fs.readdir(projectDir, { recursive: true, withFileTypes: true });
          for (const dirent of allEntries) {
            if (dirent.isFile()) {
              const fullFilePath = path.join(
                dirent.parentPath || projectDir,
                dirent.name
              );
              const rel = path
                .relative(projectDir, fullFilePath)
                .replace(/\\/g, "/");
              if (!rel.startsWith(".git") && !rel.startsWith("node_modules")) {
                const content = await fs.readFile(fullFilePath, "utf-8");
                diskFiles.set(rel, content);
              }
            }
          }
        } catch (scanErr) {
          console.warn("[ClaudeCodeRunner] Disk scan error:", scanErr);
        }

        // 3. Write extracted files to disk if not already written
        for (const file of extractedFiles) {
          const targetRel = file.path.replace(/^[/\\]+/, "");
          if (!diskFiles.has(targetRel)) {
            const fullTarget = path.join(projectDir, targetRel);
            await fs.mkdir(path.dirname(fullTarget), { recursive: true });
            await fs.writeFile(fullTarget, file.content, "utf-8");
            diskFiles.set(targetRel, file.content);
          }
        }

        // 4. Combine into final extracted files list
        const finalFiles: ExtractedProjectFile[] = [];
        for (const [relPath, content] of diskFiles.entries()) {
          finalFiles.push({
            path: relPath,
            content,
            language: detectLanguageFromPath(relPath),
            size: Buffer.byteLength(content, "utf-8"),
          });
        }

        // Pick primary file
        if (finalFiles.length > 0) {
          const primary =
            finalFiles.find(
              (f) => f.path === "index.html" || f.path.endsWith("/index.html")
            ) ||
            finalFiles.find((f) => f.path.includes("App.") || f.path.includes("page.")) ||
            finalFiles.find((f) => !f.path.toLowerCase().endsWith(".md")) ||
            finalFiles[0];

          primary.isPrimary = true;
        }

        // Refresh project file tree
        const projectTree = await listProjectDirectory(options.projectPath, true, 4);

        const primaryFile = finalFiles.find((f) => f.isPrimary) || finalFiles[0];

        // Clean response text: strip raw claude catalog warnings if present
        let cleanResponse = stdout.trim();
        cleanResponse = cleanResponse
          .replace(/^"[\w/-]+" isn't described by this version's model catalog[^\n]*\n?/gm, "")
          .replace(/^\[claude-code:[^\]]+\]\s*\{[^\n]+\}\n?/gm, "")
          .trim();

        if (!cleanResponse) {
          cleanResponse = `Claude Code successfully built **${finalFiles.length}** files in \`${options.projectName}\`.`;
        }

        resolve({
          success: true,
          response: cleanResponse,
          createdFiles: finalFiles,
          primaryFile: primaryFile
            ? {
                path: primaryFile.path,
                content: primaryFile.content,
                language: primaryFile.language,
              }
            : undefined,
          projectTree,
          model: `claude-code-cli (${selectedModel})`,
          latency: Date.now() - startTime,
          engine: "claude-code-cli",
        });
      } catch (postProcessErr: any) {
        reject(postProcessErr);
      }
    });
  });
}
