import fs from "fs/promises";
import path from "path";
import JSZip from "jszip";

import { generateSimplePdf } from "./document-generator";

/**
 * Root directory of the project.
 * Restricts all filesystem operations within the project workspace.
 */
export const PROJECT_ROOT = process.cwd();
export const WORKSPACE_ROOT = path.join(PROJECT_ROOT, "agent-workspace");

const BLOCKED_PATTERNS = [
  /^\.env/i,
  /\/\.env/i,
  /\\\.env/i,
  /\.sqlite/i,
  /\.db($|\/|\\)/i,
  /(^|[/\\])\.git($|[/\\])/i,
  /(^|[/\\])node_modules($|[/\\])/i,
  /(^|[/\\])prisma($|[/\\])/i,
  /(^|[/\\])\.next($|[/\\])/i,
  /(^|[/\\])package(-lock)?\.json$/i,
  /(^|[/\\])tsconfig\.json$/i,
  /\.pem$/i,
  /\.key$/i,
];

export function isPathBlocked(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, "/");
  return BLOCKED_PATTERNS.some((pattern) => pattern.test(normalized));
}

/**
 * Validates and resolves a path safely within the project root.
 * Prevents directory traversal attacks (e.g., ../../) and blocks sensitive files.
 */
export function resolveSafeProjectPath(targetPath: string): {
  safePath: string;
  relativePath: string;
} {
  // Normalize slashes
  const cleanPath = targetPath.replace(/^[/\\]+/, "").trim();
  const resolved = path.resolve(PROJECT_ROOT, cleanPath);

  // Security check: ensure resolved path is within PROJECT_ROOT
  if (!resolved.startsWith(PROJECT_ROOT)) {
    throw new Error(`Security violation: Access outside project directory denied for path "${targetPath}"`);
  }

  const relative = path.relative(PROJECT_ROOT, resolved).replace(/\\/g, "/");

  // Security check: block access to sensitive files and system secrets
  if (isPathBlocked(relative)) {
    throw new Error(`Security violation: Access to sensitive system path denied for "${relative}"`);
  }

  return { safePath: resolved, relativePath: relative || "." };
}

/**
 * Create a new folder anywhere throughout the project.
 */
export async function createProjectFolder(targetPath: string): Promise<{
  success: boolean;
  path: string;
  fullPath: string;
  message: string;
}> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);
  await fs.mkdir(safePath, { recursive: true });
  return {
    success: true,
    path: relativePath,
    fullPath: safePath,
    message: `Folder "${relativePath}" created successfully.`,
  };
}

/**
 * Create or write a file anywhere throughout the project.
 * Automatically creates parent directories if they don't exist.
 * Automatically compiles binary PDFs or styled Word documents when applicable.
 */
export async function createProjectFile(
  targetPath: string,
  content: string,
  options: { overwrite?: boolean } = { overwrite: true }
): Promise<{
  success: boolean;
  path: string;
  fullPath: string;
  size: number;
  message: string;
}> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);

  // Ensure parent directory exists
  const parentDir = path.dirname(safePath);
  await fs.mkdir(parentDir, { recursive: true });

  if (!options.overwrite) {
    try {
      await fs.access(safePath);
      throw new Error(`File "${relativePath}" already exists and overwrite is set to false.`);
    } catch (err: unknown) {
      if ((err as { code?: string })?.code !== "ENOENT") throw err;
    }
  }

  // Compile real binary PDF if filename ends with .pdf and content is not already binary
  if (safePath.toLowerCase().endsWith(".pdf") && !content.startsWith("%PDF-")) {
    const pdfBuf = generateSimplePdf(path.basename(safePath, ".pdf"), content);
    await fs.writeFile(safePath, pdfBuf);
  } else {
    await fs.writeFile(safePath, content, "utf-8");
  }

  const stats = await fs.stat(safePath);

  return {
    success: true,
    path: relativePath,
    fullPath: safePath,
    size: stats.size,
    message: `File "${relativePath}" created successfully (${stats.size} bytes).`,
  };
}

/**
 * Read content of a file in the project.
 */
