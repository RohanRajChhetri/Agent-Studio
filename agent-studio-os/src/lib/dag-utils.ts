import type { DAGNode, DAGEdge, DAGNodeType, DAGWorkflow } from "@/types/workflow-dag";

export interface DAGValidationResult {
  isValid: boolean;
  error?: string;
  hasCycle?: boolean;
  disconnectedNodeIds: string[];
  stageCount: number;
}

/**
 * Client-safe DAG validation for cycle detection, dangling edge detection, and disconnected node discovery.
 */
export function validateDAGClient(nodes: DAGNode[], edges: DAGEdge[]): DAGValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id));

  // Check edge references
  for (const edge of edges) {
    if (!nodeIds.has(edge.from)) {
      return {
        isValid: false,
        error: `Edge references missing source node: ${edge.from}`,
        disconnectedNodeIds: [],
        stageCount: 0,
      };
    }
    if (!nodeIds.has(edge.to)) {
      return {
        isValid: false,
        error: `Edge references missing target node: ${edge.to}`,
        disconnectedNodeIds: [],
        stageCount: 0,
      };
    }
  }

  // Detect disconnected nodes (nodes with 0 incoming and 0 outgoing edges, excluding lone triggers)
  const connectedNodes = new Set<string>();
  for (const edge of edges) {
    connectedNodes.add(edge.from);
    connectedNodes.add(edge.to);
  }
  const disconnectedNodeIds = nodes
    .filter((n) => !connectedNodes.has(n.id) && nodes.length > 1)
    .map((n) => n.id);

  // Cycle detection via DFS (White, Gray, Black)
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  const visited = new Map<string, "white" | "gray" | "black">();
  for (const node of nodes) {
    visited.set(node.id, "white");
  }

  let cycleFound = false;
  let cycleNode = "";

  function dfs(nodeId: string): boolean {
    visited.set(nodeId, "gray");
    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (visited.get(neighbor) === "gray") {
        cycleNode = neighbor;
        return true;
      }
      if (visited.get(neighbor) === "white") {
        if (dfs(neighbor)) return true;
      }
    }
    visited.set(nodeId, "black");
    return false;
  }

  for (const node of nodes) {
    if (visited.get(node.id) === "white") {
      if (dfs(node.id)) {
        cycleFound = true;
        break;
      }
    }
  }

  if (cycleFound) {
    return {
      isValid: false,
      error: `Cycle detected: node "${cycleNode}" creates an infinite circular loop`,
      hasCycle: true,
      disconnectedNodeIds,
      stageCount: 0,
    };
  }

  // Calculate topological stages count
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
  }

  let currentLevel = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
  let stageCount = 0;

  while (currentLevel.length > 0) {
    stageCount++;
    const nextLevel: string[] = [];
    for (const id of currentLevel) {
      for (const neighbor of adj.get(id) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextLevel.push(neighbor);
        }
      }
    }
    currentLevel = nextLevel;
  }

  return {
    isValid: true,
    disconnectedNodeIds,
    stageCount: Math.max(stageCount, 1),
  };
}

/**
 * Checks if adding an edge from source to target would create a cycle in the DAG.
 */
export function wouldCreateCycle(
  nodes: DAGNode[],
  edges: DAGEdge[],
  sourceId: string,
  targetId: string
): boolean {
  if (sourceId === targetId) return true;

  // DFS from target to see if source is reachable
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  const visited = new Set<string>();
  const queue = [targetId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === sourceId) return true;
    visited.add(curr);

    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return false;
}

/**
 * Automatic hierarchical DAG layout (topological left-to-right alignment with vertical centering).
 */
