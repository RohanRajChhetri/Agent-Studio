import { NextRequest, NextResponse } from "next/server";
import { executeDAGWorkflow } from "@/lib/dag-engine";
import { WORKFLOW_PRESETS } from "@/lib/workflow-presets";
import type { DAGWorkflow } from "@/types/workflow-dag";

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      presets: WORKFLOW_PRESETS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load workflows" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflow, input, approvedGateId } = body;

    if (!workflow || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow payload: nodes and edges are required" },
        { status: 400 }
      );
    }

    const missionInput = (input || "").trim() || "Execute standard swarm objective";

    const result = await executeDAGWorkflow(workflow as DAGWorkflow, missionInput, {
      approvedGateId,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute DAG workflow" },
      { status: 500 }
    );
  }
}
