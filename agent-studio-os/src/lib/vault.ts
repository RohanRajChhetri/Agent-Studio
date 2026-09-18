import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import type { VaultFile, GraphStats } from "@/types";

const execAsync = promisify(exec);

export interface GalaxyNode {
  id: string;
  name: string;
  path: string;
  category: "task" | "research" | "strategy" | "concept" | "system";
  agent?: string;
  wordCount: number;
  size: number;
  color: string;
  snippet: string;
  tags: string[];
  linksCount: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

export interface GalaxyLink {
  source: string;
  target: string;
  type: "wikilink" | "category" | "agent";
}

export interface GalaxyData {
  nodes: GalaxyNode[];
  links: GalaxyLink[];
  stats: {
    totalNotes: number;
    totalLinks: number;
    categories: Record<string, number>;
  };
  vaultPath: string;
  obsidianInstalled: boolean;
  obsidianUri: string;
}

/** Get the vault path from env or default */
export function getVaultPath(): string {
  return (
    process.env.OBSIDIAN_VAULT_PATH ||
    path.join(
      process.env.USERPROFILE || process.env.HOME || "",
      "agent-studio",
      "memory"
    )
  );
}

/** Check if Obsidian is installed on Windows */
export function getObsidianExecutable(): string {
  return path.join(
    process.env.LOCALAPPDATA || "",
    "Programs",
    "Obsidian",
    "Obsidian.exe"
  );
}

/** Ensure vault directory and Obsidian configuration exist */
export async function ensureVaultExists(): Promise<void> {
  const vaultPath = getVaultPath();
  await fs.mkdir(vaultPath, { recursive: true });
  await fs.mkdir(path.join(vaultPath, "tasks"), { recursive: true });
  await fs.mkdir(path.join(vaultPath, "research"), { recursive: true });
  await fs.mkdir(path.join(vaultPath, "marketing"), { recursive: true });
  await fs.mkdir(path.join(vaultPath, "concepts"), { recursive: true });
  await fs.mkdir(path.join(vaultPath, ".obsidian"), { recursive: true });

  // Create .obsidian/app.json if it doesn't exist
  const appJsonPath = path.join(vaultPath, ".obsidian", "app.json");
  try {
    await fs.access(appJsonPath);
  } catch {
    await fs.writeFile(
      appJsonPath,
      JSON.stringify(
        {
          theme: "obsidian",
          readableLineLength: true,
          showLineNumber: true,
          alwaysUpdateLinks: true,
          newFileLocation: "root",
        },
        null,
        2
      )
    );
  }
}

/** Seed interconnected sample notes so Galaxy has rich constellation links */
export async function seedSampleNotes(): Promise<void> {
  await ensureVaultExists();
  const vault = getVaultPath();

  const sampleNotes = [
    {
      relPath: "concepts/agent-os-architecture.md",
      content: `---
title: "Agent OS Architecture"
agent: "rohan"
category: "system"
tags: ["#architecture", "#multi-agent", "#hermes"]
---

# Agent OS Architecture

Agent OS coordinates multiple autonomous AI agents using a single unified runtime.

## Core Pillars
- **Agent Runtime**: Powered by Hermes Agent CLI with isolated profiles.
- **Shared Memory**: Synchronized [[obsidian-shared-vault]] where agents cross-reference research.
- **Task Orchestration**: Real-time [[kanban-execution-engine]] that dispatches work to specialized agents.
- **Cognitive Galaxy**: Interactive visualization of agent thoughts and deliverables in [[memory-galaxy-map]].

Related to [[neural-agent-memory]] and [[emerging-ai-trends]].
`,
    },
    {
      relPath: "research/neural-agent-memory.md",
      content: `---
title: "Neural Agent Memory & Knowledge Graphs"
agent: "athena"
category: "research"
tags: ["#research", "#memory", "#graph"]
---

# Neural Agent Memory & Knowledge Graphs

Research on persistent context in multi-agent environments.

## Findings
1. Autonomous agents require bidirectional associative memory rather than raw sliding windows.
2. The [[obsidian-shared-vault]] acts as long-term episodic storage.
3. Cross-links allow [[emerging-ai-trends]] to be referenced by marketing agents like [[growth-strategy-playbook]].

See also [[agent-os-architecture]].
`,
    },
    {
      relPath: "research/emerging-ai-trends.md",
      content: `---
title: "Emerging AI Trends 2026"
agent: "athena"
category: "research"
tags: ["#research", "#trends", "#models"]
---

# Emerging AI Trends 2026

Deep synthesis of current foundation model developments.

## Key Trends
- **Sub-100ms Edge Inference**: On-device models like Liquid LFM enable real-time local agent orchestration.
- **Graph-Augmented Generation**: Linking documents via [[memory-galaxy-map]] reduces hallucination by 40%.
- **Autonomous Kanban**: Moving from passive chat interfaces to active execution in [[kanban-execution-engine]].

Feeds directly into [[growth-strategy-playbook]] and [[agent-os-architecture]].
`,
    },
    {
      relPath: "marketing/growth-strategy-playbook.md",
      content: `---
title: "Growth Strategy Playbook"
agent: "mercury"
category: "strategy"
tags: ["#marketing", "#copywriting", "#growth"]
---

# Growth Strategy Playbook

Strategic positioning and messaging for Agent Studio OS.

## Value Proposition
- **Turn Complex CLI Agents into a Visual Powerhouse**: Hermes CLI profiles transformed into visual autonomous coworkers.
- **Memory Galaxy**: Visualizing shared intelligence with [[memory-galaxy-map]].
- **Instant Deliverables**: From [[kanban-execution-engine]] straight into Obsidian markdown notes.

References: [[agent-os-architecture]], [[emerging-ai-trends]].
`,
    },
    {
      relPath: "concepts/obsidian-shared-vault.md",
      content: `---
title: "Obsidian Shared Memory Vault"
agent: "rohan"
category: "concept"
tags: ["#obsidian", "#vault", "#storage"]
---

# Obsidian Shared Memory Vault

The single source of truth shared by all autonomous agents.

## Features
- **Zero Lock-In**: Plain text markdown notes formatted with standard YAML frontmatter.
- **Native Obsidian Sync**: Open directly in desktop Obsidian via \`obsidian://open\`.
- **Cosmic Galaxy**: Rendered via [[memory-galaxy-map]] inside Agent Studio OS.
- **Task Deliverables**: Stored automatically by [[kanban-execution-engine]].
`,
    },
    {
      relPath: "concepts/memory-galaxy-map.md",
      content: `---
title: "Memory Galaxy Map"
agent: "athena"
category: "concept"
tags: ["#galaxy", "#graph", "#visualization"]
---

# Memory Galaxy Map

An interactive celestial knowledge graph visualizing all notes, tasks, and agent connections as glowing star constellations.

## Architecture
- Nodes represent notes and deliverables.
- Constellation lines represent bidirectional [[wikilinks]] and shared agent relationships.
- Integrated with [[obsidian-shared-vault]] and [[agent-os-architecture]].
`,
    },
  ];

  for (const note of sampleNotes) {
    const fullPath = path.join(/*turbopackIgnore: true*/ vault, note.relPath);
    try {
      await fs.access(fullPath);
    } catch {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, note.content, "utf-8");
    }
  }
}

