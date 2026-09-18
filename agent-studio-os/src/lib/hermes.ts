import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs/promises";

const execAsync = promisify(exec);

/** Resolve HERMES_HOME — never hardcode ~/.hermes */
export function getHermesHome(): string {
  return process.env.HERMES_HOME || path.join(process.env.LOCALAPPDATA || process.env.HOME || "", "hermes");
}

/** Execute a hermes CLI command with optional profile scoping */
async function hermesExec(
  args: string,
  profile?: string,
  timeoutMs: number = 30000
): Promise<{ stdout: string; stderr: string }> {
  const env = { ...process.env };
  if (profile) {
    env.HERMES_PROFILE = profile;
  }
  try {
    const result = await execAsync(`hermes ${args}`, {
      env,
      timeout: timeoutMs,
      windowsHide: true,
    });
    return result;
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    throw new Error(
      `Hermes CLI error: ${execError.stderr || execError.message || "Unknown error"}`
    );
  }
}

/** In-memory cache for Hermes profiles */
let cachedProfiles: Array<{ name: string; model: string; gateway: string; isDefault: boolean }> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25s TTL

export function invalidateProfileCache() {
  cachedProfiles = null;
  lastCacheTime = 0;
}

/** List all Hermes profiles (parsed output with in-memory caching) */
export async function listProfiles(forceFresh = false): Promise<
  Array<{ name: string; model: string; gateway: string; isDefault: boolean }>
> {
  const now = Date.now();
  if (!forceFresh && cachedProfiles && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedProfiles;
  }

  const { stdout } = await hermesExec("profile list");
  const lines = stdout.split("\n").filter((l) => l.trim());
  const profiles: Array<{
    name: string;
    model: string;
    gateway: string;
    isDefault: boolean;
  }> = [];

  for (const line of lines) {
    // Parse hermes profile list output: ◆name  model  gateway  alias  distribution
    const match = line.match(/([◆◇])\s*(\S+)\s+(\S+)\s+(\S+)/);
    if (match) {
      profiles.push({
        name: match[2],
        model: match[3],
        gateway: match[4],
        isDefault: match[1] === "◆",
      });
    }
  }

  cachedProfiles = profiles;
  lastCacheTime = Date.now();
  return profiles;
}

/** Create a new Hermes profile */
export async function createProfile(
  name: string,
  opts: {
    cloneFrom?: string;
    description?: string;
    noSkills?: boolean;
  } = {}
): Promise<string> {
  invalidateProfileCache();
  let args = `profile create ${name}`;
  if (opts.cloneFrom) {
    args += ` --clone-from ${opts.cloneFrom}`;
  } else {
    args += " --clone";
  }
  if (opts.description) {
    args += ` --description "${opts.description.replace(/"/g, '\\"')}"`;
  }
  if (opts.noSkills) {
    args += " --no-skills";
  }
  args += " --no-alias";
  const { stdout } = await hermesExec(args);
  invalidateProfileCache();
  return stdout.trim();
}

/** Delete a Hermes profile */
export async function deleteProfile(name: string): Promise<string> {
  invalidateProfileCache();
  const { stdout } = await hermesExec(`profile delete ${name}`);
  invalidateProfileCache();
  return stdout.trim();
}

/** Show profile details */
export async function showProfile(name: string): Promise<string> {
  const { stdout } = await hermesExec(`profile show ${name}`);
  return stdout.trim();
}

/** Set a config value (scoped to profile if provided) */
export async function setConfig(
  key: string,
  value: string,
  profile?: string
): Promise<string> {
  const { stdout } = await hermesExec(`config set ${key} "${value}"`, profile);
  return stdout.trim();
}

/** Enable a toolset for a profile */
export async function enableTool(
  toolId: string,
  profile?: string
): Promise<string> {
  const { stdout } = await hermesExec(
    `tools enable ${toolId} --platform cli`,
    profile
  );
  return stdout.trim();
}

/** Disable a toolset for a profile */
export async function disableTool(
  toolId: string,
  profile?: string
): Promise<string> {
  const { stdout } = await hermesExec(
    `tools disable ${toolId} --platform cli`,
    profile
  );
  return stdout.trim();
}

/** List tools for a profile */
export async function listTools(
  profile?: string
): Promise<Array<{ id: string; enabled: boolean; label: string }>> {
  const { stdout } = await hermesExec("tools list", profile);
  const tools: Array<{ id: string; enabled: boolean; label: string }> = [];

  for (const line of stdout.split("\n")) {
    const match = line.match(/(✓ enabled|✗ disabled)\s+(\S+)\s+\S+\s+(.+)/);
    if (match) {
      tools.push({
        id: match[2],
        enabled: match[1].includes("enabled"),
        label: match[3].trim(),
      });
    }
  }
  return tools;
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

/** Get profile .env path */
export function getProfileEnvPath(profileName?: string): string {
  const home = getHermesHome();
  if (!profileName || profileName === "default") {
    return path.join(home, ".env");
  }
  return path.join(home, "profiles", profileName, ".env");
}

/** Read .env file and return key-value pairs */
export async function readEnvFile(
  envPath: string
): Promise<Record<string, string>> {
  try {
    const content = await fs.readFile(envPath, "utf-8");
    const result: Record<string, string> = {};
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let value = trimmed.slice(eqIdx + 1).trim();
          // Remove surrounding quotes
          if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
          ) {
            value = value.slice(1, -1);
          }
          result[key] = value;
        }
      }
    }
    return result;
  } catch {
    return {};
  }
}

/** Write/update a key in a .env file — ONLY place secrets go */
export async function writeEnvKey(
  envPath: string,
  key: string,
  value: string
): Promise<void> {
  let content = "";
  try {
    content = await fs.readFile(envPath, "utf-8");
  } catch {
    // File doesn't exist yet, we'll create it
  }

  const lines = content.split("\n");
  let found = false;
  const updatedLines = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    updatedLines.push(`${key}=${value}`);
  }

  await fs.writeFile(envPath, updatedLines.join("\n"), "utf-8");
}

/** Describe a profile */
export async function describeProfile(
  name: string,
  description: string
): Promise<string> {
  const { stdout } = await hermesExec(
    `profile describe ${name} "${description.replace(/"/g, '\\"')}"`
  );
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

/** Export a profile to archive */
export async function exportProfile(name: string): Promise<string> {
  const { stdout } = await hermesExec(`profile export ${name}`);
  return stdout.trim();
}

/** Get all profile names */
export async function getProfileNames(): Promise<string[]> {
  const profiles = await listProfiles();
  return profiles.map((p) => p.name);
}