export function autoLayoutDAG(nodes: DAGNode[], edges: DAGEdge[]): DAGNode[] {
  if (nodes.length === 0) return [];

  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) || 0) + 1);
    adj.get(edge.from)?.push(edge.to);
  }

  const stages: string[][] = [];
  let currentLevel = nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
  const visited = new Set<string>();

  while (currentLevel.length > 0) {
    stages.push(currentLevel);
    const nextLevel: string[] = [];
    for (const id of currentLevel) {
      visited.add(id);
      for (const neighbor of adj.get(id) || []) {
        const newDeg = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDeg);
        if (newDeg === 0) {
          nextLevel.push(neighbor);
        }
      }
    }
    currentLevel = nextLevel;
  }

  // Handle any orphan / unvisited nodes
  const unvisited = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
  if (unvisited.length > 0) {
    stages.push(unvisited);
  }

  const startX = 60;
  const colSpacing = 270;
  const rowSpacing = 160;

  // Find max stage height to vertically balance columns
  const maxNodesInStage = Math.max(...stages.map((s) => s.length), 1);
  const totalGraphHeight = maxNodesInStage * rowSpacing;

  return nodes.map((node) => {
    let colIdx = 0;
    let rowIdx = 0;
    let stageSize = 1;

    for (let c = 0; c < stages.length; c++) {
      const idx = stages[c].indexOf(node.id);
      if (idx !== -1) {
        colIdx = c;
        rowIdx = idx;
        stageSize = stages[c].length;
        break;
      }
    }

    const x = startX + colIdx * colSpacing;
    const stageHeight = stageSize * rowSpacing;
    const verticalOffset = (totalGraphHeight - stageHeight) / 2;
    const y = 80 + verticalOffset + rowIdx * rowSpacing;

    return {
      ...node,
      position: { x: Math.round(x), y: Math.round(y) },
    };
  });
}

export const NODE_TYPE_INFO: Record<
  DAGNodeType,
  {
    label: string;
    description: string;
    color: string;
    borderColor: string;
    bgColor: string;
    iconName: string;
  }
> = {
  trigger: {
    label: "Trigger",
    description: "Input event or mission directive that initiates swarm execution",
    color: "text-blue-500",
    borderColor: "border-blue-500/40 hover:border-blue-500",
    bgColor: "bg-blue-500/10",
    iconName: "Zap",
  },
  agent: {
    label: "Agent Task",
    description: "Autonomous specialist agent prompt execution with contextual memory",
    color: "text-primary",
    borderColor: "border-primary/40 hover:border-primary",
    bgColor: "bg-primary/10",
    iconName: "Bot",
  },
  parallel_fanout: {
    label: "Fan-Out",
    description: "Broadcasts outputs to multiple concurrent specialist branches",
    color: "text-amber-500",
    borderColor: "border-amber-500/40 hover:border-amber-500",
    bgColor: "bg-amber-500/10",
    iconName: "Split",
  },
  aggregator: {
    label: "Aggregator",
    description: "Reconciles, synthesizes, and unifies parallel deliverables",
    color: "text-purple-500",
    borderColor: "border-purple-500/40 hover:border-purple-500",
    bgColor: "bg-purple-500/10",
    iconName: "Layers",
  },
  condition: {
    label: "Condition",
    description: "Evaluates rules or output quality to dynamically route branches",
    color: "text-cyan-500",
    borderColor: "border-cyan-500/40 hover:border-cyan-500",
    bgColor: "bg-cyan-500/10",
    iconName: "Sliders",
  },
  human_gate: {
    label: "Human Gate",
    description: "Safety sign-off pause requiring operator approval before proceeding",
    color: "text-violet-500",
    borderColor: "border-violet-500/40 hover:border-violet-500",
    bgColor: "bg-violet-500/10",
    iconName: "ShieldCheck",
  },
  code: {
    label: "Code Exec",
    description: "Executes automated script logic, transformation, or tests",
    color: "text-emerald-500",
    borderColor: "border-emerald-500/40 hover:border-emerald-500",
    bgColor: "bg-emerald-500/10",
    iconName: "Code2",
  },
  storage: {
    label: "Vault Storage",
    description: "Permanently archives synthesized deliverables into Obsidian Vault",
    color: "text-indigo-500",
    borderColor: "border-indigo-500/40 hover:border-indigo-500",
    bgColor: "bg-indigo-500/10",
    iconName: "Database",
  },
  end: {
    label: "End Deliverable",
    description: "Final terminal stage and deliverable output milestone",
    color: "text-emerald-500",
    borderColor: "border-emerald-500/40 hover:border-emerald-500",
    bgColor: "bg-emerald-500/10",
    iconName: "CheckCircle2",
  },
};