/** Recursively list files in the vault */
export async function listVaultFiles(dirPath?: string): Promise<VaultFile[]> {
  const basePath = dirPath || getVaultPath();
  const vaultRoot = getVaultPath();

  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ basePath, {
      withFileTypes: true,
    });
    const files: VaultFile[] = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      const fullPath = path.join(basePath, entry.name);
      const relativePath = path
        .relative(vaultRoot, fullPath)
        .replace(/\\/g, "/");

      if (entry.isDirectory()) {
        const children = await listVaultFiles(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: true,
          children,
        });
      } else {
        const stat = await fs.stat(fullPath);
        files.push({
          name: entry.name,
          path: fullPath,
          relativePath,
          isDirectory: false,
          size: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        });
      }
    }

    files.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return files;
  } catch {
    return [];
  }
}

/** Read a file from the vault */
export async function readVaultFile(
  relativePath: string
): Promise<{ content: string; modifiedAt: string }> {
  const fullPath = path.join(getVaultPath(), relativePath);
  const content = await fs.readFile(fullPath, "utf-8");
  const stat = await fs.stat(fullPath);
  return { content, modifiedAt: stat.mtime.toISOString() };
}

/** Write a file to the vault */
export async function writeVaultFile(
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = path.join(getVaultPath(), relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, content, "utf-8");
}