export async function readProjectFile(targetPath: string): Promise<{
  success: boolean;
  path: string;
  content: string;
  size: number;
}> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);
  const content = await fs.readFile(safePath, "utf-8");
  const stats = await fs.stat(safePath);

  return {
    success: true,
    path: relativePath,
    content,
    size: stats.size,
  };
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  children?: FileTreeNode[];
}

/**
 * List files and directories at a target path.
 */
export async function listProjectDirectory(
  targetPath = "",
  recursive = false,
  maxDepth = 3,
  currentDepth = 0
): Promise<FileTreeNode[]> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);

  const IGNORED = new Set([
    "node_modules",
    ".git",
    ".next",
    ".turbo",
    ".idea",
    ".vscode",
    "dist",
    "build",
    ".project-chat.json",
  ]);

  try {
    const entries = await fs.readdir(safePath, { withFileTypes: true });
    const results: FileTreeNode[] = [];

    for (const entry of entries) {
      const entryRelPath = relativePath === "." ? entry.name : `${relativePath}/${entry.name}`;
      if (IGNORED.has(entry.name) || isPathBlocked(entry.name) || isPathBlocked(entryRelPath)) continue;

      const entryFullPath = path.join(safePath, entry.name);

      if (entry.isDirectory()) {
        const node: FileTreeNode = {
          name: entry.name,
          path: entryRelPath.replace(/\\/g, "/"),
          isDirectory: true,
        };

        if (recursive && currentDepth < maxDepth) {
          node.children = await listProjectDirectory(
            entryRelPath,
            recursive,
            maxDepth,
            currentDepth + 1
          );
        }

        results.push(node);
      } else {
        let size = 0;
        try {
          const stats = await fs.stat(entryFullPath);
          size = stats.size;
        } catch {}

        results.push({
          name: entry.name,
          path: entryRelPath.replace(/\\/g, "/"),
          isDirectory: false,
          size,
        });
      }
    }

    // Sort: directories first, then alphabetical
    return results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[Project Filesystem] Error reading directory "${safePath}":`, message);
    return [];
  }
}

export interface WorkspaceProjectInfo {
  name: string;
  path: string;
  fileCount: number;
  updatedAt: string;
}

/**
 * Lists all user project folders in agent-workspace.
 * If empty, creates an initial default project with starter files.
 */
export async function listWorkspaceProjects(): Promise<WorkspaceProjectInfo[]> {
  try {
    await fs.mkdir(WORKSPACE_ROOT, { recursive: true });
    const entries = await fs.readdir(WORKSPACE_ROOT, { withFileTypes: true });
    const projectDirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith("."));

    // If no projects exist yet, return empty list
    if (projectDirs.length === 0) {
      return [];
    }

    const projects: WorkspaceProjectInfo[] = [];

    for (const dir of projectDirs) {
      const dirPath = path.join(WORKSPACE_ROOT, dir.name);
      const relPath = `agent-workspace/${dir.name}`;
      let fileCount = 0;
      let latestMtime = new Date(0);

      try {
        const files = await listProjectDirectory(relPath, true, 4);
        const countFiles = (nodes: FileTreeNode[]): number => {
          let count = 0;
          for (const n of nodes) {
            if (!n.isDirectory) count++;
            if (n.children) count += countFiles(n.children);
          }
          return count;
        };
        fileCount = countFiles(files);
        const stats = await fs.stat(dirPath);
        latestMtime = stats.mtime;
      } catch {}

      projects.push({
        name: dir.name,
        path: relPath,
        fileCount,
        updatedAt: latestMtime.toISOString(),
      });
    }

    return projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch (err) {
    console.warn("[Project Filesystem] Error listing workspace projects:", err);
    return [];
  }
}

/**
 * Creates a new project directory inside agent-workspace with starter files.
 */
/**
 * Creates a new project directory inside agent-workspace with starter files based on template.
 */
export async function createWorkspaceProject(
  projectName: string,
  template: "blank" | "webapp" | "dashboard" | "portfolio" | "game" | "api" = "webapp"
): Promise<{
  success: boolean;
  name: string;
  path: string;
  message: string;
}> {
  const cleanName = (projectName || "new-project")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "new-project";

  const relProjPath = `agent-workspace/${cleanName}`;
  const fullProjPath = path.join(PROJECT_ROOT, relProjPath);

  await fs.mkdir(fullProjPath, { recursive: true });

  const readmePath = `${relProjPath}/README.md`;
  const indexPath = `${relProjPath}/index.html`;

  try {
    if (template === "webapp") {
      await createProjectFile(
        indexPath,
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanName} - Agent Studio Web App</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
  <!-- Header -->
  <header class="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20">
    <div class="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <svg class="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
        </div>
        <div>
          <h1 class="font-bold text-base tracking-tight text-white">${cleanName}</h1>
          <p class="text-xs text-slate-400">Autonomous Web App</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <button id="counter-btn" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer">
          Interactions: <span id="count-val">0</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <main class="flex-1 max-w-6xl mx-auto px-6 py-12 w-full flex flex-col gap-10">
    <div class="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-900/90 to-slate-900/40 p-8 sm:p-12 shadow-2xl">
      <div class="absolute -right-20 -top-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="max-w-2xl relative z-10 space-y-4">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium">
          <span class="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"></span>
          Live Sandboxed Workspace
        </div>
        <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
          Welcome to <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-violet-400">${cleanName}</span>
        </h2>
        <p class="text-slate-400 text-sm sm:text-base leading-relaxed">
          This project was initialized with modern styling, clean structure, and ready-to-run interactive JavaScript. Ask the AI agent in the chat to add new features, pages, or components!
        </p>
        <div class="flex flex-wrap gap-3 pt-2">
          <button id="action-toast-btn" class="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-semibold text-xs transition cursor-pointer shadow-md">
            Trigger Notification
          </button>
          <a href="#features" class="px-5 py-2.5 rounded-xl border border-slate-700 hover:bg-slate-800/60 text-slate-300 text-xs font-medium transition flex items-center gap-2">
            Explore Features →
          </a>
        </div>
      </div>
    </div>

    <!-- Feature Grid -->
    <div id="features" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div class="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-indigo-500/30 transition-all space-y-3">
        <div class="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>
        </div>
        <h3 class="font-semibold text-white text-sm">Tailwind CSS & Utility First</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Instant visual styling with responsive utilities and curated dark mode palettes.</p>
      </div>
      <div class="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-indigo-500/30 transition-all space-y-3">
        <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>
        </div>
        <h3 class="font-semibold text-white text-sm">Real-time Preview</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Changes save instantly and compile into the live sandboxed viewport.</p>
      </div>
      <div class="p-6 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-indigo-500/30 transition-all space-y-3">
        <div class="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>
        </div>
        <h3 class="font-semibold text-white text-sm">AI Agent Augmented</h3>
        <p class="text-xs text-slate-400 leading-relaxed">Multi-file generation, automated bug fixes, and continuous workspace enhancements.</p>
      </div>
    </div>

    <!-- Live Toast Container -->
    <div id="toast-container" class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none"></div>
  </main>

  <footer class="border-t border-slate-800/60 py-6 text-center text-xs text-slate-500">
    Built with Agent Studio OS · ${cleanName}
  </footer>

  <script src="app.js"></script>
</body>
</html>\n`
      );

      await createProjectFile(
        `${relProjPath}/styles.css`,
        `/* Custom styles and micro-animations for ${cleanName} */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

.toast-animate {
  animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.6);
}
::-webkit-scrollbar-thumb {
  background: rgba(51, 65, 85, 0.8);
  border-radius: 9999px;
}
`
      );

      await createProjectFile(
        `${relProjPath}/app.js`,
        `// Interactive application logic for ${cleanName}
document.addEventListener("DOMContentLoaded", () => {
  let count = 0;
  const counterBtn = document.getElementById("counter-btn");
  const countVal = document.getElementById("count-val");
  const toastBtn = document.getElementById("action-toast-btn");
  const toastContainer = document.getElementById("toast-container");

  function showToast(message, type = "info") {
    if (!toastContainer) return;
    const toast = document.createElement("div");
    toast.className = "toast-animate pointer-events-auto px-4 py-3 rounded-xl bg-slate-900 border border-indigo-500/30 text-white text-xs shadow-xl flex items-center gap-2";
    toast.innerHTML = \`<span class="w-2 h-2 rounded-full bg-indigo-400"></span><span>\${message}</span>\`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(4px)";
      toast.style.transition = "all 0.2s ease";
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  if (counterBtn && countVal) {
    counterBtn.addEventListener("click", () => {
      count++;
      countVal.textContent = count;
      showToast(\`Interaction recorded! (\${count})\`);
    });
  }

  if (toastBtn) {
    toastBtn.addEventListener("click", () => {
      showToast("Workspace running in live sandbox mode!", "success");
    });
  }

  console.log("${cleanName} initialized successfully.");
});
`
      );
    } else if (template === "dashboard") {
      await createProjectFile(
        indexPath,
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanName} - Analytics Dashboard</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-neutral-950 text-neutral-100 min-h-screen p-6 font-sans">
  <div class="max-w-6xl mx-auto space-y-6">
    <div class="flex items-center justify-between pb-4 border-b border-neutral-800">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">${cleanName} Dashboard</h1>
        <p class="text-xs text-neutral-400">Real-time performance metrics</p>
      </div>
      <button id="refresh-data-btn" class="px-3.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-medium text-neutral-200 transition cursor-pointer">
        ↻ Refresh Stats
      </button>
    </div>

    <!-- KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
        <span class="text-xs text-neutral-400 font-medium">Total Revenue</span>
        <div class="text-2xl font-bold text-white" id="kpi-rev">$48,290</div>
        <span class="text-xs text-emerald-400 font-medium">↑ +14.2% from last week</span>
      </div>
      <div class="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
        <span class="text-xs text-neutral-400 font-medium">Active Users</span>
        <div class="text-2xl font-bold text-white" id="kpi-users">12,450</div>
        <span class="text-xs text-emerald-400 font-medium">↑ +8.7% concurrent</span>
      </div>
      <div class="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
        <span class="text-xs text-neutral-400 font-medium">Agent Tasks</span>
        <div class="text-2xl font-bold text-white" id="kpi-tasks">1,892</div>
        <span class="text-xs text-sky-400 font-medium">99.4% completion rate</span>
      </div>
      <div class="p-5 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-1">
        <span class="text-xs text-neutral-400 font-medium">Avg Latency</span>
        <div class="text-2xl font-bold text-white" id="kpi-lat">142ms</div>
        <span class="text-xs text-emerald-400 font-medium">Optimal edge speed</span>
      </div>
    </div>

    <!-- Chart Canvas -->
    <div class="p-6 rounded-2xl bg-neutral-900 border border-neutral-800 space-y-4">
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-sm text-white">Activity Overview</h3>
        <span class="text-xs text-neutral-400">Live Canvas Stream</span>
      </div>
      <canvas id="chartCanvas" width="900" height="240" class="w-full h-60 rounded-xl bg-neutral-950 border border-neutral-800/80"></canvas>
    </div>
  </div>
  <script src="dashboard.js"></script>
</body>
</html>\n`
      );

      await createProjectFile(
        `${relProjPath}/dashboard.js`,
        `// Canvas Chart & Live Data simulation for ${cleanName}
document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("chartCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  let points = [30, 45, 60, 50, 75, 90, 85, 110, 130, 120, 145, 160];

  function drawChart() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const w = canvas.width;
    const h = canvas.height;
    const padding = 30;

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    for (let y = padding; y < h - padding; y += 40) {
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
    }

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padding, 0, h - padding);
    grad.addColorStop(0, "rgba(56, 189, 248, 0.3)");
    grad.addColorStop(1, "rgba(56, 189, 248, 0.0)");

    const stepX = (w - padding * 2) / (points.length - 1);
    const maxVal = Math.max(...points) * 1.2;

    ctx.beginPath();
    points.forEach((p, idx) => {
      const x = padding + idx * stepX;
      const y = h - padding - (p / maxVal) * (h - padding * 2);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    // Stroke line
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Fill area
    ctx.lineTo(w - padding, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw dots
    points.forEach((p, idx) => {
      const x = padding + idx * stepX;
      const y = h - padding - (p / maxVal) * (h - padding * 2);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#38bdf8";
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0a0a0a";
      ctx.stroke();
    });
  }

  drawChart();

  const refreshBtn = document.getElementById("refresh-data-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      points = points.map(p => Math.floor(p * (0.85 + Math.random() * 0.35)));
      drawChart();
    });
  }
});
`
      );
    } else {
      // Default / Blank
      await createProjectFile(
        indexPath,
        `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cleanName}</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-content: center; height: 100vh; margin: 0; background: #09090b; color: #fafafa; }
    .card { padding: 2rem; border-radius: 1rem; border: 1px solid #27272a; background: #18181b; text-align: center; max-width: 420px; }
    h1 { color: #38bdf8; margin-top: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${cleanName}</h1>
    <p>Project initialized. Ask the AI Agent to build features or add new files!</p>
  </div>
</body>
</html>\n`
      );
    }

    await createProjectFile(
      readmePath,
      `# ${cleanName}\n\nProject workspace created in Agent Studio OS (${template} template).\nUse the Code Page and AI Agent to generate files and build applications.\n`
    );
  } catch (err) {
    console.warn("Error setting up template starter files:", err);
  }

  return {
    success: true,
    name: cleanName,
    path: relProjPath,
    message: `Project folder "${cleanName}" created successfully with template "${template}".`,
  };
}

