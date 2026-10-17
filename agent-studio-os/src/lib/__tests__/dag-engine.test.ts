import { describe, it, expect, vi } from "vitest";
import {
  validateDAG,
  getTopologicalStages,
  interpolatePrompt,
  executeDAGWorkflow,
} from "../dag-engine";
import { WORKFLOW_PRESETS } from "../workflow-presets";
import type { DAGWorkflow } from "@/types/workflow-dag";

describe("DAG Workflow Engine", () => {
  it("validates built-in preset workflows as valid acyclic graphs", () => {
    for (const preset of WORKFLOW_PRESETS) {
      const result = validateDAG(preset);
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  it("detects cyclic loops in invalid DAGs", () => {
    const cyclicWorkflow: DAGWorkflow = {
      id: "cyclic-test",
      name: "Cyclic Test",
      description: "Should fail validation",
      category: "Custom",
      createdAt: "",
      updatedAt: "",
      nodes: [
        { id: "A", type: "trigger", title: "A", position: { x: 0, y: 0 }, status: "idle" },
        { id: "B", type: "agent", title: "B", position: { x: 0, y: 0 }, status: "idle" },
        { id: "C", type: "agent", title: "C", position: { x: 0, y: 0 }, status: "idle" },
      ],
      edges: [
        { id: "e1", from: "A", to: "B" },
        { id: "e2", from: "B", to: "C" },
        { id: "e3", from: "C", to: "A" }, // Creates cycle A -> B -> C -> A
      ],
    };

    const result = validateDAG(cyclicWorkflow);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Cycle detected");
  });

  it("organizes parallel branches into the same topological stage for concurrent fan-out", () => {
    const fullstackPreset = WORKFLOW_PRESETS[0];
    const stages = getTopologicalStages(fullstackPreset);

    // Stage 0: trigger
    expect(stages[0].map((n) => n.id)).toEqual(["node-trigger"]);

    // Stage 1: architect
    expect(stages[1].map((n) => n.id)).toEqual(["node-architect"]);

    // Stage 2: fan-out multiplexer
    expect(stages[2].map((n) => n.id)).toEqual(["node-fanout"]);

    // Stage 3: frontend, backend, database (ALL 3 running in parallel simultaneously)
    const fanoutStageIds = stages[3].map((n) => n.id);
    expect(fanoutStageIds).toContain("node-frontend");
    expect(fanoutStageIds).toContain("node-backend");
    expect(fanoutStageIds).toContain("node-database");
    expect(fanoutStageIds.length).toBe(3);

    // Stage 4: aggregator (synthesis after all 3 finish)
    expect(stages[4].map((n) => n.id)).toEqual(["node-aggregator"]);
  });

  it("correctly interpolates prompt placeholders and upstream context", () => {
    const template = "Integrate UI from {{node-a.output}} with API from {{node-b.output}} for topic {{input}}";
    const outputs = {
      "node-a": "Component React JSX",
      "node-b": "Route Handler POST /api/items",
    };

    const interpolated = interpolatePrompt(template, "Build Auth", outputs, ["node-a", "node-b"]);
    expect(interpolated).toContain("Component React JSX");
    expect(interpolated).toContain("Route Handler POST /api/items");
    expect(interpolated).toContain("Build Auth");
  });

  it("executes workflow with parallel fan-out and aggregator synthesis", async () => {
    const workflow: DAGWorkflow = {
      id: "test-run",
      name: "Parallel Fan-Out Test",
      description: "Tests concurrent execution and aggregation",
      category: "Custom",
      createdAt: "",
      updatedAt: "",
      nodes: [
        { id: "n1", type: "trigger", title: "Trigger", position: { x: 0, y: 0 }, status: "idle" },
        { id: "n2", type: "parallel_fanout", title: "Fan-Out", position: { x: 0, y: 0 }, status: "idle" },
        { id: "n3a", type: "agent", title: "Agent Alpha", position: { x: 0, y: 0 }, status: "idle", promptTemplate: "Alpha {{input}}" },
        { id: "n3b", type: "agent", title: "Agent Beta", position: { x: 0, y: 0 }, status: "idle", promptTemplate: "Beta {{input}}" },
        { id: "n4", type: "aggregator", title: "Aggregator", position: { x: 0, y: 0 }, status: "idle", promptTemplate: "Merged" },
        { id: "n5", type: "end", title: "End", position: { x: 0, y: 0 }, status: "idle" },
      ],
      edges: [
        { id: "e1", from: "n1", to: "n2" },
        { id: "e2", from: "n2", to: "n3a" },
        { id: "e3", from: "n2", to: "n3b" },
        { id: "e4", from: "n3a", to: "n4" },
        { id: "e5", from: "n3b", to: "n4" },
        { id: "e6", from: "n4", to: "n5" },
      ],
    };

    const mockCaller = vi.fn().mockImplementation(async (prompt: string) => {
      return `Executed: ${prompt}`;
    });

    const result = await executeDAGWorkflow(workflow, "Test Project", {
      customLlmCaller: mockCaller,
    });

    expect(result.success).toBe(true);
    expect(result.trace.length).toBe(6);
    expect(result.nodeOutputs["n3a"]).toContain("Executed: Alpha Test Project");
    expect(result.nodeOutputs["n3b"]).toContain("Executed: Beta Test Project");
    expect(result.finalDeliverable).toBeDefined();
  });

  it("pauses execution at human approval gate and resumes when approved", async () => {
    const workflow: DAGWorkflow = {
      id: "hitl-test",
      name: "HITL Test",
      description: "Tests human gate pausing",
      category: "Custom",
      createdAt: "",
      updatedAt: "",
      nodes: [
        { id: "start", type: "trigger", title: "Start", position: { x: 0, y: 0 }, status: "idle" },
        { id: "gate", type: "human_gate", title: "Human Review", position: { x: 0, y: 0 }, status: "idle" },
        { id: "after", type: "agent", title: "Deployer", position: { x: 0, y: 0 }, status: "idle" },
      ],
      edges: [
        { id: "e1", from: "start", to: "gate" },
        { id: "e2", from: "gate", to: "after" },
      ],
    };

    // First run: should pause at human gate
    const pausedResult = await executeDAGWorkflow(workflow, "Input Directive");
    expect(pausedResult.success).toBe(false);
    expect(pausedResult.pausedAtNodeId).toBe("gate");

    // Second run: with approvedGateId provided, resumes and completes
    const resumedResult = await executeDAGWorkflow(workflow, "Input Directive", {
      approvedGateId: "gate",
      customLlmCaller: async () => "Deployed successfully!",
    });
    expect(resumedResult.success).toBe(true);
    expect(resumedResult.pausedAtNodeId).toBeUndefined();
    expect(resumedResult.nodeOutputs["after"]).toBe("Deployed successfully!");
  });
});