/** Delete a file from the vault */
export async function deleteVaultFile(relativePath: string): Promise<void> {
  const fullPath = path.join(getVaultPath(), relativePath);
  await fs.unlink(fullPath);
}

/** Create a folder in the vault */
export async function createVaultFolder(relativePath: string): Promise<void> {
  const fullPath = path.join(getVaultPath(), relativePath);
  await fs.mkdir(fullPath, { recursive: true });
}

/** Rename or move a file or folder in the vault */
export async function renameVaultPath(
  oldRelativePath: string,
  newRelativePath: string
): Promise<void> {
  const oldPath = path.join(getVaultPath(), oldRelativePath);
  const newPath = path.join(getVaultPath(), newRelativePath);
  await fs.mkdir(path.dirname(newPath), { recursive: true });
  await fs.rename(oldPath, newPath);
}

/** Delete a folder and its contents recursively from the vault */
export async function deleteVaultFolder(relativePath: string): Promise<void> {
  const fullPath = path.join(getVaultPath(), relativePath);
  await fs.rm(fullPath, { recursive: true, force: true });
}

/** Count total markdown notes in the vault */
export async function countVaultNotes(dirPath?: string): Promise<number> {
  const basePath = dirPath || getVaultPath();
  let count = 0;

  try {
    const entries = await fs.readdir(/*turbopackIgnore: true*/ basePath, {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        count += await countVaultNotes(fullPath);
      } else if (entry.name.endsWith(".md")) {
        count++;
      }
    }
  } catch {
    // Directory doesn't exist yet
  }

  return count;
}