/**
 * Renames a user workspace project directory inside agent-workspace.
 */
export async function renameWorkspaceProject(
  oldName: string,
  newName: string
): Promise<{
  success: boolean;
  oldName: string;
  newName: string;
  path: string;
  message: string;
}> {
  const cleanOld = (oldName || "").trim();
  const cleanNew = (newName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!cleanOld) throw new Error("Current project name is required");
  if (!cleanNew) throw new Error("New project name cannot be empty");
  if (cleanOld === cleanNew) {
    return {
      success: true,
      oldName: cleanOld,
      newName: cleanNew,
      path: `agent-workspace/${cleanOld}`,
      message: "Project name unchanged.",
    };
  }

  const oldPath = `agent-workspace/${cleanOld}`;
  const newPath = `agent-workspace/${cleanNew}`;

  await renameProjectEntry(oldPath, newPath);

  return {
    success: true,
    oldName: cleanOld,
    newName: cleanNew,
    path: newPath,
    message: `Project "${cleanOld}" renamed to "${cleanNew}" successfully.`,
  };
}

/**
 * Deletes a user workspace project directory inside agent-workspace.
 */
export async function deleteWorkspaceProject(projectName: string): Promise<{
  success: boolean;
  name: string;
  message: string;
}> {
  const cleanName = (projectName || "").trim();
  if (!cleanName) throw new Error("Project name is required for deletion");

  const relPath = `agent-workspace/${cleanName}`;
  await deleteProjectEntry(relPath);

  return {
    success: true,
    name: cleanName,
    message: `Project "${cleanName}" deleted successfully.`,
  };
}


