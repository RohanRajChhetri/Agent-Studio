import fs from "fs/promises";
import path from "path";
import type { GraphStats } from "@/types";
import {
  getVaultPath,
  getObsidianExecutable,
  ensureVaultExists,
} from "./obsidian-integration";

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

const CATEGORY_COLORS: Record<string, string> = {
  task: "#a855f7", // Purple star
  research: "#06b6d4", // Cyan star
  strategy: "#f59e0b", // Gold star
  concept: "#3b82f6", // Blue star
  system: "#10b981", // Emerald star
};

/** Parse all markdown files and build the Memory Galaxy graph */
export async function generateGalaxyData(): Promise<GalaxyData> {
  await ensureVaultExists();
  const vaultRoot = getVaultPath();

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

  const filePaths = await getMdFiles(vaultRoot);

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

    let category: GalaxyNode["category"] = "concept";
    if (relPath.startsWith("tasks/")) category = "task";
    else if (relPath.startsWith("research/")) category = "research";
    else if (relPath.startsWith("marketing/")) category = "strategy";
    else if (relPath.startsWith("concepts/")) category = "concept";
    else category = "system";

    categories[category] = (categories[category] || 0) + 1;

    let title = filename
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    let agent: string | undefined;
    const titleMatch = content.match(/title:\s*["']?([^"'\n]+)["']?/);
    if (titleMatch) title = titleMatch[1];

    const agentMatch = content.match(/agent:\s*["']?([^"'\n]+)["']?/);
    if (agentMatch) agent = agentMatch[1];

    const tags: string[] = [];
    const tagMatches = content.match(/#[a-zA-Z0-9_-]+/g);
    if (tagMatches) {
      for (const t of tagMatches) {
        if (!tags.includes(t)) tags.push(t);
      }
    }

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
      color: CATEGORY_COLORS[category] || "#6366f1",
      snippet,
      tags,
      linksCount: 0,
    });

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

  // Enhanced Galaxy Link Building:
  // Connect unlinked nodes within identical categories using a cluster-hub star topology.
  // Algorithmic Complexity: Strictly O(N) linear time (single grouping pass + single hub resolution per category).
  // This completely eliminates the previous O(N^2) worst-case pair matching and avoids orphaned nodes.
  const nodesByCategory = new Map<string, GalaxyNode[]>();
  for (const node of nodes) {
    const list = nodesByCategory.get(node.category);
    if (list) {
      list.push(node);
    } else {
      nodesByCategory.set(node.category, [node]);
    }
  }

  for (const catNodes of nodesByCategory.values()) {
    if (catNodes.length < 2) continue;

    // Pick the most central anchor node (highest existing linksCount or wordCount)
    let hubNode = catNodes[0];
    for (const node of catNodes) {
      if (
        node.linksCount > hubNode.linksCount ||
        (node.linksCount === hubNode.linksCount && node.wordCount > hubNode.wordCount)
      ) {
        hubNode = node;
      }
    }

    // Connect all unlinked nodes to the category hub node (ensuring no orphans)
    for (const node of catNodes) {
      if (node.linksCount === 0 && node.id !== hubNode.id) {
        links.push({
          source: hubNode.id,
          target: node.id,
          type: "category",
        });
        hubNode.linksCount++;
        node.linksCount++;
      }
    }
  }

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
