import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/** Execute a hermes CLI command with optional profile scoping */
export async function hermesExec(
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