/**
 * Writes multiple project files in one batch operation.
 */
export async function writeBatchProjectFiles(
  projectPath: string,
  files: Array<{ path: string; content: string }>
): Promise<{
  success: boolean;
  createdFiles: Array<{ path: string; size: number }>;
  message: string;
}> {
  const createdFiles: Array<{ path: string; size: number }> = [];

  for (const f of files) {
    if (!f.path) continue;
    // Normalize path inside project
    const cleanSubPath = f.path.replace(/^[/\\]+/, "").trim();
    const targetRelPath = cleanSubPath.startsWith(projectPath)
      ? cleanSubPath
      : `${projectPath}/${cleanSubPath}`;

    const res = await createProjectFile(targetRelPath, f.content, { overwrite: true });
    createdFiles.push({ path: res.path, size: res.size });
  }

  return {
    success: true,
    createdFiles,
    message: `Batch created/updated ${createdFiles.length} project files.`,
  };
}

/**
 * Renames or moves a file or folder safely within the project.
 */
export async function renameProjectEntry(
  oldPath: string,
  newPath: string
): Promise<{
  success: boolean;
  oldPath: string;
  newPath: string;
  message: string;
}> {
  const { safePath: oldSafe, relativePath: oldRel } = resolveSafeProjectPath(oldPath);
  const { safePath: newSafe, relativePath: newRel } = resolveSafeProjectPath(newPath);

  const PROTECTED = new Set([".", "", "node_modules", ".git", ".next", "src", "agent-workspace"]);
  if (PROTECTED.has(oldRel)) {
    throw new Error(`Cannot rename protected directory "${oldRel}"`);
  }

  try {
    await fs.access(oldSafe);
  } catch {
    throw new Error(`Source file or folder "${oldRel}" does not exist`);
  }

  const parentDir = path.dirname(newSafe);
  await fs.mkdir(parentDir, { recursive: true });

  const maxAttempts = 5;
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await fs.rename(oldSafe, newSafe);
      break;
    } catch (err: unknown) {
      attempts++;
      const error = err as { code?: string; message?: string };
      if ((error?.code === "EPERM" || error?.code === "EBUSY") && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 60));
        continue;
      }
      throw new Error(
        `Failed to rename "${oldRel}" to "${newRel}" after ${attempts} attempt(s) [${error?.code || error?.message}]: File or directory may be locked by an external process.`
      );
    }
  }

  return {
    success: true,
    oldPath: oldRel,
    newPath: newRel,
    message: `Renamed "${oldRel}" to "${newRel}" successfully.`,
  };
}

