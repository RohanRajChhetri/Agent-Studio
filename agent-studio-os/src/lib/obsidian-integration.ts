import fs from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
import { getActiveVaultPath } from "./storage-config";

/** Get the vault path from dynamic config, env, or default */
export function getVaultPath(): string {
  return getActiveVaultPath();
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
agent: "orchestrator"
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
agent: "orchestrator"
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

    const parentDir = path.dirname(fullTargetPath);
    try {
      await fs.mkdir(parentDir, { recursive: true });
    } catch {}

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
