import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WORKFLOW_PRESETS } from "@/lib/workflow-presets";
import type { DAGWorkflow } from "@/types/workflow-dag";

const SETTING_KEY = "agent_studio_workflows";

export async function GET(req: NextRequest) {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEY },
    });

    let customWorkflows: DAGWorkflow[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) {
          customWorkflows = parsed;
        }
      } catch (err) {
        console.warn("[API Workflows] Parse error in stored workflows setting:", err);
      }
    }

    // Merge preset workflows with custom workflows
    const presetIds = new Set(WORKFLOW_PRESETS.map((p) => p.id));
    const uniqueCustom = customWorkflows.filter((c) => !presetIds.has(c.id));
    const allWorkflows = [...WORKFLOW_PRESETS, ...uniqueCustom];

    return NextResponse.json({
      success: true,
      workflows: allWorkflows,
      customWorkflows: uniqueCustom,
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
    const workflow: DAGWorkflow = body.workflow || body;

    if (!workflow || !workflow.name || !Array.isArray(workflow.nodes) || !Array.isArray(workflow.edges)) {
      return NextResponse.json(
        { success: false, error: "Invalid workflow format: name, nodes array, and edges array are required" },
        { status: 400 }
      );
    }

    const workflowId = workflow.id || `workflow-${Date.now()}`;
    const sanitizedWorkflow: DAGWorkflow = {
      ...workflow,
      id: workflowId,
      name: workflow.name.trim(),
      description: workflow.description || "Custom multi-agent swarm workflow",
      category: (workflow.category || "Custom") as any,
      createdAt: workflow.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Load existing custom workflows
    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEY },
    });

    let existingCustom: DAGWorkflow[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) existingCustom = parsed;
      } catch {}
    }

    // Upsert the workflow
    const updatedCustom = [
      ...existingCustom.filter((w) => w.id !== workflowId),
      sanitizedWorkflow,
    ];

    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(updatedCustom) },
      create: { key: SETTING_KEY, value: JSON.stringify(updatedCustom) },
    });

    // Log activity
    try {
      await prisma.activityLog.create({
        data: {
          type: "workflow_created",
          message: `Created multi-agent DAG workflow: "${sanitizedWorkflow.name}" (${sanitizedWorkflow.nodes.length} nodes)`,
        },
      });
    } catch {}

    return NextResponse.json({
      success: true,
      workflow: sanitizedWorkflow,
      message: `Workflow "${sanitizedWorkflow.name}" saved successfully`,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to save workflow" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Workflow id is required" },
        { status: 400 }
      );
    }

    const isPreset = WORKFLOW_PRESETS.some((p) => p.id === id);
    if (isPreset) {
      return NextResponse.json(
        { success: false, error: "Built-in preset workflows cannot be deleted" },
        { status: 400 }
      );
    }

    const setting = await prisma.setting.findUnique({
      where: { key: SETTING_KEY },
    });

    let existingCustom: DAGWorkflow[] = [];
    if (setting?.value) {
      try {
        const parsed = JSON.parse(setting.value);
        if (Array.isArray(parsed)) existingCustom = parsed;
      } catch {}
    }

    const filtered = existingCustom.filter((w) => w.id !== id);

    await prisma.setting.upsert({
      where: { key: SETTING_KEY },
      update: { value: JSON.stringify(filtered) },
      create: { key: SETTING_KEY, value: JSON.stringify(filtered) },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow deleted successfully",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete workflow" },
      { status: 500 }
    );
  }
}
