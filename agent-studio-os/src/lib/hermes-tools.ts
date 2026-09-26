import { hermesExec } from "./hermes-exec";

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
    const match = line.match(/(✓ enabled|✗ disabled)\s+(\S+)(?:\s+\S+)?(?:\s+(.+))?/);
    if (match) {
      tools.push({
        id: match[2],
        enabled: match[1].includes("enabled"),
        label: (match[3] || match[2]).trim(),
      });
    }
  }
  return tools;
}
