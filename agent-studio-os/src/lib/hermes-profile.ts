import { hermesExec } from "./hermes-exec";

/** In-memory cache for Hermes profiles */
let cachedProfiles: Array<{ name: string; model: string; gateway: string; isDefault: boolean }> | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25s TTL

export function invalidateProfileCache(): void {
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
