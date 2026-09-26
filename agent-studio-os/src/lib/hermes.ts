/**
 * Agent Studio OS — Hermes Agent CLI Facade
 * 
 * Modular architecture:
 * - hermes-exec.ts: Core CLI child_process execution
 * - hermes-env.ts: Profile environment variables and file I/O
 * - hermes-profile.ts: Profile lifecycle management & caching
 * - hermes-tools.ts: Tooling enablement, disablement, and listing
 */

import { hermesExec } from "./hermes-exec";

export { hermesExec } from "./hermes-exec";

export {
  getHermesHome,
  getProfileEnvPath,
  readEnvFile,
  writeEnvKey,
} from "./hermes-env";

export {
  invalidateProfileCache,
  listProfiles,
  createProfile,
  deleteProfile,
  showProfile,
  describeProfile,
  exportProfile,
  getProfileNames,
} from "./hermes-profile";

export {
  enableTool,
  disableTool,
  listTools,
} from "./hermes-tools";

/** Set a config value (scoped to profile if provided) */
export async function setConfig(
  key: string,
  value: string,
  profile?: string
): Promise<string> {
  const { stdout } = await hermesExec(`config set ${key} "${value}"`, profile);
  return stdout.trim();
}

/** Run a one-shot prompt via hermes -z */
export async function runOneshot(
  prompt: string,
  opts: { model?: string; profile?: string; toolsets?: string } = {}
): Promise<string> {
  let args = `-z "${prompt.replace(/"/g, '\\"')}"`;
  if (opts.model) {
    args += ` -m ${opts.model}`;
  }
  if (opts.toolsets) {
    args += ` -t ${opts.toolsets}`;
  }
  const { stdout } = await hermesExec(args, opts.profile, 120000);
  return stdout.trim();
}

/** Tail logs for a profile */
export async function tailLogs(
  profile?: string,
  lines: number = 50
): Promise<string> {
  try {
    const { stdout } = await hermesExec(
      `logs -n ${lines}`,
      profile,
      10000
    );
    return stdout;
  } catch {
    return "No logs available.";
  }
}
