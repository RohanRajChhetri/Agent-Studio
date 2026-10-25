import path from "path";
import fs from "fs/promises";
import {
  createProjectFile,
  createProjectFolder,
  listProjectDirectory,
  type FileTreeNode,
} from "./project-filesystem";
import { executeChatCompletion, normalizeModelName } from "./llm-router";
import { parseToolCalls } from "./agentic-tool-loop";
import {
  runClaudeCodeProjectBuild,
  isClaudeCodeAvailable,
} from "./claude-code-runner";

export interface ExtractedProjectFile {
  path: string;
  content: string;
  language: string;
  size: number;
  isPrimary?: boolean;
}

/** Detect programming language from file extension */
export function detectLanguageFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const map: Record<string, string> = {
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    markdown: "markdown",
    py: "python",
    sql: "sql",
    sh: "bash",
    bash: "bash",
    yaml: "yaml",
    yml: "yaml",
    rs: "rust",
    go: "go",
  };
  return map[ext] || "text";
}

/** Sanitize relative path inside a project */
export function sanitizeProjectRelativePath(rawPath: string): string {
  let clean = rawPath.trim().replace(/^[/\\]+/, "").replace(/\\/g, "/");
  // Remove agent-workspace/[project-name]/ if already prepended by LLM
  clean = clean.replace(/^agent-workspace\/[^/]+\//, "");
  // Remove backticks or quotes
  clean = clean.replace(/^[`'"]+|[`'"]+$/g, "");
  // Remove trailing colons or punctuation
  clean = clean.replace(/[:.]+$/, (m) => (m === ":" ? "" : m));
  return clean.trim();
}

/**
 * Robust extractor for all file formats emitted by LLMs (Hermes/Qwen tool calls,
 * tagged code blocks, header-preceded blocks, inline comments).
 */
export function extractProjectFiles(
  text: string,
  defaultFallbackPath?: string
): ExtractedProjectFile[] {
  const files: ExtractedProjectFile[] = [];
  const seenPaths = new Set<string>();

  if (!text || typeof text !== "string") return files;

  const addFile = (relPath: string, rawContent: string) => {
    const cleanPath = sanitizeProjectRelativePath(relPath);
    if (!cleanPath || cleanPath.includes("..") || seenPaths.has(cleanPath)) return;
    // Don't treat generic words without extensions as files unless typical (e.g. Dockerfile)
    const hasExt = path.extname(cleanPath).length > 1;
    const isSpecialFile = /^(dockerfile|makefile|procfile|\.gitignore|\.env)$/i.test(path.basename(cleanPath));
    if (!hasExt && !isSpecialFile) return;

    seenPaths.add(cleanPath);
    const content = rawContent.trimEnd() + "\n";
    files.push({
      path: cleanPath,
      content,
      language: detectLanguageFromPath(cleanPath),
      size: Buffer.byteLength(content, "utf-8"),
    });
  };

  // 1. Tool calls extraction: [create_file(path="...", content="...")] or <tool_call>
  const toolCalls = parseToolCalls(text);
  for (const tc of toolCalls) {
    if (
      tc.name === "create_file" ||
      tc.name === "write_file" ||
      tc.name === "save_file" ||
      tc.name === "create_doc" ||
      tc.name === "create_pdf"
    ) {
      const p = tc.args.path || tc.args.filename || tc.args.file;
      const c = tc.args.content || tc.args.text || tc.args.data || "";
      if (p && c) {
        addFile(p, c);
      }
    }
  }

  // 2. Format: ```file:path/to/file.ext or ```javascript:src/app.js or ```html:index.html
  const fileBlockRegex = /```(?:file:|[\w-]+:)([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = fileBlockRegex.exec(text)) !== null) {
    addFile(match[1], match[2]);
  }

  // 3. Format: ```html index.html or ```typescript src/index.ts
  const spaceBlockRegex = /```[a-zA-Z0-9_-]+\s+([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)\n([\s\S]*?)```/g;
  while ((match = spaceBlockRegex.exec(text)) !== null) {
    addFile(match[1], match[2]);
  }

  // 4. Format: ### File: `path/to/file.ext` or ### `path/to/file.ext` or **path/to/file.ext**:
  const headerFileRegex =
    /(?:###?\s*(?:File:\s*|Filename:\s*)?`?([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)`?|\*\*([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)\*\*:?)\s*[\r\n]+(?:[^\n`]*[\r\n]+)?```(?:\w+)?\n([\s\S]*?)```/g;
  while ((match = headerFileRegex.exec(text)) !== null) {
    const rawPath = match[1] || match[2];
    const content = match[3];
    if (rawPath && content) {
      addFile(rawPath, content);
    }
  }

  // 5. In-block comments: <!-- index.html --> or // app.js or /* styles.css */ or # main.py
  const commentFileRegex =
    /```(?:\w+)?\n(?:\s*(?:<!--|\/\/|\/\*|#)\s*([a-zA-Z0-9_./\\-]+\.[a-zA-Z0-9]+)\s*(?:-->|\*\/)?[\r\n]+)([\s\S]*?)```/g;
  while ((match = commentFileRegex.exec(text)) !== null) {
    const rawPath = match[1];
    const content = match[2];
    if (rawPath && content) {
      addFile(rawPath, content);
    }
  }

  // 6. Intelligent Fallback: If only 1 code block was produced and no files parsed yet
  if (files.length === 0) {
    const singleCodeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (singleCodeMatch && singleCodeMatch[1].trim().length > 0) {
      const codeSnippet = singleCodeMatch[1].trim();

      let inferredPath = defaultFallbackPath || "index.html";
      // Heuristic detection based on content
      if (codeSnippet.includes("<!DOCTYPE html") || codeSnippet.includes("<html")) {
        inferredPath = "index.html";
      } else if (
        (codeSnippet.includes("{") && codeSnippet.includes("margin:") && codeSnippet.includes("padding:")) ||
        codeSnippet.includes(":root {") ||
        codeSnippet.includes("@media")
      ) {
        inferredPath = "styles.css";
      } else if (codeSnippet.startsWith("{") && codeSnippet.includes('"name":')) {
        inferredPath = "package.json";
      } else if (
        codeSnippet.includes("function") ||
        codeSnippet.includes("const ") ||
        codeSnippet.includes("document.") ||
        codeSnippet.includes("window.")
      ) {
        inferredPath = "app.js";
      } else if (codeSnippet.startsWith("# ") || codeSnippet.includes("## Overview")) {
        inferredPath = "README.md";
      }

      addFile(inferredPath, codeSnippet);
    }
  }

  // Pick primary file: prioritize index.html, App.tsx, index.js, or first non-readme file
  if (files.length > 0) {
    const primary =
      files.find((f) => f.path === "index.html" || f.path.endsWith("/index.html")) ||
      files.find((f) => f.path.includes("App.") || f.path.includes("page.")) ||
      files.find((f) => !f.path.toLowerCase().endsWith(".md")) ||
      files[0];

    primary.isPrimary = true;
  }

  return files;
}

/**
 * Builds a comprehensive, multi-file project inside a workspace project folder.
 */
export async function buildProjectWithAgent(params: {
  prompt: string;
  projectName?: string;
  projectPath?: string;
  targetFolder?: string;
  currentFilePath?: string;
  currentCode?: string;
  model?: string;
  engine?: "claude-code" | "cloud-architect" | "auto";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<{
  success: boolean;
  response: string;
  createdFiles: ExtractedProjectFile[];
  primaryFile?: { path: string; content: string; language: string };
  projectTree: FileTreeNode[];
  model: string;
  latency: number;
  engine?: string;
}> {
  const startTime = Date.now();
  const projectName = (params.projectName || "default-project").trim();
  const projectBasePath = params.projectPath || `agent-workspace/${projectName}`;

  // Ensure workspace project folder exists
  await createProjectFolder(projectBasePath);

  // 1. First-class: Execute Native Anthropic Claude Code CLI if available and not explicitly disabled
  if (params.engine !== "cloud-architect" && isClaudeCodeAvailable()) {
    try {
      console.log(`[ProjectGenerator] Invoking Claude Code CLI for project "${projectName}"...`);
      const claudeResult = await runClaudeCodeProjectBuild({
        prompt: params.prompt,
        projectName,
        projectPath: projectBasePath,
        targetFolder: params.targetFolder,
        currentFilePath: params.currentFilePath,
        currentCode: params.currentCode,
        model: params.model,
        timeoutMs: 90000,
      });

      if (claudeResult.success && claudeResult.createdFiles.length > 0) {
        return claudeResult;
      }
    } catch (claudeErr: any) {
      console.warn(
        "[ProjectGenerator] Claude Code CLI run error, engaging Cloud Architect fallback:",
        claudeErr.message
      );
    }
  }

  // 2. High-Intelligence Cloud Architect Fallback Engine (Gemini 3.6 Thinking / OpenRouter / Anthropic)
  const existingTree = await listProjectDirectory(projectBasePath, true, 4);
  const flattenPaths = (nodes: FileTreeNode[]): string[] => {
    const paths: string[] = [];
    for (const n of nodes) {
      const rel = n.path.startsWith(projectBasePath)
        ? n.path.slice(projectBasePath.length).replace(/^[/\\]+/, "")
        : n.path;
      if (!n.isDirectory) paths.push(rel);
      if (n.children) paths.push(...flattenPaths(n.children));
    }
    return paths;
  };
  const existingFiles = flattenPaths(existingTree);

  // Read contents of existing project files to give the LLM 100% full context of the project
  const projectFileSnippets: string[] = [];
  for (const relPath of existingFiles.slice(0, 15)) {
    try {
      const fullFilePath = path.join(process.cwd(), projectBasePath, relPath);
      const stats = await fs.stat(fullFilePath);
      const ext = path.extname(relPath).toLowerCase();
      const isBinary = [".png", ".jpg", ".jpeg", ".gif", ".ico", ".webp", ".zip", ".tar", ".gz"].includes(ext);
      if (!isBinary && stats.size < 35000) {
        const content = await fs.readFile(fullFilePath, "utf-8");
        projectFileSnippets.push(`--- FILE: "${relPath}" ---\n${content}\n`);
      } else if (!isBinary) {
        projectFileSnippets.push(`--- FILE: "${relPath}" (${(stats.size / 1024).toFixed(1)} KB) ---`);
      }
    } catch {
      // Ignore unreadable files
    }
  }

  // Target subfolder guidance
  const folderScope = params.targetFolder ? `\nTarget Subfolder to add files: "${params.targetFolder}"` : "";

  // Prepare elite Claude-grade system prompt with complete project context
  const systemPrompt = `You are an elite Lead Software Architect & Autonomous Project Builder in Agent Studio OS.
You specialize in designing, creating, and completely implementing entire multi-file software projects, web applications, components, tools, and scripts.

WORKING PROJECT FOLDER: "${projectName}" (${projectBasePath})${folderScope}
EXISTING FILES IN THIS PROJECT (${existingFiles.length} files):
${existingFiles.length > 0 ? existingFiles.map((f) => `- ${f}`).join("\n") : "(Empty project folder)"}

${projectFileSnippets.length > 0 ? `CURRENT PROJECT FILE CONTENTS:\n${projectFileSnippets.join("\n")}\n` : ""}

ACTIVE FILE OPEN IN EDITOR: "${params.currentFilePath || "index.html"}"
${params.currentCode ? `ACTIVE FILE CURRENT CODE:\n\`\`\`${detectLanguageFromPath(params.currentFilePath || "index.html")}\n${params.currentCode}\n\`\`\`` : ""}

AUTONOMOUS PROJECT BUILDER DIRECTIVES:
1. FULL IMPLEMENTATIONS ONLY: Always output 100% complete, fully implemented, runnable production code. NEVER use placeholders like "// TODO", "// implement here", or truncate any section.
2. INTELLIGENT PROJECT EDITING & REVISIONS:
   - When updating or adding features to an existing project, preserve working architecture and conventions.
   - Output the complete content for every file you create or modify.
   - Do NOT emit files that do not require any changes. Any file you do not emit will remain untouched on disk.
3. MULTI-RUNTIME & STACK SUPPORT:
   - Web Applications (HTML/CSS/JS): Modern semantic HTML5, beautiful responsive styling (Tailwind CSS or clean CSS variables), rich micro-interactions, robust logic, and interactive state management.
   - React / TypeScript Apps: If asked for React or components, write clean, self-contained, modern React code (hooks, modular components).
   - Python Scripts & Automation: Provide complete, runnable Python code with clear entrypoints (\`if __name__ == "__main__":\`), error handling, and helpful terminal feedback.
   - Node.js APIs & Tools: Provide clean, idiomatic Node.js or Express code with structured routes and clear error handling.
4. MULTI-FILE CODE BLOCKS FORMAT:
   For EVERY file you create or update, format it with a clear header and tagged code block:
   \`\`\`file:path/to/file.ext
   [Complete production-ready code]
   \`\`\`
   Example:
   \`\`\`file:index.html
   <!DOCTYPE html>
   ...
   \`\`\`
   \`\`\`file:styles.css
   ...
   \`\`\`
   \`\`\`file:app.js
   ...
   \`\`\`
   \`\`\`file:main.py
   ...
   \`\`\`
   \`\`\`file:README.md
   ...
   \`\`\`
5. ARTICULATE ARCHITECTURE BREAKDOWN:
   Provide an articulate, highly thorough explanation including:
   - 🚀 **Architecture & Features**: Summary of what was created or upgraded.
   - 📁 **Files Modified/Created**: Breakdown of each file's purpose and how they connect.
   - 🎯 **How to Run & Test**: Clear, actionable instructions.`;

  const modelToUse = normalizeModelName(params.model || "auto/best-coding");

  // Call completion engine
  const completion = await executeChatCompletion({
    prompt: params.prompt,
    history: params.history as any,
    model: modelToUse,
    systemPrompt,
    agentName: "Autonomous Project Architect",
    useVaultRAG: false,
    useEpisodicMemory: false,
  });

  const rawResponse = completion.content || "";

  // Extract all files from the AI response
  const extractedFiles = extractProjectFiles(rawResponse, params.currentFilePath);

  // Write all extracted files directly to disk in the project folder
  for (const file of extractedFiles) {
    const fullRelativePath = `${projectBasePath}/${file.path.replace(/^[/\\]+/, "")}`;
    await createProjectFile(fullRelativePath, file.content, { overwrite: true });
  }

  // Refresh project file tree
  const updatedTree = await listProjectDirectory(projectBasePath, true, 4);

  // Primary file to open in editor
  const primary = extractedFiles.find((f) => f.isPrimary) || extractedFiles[0];

  return {
    success: true,
    response: rawResponse,
    createdFiles: extractedFiles,
    primaryFile: primary
      ? { path: primary.path, content: primary.content, language: primary.language }
      : undefined,
    projectTree: updatedTree,
    model: completion.modelUsed || modelToUse,
    latency: Date.now() - startTime,
  };
}