/** Parse all markdown files and build the Memory Galaxy graph */
export async function generateGalaxyData(): Promise<GalaxyData> {
  await ensureVaultExists();
  const vaultRoot = getVaultPath();

  // Helper to find all .md files
  async function getMdFiles(dir: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...(await getMdFiles(full)));
        } else if (entry.name.endsWith(".md")) {
          results.push(full);
        }
      }
    } catch {
      // Empty
    }
    return results;
  }

  let filePaths = await getMdFiles(vaultRoot);

  // If few notes, seed sample notes so Galaxy is populated
  if (filePaths.length < 3) {
    await seedSampleNotes();
    filePaths = await getMdFiles(vaultRoot);
  }

  const nodes: GalaxyNode[] = [];
  const rawLinks: Array<{ source: string; target: string }> = [];
  const nameToId: Record<string, string> = {};
  const categories: Record<string, number> = {
    task: 0,
    research: 0,
    strategy: 0,
    concept: 0,
    system: 0,
  };

  const categoryColors = {
    task: "#a855f7", // Purple star
    research: "#06b6d4", // Cyan star
    strategy: "#f59e0b", // Gold star
    concept: "#3b82f6", // Blue star
    system: "#10b981", // Emerald star
  };

  for (const fullPath of filePaths) {
    const relPath = path.relative(vaultRoot, fullPath).replace(/\\/g, "/");
    const filename = path.basename(relPath, ".md");
    const id = filename.toLowerCase().replace(/[^a-z0-9]/g, "-");

    nameToId[id] = id;
    nameToId[filename.toLowerCase()] = id;

    let content = "";
    try {
      content = await fs.readFile(fullPath, "utf-8");
    } catch {
      continue;
    }

    // Determine category
    let category: GalaxyNode["category"] = "concept";
    if (relPath.startsWith("tasks/")) category = "task";
    else if (relPath.startsWith("research/")) category = "research";
    else if (relPath.startsWith("marketing/")) category = "strategy";
    else if (relPath.startsWith("concepts/")) category = "concept";
    else category = "system";

    categories[category] = (categories[category] || 0) + 1;

    // Extract frontmatter info
    let title = filename
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    let agent: string | undefined;
    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)["']?/);
    if (titleMatch) title = titleMatch[1];

    const agentMatch = content.match(/agent:\s*["']?([^"'\n]+)["']?/);
    if (agentMatch) agent = agentMatch[1];

    // Extract tags
    const tags: string[] = [];
    const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g);
    if (tagMatches) {
      for (const t of tagMatches) {
        if (!tags.includes(t)) tags.push(t);
      }
    }

    // Snippet
    const cleanContent = content
      .replace(/---[\s\S]*?---/, "")
      .replace(/[#*`_]/g, "")
      .trim();
    const snippet = cleanContent.slice(0, 160) + (cleanContent.length > 160 ? "..." : "");

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const size = Math.max(16, Math.min(48, Math.round(Math.sqrt(wordCount) * 2.2)));

    nodes.push({
      id,
      name: title,
      path: relPath,
      category,
      agent,
      wordCount,
      size,
      color: categoryColors[category] || "#6366f1",
      snippet,
      tags,
      linksCount: 0,
    });

    // Extract [[wikilinks]]
    const wikilinkMatches = content.matchAll(/\[\[(.*?)\]\]/g);
    for (const match of wikilinkMatches) {
      const linkTarget = match[1]
        .split("|")[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-");
      rawLinks.push({ source: id, target: linkTarget });
    }
  }

  // Index nodes by ID for O(1) lookups
  const nodeMap = new Map<string, GalaxyNode>(nodes.map((n) => [n.id, n]));
  const links: GalaxyLink[] = [];

  for (const rl of rawLinks) {
    const resolvedTarget = nameToId[rl.target] || rl.target;
    const srcNode = nodeMap.get(rl.source);
    const tgtNode = nodeMap.get(resolvedTarget);

    if (srcNode && tgtNode) {
      links.push({
        source: rl.source,
        target: resolvedTarget,
        type: "wikilink",
      });
      srcNode.linksCount++;
      tgtNode.linksCount++;
    }
  }

  // Connect unlinked nodes within identical categories in O(N) linear time
  const unlinkedByCategory = new Map<string, GalaxyNode[]>();
  for (const node of nodes) {
    if (node.linksCount === 0) {
      const list = unlinkedByCategory.get(node.category);
      if (list) {
        list.push(node);
      } else {
        unlinkedByCategory.set(node.category, [node]);
      }
    }
  }

  for (const categoryNodes of unlinkedByCategory.values()) {
    for (let i = 0; i < categoryNodes.length - 1; i += 2) {
      const a = categoryNodes[i];
      const b = categoryNodes[i + 1];
      links.push({
        source: a.id,
        target: b.id,
        type: "category",
      });
      a.linksCount++;
      b.linksCount++;
    }
  }

  // Check if Obsidian executable exists
  let obsidianInstalled = false;
  try {
    await fs.access(getObsidianExecutable());
    obsidianInstalled = true;
  } catch {
    obsidianInstalled = false;
  }

  return {
    nodes,
    links,
    stats: {
      totalNotes: nodes.length,
      totalLinks: links.length,
      categories,
    },
    vaultPath: vaultRoot,
    obsidianInstalled,
    obsidianUri: `obsidian://open?path=${encodeURIComponent(vaultRoot)}`,
  };
}

/** Open the vault or a specific note file directly in Desktop Obsidian */
export async function openVaultInObsidian(
  targetFile?: string,
  fallbackData?: { title: string; content?: string; agentName?: string }
): Promise<{ success: boolean; opened: boolean; message: string; uri: string }> {
  const vaultPath = getVaultPath();
  const exePath = getObsidianExecutable();

  let fullTargetPath = vaultPath;
  if (targetFile) {
    const cleanRel = targetFile.replace(/^[/\\]+/, "");
    fullTargetPath = path.isAbsolute(targetFile) ? targetFile : path.join(vaultPath, cleanRel);

    // Ensure parent directory exists
    const parentDir = path.dirname(fullTargetPath);
    try {
      await fs.mkdir(parentDir, { recursive: true });
    } catch {}

    // Check if file exists, if not write deliverable content so Obsidian has the file to open
    try {
      await fs.access(fullTargetPath);
    } catch {
      if (fallbackData) {
        const fileContent = `---
title: "${(fallbackData.title || "Task Deliverable").replace(/"/g, '\\"')}"
agent: "${fallbackData.agentName || "Agent"}"
date: "${new Date().toISOString()}"
tags:
  - deliverable
  - task
---

# ${fallbackData.title || "Task Deliverable"}

${fallbackData.content || "No deliverable content recorded."}
`;
        await fs.writeFile(fullTargetPath, fileContent, "utf-8");
      }
    }
  }

  const obsidianUri = `obsidian://open?path=${encodeURIComponent(fullTargetPath)}`;

  // 1. If Windows and Obsidian.exe exists, launch directly in detached mode
  if (process.platform === "win32") {
    try {
      if (existsSync(exePath)) {
        const child = spawn(exePath, [obsidianUri], {
          detached: true,
          stdio: "ignore",
          windowsHide: false,
        });
        child.unref();
        return {
          success: true,
          opened: true,
          message: `Opened ${targetFile ? path.basename(targetFile) : "vault"} in Obsidian Desktop`,
          uri: obsidianUri,
        };
      }
    } catch (e) {
      console.warn("Direct Obsidian spawn error:", e);
    }
  }

  // 2. Try native platform protocol handler
  try {
    if (process.platform === "win32") {
      await execAsync(`cmd /c start "" "${obsidianUri}"`);
    } else if (process.platform === "darwin") {
      await execAsync(`open "${obsidianUri}"`);
    } else {
      await execAsync(`xdg-open "${obsidianUri}"`);
    }
    return {
      success: true,
      opened: true,
      message: `Opened ${targetFile || "vault"} in Obsidian`,
      uri: obsidianUri,
    };
  } catch {
    // 3. Fallback: Open directory in native file explorer
    try {
      if (process.platform === "win32") {
        await execAsync(`explorer "${fullTargetPath}"`);
      } else if (process.platform === "darwin") {
        await execAsync(`open "${path.dirname(fullTargetPath)}"`);
      } else {
        await execAsync(`xdg-open "${path.dirname(fullTargetPath)}"`);
      }
      return {
        success: true,
        opened: true,
        message: "Opened vault directory in file manager",
        uri: obsidianUri,
      };
    } catch (fallbackErr) {
      return {
        success: false,
        opened: false,
        message: fallbackErr instanceof Error ? fallbackErr.message : "Failed to open Obsidian",
        uri: obsidianUri,
      };
    }
  }
}

/** Parse graph.json for legacy stats */
export async function getGraphStats(): Promise<GraphStats> {
  const galaxy = await generateGalaxyData();
  return {
    nodes: galaxy.nodes.length,
    edges: galaxy.links.length,
    communities: Object.keys(galaxy.stats.categories).length,
    godNodes: galaxy.nodes
      .filter((n) => n.linksCount >= 2)
      .map((n) => n.name),
  };
}
