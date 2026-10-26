import { buildProjectWithAgent, type ExtractedProjectFile } from "./project-generator";
import { type FileTreeNode } from "./project-filesystem";

export interface ProjectBuildJob {
  id: string;
  userId?: string;
  projectName: string;
  projectPath: string;
  prompt: string;
  targetFolder?: string;
  persona?: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  result?: {
    success: boolean;
    response: string;
    createdFiles: ExtractedProjectFile[];
    primaryFile?: { path: string; content: string; language: string };
    projectTree: FileTreeNode[];
    model: string;
    latency: number;
  };
  error?: string;
}

// In-memory job registry that survives page navigations and client disconnects
const jobsMap = new Map<string, ProjectBuildJob>();

/**
 * Creates and starts an asynchronous project build job in the background.
 * Continues running on the server even if the client disconnects or switches pages.
 */
export function startProjectBuildJob(params: {
  userId?: string;
  prompt: string;
  projectName?: string;
  projectPath?: string;
  targetFolder?: string;
  currentFilePath?: string;
  currentCode?: string;
  model?: string;
  persona?: string;
  engine?: "claude-code" | "cloud-architect" | "auto";
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): { job: ProjectBuildJob; promise: Promise<ProjectBuildJob> } {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const projectName = (params.projectName || "workspace").trim();
  const projectBasePath = params.projectPath || `agent-workspace/${projectName}`;

  const job: ProjectBuildJob = {
    id: jobId,
    userId: params.userId,
    projectName,
    projectPath: projectBasePath,
    prompt: params.prompt,
    targetFolder: params.targetFolder,
    persona: params.persona,
    status: "running",
    startedAt: Date.now(),
  };

  jobsMap.set(jobId, job);

  // Background promise execution
  const promise = (async () => {
    try {
      const result = await buildProjectWithAgent({
        prompt: params.prompt,
        projectName,
        projectPath: projectBasePath,
        targetFolder: params.targetFolder,
        currentFilePath: params.currentFilePath,
        currentCode: params.currentCode,
        model: params.model,
        persona: params.persona,
        engine: params.engine,
        history: params.history,
      });

      job.status = "completed";
      job.completedAt = Date.now();
      job.result = result;
      return job;
    } catch (err: unknown) {
      console.error(`[ProjectJobManager] Job ${jobId} failed:`, err);
      job.status = "failed";
      job.completedAt = Date.now();
      job.error = err instanceof Error ? err.message : "Failed to generate project";
      return job;
    }
  })();

  // Prune jobs older than 2 hours
  cleanOldJobs();

  return { job, promise };
}

/**
 * Retrieves a job by ID
 */
export function getProjectBuildJob(jobId: string): ProjectBuildJob | undefined {
  return jobsMap.get(jobId);
}

/**
 * Retrieves the latest running or recently completed job
 */
export function getLatestProjectBuildJob(userId?: string, projectName?: string): ProjectBuildJob | undefined {
  let matched: ProjectBuildJob | undefined = undefined;

  for (const job of jobsMap.values()) {
    if (userId && job.userId !== userId) continue;
    if (projectName && job.projectName !== projectName) continue;

    if (!matched || job.startedAt > matched.startedAt) {
      matched = job;
    }
  }

  return matched;
}

/**
 * Removes old jobs from the map
 */
function cleanOldJobs() {
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  for (const [id, job] of jobsMap.entries()) {
    if (job.startedAt < twoHoursAgo) {
      jobsMap.delete(id);
    }
  }
}
