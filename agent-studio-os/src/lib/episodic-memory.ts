import fs from "fs/promises";
import path from "path";
import { getVaultPath, ensureVaultExists } from "./vault";

export interface AgentMemoryEntry {
  agentName: string;
  content: string;
  updatedAt: string;
  learningsCount: number;
}

/** Get directory for storing episodic agent memories inside the vault */
export function getMemoriesDirPath(): string {
  return path.join(getVaultPath(), "memories");
}

/** Ensure memories directory exists */
export async function ensureMemoriesDir(): Promise<void> {
  await ensureVaultExists();
  const dir = getMemoriesDirPath();
  await fs.mkdir(dir, { recursive: true });
}

/** Get or initialize memory file for an agent */
export async function getAgentMemory(agentName: string): Promise<string> {
  await ensureMemoriesDir();
  const normalized = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const filePath = path.join(getMemoriesDirPath(), `${normalized}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch {
    // Initialize default memory profile template
    const initialContent = `---
agent: "${normalized}"
type: "episodic_memory"
updatedAt: "${new Date().toISOString()}"
---

# Episodic Memory: ${normalized.toUpperCase()}

## 🎯 User Preferences & Directives
- Deliver concise, highly-structured executive responses with code and tables.
- Provide clear, actionable, expert guidance without generic conversational filler, robotic greetings, or forced tags.

## 🧠 Project Context & Rules
- Agent Studio OS uses Omniroute as primary brain and SQLite for local state.
- All code deliverables must be production-ready and error-free.

## 🔄 Self-Reflection & Critique Learnings
- *System initialized*: Ready to record iteration improvements and critique feedback.
`;
    await fs.writeFile(filePath, initialContent, "utf-8");
    return initialContent;
  }
}

/** Append a reflection or learning to an agent's memory file */
export async function appendAgentLearning(
  agentName: string,
  learning: string,
  category: "Critique Feedback" | "Project Decision" | "User Preference" = "Critique Feedback"
): Promise<void> {
  await ensureMemoriesDir();
  const normalized = agentName.toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const filePath = path.join(getMemoriesDirPath(), `${normalized}.md`);

  let current = await getAgentMemory(normalized);
  const timestamp = new Date().toISOString().split("T")[0];
  const newEntry = `\n- **[${timestamp} - ${category}]**: ${learning.trim()}`;

  if (current.includes("## 🔄 Self-Reflection & Critique Learnings")) {
    current = current.replace(
      "## 🔄 Self-Reflection & Critique Learnings",
      `## 🔄 Self-Reflection & Critique Learnings${newEntry}`
    );
  } else {
    current += `\n\n## 🔄 Self-Reflection & Critique Learnings${newEntry}\n`;
  }

  // Update frontmatter updatedAt
  current = current.replace(/updatedAt:\s*"[^"]*"/, `updatedAt: "${new Date().toISOString()}"`);
  await fs.writeFile(filePath, current, "utf-8");
}

/** Format memory into a system prompt injection block */
export async function formatEpisodicMemoryPrompt(agentName: string): Promise<string> {
  try {
    const memory = await getAgentMemory(agentName);
    const bodyOnly = memory.replace(/^---\r?\n[\s\S]*?\r?\n---/, "").trim();
    if (!bodyOnly) return "";

    return `\n---
[AGENT EPISODIC MEMORY & LEARNED PREFERENCES]
The following are past learnings, rules, and critiques you have recorded:
${bodyOnly.slice(0, 1000)}
---
`;
  } catch {
    return "";
  }
}

/** List all memories across agents for the UI */
export async function listAllAgentMemories(): Promise<AgentMemoryEntry[]> {
  await ensureMemoriesDir();
  const dir = getMemoriesDirPath();
  const entries: AgentMemoryEntry[] = [];

  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      if (f.endsWith(".md")) {
        const full = path.join(dir, f);
        const stat = await fs.stat(full);
        const content = await fs.readFile(full, "utf-8");
        const agentName = path.basename(f, ".md");
        const learningsCount = (content.match(/- \*\*\[\d{4}-\d{2}-\d{2}/g) || []).length;

        entries.push({
          agentName,
          content,
          updatedAt: stat.mtime.toISOString(),
          learningsCount,
        });
      }
    }
  } catch {
    // Ignore
  }

  return entries;
}
