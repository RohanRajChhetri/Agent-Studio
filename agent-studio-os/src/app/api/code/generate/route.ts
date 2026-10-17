import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/user-auth";
import {
  startProjectBuildJob,
  getProjectBuildJob,
  getLatestProjectBuildJob,
} from "@/lib/project-job-manager";

export async function GET(request: Request) {
  try {
    const userId = await getAuthUserId();
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");
    const active = searchParams.get("active") === "true";
    const projectName = searchParams.get("project") || undefined;

    if (jobId) {
      const job = getProjectBuildJob(jobId);
      if (!job) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }
      if (job.userId && (!userId || job.userId !== userId)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({ job });
    }

    if (active) {
      if (!userId) {
        return NextResponse.json({ job: null });
      }
      const latestJob = getLatestProjectBuildJob(userId, projectName);
      return NextResponse.json({ job: latestJob || null });
    }

    return NextResponse.json({ error: "Missing jobId or active parameter" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to query job status" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      prompt,
      projectName = "default-project",
      projectPath,
      targetFolder,
      currentFilePath,
      currentCode,
      model,
      engine,
      history,
      async: isAsync = false,
    } = body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // Start background job which will run to completion regardless of client connectivity
    const { job, promise } = startProjectBuildJob({
      userId,
      prompt: prompt.trim(),
      projectName,
      projectPath,
      targetFolder,
      currentFilePath,
      currentCode,
      model,
      engine,
      history,
    });

    if (isAsync) {
      return NextResponse.json({
        jobId: job.id,
        status: job.status,
        projectName: job.projectName,
      });
    }

    // Await job completion for synchronous caller
    const completedJob = await promise;

    if (completedJob.status === "failed") {
      return NextResponse.json(
        {
          error: completedJob.error || "Project generation failed",
          success: false,
          jobId: completedJob.id,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...(completedJob.result || {}),
      jobId: completedJob.id,
    });
  } catch (err: any) {
    console.error("[API Code Generate] Error:", err);
    return NextResponse.json(
      {
        error: err.message || "Failed to generate project files",
        success: false,
      },
      { status: 500 }
    );
  }
}

