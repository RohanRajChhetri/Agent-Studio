import { describe, it, expect } from "vitest";
import { validateDAGClient, wouldCreateCycle, autoLayoutDAG } from "../dag-utils";
import type { DAGNode, DAGEdge } from "@/types/workflow-dag";

describe("DAG Client Utilities", () => {
  const sampleNodes: DAGNode[] = [
    { id: "A", type: "trigger", title: "A", position: { x: 0, y: 0 }, status: "idle" },
    { id: "B", type: "agent", title: "B", position: { x: 0, y: 0 }, status: "idle" },
    { id: "C", type: "end", title: "C", position: { x: 0, y: 0 }, status: "idle" },
  ];

  it("validates an acyclic workflow correctly", () => {
    const edges: DAGEdge[] = [
      { id: "e1", from: "A", to: "B" },
      { id: "e2", from: "B", to: "C" },
    ];
    const res = validateDAGClient(sampleNodes, edges);
    expect(res.isValid).toBe(true);
    expect(res.stageCount).toBe(3);
    expect(res.hasCycle).toBeUndefined();
  });

  it("detects circular loops in invalid workflows", () => {
    const edges: DAGEdge[] = [
      { id: "e1", from: "A", to: "B" },
      { id: "e2", from: "B", to: "C" },
      { id: "e3", from: "C", to: "A" },
    ];
    const res = validateDAGClient(sampleNodes, edges);
    expect(res.isValid).toBe(false);
    expect(res.hasCycle).toBe(true);
    expect(res.error).toContain("Cycle detected");
  });

  it("prevents connecting edges that would form a cycle", () => {
    const edges: DAGEdge[] = [
      { id: "e1", from: "A", to: "B" },
      { id: "e2", from: "B", to: "C" },
    ];
    expect(wouldCreateCycle(sampleNodes, edges, "C", "A")).toBe(true);
    expect(wouldCreateCycle(sampleNodes, edges, "A", "C")).toBe(false);
    expect(wouldCreateCycle(sampleNodes, edges, "B", "A")).toBe(true);
  });

  it("arranges nodes in clean topological columns with autoLayoutDAG", () => {
    const edges: DAGEdge[] = [
      { id: "e1", from: "A", to: "B" },
      { id: "e2", from: "B", to: "C" },
    ];
    const laidOut = autoLayoutDAG(sampleNodes, edges);
    const nodeA = laidOut.find((n) => n.id === "A")!;
    const nodeB = laidOut.find((n) => n.id === "B")!;
    const nodeC = laidOut.find((n) => n.id === "C")!;

    expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
    expect(nodeB.position.x).toBeLessThan(nodeC.position.x);
  });
});