/**
 * Deletes a file or directory safely within the project workspace.
 */
export async function deleteProjectEntry(
  targetPath: string
): Promise<{
  success: boolean;
  path: string;
  message: string;
}> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);

  const PROTECTED = new Set([".", "", "node_modules", ".git", ".next", "src", "agent-workspace"]);
  if (PROTECTED.has(relativePath)) {
    throw new Error(`Cannot delete protected directory "${relativePath}"`);
  }

  const maxAttempts = 5;
  let attempts = 0;
  while (attempts < maxAttempts) {
    try {
      await fs.rm(safePath, { recursive: true, force: true });
      break;
    } catch (err: unknown) {
      attempts++;
      const error = err as { code?: string; message?: string };
      if ((error?.code === "EPERM" || error?.code === "EBUSY") && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempts * 60));
        continue;
      }
      throw new Error(
        `Failed to delete "${relativePath}" after ${attempts} attempt(s) [${error?.code || error?.message}]: File or directory may be locked by an external process.`
      );
    }
  }

  return {
    success: true,
    path: relativePath,
    message: `Deleted "${relativePath}" successfully.`,
  };
}

/**
 * Duplicates a file or folder safely within the project.
 */
export async function duplicateProjectEntry(targetPath: string): Promise<{
  success: boolean;
  newPath: string;
  message: string;
}> {
  const { safePath, relativePath } = resolveSafeProjectPath(targetPath);
  const ext = path.extname(relativePath);
  const baseWithoutExt = ext ? relativePath.slice(0, -ext.length) : relativePath;
  let newRel = `${baseWithoutExt}-copy${ext}`;
  let counter = 1;

  while (true) {
    try {
      const { safePath: testSafe } = resolveSafeProjectPath(newRel);
      await fs.access(testSafe);
      newRel = `${baseWithoutExt}-copy${counter}${ext}`;
      counter++;
    } catch {
      break;
    }
  }

  const { safePath: newSafe } = resolveSafeProjectPath(newRel);
  await fs.cp(safePath, newSafe, { recursive: true });

  return {
    success: true,
    newPath: newRel,
    message: `Duplicated "${relativePath}" to "${newRel}" successfully.`,
  };
}

/**
 * Packages an entire project workspace folder into a ZIP buffer.
 */
export async function exportProjectZip(projectRelPath: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const { safePath } = resolveSafeProjectPath(projectRelPath);
  const zip = new JSZip();

  const addDirToZip = async (currentDir: string, zipFolder: JSZip) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const fullEntryPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        const subFolder = zipFolder.folder(entry.name);
        if (subFolder) {
          await addDirToZip(fullEntryPath, subFolder);
        }
      } else {
        const fileData = await fs.readFile(fullEntryPath);
        zipFolder.file(entry.name, fileData);
      }
    }
  };

  await addDirToZip(safePath, zip);
  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const projBaseName = path.basename(safePath) || "project";

  return {
    buffer,
    filename: `${projBaseName}.zip`,
  };
}

